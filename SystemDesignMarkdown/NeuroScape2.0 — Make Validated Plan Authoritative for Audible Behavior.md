# NeuroScape2.0 — Make Validated Plan Authoritative for Audible Behavior

## Goal

We want to enforce the following architectural principle:

> The Validated Plan is authoritative over all semantically meaningful audible behavior. Runtime and Audio Engine may only perform deterministic technical realization.

The previous fixes correctly improved fidelity for:
- future Action materialization,
- `startMs` / `endMs`,
- direct gain propagation,
- Event timing,
- and prevention of premature activation.

However, the recent audit shows that several downstream components still make audible or semantic decisions that are not represented in the Validated Plan.

This task should address those remaining authority-boundary issues.

Do **not** blindly delete all downstream processing. First distinguish:

1. **semantic/audible decisions** that should be controlled by the Validated Plan or an explicit playback contract;
2. **technical rendering operations** that may remain deterministic implementation details.

---

## Architectural Rule

The following properties should be determined explicitly by the Validated Plan or an explicit validated playback contract when they materially affect what the participant hears:

- `assetId`
- layer
- start time
- end time / intended active duration
- gain
- position
- spatial mode
- movement path
- movement interpolation policy
- distance behavior / attenuation policy
- transition / fade behavior
- loop behavior
- repeat count
- per-repeat behavior
- playback duration policy

Runtime should not silently invent or change these decisions.

The desired flow is:

```text
EEG / Context
    ↓
LLM reasoning
    ↓
LLM Scene Patch
    ↓
Deterministic Validator
    ↓
Validated Plan / Playback Contract
    ↓
Deterministic Runtime Scheduler
    ↓
Audio / HRTF Renderer
```

---

## 1. Remove hidden Action suppression

Current behavior:

Foot-attached Actions may be suppressed when the listener is stationary, even if the Validated Plan says the Action should be active.

This is a hidden runtime decision about whether an intervention occurs.

Required behavior:

- Runtime must not suppress an otherwise valid Action based on listener movement unless this rule is explicitly represented in the Plan.
- If movement-dependent activation is a legitimate design concept, expose it explicitly, for example through a validated field such as:

```ts
activationCondition:
  | "always"
  | "listener-moving"
```

Do not keep implicit suppression logic.

---

## 2. Make distance attenuation explicit

Current behavior:

Localized Ambient and Event sounds use a hard-coded runtime distance attenuation curve with a gain floor.

This means:

```text
validated gain
↓
runtime distance attenuation
↓
actual audible gain
```

The final audible gain is therefore not fully specified by the Plan.

Required behavior:

Decide on one explicit architecture.

Preferred approach:

Represent distance behavior in the validated contract, for example:

```ts
distanceModel: {
  mode: "none" | "inverse" | "custom",
  referenceDistance?: number,
  maxDistance?: number,
  minGain?: number
}
```

The exact schema should fit the current system.

Runtime may compute the attenuation mathematically, but it must not choose the attenuation policy itself.

If NeuroScape currently does not need perceptual distance attenuation, use an explicit `"none"` policy rather than retaining a hidden curve.

---

## 3. Make movement interpolation explicit

Current behavior:

Event movement uses hard-coded `smoothstep` interpolation between validated waypoints.

The waypoints are planner-authored, but the movement behavior between them is runtime-authored.

Required behavior:

Expose interpolation policy in the Plan or movement contract.

For example:

```ts
movement: {
  waypoints: [...],
  interpolation: "linear" | "smoothstep"
}
```

Runtime may implement the interpolation deterministically.

The important distinction is:

> Runtime implements the chosen movement model; it does not choose it.

---

## 4. Stop Runtime from rewriting active trajectories

Current behavior:

When an active Event is updated, Runtime may:

- rebase from current position,
- remove previous waypoints,
- inject a new waypoint at merge time.

This changes the validated trajectory.

Required behavior:

Do not silently rewrite planner-authored trajectories.

If active trajectory updates require continuity handling, make the behavior explicit.

Possible strategies include:

```ts
trajectoryUpdatePolicy:
  | "replace-at-effective-time"
  | "continue-from-current-position"
```

If continuity correction is technically necessary, it must be represented and observable rather than silently authored by Runtime.

---

## 5. Make replacement timing authoritative

Current behavior:

When asset, spatial mode, attachment, or position changes, Runtime fades out the previous object before creating the replacement.

As a result, the new configuration may begin later than the validated effective time.

Required behavior:

The validated transition specification must determine the audible transition timing.

Represent transition semantics explicitly, for example:

```ts
transition: {
  mode: "immediate" | "crossfade",
  fadeInMs: number,
  fadeOutMs: number,
  curve: "linear" | "equal-power"
}
```

If the validated Plan says the new state becomes effective at time `T`, Runtime must not silently shift that effective time.

Crossfading is allowed, but its timing must be part of the validated contract.

---

## 6. Move audible fade semantics out of hidden Runtime logic

Current behavior:

Runtime applies activation, gain-change, removal, and pre-end fades.

Some Event fades additionally derive duration using logic such as:

```ts
min(defaultDurationMs, durationMs / 2)
```

This changes the actual gain envelope independently of the planner.

Required behavior:

Separate:

### Semantic fades

Any fade that materially shapes the adaptation should be explicit in the validated transition contract.

