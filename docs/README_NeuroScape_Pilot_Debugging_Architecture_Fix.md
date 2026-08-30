# NeuroScape Pilot Debugging / Architecture Fix

## Scope

This pass implements the targeted fixes in `CODEX_Pilot_Debugging_Architecture_Fix.md` against the current local checkout. It preserves the existing 20-second planner cadence, 5-second general adaptation cooldown, constrained semantic journey architecture, deterministic materializer, and transition locomotion cues.

## Root causes

### Adaptation freeze after patch 6

The freeze was a hard validation ceiling, not an LLM failure. `maxCumulativePatches` was `6`, while `targetAdaptationsMax` was also `6`. The target was supplied to planning as a soft session objective, but the cumulative ceiling rejected every later projected patch. Because downstream outcomes were not recorded consistently, this appeared as a silent stop.

### Planner/runtime location divergence

`JourneyController.replacePlan()` discarded the absolute `arrivalTimeMs` authored by the adaptive journey update. It redistributed replacement waypoints across the full 600-second planning horizon. A transition proposed around 360 seconds could therefore remain at `forest_clearing` through session end, even though the projected planner plan already contained `stream_bank`.

Planner state was also committed at `PLAN_APPLIED`, before runtime arrival. That allowed planner history/location to get ahead of the runtime listener.

### Weak destination identity

The transition could select a transient water event and system-generated footsteps without selecting a persistent ambient foundation for the destination. In addition, the old Stream Bank foundation ID did not have a usable technical audio record/file, while `stream_lakeside_river` did.

## Changes

### Policy and validation

- Raised the independent safety ceiling from 6 to 10 cumulative patches. `targetAdaptationsMax` remains a soft target rather than a hard stop.
- Added the exact terminal reason `PATCH_BUDGET_EXHAUSTED` when the safety ceiling rejects a proposal.
- Reduced scene-transition cooldown from 200 seconds to 120 seconds; the maximum remains two transitions and closing-phase restrictions remain active.
- Added a 45-second minimum destination-foundation stabilization duration.
- A scene transition now requires a Decision 2-selected ambient long-bed foundation that:
  - belongs to the destination node's foundation coverage;
  - has valid technical metadata;
  - is active by arrival/transition completion;
  - persists through the stabilization window.
- Missing destination foundations now reject with `DESTINATION_ACOUSTIC_FOUNDATION_MISSING`.
- System-generated footsteps do not consume the LLM patch-operation budget and cannot satisfy destination acoustic identity.

### Scene Graph and Decision 2

- Added the technically playable `stream_lakeside_river` asset to Stream Bank foundation coverage.
- Destination nodes without a playable foundation are marked unavailable to Decision 2.
- The D2 prompt requires a persistent destination foundation for scene transitions and distinguishes it from transient events and locomotion.
- Recent semantic adaptation history is included so D2 can prefer coherent perceptual variation without introducing a rigid repetition ban.
- The D1 prompt limits `constraints_for_decision_2` to safety, scope, salience, continuity, operation, and evidence constraints; it must not prescribe a sound family or tactic.

### Runtime commit state machine

The effective transition lifecycle is now:

```text
PLANNED -> TRANSITION_STARTED -> ARRIVED -> COMMITTED
```

- Replacement journeys preserve future absolute arrival timestamps.
- Before arrival, runtime semantic location remains the origin.
- At arrival, runtime updates semantic location and coordinates, emits `SemanticLocationChanged`, and the planner commits the pending base plan/history only after receiving that event.
- A runtime rejection leaves planner state unchanged.
- A pending transition not arriving within one checkpoint interval after its authored arrival ends as `RUNTIME_TIMEOUT`.

### Terminal outcomes and study evidence

Every logged D1 `adapt` path now has an explicit downstream terminal category:

```text
D2_NOT_CALLED
D2_NO_SAFE_CHANGE
D2_SCHEMA_REJECTED
SEMANTIC_SELECTION_REJECTED
MATERIALIZATION_FAILED
PATCH_VALIDATION_REJECTED
PATCH_BUDGET_EXHAUSTED
RUNTIME_REJECTED
RUNTIME_TIMEOUT
APPLIED
```

Recorded sessions now include adaptive summary counters and applied audio exposure records. Exposure evidence distinguishes Decision 2-selected assets from system-generated transition locomotion and records validation/runtime activation and effective duration. Raw evidence remains available for audit.

## Verification

The following checks passed on 2026-08-29:

- `npm run build`
- `npm run typecheck`
- `npm run lint`
- adaptive planner: 50 tests
- contracts: 5 tests
- runtime scene controller: 36 tests
- frontend: 81 tests
- study recorder server: 7 tests
- changed-file Prettier checks and `git diff --check`

The first all-workspace test attempt could not bind a temporary loopback listener under the restricted sandbox (`listen EPERM 127.0.0.1`). Re-running the study-recorder suite with local loopback permission passed all seven tests. The production build emits only Vite's existing large-chunk advisory.

## Pilot acceptance behavior

- A seventh valid patch is accepted; patch 11 is rejected explicitly when ten patches have already been accepted.
- A transition using only a transient waterfall cue plus footsteps is rejected.
- A Stream Bank transition selecting `stream_lakeside_river` plus deterministic surface-appropriate footsteps validates.
- A replacement journey remains at the origin at `arrivalTimeMs - 1`, switches at `arrivalTimeMs`, and commits the planner to the same destination only at that arrival event.
