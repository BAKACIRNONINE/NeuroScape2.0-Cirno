# Module 01/02 Phase 1: Runnable Mock Integration

This branch rebuilds Modules 01 and 02 without relying on the earlier placeholders. It provides a deterministic, testable seam from calibration-shaped mock data to the existing Module 03 scene controller and Module 04 spatial-audio frontend.

## Run

```bash
npm ci
npm run dev
```

Open the Vite URL and choose **Phase 1 · adaptive EEG mock → spatial audio**. The 10-minute session runs at 10× speed (about one minute of wall time). Click **Audio** in the session UI to enable browser audio playback.

At session end, the existing Summary page retains the complete recording in application state. **Export Recording** downloads a versioned JSON bundle containing:

- calibration-relative attention states;
- eligibility outcomes and gate reasons;
- Decision 1 inputs/outputs and structured rationale;
- Decision 2 output, selected assets, and structured rationale;
- every accepted `SceneJourneyPlan`;
- Module 03 runtime snapshots and session/planner events.

The recording contains inspectable rationale summaries, not hidden model chain-of-thought.

## Phase 1 pipeline

1. `createMockTbrReplay()` emits one quality-annotated log-TBR epoch every 10 session seconds.
2. `AttentionInterpreter` applies the individual calibration anchors and computes current state, trend, variability, duration, confidence, and phase.
3. `evaluateEligibility()` checks only hard prerequisites: calibration usability, phase, valid-window count, confidence, and cooldown.
4. `MockDecisionProvider` implements the Decision 1 interface (`Should adapt?`).
5. `MockPlanningProvider` implements Decision 2 (`How to adapt?`) and selects from the mock sound knowledge base.
6. `mergePlanPatch()` merges a soundscape patch into a complete `SceneJourneyPlan`.
7. Module 03 validates and applies the plan without resetting the runtime.
8. Module 04 renders the resulting world state using the existing audio catalog and HRTF chain.

Decision 2 is never called when Decision 1 returns maintain.

## Replacement seams for later phases

| Phase 1 component        | Later replacement               | Stable interface       |
| ------------------------ | ------------------------------- | ---------------------- |
| `mockCalibrationProfile` | calibration repo output adapter | `CalibrationProfile`   |
| `createMockTbrReplay()`  | Muse/live EEG stream            | `TbrEpoch`             |
| `MockDecisionProvider`   | OpenAI Decision 1 provider      | `DecisionProvider`     |
| `MockPlanningProvider`   | OpenAI Decision 2 provider      | `PlanningProvider`     |
| `phase1SoundKnowledge`   | production audio database       | asset metadata records |

## Eligibility design rationale

Eligibility is deliberately not an attention classifier. It answers only whether the evidence and system state are safe enough to ask Decision 1. The adaptation decision therefore remains separately observable and testable. Gate failures always produce a maintain result with explicit reason codes.

## TBD pilot parameters

All values below are runnable hypotheses centralized in `packages/adaptive-planner/src/config.ts`; none should be described as validated thresholds.

| Parameter                   |   Phase 1 value | Adjustment target        |
| --------------------------- | --------------: | ------------------------ |
| Session duration            |           600 s | study protocol           |
| Opening phase               |            60 s | onboarding experience    |
| Closing phase start         |           540 s | closing experience       |
| EEG epoch                   |            10 s | signal stability/latency |
| Analysis window             |            60 s | state stability          |
| Planning checkpoint         |            40 s | responsiveness/cost      |
| Minimum valid epochs        |               5 | quality tolerance        |
| Trend history               |   3 checkpoints | trend reliability        |
| Focus/intermediate boundary |            0.34 | pilot distribution       |
| Intermediate/MW boundary    |            0.67 | pilot distribution       |
| Trend delta                 | 0.05/checkpoint | pilot false positives    |
| High variability MAD        |            0.12 | pilot distribution       |
| Sustained duration          |   2 checkpoints | intervention sensitivity |
| Minimum confidence          |            0.60 | quality policy           |
| General adaptation cooldown |            80 s | perceptual density       |
| Scene transition cooldown   |           200 s | narrative continuity     |
| Maximum scene transitions   |       2/session | study design             |
| Exact asset cooldown        |           120 s | repetition tolerance     |
| Asset-family cooldown       |            60 s | library diversity        |
| Body-anchor cooldown        |           100 s | repetition tolerance     |

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The adaptive end-to-end test is `frontend/tests/AdaptiveIntegrationHarness.test.ts`.
