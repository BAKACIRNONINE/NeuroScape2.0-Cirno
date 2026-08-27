# NeuroScape2.0 — Close the Audible Execution Feedback Loop

## Context

The previous end-to-end audit confirmed that the Validated Plan is now largely authoritative over semantically meaningful audible behavior.

The current main problem is no longer:

> LLM plans A but Runtime silently changes it into B.

The main remaining problem is:

> The system currently treats successful Runtime Plan application as if the participant actually heard the intervention.

This is not valid.

Currently the approximate flow is:

```text
Decision 2
→ validation
→ runtime.applyPlan()
→ acknowledgeApplication("APPLIED")
→ adaptationCount++
→ adaptation history
→ outcome evaluation

while independently:

Runtime activation
→ asset loading
→ Web Audio playback
```

Therefore a Plan may be marked `APPLIED` even if:

- the sound has not reached its scheduled start time;
- the asset is still loading;
- loading fails;
- playback never starts;
- playback starts late;
- playback finishes earlier than expected.

The purpose of this task is to close the:

```text
Runtime
→ Audio Engine
→ Planner / Recording
```

feedback loop.

Do NOT redesign the Planner or Plan/Runtime authority model in this task.

---

# 1. Separate Plan Application from Experienced Intervention

The system must distinguish at least these concepts:

```text
PLANNED
VALIDATED
PLAN_APPLIED
RUNTIME_ACTIVATED
AUDIO_STARTED
AUDIO_FINISHED
AUDIO_FAILED
```

Exact names may follow existing conventions.

Important semantic distinction:

### PLAN_APPLIED

Means:

> The validated Plan was successfully accepted by Runtime.

It does NOT mean that the participant heard the intervention.

### RUNTIME_ACTIVATED

Means:

> Runtime reached the element's scheduled active interval.

It still does NOT prove audio playback started.

### AUDIO_STARTED

Means:

> AudioEngine / SourceManager successfully started actual Web Audio playback.

This is the minimum evidence that the participant experienced the intervention.

### AUDIO_FINISHED

Means:

> Playback actually ended/stopped.

### AUDIO_FAILED

Means:

> The intervention was expected to play but actual audio playback failed.

---

# 2. Do Not Use `APPLIED` as Audible Evidence

Inspect the current code around:

```text
runtime.applyPlan()
planner.acknowledgeApplication(..., "APPLIED")
adaptationCount++
```

Currently this occurs immediately after Runtime accepts the Plan.

Change the semantics so that successful `runtime.applyPlan()` records only:

```text
PLAN_APPLIED
```

or the closest equivalent lifecycle stage.

Do NOT interpret this as an experienced adaptation.

Preserve compatibility where necessary, but make the distinction explicit.

---

# 3. Add Audio Playback Evidence

SourceManager / AudioEngine must expose actual playback lifecycle evidence to the integration/session layer.

For every adaptive sound element, preserve a stable identity across:

```text
Decision 2
→ Patch
→ Plan
→ Runtime element
→ SourceManager
→ Web Audio source
```

Record at minimum:

```ts
{
  adaptationId,
  elementId,
  assetId,
  layer,

  plannedStartMs,
  runtimeActivationMs,
  audioStartMs,

  plannedEndMs,
  runtimeFinishedMs,
  audioEndMs,

  playbackStatus
}
```

Use the existing contracts and naming conventions where possible.

Do not duplicate identifiers unnecessarily.

---

# 4. Record Actual `audioStartMs`

When Web Audio playback actually begins successfully, emit/record:

```text
AUDIO_STARTED
```

with an authoritative session-relative timestamp:

```text
audioStartMs
```

This must represent actual playback scheduling/start as accurately as the current architecture allows.

Do not use:

```text
plannedStartMs
```

or:

```text
runtimeActivationMs
```

as substitutes.

If asset loading causes:

```text
plannedStartMs = 251770
runtimeActivationMs = 251800
audioStartMs = 252430
```

all three values should remain distinguishable.

---

# 5. Record Actual Audio Completion

When playback actually ends or is explicitly stopped, record:

```text
AUDIO_FINISHED
```

with:

```text
audioEndMs
```

Distinguish where possible between:

```text
natural buffer completion
planned end stop
explicit cancellation/replacement
session termination
```

Do not silently treat Runtime `finished` as Audio `finished`.

---

# 6. Persist Audio Failures

Currently loading/decode/playback failures may remain inside SourceManager.

Propagate these failures into session recording.

Examples:

```text
ASSET_LOAD_FAILED
DECODE_FAILED
PLAYBACK_START_FAILED
```

