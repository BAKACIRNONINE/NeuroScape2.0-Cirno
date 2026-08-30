# Codex Instruction — NeuroScape Perceptual Audio & Spatial Transition Refinement v2

## 0. Purpose

This is a **targeted perceptual/runtime refinement pass** based on two recent pilot sessions from different participants.

Do **not** redesign the EEG pipeline, calibration logic, TBR interpretation, Scene Graph topology, or the two-stage LLM architecture.

The two pilots show meaningfully different participant-specific Decision 1 behavior, but they converge on similar downstream rendering/runtime problems. Therefore this task should focus on:

1. event playback reliability and audibility;
2. scene-transition atomicity and rollback;
3. 20–30 second embodied edge traversal;
4. destination acoustic identity and route diversity;
5. only after the above is reliable, progression timing.

Core principle:

> **Do not increase adaptation proposal frequency to compensate for unreliable execution. First make every accepted adaptation perceptually real, every failed transition cleanly reversible, and every successful transition spatially legible.**

---

# 1. Evidence from the two pilot sessions

## Pilot A — P002

Known observations:

- calibration passed with 29 valid epochs;
- Decision 1 generated multiple EEG-informed local adaptations;
- local event selections included birds and leaf rustle;
- some selected bird events reached planner/runtime activation state but did not produce reliable `AUDIO_STARTED`;
- leaf rustle was audible only briefly and weakly;
- one `forest_clearing -> dense_forest` scene transition proposal failed because the current base ambient was not suppressible;
- a later `forest_clearing -> stream_bank` transition succeeded;
- runtime semantic location eventually committed correctly to `stream_bank`;
- scene-transition locomotion/footstep exposure was only a few seconds;
- the first successful spatial transition happened late enough that a second transition was effectively unavailable before closing.

## Pilot B — P003

Session:

```text
participantId: P003
sessionId: session-20260830020826115-23439dd6
duration: 600000 ms
basePlanVersion: base_plan_v5_constrained_journey
plannerMode: openai
```

Calibration:

```text
qualityStatus: pass
validEpochCount: 29
baselineAvailable: true
baselineLogTbr: 0.24784266680150624
```

This differs substantially from P002's baseline, so the two sessions should not be treated as equivalent EEG cases.

Observed P003 planner behavior:

```text
checkpointCount        ≈ 26
gateEligibleCount      ≈ 25

Decision 1:
maintain               ≈ 17
adapt                  ≈ 8

Decision 2 calls       ≈ 8

scene transitions:
proposed               = 4
applied                = 0
```

Important pattern:

- P003's adapt decisions were largely / entirely progression-driven rather than corrective EEG-driven;
- the first scene-transition proposal occurred around ~340 s;
- later transition attempts recurred around ~520–560 s;
- multiple transition attempts targeted `stream_bank`;
- at least two transition attempts ended with runtime timeout;
- later attempts produced `DESTINATION_ACOUSTIC_FOUNDATION_MISSING`;
- despite failed transitions, destination river audio was audibly activated for non-trivial periods;
- runtime semantic location did not successfully commit to the destination.

This demonstrates that the main bottleneck is not simply "Decision 1 does not trigger enough transitions."

---

# 2. What this second pilot changes about priorities

The earlier refinement plan was directionally correct, but priority order must change.

## New priority order

### P0
1. Event playback lifecycle and audibility
2. Scene-transition **atomicity / rollback / runtime reconciliation**
3. 20–30 second embodied edge traversal

### P1
4. Destination acoustic identity and route diversity
5. Progression timing, only after transition execution is reliable

Do not start by making progression pressure more aggressive.

If transition execution can timeout, partially apply destination audio, or leave runtime state inconsistent, increasing transition frequency will make the experience worse.

---

# 3. Keep these architecture boundaries unchanged

Preserve:

```text
EEG
→ deterministic interpretation / gating
→ Decision 1: whether / why / scope
→ Decision 2: semantic destination + sound choice
→ deterministic materializer
→ deterministic validator
→ runtime
```

Preserve the user's current intended pilot settings unless this document explicitly changes them:

```ts
checkpointIntervalMs: 20_000
adaptationCooldownMs: 5_000
sceneTransitionCooldownMs: 120_000
maxSceneTransitions: 2
```

Do not:

- add a third LLM;
- redesign calibration;
- change TBR formulas;
- add Scene Graph nodes;
- add new audio recordings;
- introduce destination numeric weighting;
- create fixed routes;
- force one or two scene transitions per session;
- change the 10-minute study duration;
- use random destination sampling as a shortcut.

---

# 4. P0-A — Event playback lifecycle must be reliable

Two different pilot sessions show the same class of problem:

```text
D2 selects event
→ semantic materialization succeeds
→ runtime activation appears
→ AUDIO_STARTED is missing or event is not perceptually heard
```

This is now a confirmed runtime issue.

Inspect the full path for short event assets, especially:

```text
forest_bird_far_01
forest_bird_far_02
forest_leaf_rustle_mid_01
```

Trace:

```text
semantic selection
→ materialized element
→ asset load / decode
→ source creation
→ scheduled start
→ spatial source activation
→ gain envelope
→ AUDIO_STARTED
→ AUDIO_FINISHED
→ cleanup
```

## Required invariant

Every applied one-shot event must end in exactly one terminal audio outcome:

```ts
type AudioPlaybackTerminalStatus =
  | 'PLAYED'
  | 'ASSET_LOAD_FAILED'
  | 'SOURCE_CREATION_FAILED'
  | 'AUDIO_START_FAILED'
  | 'RUNTIME_CANCELLED';
```

No "runtimeActivated but silently never started."

Log:

```ts
{
  assetId,
  adaptationId,
  materializedAtMs,
  runtimeActivatedAtMs,
  audioStartedAtMs,
  audioFinishedAtMs,
  playbackTerminalStatus,
  failureReason
}
```

---

# 5. P0-B — Short-event envelope must be separate from scene-transition timing

Do not use the same generic ~5 s transition/fade timing for a 6–8 s one-shot event.

The short event must contain a perceptually meaningful audible plateau.

Recommended centralized pilot defaults:

```ts
shortEventFadeInMs: 750,                  // TBD_PILOT
shortEventFadeOutMs: 1000,                // TBD_PILOT
shortEventMinimumAudiblePlateauMs: 3000,  // TBD_PILOT
```

Use actual source duration.

Do not stretch audio.

## Materialization invariant

For a one-shot event:

```text
fade in
→ audible plateau
→ fade out
```

and:

```text
sourceDuration >= fadeIn + plateau + fadeOut
```

If a source cannot satisfy this, shorten the fades, not the audible plateau to zero.

Longer environmental landmarks such as waterfall may keep separate authored fade policies.

---

# 6. P0-C — Add foreground audibility protection

A low-salience event should remain subtle, but it must still be detectable.

Do not solve this by applying a global `eventGain *= 2`.

Implement a centralized deterministic foreground audibility guard.

It should consider:

1. authored recommended event gain;
2. current dominant ambient gain;
3. current salience request;
4. asset max-safe gain;
5. optional precomputed source loudness normalization.

Conceptually:

```text
minimal salience
= subtle but detectable

low salience
= clearly perceptible without dominating

moderate salience
= foreground-present but not startling
```

If technically feasible, add offline/precomputed per-asset loudness metadata:

```text
RMS and/or LUFS
normalizationGain
```

Keep:

```text
source normalization gain
```

separate from:

```text
planner/materializer mix gain
```

Do not perform expensive continuous loudness analysis inside the live runtime loop.

---

# 7. P0-D — Scene transitions must be atomic transactions

This is the most important new requirement from P003.

A failed scene transition must never leave the system in a half-transitioned state such as:

```text
semantic location = forest_clearing
BUT
stream destination ambience is already playing
AND
transition terminal status = RUNTIME_TIMEOUT
```

Treat a scene transition as a transaction.

## Required state machine

Implement or formalize:

```text
PLANNED
→ DEPARTING
→ TRAVERSING
→ APPROACHING
→ ARRIVED
→ COMMITTED
```

Failure path:

```text
PLANNED / DEPARTING / TRAVERSING / APPROACHING
→ FAILED
→ ROLLBACK
→ ORIGIN_RESTORED
→ ABORTED
```

If the transition fails before commit:

- semantic location remains origin;
- origin persistent mix is restored;
- destination temporary layers are stopped/faded out;
- locomotion is stopped;
- pending journey waypoint is removed;
- projected Base Plan and actual runtime are reconciled;
- transition does not increment applied scene-transition count;
- progression timer is not reset as if arrival succeeded.

---

# 8. Transition commit must have one authoritative boundary

Define one authoritative commit condition.

Recommended:

> A transition is committed only after the runtime reports ARRIVED and the destination persistent acoustic identity is active.

At that point update together:

```text
runtime listener.semanticLocation
planner currentNodeId
journey current waypoint / segment
applied scene-transition history
secondsSinceLastSpatialProgression reset
```

Before commit:

```text
current semantic location = origin
```

Do not let planner journey advance earlier than runtime arrival.

---

# 9. P0-E — Failed transition must rollback destination audio

The latest pilot shows destination audio can remain audible despite `RUNTIME_TIMEOUT`.

Fix this explicitly.

For every transition, track all transition-owned runtime elements:

```ts
transitionOwnedElementIds: string[]
```

Examples:

- destination foundation preview;
- supporting destination ambience;
- transition cue;
- system-generated footsteps;
- optional breath cue;
- temporary origin attenuation automation.

On failure:

```text
cancel future activations
fade/stop already-started destination elements
restore origin gains
stop locomotion
clear transition-owned automation
```

Use a short deterministic rollback fade rather than an abrupt cut when possible.

Suggested:

```ts
transitionRollbackFadeMs: 1500–3000 // TBD_PILOT
```

---

# 10. P0-F — Add transition recovery / retry backoff

P003 repeatedly attempted similar transitions after a timeout.

Do not allow immediate repeated transition proposals while runtime state is still reconciling.

Add explicit transition recovery state:

```text
READY
TRANSITION_IN_PROGRESS
RECOVERING
READY
```

While `RECOVERING`:

```text
allowSceneTransition = false
```

Recovery ends only when:

```text
no transition-owned destination element remains unexpectedly active
origin mix is restored
runtime semantic location == planner semantic location
no pending journey transition exists
```

Add a minimum recovery interval only as a secondary safeguard, e.g.:

```ts
sceneTransitionRecoveryMs: 20_000 // TBD_PILOT
```

But state reconciliation, not the timer alone, should determine readiness.

Do not count recovery as the normal scene-transition cooldown.

---

# 11. P0-G — Diagnose transition runtime timeout root cause

Do not hide P003's timeout by simply increasing timeout duration.

Trace the transition acknowledgement path.

Determine whether timeout occurs because:

- arrival acknowledgement is not emitted;
- transition duration exceeds an old timeout;
- runtime semantic location commit is delayed;
- destination foundation acknowledgement is missing;
- locomotion end condition never resolves;
- planner waits on an obsolete lifecycle signal;
- scene transition has multiple competing completion conditions.

The new 20–30 s traversal will make this even more important.

Set any transition timeout relative to traversal duration, e.g. conceptually:

```ts
sceneTransitionRuntimeTimeoutMs
  = sceneTraversalDurationMs
  + runtimeCommitGraceMs
```

rather than a hardcoded timeout shorter than the intended traversal.

Keep a clear failure reason.

---

# 12. P0-H — 20–30 second Scene Graph edge traversal

A scene transition should be experienced as traversing an edge.

Replace short node switching with a first-class temporal choreography.

Recommended pilot:

```ts
sceneTraversalDurationMs: 25_000 // TBD_PILOT
```

or a bounded 20–30 s deterministic range.

D2 chooses the semantic transition.

Deterministic runtime owns timing.

## Transition phases

Conceptual 25-second traversal:

```text
0–5 s
DEPARTING
origin remains dominant
destination may become faintly audible

5–15 s
TRAVERSING
locomotion active
origin decreases
destination grows

15–22 s
APPROACHING
destination becomes dominant
origin recedes
movement continues / begins to reduce

22–25 s
ARRIVAL
locomotion fades out
destination stabilizes
commit semantic location
```

