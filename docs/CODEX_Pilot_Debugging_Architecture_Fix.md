# Codex Instruction — NeuroScape Pilot Debugging / Architecture Fix

## 0. Purpose

This is a **targeted debugging and architecture-fix pass**, not another full planner rewrite.

Work from the user's **current local checkout** and inspect the code as it exists now. Do **not** assume the remote GitHub branch is fully up to date, because several pilot changes were made locally after the earlier architecture migration.

The current system already includes:

- 10-minute adaptive meditation session;
- guided-breathing calibration baseline;
- 20-second LLM/checkpoint cadence;
- general adaptation cooldown reduced to 5 seconds;
- Semantic Scene Graph;
- Decision 1 + Decision 2 architecture;
- semantic audio candidates;
- deterministic semantic materializer;
- system-generated scene-transition locomotion/footstep cues;
- Base Plan `base_plan_v5_constrained_journey`;
- Decision 2 prompt version around `decision-2-semantic-scene-graph-v10`.

**Do not undo these changes.**

The goal of this pass is to fix the concrete bottlenecks revealed by the latest pilot session.

---

# 1. Pilot session evidence to reproduce before editing

The latest test session was:

```text
participantId: P002
sessionId: session-20260830003158819-d3b9af15
duration: 600000 ms
basePlanVersion: base_plan_v5_constrained_journey
plannerMode: openai
```

Calibration was usable:

```text
qualityStatus: pass
validEpochCount: 29
baselineAvailable: true
```

The observed adaptive sequence was approximately:

```text
80 s   -> forest_bird_far_01
120 s  -> forest_bird_far_02
160 s  -> forest_leaf_rustle_mid_01
200 s  -> forest_bird_far_02
240 s  -> forest_wind_leaves_01
360 s  -> scene transition forest_clearing -> stream_bank
          + forest_water_drop_far_01 (waterfall)
          + system-generated locomotion footsteps
```

The 360-second transition produced a valid projected patch with:

```text
journeyUpdate:
  forest_clearing -> stream_bank
arrivalTimeMs: ~379625

cumulativePatchCount: 6
validation.valid: true
```

The Scene Graph was therefore **not completely inactive**. The problems are downstream and policy-related.

---

# 2. Problems this task must address

Treat these as separate bugs/policy defects. Do not fix one by adding another broad heuristic.

## P0-A. Adaptations stop after cumulative patch count reaches 6

After the sixth applied patch, later Decision 1 calls still returned `adapt`, but no additional audible changes were committed.

The sixth accepted patch showed:

```text
cumulativePatchCount: 6
```

The previous implementation historically had:

```ts
maxCumulativePatches: 6
targetAdaptationsMin: 5
targetAdaptationsMax: 6
```

### Required action

Trace the **current local code** and determine exactly what blocks adaptations after patch 6.

Search for:

```text
maxCumulativePatches
cumulativePatchCount
targetAdaptationsMax
patch budget
adaptation count
validation violation
NO_SAFE_CHANGE
```

Do not merely assume the old config is still responsible.

### Desired behavior

For the pilot, `maxCumulativePatches` must not silently become the main reason the second half of the 10-minute session freezes.

Recommended pilot policy:

```ts
maxCumulativePatches: 10 // TBD_PILOT
```

or an equivalent ceiling that allows continued adaptation while remaining bounded.

If the current architecture has another hard cap, expose and centralize it rather than layering another override.

The session should still be bounded by:

- 20 s decision cadence;
- 5 s general cooldown;
- phase restrictions;
- event/body-anchor density limits;
- source-count/salience limits;
- exact/family cooldowns;
- max scene transitions;
- D1 maintain/adapt judgment.

### Important

Do not convert `targetAdaptationsMax` into a hard stop unless that is explicitly intended. A target and a safety ceiling are conceptually different.

Add an explicit log reason whenever the patch budget blocks an adaptation:

```text
PATCH_BUDGET_EXHAUSTED
```

No silent drop.

---

# 3. P0-B. Planner location and runtime semantic location must never diverge

The accepted Base Plan / planner journey moved to:

```text
forest_clearing -> stream_bank
```

However, the runtime snapshots continued to report:

```text
listener.semanticLocation = forest_clearing
```

after the transition.

This creates two contradictory worlds:

```text
planner current node = stream_bank
runtime listener semantic location = forest_clearing
```

This must be fixed before further Scene Graph tuning.

## Required invariant

After a scene transition is successfully applied and its arrival time is reached:

```text
planner currentNodeId
runtime listener.semanticLocation
runtime journey current segment
last acknowledged journey waypoint
```

must all agree on the same canonical node.

## Required implementation work

Trace the transition lifecycle across:

```text
Decision 2 semantic output
-> materializer
-> FutureScenePatch / journeyUpdate
-> projected Base Plan
-> runtime handoff
-> runtime transition execution
-> acknowledgement
-> runtime world state
-> next DecisionContext
```

Find the exact point where `journeyUpdate.toNodeId` is committed to planner state but not propagated to runtime semantic location.

Do not fix this by simply reading planner state directly in the dashboard. The **runtime world state itself** must become correct.

### Runtime commit semantics

Use one clear transition state machine:

```text
PLANNED
-> TRANSITION_STARTED
-> ARRIVED
-> COMMITTED
```

At minimum:

- before arrival: semantic location remains origin;
- at/after arrival: semantic location becomes destination;
- failed/rejected runtime transition: remain at origin;
- next Decision 1/2 context must use the last successfully committed destination.

If the runtime uses coordinates as well as semantic nodes, keep them synchronized.

---

# 4. P0-C. A scene transition must establish a persistent destination acoustic identity

The successful transition to `stream_bank` used:

```text
forest_body_slow_creek_steps_01  ~5 s
forest_water_drop_far_01         ~16.8 s
```

but after those transient sounds ended, the long-term foundation returned to essentially the same forest bed.

This makes the transition perceptually behave like:

```text
forest
-> footsteps
-> waterfall event
-> forest again
```

instead of:

```text
forest clearing
-> transitional movement
-> water becomes perceptible
-> arrive at stream bank
-> stream-bank acoustic identity persists
```

## Required scene-transition coherence rule

A scene transition is valid only if the destination has a **persistent destination-defining acoustic layer** active after arrival.

For a transition with arrival time `T_arrival`, require at least one eligible destination-defining ambient/long-bed asset that:

1. belongs to the destination node's authored `audio_coverage`;
2. has a real technical runtime record;
3. begins no later than, or shortly after, arrival;
4. remains active for a meaningful stabilization interval after arrival.

Use a centralized pilot parameter, e.g.:

```ts
destinationStabilizationMinMs: 45_000 // TBD_PILOT
```

Do not scatter this number.

## Decision 2 responsibility

For `scene-transition` scope, Decision 2 should normally choose:

- destination node;
- one destination foundation/supporting ambient asset;
- optional transition cue;
- optional suppression/attenuation of an origin-specific layer.

Do **not** require an extra salient event just to make the transition obvious.

## Validator responsibility

Reject a transition if it only contains transient locomotion/events and no persistent destination identity.

Use an explicit violation:

```text
DESTINATION_ACOUSTIC_FOUNDATION_MISSING
```

## Materializer responsibility

Do not invent an ambient asset that Decision 2 did not select unless the current architecture already has an explicitly documented deterministic fallback.

Prefer:

```text
D2 chooses semantic destination foundation
-> code materializes technical playback
```

rather than:

```text
D2 forgets foundation
-> code silently invents one
```

---

# 5. P0-D. Make Stream Bank technically representable

In the pilot trace, `forest_stream_ambient_bed_01` appeared as unavailable because of a missing technical record (`no_technical_record`).

Inspect the current local resources:

```text
packages/contracts/src/audio_library.json
packages/contracts/src/audio_library_synced.json
packages/contracts/src/audio_library_semantic_v1.json
packages/contracts/src/scene_graph_v1.json
```

Determine whether:

```text
forest_stream_ambient_bed_01
```

has a real file-backed technical definition.

### Rules

- If the technical record exists in one of the authored sources, reconcile it into the canonical runtime library.
- If it does not exist, **do not invent** playback metadata.
- `stream_lakeside_river` may be used as the Stream Bank destination foundation if it has valid technical metadata and is semantically appropriate.
- Do not require the waterfall event itself to serve as the persistent Stream Bank foundation.

Add a startup/test validation that every Scene Graph node intended as a reachable destination has at least one technically playable destination-defining ambient/long-bed asset.