Use existing error types if available.

An intervention that reaches:

```text
PLAN_APPLIED
```

but later fails audio playback must be represented conceptually as:

```text
planApplied = true
experienced = false
audioStatus = failed
```

It must not remain indistinguishable from a successful audible intervention.

---

# 7. Fix Adaptation Counting Semantics

Do not use one ambiguous:

```text
adaptationCount
```

for multiple meanings.

Expose separate metrics where useful:

```text
planAppliedCount
runtimeActivatedAdaptationCount
experiencedAdaptationCount
audioFailedAdaptationCount
```

Most importantly:

```text
experiencedAdaptationCount
```

must only increase after actual `AUDIO_STARTED` evidence.

If one adaptation contains multiple sound elements, inspect the existing adaptation model and define clearly whether "experienced adaptation" means:

- at least one intended adaptive element successfully started; or
- all intended elements successfully started.

Do not choose this silently.

Report the existing structure first and use the interpretation most consistent with the current planner/adaptation semantics.

---

# 8. Fix Adaptation History

Planner adaptation history must distinguish:

```text
Plan accepted
```

from:

```text
Participant experienced intervention
```

Do not put a Plan into the experienced-intervention history merely because:

```text
runtime.applyPlan()
```

succeeded.

If the planner needs Plan application history for cooldown or planning continuity, preserve a separate Plan-level history.

Conceptually:

```text
planApplicationHistory
```

and:

```text
experiencedInterventionHistory
```

should not be treated as equivalent.

Reuse existing structures where possible rather than introducing unnecessary parallel systems.

---

# 9. Gate Outcome Evaluation on Audible Evidence

This is critical.

Current outcome evaluation may evaluate an adaptation after Plan application without proving playback occurred.

Change this behavior.

An adaptation must NOT enter outcome evaluation unless there is actual:

```text
AUDIO_STARTED
```

evidence.

The post-intervention observation window should be anchored to:

```text
audioStartMs
```

rather than only:

```text
plan applied time
planned start
runtime activation
```

Conceptually:

```text
Decision 2
↓
PLAN_APPLIED
↓
RUNTIME_ACTIVATED
↓
AUDIO_STARTED
↓
begin post-intervention observation
↓
collect EEG evidence
↓
evaluate outcome
```

If:

```text
AUDIO_FAILED
```

then:

```text
do not evaluate intervention outcome
```

and record an explicit reason such as:

```text
intervention_not_experienced
```

If the adaptation never reaches `AUDIO_STARTED`, it must never be interpreted as an ineffective intervention.

---

# 10. Persist Evidence in Session Recording

The following evidence must survive session export and later offline analysis.

At minimum, for adaptive elements/interventions:

```text
plannedStartMs
runtimeActivationMs
audioStartMs

plannedEndMs
runtimeFinishedMs
audioEndMs

audio playback status
audio failure reason if applicable
```

Do not keep critical evidence only in SourceManager in-memory diagnostics.

This data must be available after the user study session is complete.

---

# 11. Include Global Ambient in Playback Evidence

The previous audit found that global Ambient sources may be excluded from current SourceManager diagnostics.

Fix the observability path so that playback evidence covers:

```text
global Ambient
localized Ambient
Action
Event
```

Do not require HRTF/spatial diagnostics for a source to have audio lifecycle diagnostics.

Spatial diagnostics and playback diagnostics should be conceptually separable.

---

# 12. Clarify Runtime vs Audio Timing

For every adaptive element, the system should be able to reconstruct:

```text
LLM intended time
        ↓
plannedStartMs

Runtime actually activated
        ↓
runtimeActivationMs

Audio actually started
        ↓
audioStartMs
```

and similarly:

```text
plannedEndMs
runtimeFinishedMs
audioEndMs
```

These timestamps should allow us to calculate:

```text
runtimeSchedulingDelay =
runtimeActivationMs - plannedStartMs
```

and:

```text
audioStartDelay =
audioStartMs - plannedStartMs
```

Do not automatically treat small delays as errors.

The purpose is observability and experimental validity.

---

# 13. Preserve Technical Rendering Architecture

Do NOT redesign or remove the currently valid behavior for:

- HRTF rendering;
- coordinate transforms;
- semantic location mapping;
- listener-relative Action positions;
- explicit distance policy;
- explicit interpolation policy;
- explicit playback policy;
- transition policy;
- 40 ms anti-click ramp;
- Runtime waiting / active / finished scheduling.

These were already audited.

Only modify them if required to expose lifecycle evidence, and keep such changes minimal.

---