### Technical anti-click ramps

Very short fixed ramps used only to prevent audio clicks may remain an Audio Engine implementation detail.

For example, the current ~40 ms gain ramp may remain if it is purely anti-click and not intended as perceptual scene design.

Document this distinction clearly in code.

Do not let technical ramps become adaptation-level envelopes.

---

## 7. Make repeat behavior explicit

Current behavior:

Burst assets receive:

- repeat count selected downstream from a hash,
- deterministic but unplanned per-repeat gain variation.

This is audible scene generation happening after validation.

Required behavior:

Remove downstream-authored repeat variation.

Represent repeat behavior explicitly in the validated playback contract, for example:

```ts
playback: {
  mode: "once" | "loop" | "repeat",
  repeatCount?: number,
  repeatIntervalMs?: number,
  perRepeatGain?: number[]
}
```

Do not generate repeat count or gain sequences from runtime IDs unless the Plan explicitly requests that behavior.

---

## 8. Make loop and duration semantics explicit

Current behavior:

Looping is selected from asset metadata rather than the Validated Plan.

A non-looping audio file may finish before `endMs`, while the Runtime element remains active.

This creates an invalid state:

```text
runtime active
audio silent
```

Required behavior:

Introduce an explicit playback-duration policy.

For example:

```ts
durationPolicy:
  | "natural"
  | "loop-until-end"
  | "truncate-at-end"
```

The exact design may differ, but the system must define what should happen when:

```text
buffer duration < planned active duration
```

and when:

```text
buffer duration > planned active duration
```

The outcome must not be decided implicitly by asset metadata.

---

## 9. Handle asset loading latency correctly

Current behavior:

Audio playback begins after asynchronous asset loading, scheduled relative to current `AudioContext.currentTime`.

This can shift actual audible start time later than the authoritative session `startMs`.

Required behavior:

Prefer preloading all assets that may be used during the session if feasible.

At minimum, record separately:

```text
plannedStartMs
runtimeActivationMs
audioStartMs
```

If audio cannot start at the planned time due to loading latency:

- do not pretend execution was exact;
- record the delay explicitly;
- use actual audible start time for later intervention/outcome analysis.

Do not silently redefine the Plan timing.

---

## 10. Preserve technical transformations that are already correct

Do **not** remove or rewrite the following unless necessary:

### Semantic location resolution

```text
locationId
→ deterministic worldPosition
```

This is a faithful coordinate resolution.

### Listener-relative Action transforms

Rotating `relativePosition` by listener orientation and adding listener position is a faithful implementation of a listener-attached coordinate system.

### HRTF coordinate conversion

World-space to listener-space transformation is a technical rendering operation.

HRTF DSP is allowed to determine binaural filtering.

### Layer preservation

Ambient / Action / Event should remain in their validated layer.

### `assetId`

The exact validated asset should continue to be used.

---

## 11. Define the authority boundary explicitly in code

Please add a short architecture comment or documentation section describing the rule:

> Semantically meaningful audible behavior must originate from the Validated Plan or validated playback contract. Runtime may resolve coordinates, interpolate according to an explicit policy, schedule playback, and perform technical DSP, but it must not independently author adaptation behavior.

This should make future regressions easier to identify.

---

## 12. Tests

Add regression tests covering at least the following.

### Action activation fidelity

A validated Action must not be suppressed merely because the listener is stationary unless the validated activation policy explicitly requires movement.

### Distance policy

Verify that Runtime uses the validated distance policy rather than an implicit default attenuation curve.

### Interpolation

Verify that movement interpolation matches the validated interpolation mode.

### Trajectory updates

Verify that Runtime does not silently rewrite an active validated trajectory outside the explicit update policy.

### Replacement timing

Verify that a replacement becomes effective according to the validated transition timing.

### Repeat behavior

Verify that repeat count and per-repeat gain are not generated downstream unless present in the validated contract.

### Loop/duration

Verify behavior for:

```text
buffer shorter than planned interval
```

and:

```text
buffer longer than planned interval
```

### Audio start timing

Verify that planned start, runtime activation, and actual audio start remain separately observable.

---

## Important constraint

Do not make the LLM control low-level DSP details unnecessarily.

The objective is NOT:

> “LLM controls every implementation parameter.”

The objective is:

> “LLM / Validated Plan controls every semantically meaningful scene decision, while deterministic code faithfully realizes it.”

For example, HRTF convolution, coordinate transforms, buffer decoding, and a minimal anti-click ramp may remain technical implementation details.

---

## Before modifying

First inspect the existing architecture and report:

1. which current behaviors violate this authority boundary;
2. which are legitimate technical rendering details;
3. which new contract fields are actually necessary;
4. whether any existing fields such as `transitionPolicy`, movement definitions, or asset metadata can be reused instead of introducing duplicate concepts.

Then implement the smallest coherent contract-level refactor.

Avoid piecemeal deletion of downstream logic if the corresponding semantic behavior still needs to exist.

---

## Final report

After implementation, report:

- files changed;
- contract/schema changes;
- hidden runtime decisions removed;
- technical renderer behavior intentionally retained;
- backward compatibility impact;
- migration needed for existing Base Plans;
- tests added;
- all test results;
- any remaining audible behavior that is still not fully specified by the Validated Plan.