If a node fails that test, either:
- mark it temporarily unavailable as a destination; or
- fix the real technical metadata.

Do not silently leave a reachable but acoustically unrenderable node.

---

# 6. P1-A. Scene-transition cooldown must fit a 10-minute / two-transition journey

The pilot's first successful scene transition arrived around:

```text
379.6 s
```

With a 200-second scene-transition cooldown, a second transition becomes eligible only near:

```text
~580 s
```

which is effectively the end/closing period.

That makes paths such as:

```text
forest_clearing -> stream_bank -> waterfall_vicinity
```

or:

```text
forest_clearing -> forest_edge -> beach_shore
```

very difficult to realize within 10 minutes.

## New pilot default

Change to:

```ts
sceneTransitionCooldownMs: 120_000 // TBD_PILOT
maxSceneTransitions: 2
```

Do not reduce `maxSceneTransitions` below 2.

Do not make transitions mandatory.

### Expected timing behavior

A plausible session should support:

```text
first major transition: ~240–360 s
second major transition: ~420–520 s
```

when D1/graph context supports it.

Opening/closing restrictions remain authoritative.

If the current closing policy forbids transitions from 540 s onward, preserve that.

---

# 7. P1-B. Preserve 5-second general cooldown and 20-second checkpoint cadence

The user intentionally changed:

```text
general adaptation cooldown -> 5 seconds
LLM/checkpoint cadence -> 20 seconds
```

Do not revert these to the old 80 s / 40 s values.

However, understand the actual consequence:

```text
20 s checkpoint cadence
```

is still the minimum frequency at which D1 can make a new decision.

The 5 s cooldown is only a hard operational safety floor.

Do not add another hidden deterministic 40–80 s cooldown elsewhere.

If Decision 1 chooses maintain because a recent intervention needs observation time, that is allowed, but it must be an explicit semantic decision rather than an accidental second hard cooldown.

---

# 8. P1-C. D1 should constrain scope/safety, not micromanage D2 into repeated bird/leaf cues

In the pilot, many adaptations had:

```text
intent = gently_reorient_attention
salience = low
scope = within-scene
```

This is not inherently wrong.

The problem is that Decision 1 often generated constraints similar to:

```text
use only one brief natural cue
keep it subtle
preserve forest foundation
do not transition
```

This strongly collapses Decision 2 into repeated:

```text
bird
bird variant
leaf rustle
bird
wind
```

## Required prompt change

Decision 1 `constraints_for_decision_2` must describe:

- maximum scope;
- salience ceiling;
- continuity requirements;
- forbidden operations due to phase/safety;
- whether the adaptation is EEG-informed vs progression-driven;
- any genuinely relevant recent-adaptation constraint.

It should **not normally prescribe**:

- event vs ambient vs action;
- "one bird-like cue";
- "one brief natural event";
- a specific asset family;
- a specific acoustic mechanism.

Add a D1 system instruction similar to:

```text
constraints_for_decision_2 should constrain safety, scope, salience,
continuity, and evidentiary framing. Do not prescribe an audio layer,
asset family, or exact acoustic tactic unless a hard system restriction
requires it. Decision 2 owns semantic sound-design selection.
```

Preserve the scientific caution around EEG.

---

# 9. P1-D. Repeated D1 intent must not imply repeated acoustic treatment

Decision 2 should continue using:

- current Scene Graph node;
- candidate semantics;
- recent asset/family use;
- current active soundscape;
- recent location history;
- capacity.

Add a compact **recent semantic adaptation history**, if not already present:

```ts
recentAdaptations: Array<{
  intent: AdaptationIntent;
  scope: AdaptationScope;
  selectedAssetIds: string[];
  semanticRoles: string[];
  destinationNodeId?: string;
  experiencedAtMs?: number;
}>;
```

Use it only as context.

Do not create a hard rule such as:

```text
if previous = bird, next cannot be bird
```

But update D2 prompt to say that when multiple choices are equally coherent, prefer perceptual/semantic variation over repeating the same treatment.

---

# 10. P1-E. Log every D1=adapt downstream outcome

The 320 s checkpoint is especially important.

At ~320 s, Decision 1 returned a **progression-driven scene-transition adaptation** and D2 timing/validation timestamps existed, but no applied transition was visible from the final outcome. The later 360 s transition succeeded.