Use centralized phase proportions rather than per-edge copied timings.

---

# 13. P0-I — Origin/destination ambience must crossfade

The transition should produce perceptual movement through changing acoustic composition.

Example:

```text
forest_clearing -> stream_bank

forest_ambient_bed_01
  gradually decreases

stream_lakeside_river
  starts faint / distant
  gradually increases

footsteps
  span the movement phase
```

At arrival:

```text
stream destination identity remains persistent
footsteps end
origin no longer dominates
```

For:

```text
forest_clearing -> dense_forest
```

prefer deterministic attenuation / crossfade:

```text
forest_ambient_bed_01 ↓
forest_ambient_bed_02 ↑
```

Do not reject the transition solely because the base ambient is globally marked non-suppressible.

A protected base ambient may be **temporarily attenuated by a validated scene transition** without making it globally suppressible to arbitrary local adaptation.

---

# 14. P0-J — Locomotion must span meaningful traversal time

The existing scene-transition footstep behavior is conceptually useful but too short.

Do not bind footsteps to the old 5-second transition duration.

If the footstep source is ~8 s:

- play according to its real contract;
- if authored looping/repetition is allowed, repeat sparsely;
- otherwise schedule multiple legal segments with pauses;
- never time-stretch;
- never invent a nonexistent recording.

Desired result:

```text
participant perceives sustained slow movement
```

not:

```text
brief footstep cue
```

Mark all automatically scheduled locomotion segments:

```text
systemGenerated = scene_transition_locomotion
```

They belong to one scene transition and must not count as separate adaptations.

---

# 15. P1-A — Optional breathing as embodied navigation support

Breathing and footsteps are not interchangeable.

```text
footsteps = locomotion through external space
breathing = body-relative anchor
```

Allow D2 to express a conceptual preference such as:

```ts
embodiedTransitionSupport:
  | 'none'
  | 'breath'
  | 'locomotion'
  | 'breath_and_locomotion'
```

Deterministic runtime decides exact playback timing.

Breathing must not become mandatory.

Do not interpret breathing as evidence of EEG state.

A possible transition:

```text
origin ambience
→ breath softly emerges
→ footsteps begin
→ destination approaches
→ footsteps end
→ breath briefly remains
→ destination stabilizes
```

---

# 16. P1-B — Destination acoustic identity must be persistent

A successful scene transition requires a perceptually recognizable destination after arrival.

A destination identity may come from either:

```text
foundation
```

or:

```text
persistent supporting ambient
```

Do not require every node to own a unique dedicated foundation recording.

Transition acceptance requires:

1. at least one technically playable persistent destination-defining layer;
2. it is active at/after arrival;
3. it remains for a meaningful stabilization interval.

Suggested:

```ts
destinationStabilizationMinMs: 45_000 // TBD_PILOT
```

Do not treat a transient waterfall event or footsteps alone as destination identity.

---

# 17. P1-C — Resolve Stream Bank retry/foundation inconsistency

P003 showed an important inconsistency:

- earlier transition attempts could audibly start river ambience;
- later retries could fail with `DESTINATION_ACOUSTIC_FOUNDATION_MISSING`.

Do not simply weaken the validator.

Add a regression test around failed transition cleanup:

```text
1. forest_clearing -> stream_bank proposed
2. destination river starts
3. transition times out
4. rollback completes
5. runtime returns to clean forest_clearing
6. wait until transition recovery completes
7. propose forest_clearing -> stream_bank again
8. validator sees clean destination foundation availability
9. transition can proceed normally
```

If the validator still reports missing foundation after clean rollback, fix the real source-of-truth/state bug.

---

# 18. P1-D — Strengthen Forest Edge representation

Do not add route weights.

Current route bias is largely representational.

From `forest_clearing`, likely adjacent candidates are:

```text
dense_forest
stream_bank
forest_edge
```

`dense_forest` and `stream_bank` have clearer distinct acoustic identities.

Strengthen `forest_edge` with existing assets.

Recommended composition:

```text
forest_ambient_bed_01
  attenuated

forest_wind_leaves_01
  persistent and more present

spatial character
  wider / less enclosed

optional:
  grass locomotion during traversal
```

Update validator semantics so a persistent supporting ambient can satisfy destination identity.

This should make:

```text
forest_clearing
→ forest_edge
→ beach_shore
```

and:

```text
forest_clearing
→ forest_edge
→ city_park
```

structurally viable without numeric destination weighting.

---

# 19. P1-E — Soft route diversity only

The second participant also repeatedly converged toward Stream Bank.

Do not add hard destination weights.

Give D2:

```ts
recentSceneHistory: Array<{
  nodeId: string;
  arrivedAtMs: number;
}>
```

and optionally recent rejected transition targets.

Prompt guidance:

> When multiple adjacent destinations are similarly coherent and safe, consider recent scene history and prefer meaningful spatial variety over repeatedly choosing the same branch.

Do not:

```text
forbid stream after one stream choice
```

Do not randomize.

Do not attach numerical bonuses to Forest Edge / Beach / City Park.

---

# 20. P1-F — Progression timing is secondary to reliability

Do not aggressively lower progression thresholds in the first implementation pass.

The two pilots indicate:

- transition proposals can already occur around the middle of the session;
- the larger problem is rejection / timeout / partial execution.

Therefore implement in two stages.

## Stage 1

Keep current progression thresholds unless there is an obvious bug.

Fix:

```text
transition reliability
rollback
traversal
destination identity
```

## Stage 2

After replay tests pass, evaluate whether first successful spatial progression still occurs too late.

Only then consider modest pilot tuning toward:

```ts
progressionPressureMediumMs: 100_000 // candidate TBD_PILOT
progressionPressureHighMs: 170_000   // candidate TBD_PILOT
```

The experiential target may remain:

```text
first successful transition opportunity:
~3.5–5 min

second successful transition opportunity:
~6–7.5 min
```

These are opportunities, not schedules.

High pressure must never force a transition.

---

# 21. Do not increase transition proposals while a transition is unresolved

Decision 1/gate context must include transition lifecycle.

Suggested:

```ts
sceneTransitionStatus:
  | 'ready'
  | 'planned'
  | 'traversing'
  | 'recovering';
```

If:

```text
planned
traversing
recovering
```

then:

```text
allowSceneTransition = false
```

Decision 1 may still choose:

```text
maintain
```

or, where safe:

```text
within-scene adaptation
```

but should not stack a new journey transition.

---

# 22. Event and transition logging required

## Event exposure

For every short event/action:

```ts
{
  assetId,
  adaptationId,
  requestedGain,
  materializedGain,
  peakRuntimeGain,
  fadeInMs,
  fadeOutMs,
  audioStartedAtMs,
  audioFinishedAtMs,
  effectiveExposureMs,
  playbackTerminalStatus
}
```

## Scene transition trace

For every transition proposal:

```ts
{
  adaptationId,
  originNodeId,
  destinationNodeId,

  proposedAtMs,
  traversalStartMs,
  locomotionStartMs,
  destinationPreviewStartMs,
  crossfadeStartMs,
  arrivalMs,
  committedAtMs,

  transitionStateTimeline,

  originStartGain,
  originArrivalGain,
  destinationStartGain,
  destinationArrivalGain,

  embodiedTransitionSupport,

  terminalStatus,
  failureReason,

  rollbackStartMs,
  rollbackCompleteMs,

  finalRuntimeSemanticLocation,
  finalPlannerSemanticLocation
}
```

---

# 23. Terminal statuses

Keep every D1 adapt fully traceable.

Recommended high-level terminal status:

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
  | 'ROLLED_BACK'
  | 'APPLIED';
