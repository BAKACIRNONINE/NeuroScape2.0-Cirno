# NeuroScape Single Guided-Baseline Implementation

## Scope

This update replaces the Focused Meditation / Free Thought two-anchor calibration with one empirical five-minute guided-breathing baseline. The baseline is a personal reference for the session; it is not maximum focus, a physiological bound, a diagnostic threshold, or objective mind-wandering detection.

Implementation branch: `calibration-single-guided-baseline`  
Reference branch preserved: `validated-plan-audio-fix` (`c21957c`)

## Protocol changes

- Calibration now consists of a 60-second acclimation followed by one 300-second guided-breathing baseline.
- The full baseline is analyzed as thirty non-overlapping 10-second epochs. There is no initial 15-second discard.
- At least 25 valid epochs are required. A failed first attempt schedules exactly one complete redo; a failed redo produces an unusable profile and blocks the adaptive session.
- The post-baseline 1–7 focus and drowsiness ratings are contextual metadata only. They never select, reject, or alter EEG epochs.
- The required media contract is `/calibration/guided-breathing-baseline.mp3`, with decoded duration `300 ± 2` seconds. Missing, undecodable, or incorrectly timed media produces a visible preflight blocker. No substitute audio is selected.
- Guidance readiness, playback start, error, and ended markers are persisted alongside EEG markers. Playback is reset if the backend cannot start the baseline.

The repository currently does not contain the licensed five-minute guidance file. Before a real calibration can start, place the approved asset at:

`frontend/public/calibration/guided-breathing-baseline.mp3`

## Calibration profile v5

Feature version:

`raw_welch_frontal_log_tbr_guided_baseline_protocol_v5`

The profile now stores:

- `baseline_log_tbr`: median of all valid baseline epoch log-TBR values.
- `baseline_mad`: median absolute deviation around the baseline median.
- `baseline_scale`: `1.4826 × baseline_mad`.
- `effective_baseline_scale`: `max(baseline_scale, 0.05)` for numerically stable runtime normalization.
- expected, valid, and invalid epoch counts; quality status/issues; selected attempt; contextual self-report.

Old feature versions are rejected with an explicit recalibration message and cannot silently enter a new adaptive session.

## Runtime interpretation and adaptive policy

Runtime attention evidence is calculated from the rolling 60-second valid-epoch median:

- raw delta: `current_log_tbr - baseline_log_tbr`
- TBR ratio: `exp(raw_delta)`
- percent change: `(ratio - 1) × 100`
- robust deviation: `raw_delta / effective_baseline_scale`
- baseline relation: `tbr-elevated`, `baseline-consistent`, `tbr-reduced`, or `uncertain`
- three-checkpoint robust-deviation slope and conservative trajectory

The UI and Decision 1 prompt describe these as baseline-relative observations. They do not convert them into focus/mind-wandering percentages or categorical diagnoses.

Adaptive gate defaults are now:

- checkpoint interval: 40 seconds
- adaptation cooldown after experienced audio: 80 seconds
- scene-transition cooldown: 200 seconds
- minimum measurement confidence: 0.60
- minimum valid epochs in the rolling window: 5

Decision 1 uses prompt version `decision-1-guided-baseline-delta-v1`. Its structured evidence names `relation`, not the old two-anchor `position`.

## Recording and replay

- New recordings use schema `1.4` and store the v5 baseline profile and baseline-relative NeuroState fields.
- Attention-state CSV exports contain baseline median/MAD/scale, raw delta, ratio, percent change, robust deviation, relation, slope, and sustained-window counts.
- Schema `1.3` recordings remain importable for replay through an explicitly labeled legacy two-anchor compatibility type.
- New live sessions are emitted by the baseline-relative integration path and do not generate the legacy two-anchor state shape.

## Files changed

- `eeg-calibration/backend/app`: protocol timing, state service, API aliases, schemas, signal aggregation, and profile compatibility checks.
- `frontend/src/calibration`: single-baseline investigator flow, media preflight/synchronization, self-report, and result UI.
- `packages/adaptive-planner`: baseline-relative interpreter, eligibility gates, prompts, mock planning, retrieval context, and reflection.
- `packages/contracts` and `frontend/src/recording`: schema 1.4 contracts, export fields, and schema 1.3 replay support.
- Frontend neuro-state and summary panels: baseline-relative wording and visualization.
- Unit/integration tests: protocol timing, redo policy, baseline statistics, runtime deltas, prompt contract, cooldowns, recording migration, and UI semantics.

## Validation commands

From the repository root:

```bash
npm install
npm run build
npm run typecheck
npm test
```

Backend calibration tests:

```bash
cd eeg-calibration/backend
pytest -q
```

The real Muse end-to-end acceptance path additionally requires Mind Monitor OSC input and the approved guidance asset described above.