# 14. Do Not Modify These Components Semantically

Do NOT change:

- EEG calibration;
- TBR calculation;
- AttentionInterpreter;
- checkpoint interval;
- Decision 1 prompt;
- Decision 1 eligibility;
- Decision 2 reasoning strategy;
- sound candidate retrieval strategy;
- adaptation frequency;
- Base Plan content;
- HRTF perceptual behavior;
- Adaptive vs Non-adaptive experimental design.

This task is specifically:

```text
Runtime
→ Audio
→ playback evidence
→ recording
→ planner lifecycle
→ outcome evaluation
```

---

# 15. Playback Duration Semantics

Also inspect the existing playback duration behavior identified in the previous audit.

Current concern:

```text
Runtime element = active
Audio buffer = already finished
```

Do NOT perform a large playback redesign unless necessary.

First verify the actual semantics of:

```text
natural
truncate-at-end
loop-until-end / equivalent
repeat
```

The minimum requirement is:

> The system must never report that an intervention is audibly ongoing if playback has already ended without recording that fact.

If the current playback contract is ambiguous, report the ambiguity before making a major schema change.

---

# 16. Required Regression Tests

Add tests for at least the following scenarios.

### Test A — Successful audible adaptation

```text
PLAN_APPLIED
→ RUNTIME_ACTIVATED
→ AUDIO_STARTED
→ AUDIO_FINISHED
```

Verify all timestamps are recorded.

### Test B — Future adaptation

Before planned start:

```text
PLAN_APPLIED
experiencedAdaptationCount = 0
```

After actual audio starts:

```text
experiencedAdaptationCount = 1
```

### Test C — Asset load failure

```text
PLAN_APPLIED
→ RUNTIME_ACTIVATED
→ ASSET_LOAD_FAILED
```

Verify:

```text
experiencedAdaptationCount = 0
```

and outcome evaluation is not scheduled.

### Test D — Delayed audio loading

Example:

```text
plannedStartMs = 100000
runtimeActivationMs = 100050
audioStartMs = 100700
```

Verify all three timestamps remain distinct.

### Test E — Outcome gating

Verify outcome evaluation cannot run before `AUDIO_STARTED`.

### Test F — Failed intervention

Verify failed audio playback produces:

```text
intervention_not_experienced
```

or equivalent explicit status rather than an `inconclusive` effectiveness result.

### Test G — Global Ambient

Verify global Ambient produces audio lifecycle evidence even though it does not use HRTF.

### Test H — Session persistence

Export/reload a recorded session and verify actual audio lifecycle timestamps remain available.

---

# 17. Final Verification

After implementation, run a simulated end-to-end adaptive intervention and show a trace similar to:

```text
adaptationId: adaptation-04

Decision 1:
support_grounding

Decision 2:
body_slow_breath_01

PLAN_APPLIED:
220150 ms

plannedStartMs:
251770 ms

RUNTIME_ACTIVATED:
251802 ms

AUDIO_STARTED:
251934 ms

plannedEndMs:
257770 ms

RUNTIME_FINISHED:
257801 ms

AUDIO_FINISHED:
257806 ms

experienced:
true

includedInOutcomeEvaluation:
true
```

Also simulate failure:

```text
adaptationId: adaptation-05

PLAN_APPLIED:
380100 ms

plannedStartMs:
411610 ms

RUNTIME_ACTIVATED:
411645 ms

AUDIO_FAILED:
411700 ms

experienced:
false

includedInOutcomeEvaluation:
false
```

---

# Implementation Process

Before editing:

1. Trace the existing path from `runtime.applyPlan()` to `SourceManager` playback.
2. Identify the smallest place to emit audio lifecycle evidence.
3. Identify how to propagate it back to:
   - AdaptiveIntegrationHarness;
   - SessionRecorder;
   - planner/adaptation history;
   - outcome evaluator.
4. Report the proposed lifecycle/data-flow change briefly.
5. Then implement it.

Avoid unrelated refactoring.

After implementation report:

- files changed;
- lifecycle contract changes;
- recording schema changes;
- how `AUDIO_STARTED` is detected;
- how `AUDIO_FINISHED` is detected;
- how audio failure is propagated;
- how experienced adaptation count is calculated;
- how outcome evaluation is gated;
- backward compatibility impact;
- tests added;
- complete test results;
- any remaining case where `PLAN_APPLIED` could still be confused with actual audible playback.

The success criterion is:

> After a session, we can prove from saved data whether each LLM-planned intervention was actually heard, when it started, when it ended, and whether it was eligible for outcome evaluation.