```

For scene transition failures, distinguish:

```text
runtime timeout
rollback started
rollback completed
```

Do not stop at `RUNTIME_TIMEOUT`.

---

# 24. Tests required

## Event playback

1. Applied bird event reaches `AUDIO_STARTED`.
2. Applied event reaches `AUDIO_FINISHED` or explicit failure.
3. No event remains silently in activated-without-start state.
4. A 6–8 s event has a real audible plateau.
5. Event gain remains within safe bounds.
6. Foreground audibility guard produces a detectable but bounded event.

## Transition atomicity

7. Timeout before arrival leaves semantic location at origin.
8. Timeout stops/fades all transition-owned destination layers.
9. Timeout restores origin mix.
10. Timeout removes pending journey update.
11. Timeout does not reset spatial progression timer as a successful transition.
12. Timeout enters `RECOVERING`.
13. New scene transition is blocked during recovery.
14. After recovery, planner/runtime locations agree.
15. Reattempt after clean recovery is possible.

## Traversal

16. Valid scene transition lasts approximately 20–30 s.
17. Origin ambience decreases during traversal.
18. Destination ambience increases during traversal.
19. Footsteps span a meaningful fraction of traversal.
20. Destination identity remains after footsteps end.
21. Semantic location commits only at arrival.
22. Transition timeout is longer than traversal + commit grace.

## Dense Forest

23. `forest_clearing -> dense_forest` does not fail solely because base ambient is non-suppressible when attenuation is valid.
24. Non-scene-transition adaptations still cannot arbitrarily suppress the protected base ambient.

## Stream Bank

25. `forest_clearing -> stream_bank` succeeds with clean persistent destination identity.
26. Failed Stream Bank transition fully rolls back.
27. Retried Stream Bank transition after recovery does not incorrectly produce `DESTINATION_ACOUSTIC_FOUNDATION_MISSING`.

## Forest Edge

28. `forest_clearing -> forest_edge` can establish identity using persistent wind + attenuated forest bed.
29. Forest Edge can subsequently reach Beach.
30. Forest Edge can subsequently reach City Park.

## Route diversity

31. No numeric destination weights are added.
32. Recent scene history is available to D2.
33. Stream Bank remains valid but is not the only acoustically legible branch.

---

# 25. Deterministic replay scenarios

## Replay A — successful Stream Bank traversal

```text
forest_clearing
→ stream_bank
```

Assert:

- river preview begins before arrival;
- forest gradually attenuates;
- footsteps persist through traversal;
- arrival commits `stream_bank`;
- river remains after footsteps end;
- planner/runtime locations agree.

## Replay B — failed Stream Bank traversal

```text
forest_clearing
→ stream_bank
→ runtime timeout before commit
```

Assert:

- destination river may have started;
- rollback fades/stops river;
- origin forest mix returns;
- semantic location remains clearing;
- no stale waypoint;
- transition enters recovery;
- later retry starts from clean state.

## Replay C — Dense Forest

```text
forest_clearing
→ dense_forest
```

Assert:

- base forest bed is attenuated, not illegally suppressed;
- alternate forest bed grows;
- transition is accepted;
- destination identity persists.

## Replay D — Forest Edge to Beach

```text
forest_clearing
→ forest_edge
→ beach_shore
```

Assert:

- Forest Edge is perceptually distinct before second transition;
- first transition commits successfully;
- second transition remains temporally possible;
- sea breeze/waves approach gradually;
- beach remains stable after arrival.

---

# 26. Suggested config values for this pass

Preserve:

```ts
checkpointIntervalMs: 20_000
adaptationCooldownMs: 5_000
sceneTransitionCooldownMs: 120_000
maxSceneTransitions: 2
```

Add / centralize:

```ts
sceneTraversalDurationMs: 25_000          // TBD_PILOT
sceneTransitionRecoveryMs: 20_000         // TBD_PILOT
transitionRollbackFadeMs: 2_000           // TBD_PILOT
runtimeCommitGraceMs: 5_000               // TBD_PILOT

shortEventFadeInMs: 750                    // TBD_PILOT
shortEventFadeOutMs: 1_000                 // TBD_PILOT
shortEventMinimumAudiblePlateauMs: 3_000  // TBD_PILOT