This must become fully explainable from logs.

For every `decision=adapt`, record a terminal downstream status:

```ts
type AdaptationTerminalStatus =
  | 'D2_NOT_CALLED'
  | 'D2_NO_SAFE_CHANGE'
  | 'D2_SCHEMA_REJECTED'
  | 'SEMANTIC_SELECTION_REJECTED'
  | 'MATERIALIZATION_FAILED'
  | 'PATCH_VALIDATION_REJECTED'
  | 'PATCH_BUDGET_EXHAUSTED'
  | 'RUNTIME_REJECTED'
  | 'RUNTIME_TIMEOUT'
  | 'APPLIED';
```

Record:

```ts
{
  checkpointTimestampMs,
  adaptationId,
  decision1Intent,
  decision1Scope,
  adaptationBasis,
  terminalStatus,
  failureStage,
  reasonCodes,
  validationViolations,
  destinationNodeId,
  selectedAssetIds
}
```

No D1 adaptation should disappear between logs.

### Required session summary counters

Add:

```text
decision1AdaptCount
decision2CallCount
decision2NoSafeChangeCount
materializationFailureCount
patchValidationRejectCount
patchBudgetRejectCount
runtimeRejectCount
appliedAdaptationCount
sceneTransitionProposedCount
sceneTransitionAppliedCount
```

This is necessary for pilot debugging and later methods reporting.

---

# 11. P1-F. Log applied exposure, not only proposed/selected assets

Keep clear separation between:

```text
LLM selected
materialized
validated
runtime activated
audio actually started
audio finished
```

For each asset, log:

```ts
{
  assetId,
  adaptationId,
  selectedByDecision2: boolean,
  systemGenerated: boolean,
  validated: boolean,
  runtimeActivated: boolean,
  audioStartedAtMs?: number,
  audioFinishedAtMs?: number,
  effectiveExposureMs?: number
}
```

System-generated locomotion footsteps must be marked distinctly, e.g.:

```text
systemGenerated = scene_transition_locomotion
```

Do not count them as an independent LLM adaptation.

---

# 12. Scene-transition locomotion cues: preserve the new behavior, but validate it

The current local system reportedly adds a scene-appropriate movement/footstep cue when moving between Scene Graph nodes.

Do not remove this behavior.

Verify that:

1. locomotion is added only for actual listener scene transitions;
2. it is not added for within-scene events;
3. the chosen locomotion asset is compatible with the edge/destination;
4. it begins during the transition;
5. it stops around arrival;
6. it does not itself define the destination;
7. runtime listener movement/semantic transition agrees with it.

Examples:

```text
forest_clearing -> stream_bank
  forest/creek-compatible footsteps

forest_edge -> beach_shore
  coastal/sand-compatible footsteps when technically available

forest_edge -> city_park
  street/walking-compatible action when technically available
```

Do not invent missing locomotion assets.

If no valid transition locomotion asset exists, the transition may still occur if the architecture allows non-footstep movement representation; log the fallback explicitly.

---

# 13. Destination foundation should survive local transient events

After arriving at a node, later transient events should be layered **on top of** that node's acoustic identity.

Example:

```text
stream_bank foundation:
  stream_lakeside_river (persistent)
  + quieter forest foundation

later local adaptation:
  distant bird OR leaf rustle
```

not:

```text
stream-bank cue ends
-> scene acoustically becomes forest_clearing again
```

The current node should therefore influence which persistent layers are protected/preserved.

Do not make every node a fixed full audio package.

The node still represents a semantic composition, but at least one persistent defining layer must support the node identity.

---

# 14. Do not make progression pressure another forced scheduler

Keep:

```text
low / medium / high progression pressure
```

as Decision 1 context.

High progression pressure should increase the plausibility of a non-corrective transition, but:

- it must not force a transition;
- it must not choose the destination;
- it must not create an EEG claim;
- it must not override closing/cooldown/runtime constraints.

The pilot already demonstrated a useful D1 behavior at ~320 s:

```text
EEG trend improving
+
high progression pressure
->
progression-driven transition considered
```

Preserve this capability.

---

# 15. Parameter set for this debugging pass

Use the user's current local parameters as the base.

The intended pilot defaults after this fix should be approximately:

```ts
checkpointIntervalMs: 20_000,
adaptationCooldownMs: 5_000,

sceneTransitionCooldownMs: 120_000, // changed in this task
maxSceneTransitions: 2,

maxCumulativePatches: 10, // changed in this task, TBD_PILOT

destinationStabilizationMinMs: 45_000, // new, TBD_PILOT
```

Do not change EEG/calibration thresholds in this task.

Do not change the 10-minute phase boundaries unless the current local implementation has already intentionally changed them.

If `maxCumulativePatches` is no longer present, implement the equivalent bounded pilot ceiling only if needed. Do not duplicate controls.

---

# 16. Tests required

Add focused tests before declaring success.

## Patch-budget tests

1. Six applied patches do not automatically freeze the remainder of the session.
2. Patch 7 can be applied when all other constraints allow it.
3. The new configured ceiling is enforced and logged explicitly.
4. `targetAdaptationsMax` is not silently treated as the hard patch ceiling.

## Runtime location tests

5. `forest_clearing -> stream_bank`:
   - before arrival: runtime semantic location = `forest_clearing`;
   - after arrival: runtime semantic location = `stream_bank`.
6. Next DecisionContext sees `stream_bank`.
7. Failed runtime transition leaves both planner and runtime at origin.
8. No planner/runtime location divergence after acknowledgement.

## Destination persistence tests

9. A scene transition containing only transient event + footsteps is rejected.
10. A transition with a valid destination long-bed/foundation is accepted.
11. Destination foundation remains active for at least the configured stabilization interval.
12. Later local event does not erase destination identity.

## Scene transition timing tests

13. With 120 s scene-transition cooldown, two scene transitions can legally occur in one 10-minute session when D1 requests them.
14. More than two transitions are rejected.
15. Closing phase still prevents late transition.

## D1/D2 responsibility tests

16. D1 constraints do not systematically prescribe an audio layer.
17. D2 retains semantic choice among eligible ambient/event/action candidates.
18. Repeated `gently_reorient_attention` does not force repeated bird assets.
19. D2 cannot select non-candidate/non-graph assets.

## Logging tests

20. Every D1 `adapt` has exactly one terminal downstream status.
21. `NO_SAFE_CHANGE` is logged.
22. materialization failure is logged.
23. patch validation rejection and violations are logged.
24. patch-budget rejection is logged.
25. runtime rejection/timeout is logged.
26. applied transition includes origin, destination, transition start, arrival, and runtime semantic location.

## Locomotion tests

27. Scene transition produces compatible locomotion cue when available.
28. Within-scene adaptation does not generate locomotion.
29. Locomotion stops at/near arrival.
30. Locomotion is marked `systemGenerated` and not counted as a separate adaptation.

---

# 17. Replay test modeled on the actual pilot

Create a deterministic replay test that approximates the observed session structure.

It does not need to reproduce GPT text. Stub Decision 1/2 outputs.

Expected sequence:

```text
80   local adaptation
120  local adaptation
160  local adaptation
200  local adaptation
240  local adaptation
320  scene-transition proposal that is rejected or NO_SAFE_CHANGE
360  valid forest_clearing -> stream_bank transition
400+ additional valid within-scene adaptation(s)
~500 second transition may become eligible
```

Assertions:

- system does not freeze at cumulative patch 6;
- 320 rejection has a visible terminal reason;
- 360 transition commits `stream_bank` to runtime;
- persistent Stream Bank foundation remains after transient waterfall/footsteps end;
- later candidates are based on `stream_bank`;
- second transition becomes temporally possible before closing.

---

# 18. Files likely involved

Inspect the current local tree first. Likely areas include:

```text
packages/adaptive-planner/src/config.ts
packages/adaptive-planner/src/engine.ts
packages/adaptive-planner/src/gate.ts
packages/adaptive-planner/src/types.ts
packages/adaptive-planner/src/openai-providers.ts
packages/adaptive-planner/src/audio-retrieval.ts
packages/adaptive-planner/src/semantic-materializer.ts   (or equivalent)
packages/adaptive-planner/src/patching.ts
packages/adaptive-planner/src/base-plan.ts

packages/contracts/src/scene-journey-plan.ts
packages/contracts/src/scene-graph.ts
packages/contracts/src/scene_graph_v1.json
packages/contracts/src/audio_library.json
packages/contracts/src/audio_library_synced.json
packages/contracts/src/audio_library_semantic_v1.json

module-03-runtime-scene-controller/*
study-recorder-server/*
frontend/* only if debug display/log schema requires it
```

