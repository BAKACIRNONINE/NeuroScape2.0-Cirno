# EEG Logging, 10× Replay, and Ambient-Only Base Plan

## Implementation map

- Adaptive and non-adaptive execution: `frontend/src/integration/AdaptiveIntegrationHarness.ts`; application orchestration is in `frontend/src/app/App.tsx`.
- Muse acquisition and raw export: `eeg-calibration/backend/app/osc/receiver.py`, `app/calibration/service.py`, and `app/main.py`.
- Shared filtering, epoching, artifact handling, theta/beta power, and log-TBR: `eeg-calibration/backend/app/signal_processing/core.py`.
- Personal TBR baseline and calibration: the calibration service/profile v5. This update does not change its algorithm.
- Decision 1 / Decision 2: `packages/adaptive-planner/src/engine.ts` and provider modules; timestamps are logged by the integration harness and recorder.
- Session recording/export: `packages/contracts/src/recorded-session.ts`, `frontend/src/recording/SessionRecorder.ts`, and `frontend/src/study/StudyArtifacts.ts`.
- Result and comparison visualization: `EegTimelinePlot.tsx`, `SummaryPage.tsx`, and `HomePage.tsx`.
- Shared experimental Base Plan: `packages/adaptive-planner/src/base-plan.ts`.

## EEG records

Both conditions now feed an epoch source into the same session harness. Every completed 10-second epoch is stored in `RecordedSession.eegMetrics` with:

- original session `timestampMs`
- frontal median theta power
- frontal median beta power
- real-time log-TBR
- the participant's calibrated `tbrBaseline`
- validity, quality score, and artifact flags

Adaptive and non-adaptive sessions therefore use the same backend Welch/filter/artifact/TBR implementation. Non-adaptive processing is observational only: the planner is absent and EEG cannot change playback.

Decision 1 and Decision 2 calls remain separate `adaptiveTrace` records and are additionally indexed in `RecordedSession.decisionEvents`. Their original session timestamps are shown as distinct D1 and D2 vertical markers.

The study ZIP `eeg-epochs.csv` now exports theta, beta, log-TBR, and baseline alongside quality fields.

## Visualizations and persistence

The session summary contains four aligned tracks with their actual per-track numeric ranges: theta, beta, log-TBR, and baseline. Adaptive results overlay D1/D2 markers. The fixed X-axis is 0–10 minutes.

`recordingStore` retains the most recently completed adaptive and non-adaptive recordings separately while navigating within the application. When both exist, Home renders vertically stacked, horizontally aligned 0–10 minute comparison plots for theta, beta, and log-TBR.

The study artifact backend/ZIP remains the durable cross-restart storage mechanism; the Home comparison cache is intentionally in-memory and scoped to the current paired study workflow.

## Raw EEG replay input

Choose **Pre-recorded EEG** on Home and upload a NeuroScape `raw_eeg.csv`. The accepted file is approximately ten minutes (9–10 minutes accepted) at 256 Hz.

Required columns:

```text
sample_index,monotonic_timestamp,tp9,af7,af8,tp10
```

The normal NeuroScape export also includes `session_elapsed_seconds`, HSI, HeadBandOn, accelerometer, gyroscope, blink, jaw-clench, and auxiliary fields. These are preserved when present. Rows must have finite required numeric values and increasing timestamps. Missing channels, malformed rows/timestamps, short recordings, and recordings over ten minutes plus one second are rejected; fake values are never substituted.

The browser only parses the CSV transport format. It sends raw samples to `/api/live/replay/process`, where `analyze_segment()`—the same function used for live Muse epochs—performs preprocessing and metric calculation.

## 10× clock semantics

Replay sessions use the existing accelerated harness clock: one second of session time advances every 100 ms of wall time. `ReplayEegEpochSource.next(sessionTimestampMs)` releases a processed epoch only when that accelerated session clock reaches the epoch's original timestamp. Consequently:

- a 600-second recording takes approximately 60 wall-clock seconds;
- a source epoch at 300 seconds remains timestamped at 300 seconds;
- analysis windows, 40-second checkpoints, 80-second cooldowns, Decision timestamps, runtime scheduling, and plots all use original session time.

Real-time mode continues to poll live Muse epochs at normal wall-clock speed.

## Audio plan change

The shared Base Plan is now `base_plan_v4` / `forest_ambient_only_v1` and contains one continuous `forest_ambient_bed_01` layer with no scheduled events or actions. The initial voice remains handled by the existing opening-audio layer for both conditions.

- Non-adaptive: opening voice + continuous forest ambience; no planner and no later events.
- Adaptive: the same initial soundscape; Decision 2 may later introduce an authored event/action/ambient patch because the adaptation vocabulary remains intact.

## Validation

```bash
npm run build
npm run typecheck
npm test
cd eeg-calibration/backend && pytest -q
```