destinationStabilizationMinMs: 45_000      // TBD_PILOT
```

Do not change EEG/calibration thresholds.

Do not change progression-pressure thresholds until transition reliability tests pass, unless a code bug requires it.

---

# 27. Likely implementation areas

Inspect the local code first.

Likely areas:

```text
packages/adaptive-planner/src/config.ts
packages/adaptive-planner/src/engine.ts
packages/adaptive-planner/src/types.ts
packages/adaptive-planner/src/openai-providers.ts
packages/adaptive-planner/src/semantic-materializer.ts
packages/adaptive-planner/src/patching.ts
packages/adaptive-planner/src/base-plan.ts
packages/adaptive-planner/src/reflection.ts

packages/contracts/src/scene-journey-plan.ts
packages/contracts/src/scene-graph.ts
packages/contracts/src/scene_graph_v1.json
packages/contracts/src/audio_library.json
packages/contracts/src/audio_library_semantic_v1.json

module-03-runtime-scene-controller/*
study-recorder-server/*
```

Follow the actual local data path.

Do not modify unrelated files merely because they are listed.

---

# 28. Out of scope

Do not:

- redesign calibration;
- alter TBR baseline formula;
- add new EEG features;
- add Scene Graph nodes;
- add audio files;
- introduce route weights;
- add a Route Planner;
- create a fixed journey schedule;
- change participant study UI;
- change study duration;
- force two transitions;
- replace LLM semantic planning with deterministic routing.

---

# 29. Acceptance criteria

This task is complete only when:

1. selected event sounds reliably start playback;
2. event sounds have a real audible plateau;
3. event mix is detectable relative to ambience without becoming startling;
4. failed scene transitions leave no destination audio residue;
5. planner/runtime semantic locations agree after both success and failure;
6. failed transitions enter recovery before retry;
7. successful transitions are experienced over roughly 20–30 seconds;
8. origin ambience decreases while destination ambience increases;
9. locomotion spans meaningful traversal time;
10. optional breathing can support traversal without being mandatory;
11. destination identity persists after arrival;
12. Stream Bank retry works after a failed transition rollback;
13. Dense Forest transition no longer fails solely due to protected base ambience;
14. Forest Edge becomes a viable persistent destination;
15. Beach / City Park become structurally reachable through Forest Edge;
16. no numeric route weighting is introduced;
17. progression-pressure tuning is not used as a workaround for transition execution bugs;
18. 5 s general cooldown and 20 s checkpoint cadence remain intact;
19. EEG/calibration logic remains unchanged;
20. build, typecheck, tests, lint, and formatting pass.

---

# 30. Required completion report from Codex

Return:

1. root cause of bird/event playback failure;
2. event envelope implementation;
3. event audibility/gain implementation;
4. root cause of P003 transition runtime timeout;
5. transition state machine implementation;
6. rollback behavior;
7. recovery/backoff behavior;
8. runtime/planner semantic-location commit boundary;
9. new traversal timing;
10. origin/destination crossfade implementation;
11. locomotion duration/repetition implementation;
12. whether breathing support was added;
13. how failed transition-owned audio is cleaned up;
14. how Stream Bank foundation retry inconsistency was fixed;
15. how Dense Forest protected-base transition was fixed;
16. how Forest Edge identity was strengthened;
17. confirmation that no destination numeric weights were added;
18. whether progression thresholds were changed; if yes, why;
19. replay results for successful Stream Bank, failed Stream Bank rollback, Dense Forest, and Forest Edge→Beach;
20. exact build / typecheck / test / lint / format results;
21. remaining perceptual or runtime limitations.

Do not report a scene transition as successful based only on planner JSON.

Verify:

```text
audio exposure
runtime semantic location
journey state
terminal status
persistent destination mix
```

all agree.

---

# 31. Final design principle

The desired system behavior is:

> **Participant-specific EEG may lead Decision 1 to produce very different adaptation patterns, but every accepted adaptation must become perceptually real. Short events should be subtle but audible. A scene transition should behave as an atomic 20–30 second embodied traversal: the listener leaves the origin, moves through footsteps and/or breathing, hears the destination approach while the origin recedes, then arrives in a persistent new acoustic place. If that traversal fails, the entire transition must roll back cleanly before the system tries again. Route diversity should emerge from acoustically legible scene representations and semantic planning, not arbitrary destination weights.**