Do not modify files just because they are listed here. Follow the actual data path in the local code.

---

# 19. Logging/session bundle improvement

Update the final session bundle so a future analysis can answer, without code archaeology:

```text
How many checkpoints?
How many gate-eligible?
How many D1 maintain/adapt?
How many D2 calls?
How many NO_SAFE_CHANGE?
How many validation rejects?
How many patch-budget rejects?
How many runtime rejects?
How many actually applied adaptations?
How many scene transitions proposed/applied?
Where was the listener semantically over time?
What assets were actually audible?
```

Add a compact per-checkpoint derived table/export if appropriate:

```text
checkpointTimestamp
baselineRelation
trajectory
measurementConfidence
gateEligible
gateReasons
decision1
intent
scope
adaptationBasis
decision2Status
destination
selectedAssets
validationStatus
terminalStatus
runtimeApplied
runtimeSemanticLocation
```

Do not remove the existing raw logs.

---

# 20. Out of scope

Do not use this debugging pass to:

- redesign calibration;
- change TBR computation;
- add new EEG features;
- add new Scene Graph nodes;
- add new audio recordings;
- add a third LLM;
- add embeddings/vector retrieval;
- redesign the control condition;
- change the participant UI;
- tune dozens of audio gain values by hand;
- introduce a fixed route;
- force two scene transitions every session.

---

# 21. Acceptance criteria

This task is complete only when all of the following are true:

1. The system can apply more than six adaptations in a 10-minute pilot if justified.
2. Any hard adaptation ceiling is explicit, centralized, and logged.
3. Planner and runtime semantic location agree after scene transition.
4. A successful scene transition creates a persistent destination acoustic identity.
5. Stream Bank has at least one technically valid persistent foundation or is explicitly unavailable.
6. Scene-transition cooldown is compatible with up to two transitions in 10 minutes.
7. 5 s general cooldown and 20 s checkpoint cadence remain intact.
8. D1 no longer routinely micromanages D2 into a single brief event tactic.
9. Repeated D1 intent can produce semantically varied D2 treatments.
10. Every `D1=adapt` has a visible downstream terminal outcome.
11. Transition locomotion remains scene-compatible and system-generated.
12. No scene transition occurs to a non-adjacent node.
13. No persistent destination is represented only by transient footsteps/event audio.
14. Opening/closing restrictions and deterministic safety limits still work.
15. Existing EEG scientific caution is preserved.
16. Build, typecheck, tests, lint, and formatting pass.

---

# 22. Required commands

From repo root, run the repository's actual scripts. At minimum:

```bash
npm run build
npm run typecheck
npm test
npm run lint
npm run format:check
```

Also run the new replay test.

If the local repo uses a different command for the current pilot branch, document it.

---

# 23. Codex completion report

After implementing, return a concise report containing:

1. root cause of the post-sixth-patch freeze;
2. exact change to patch-budget policy;
3. exact change to scene-transition cooldown;
4. where runtime semantic location is now committed;
5. how origin/destination state synchronization is tested;
6. how destination acoustic persistence is enforced;
7. which asset is now the persistent Stream Bank foundation;
8. whether `forest_stream_ambient_bed_01` had a real technical record;
9. what happened at the replayed 320 s rejected transition;
10. how every D1 adapt is now given a terminal status;
11. changes to D1 constraints/prompt;
12. changes to D2 context/prompt if any;
13. confirmation that 5 s general cooldown and 20 s checkpoint cadence remain;
14. test results;
15. any unresolved issue that still prevents two coherent transitions in one 10-minute session.

Do not report a fix as successful based only on planner JSON. Verify the runtime state and rendered scheduling path as well.

---

# 24. Design principle to preserve

The resulting implementation should still follow:

> **Deterministic code owns measurement validity, operational safety, technical playback, graph adjacency, runtime state, and logging. Decision 1 decides whether and why the soundscape should evolve. Decision 2 decides the smallest semantically coherent local adaptation or adjacent spatial progression. A scene transition is not complete until the runtime arrives at the new semantic node and the destination has a persistent acoustic identity.**
