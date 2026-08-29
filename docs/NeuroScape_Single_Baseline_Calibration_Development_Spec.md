# NeuroScape Single Guided-Breathing Baseline Calibration

## End-to-End Development Specification for Codex

**Repository:** `yujianing0210/NeuroScape2.0`  
**Reference branch:** `validated-plan-audio-fix`  
**Reference commit inspected during planning:** `c21957c9b4288df89d4baeca5d7719abe6a200ae`  
**Document purpose:** Implementation-ready specification for migrating NeuroScape from a two-anchor calibration model to a single guided-breathing baseline model.

---

## 0. Mandatory Repository Safety Instructions

1. **Do not modify, commit to, force-push, rebase, merge into, or otherwise alter `validated-plan-audio-fix`.**
2. Treat `validated-plan-audio-fix` as a read-only reference branch.
3. Before implementation, verify the current reference branch and commit, then create a new feature branch from it. Suggested branch name:

   ```text
   calibration-single-guided-baseline
   ```

4. Do not modify audio behavior unrelated to this calibration migration.
5. Preserve all validated-plan and audible-execution fixes already present in the reference branch.
6. Before editing, perform a read-only dependency audit and confirm every old two-anchor dependency identified in Section 3.
7. Do not claim completion until the end-to-end calibration, live EEG, planner, recording, replay, build, typecheck, lint, and test paths pass.
8. If implementation reveals a material ambiguity that would change the research protocol, stop and report it instead of inventing a protocol decision.

---

## 1. Objective

Replace the current Focused Meditation / Free Thought two-anchor calibration with a single five-minute guided-breathing EEG baseline.

The new system must no longer estimate a bounded focus percentage or place the live value between presumed minimum and maximum attention states. It must instead describe the current log-TBR relative to a participant-specific guided-breathing reference:

- whether current TBR is above, below, or consistent with baseline;
- the raw magnitude of the difference;
- the TBR ratio relative to baseline;
- whether the difference exceeds baseline variability;
- the recent trend and duration of the deviation;
- whether signal and baseline quality are sufficient for an LLM decision.

The system must not describe the baseline as maximum focus, 100% focus, or a physiological upper bound. It must not claim objective mind-wandering detection.

---

## 2. Scientific and Product Semantics

### 2.1 Required interpretation

The five-minute session produces an **empirical guided-breathing reference**. It is an operational reference collected while the participant follows a breath-focused voice guide.

It is not:

- a participant's maximum possible focus;
- a 100% focus state;
- a minimum mind-wandering state;
- a clinical or diagnostic measure;
- a universal boundary separating focus from mind wandering.

### 2.2 Required system language

Prefer:

- `guided-breathing baseline`
- `baseline-relative log-TBR`
- `TBR elevated relative to baseline`
- `TBR reduced relative to baseline`
- `baseline-consistent`
- `possible attentional drift`, only when supported by sustained, high-quality evidence
- `operational estimate`

Avoid:

- `100% focused`
- `focus percentage`
- `mind wandering detected`
- `maximum focus`
- `minimum attention`
- `more than 100% focused`

### 2.3 Self-report semantics

The post-baseline focus and drowsiness ratings are contextual metadata. They must not be added to EEG values, used to numerically rescale TBR, or used to label individual epochs.

For the first implementation, subjective focus must not invalidate or select EEG epochs. Technical signal quality determines baseline usability. Subjective ratings remain available for research analysis and quality context.

---

## 3. Current Implementation That Must Be Migrated

The current reference branch contains a complete two-anchor dependency chain.

### 3.1 Calibration backend

- Four 75-second blocks.
- Counterbalanced order:
  - Focus / Free Thought / Focus / Free Thought; or
  - Free Thought / Focus / Free Thought / Focus.
- First 15 seconds of each block discarded.
- Per-block mind-wandering and drowsiness self-report.
- Conditional redo logic by condition.
- Output fields include:
  - `focused_meditation_anchor`
  - `free_thought_anchor`
  - `difference`
  - `direction`
  - `pooled_mad`
  - `separation_score`
  - `mapping_status`

### 3.2 Frontend calibration adapter

`frontend/src/calibration/integration.ts` maps the Python profile to:

- `focusedAnchorLogTbr`
- `mindWanderingAnchorLogTbr`
- `pooledMad`
- `mappingAvailable`

### 3.3 Adaptive interpreter

The current interpreter calculates:

```text
relativePosition =
  (currentLogTbr - mindWanderingReferenceLogTbr)
  / (focusReferenceLogTbr - mindWanderingReferenceLogTbr)
```

It then derives focus/mind-wandering labels and visualization fields from this axis.

### 3.4 LLM reasoning

The Decision 1 prompt explicitly describes `two calibration values` and reasons over:

- `relativePosition`
- `deltaFromFocus`
- `deltaFromMindWandering`
- calibration separation
- distance from two references

### 3.5 Recording and replay

The recorded-session contract stores the two anchors and current neuro-state fields derived from them.

### 3.6 Existing configuration discrepancies to resolve explicitly

The current repository contains protocol/configuration inconsistencies:

- Calibration documentation describes at least 5/6 valid epochs per 75-second block, while `config.py` currently uses 4/6.
- The paper and prior protocol describe a 60-second analysis window with updates every 40 seconds; the current planner config uses a 20-second checkpoint interval.
- The agreed general adaptation cooldown is 80 seconds, while the current code uses 10 seconds.
- The agreed scene-transition cooldown is 200 seconds, while the current code uses 180 seconds.
- `minimumConfidence` exists in planner configuration but is not enforced by the current eligibility gate.
- `evaluateEligibility()` receives a calibration profile but currently does not validate it.

Do not silently preserve or silently change these discrepancies. Apply the decisions in Section 11 and document them in tests and protocol documentation.

---

## 4. New Calibration Protocol

### 4.1 Required flow

1. Muse connection and data-quality check.
2. Sixty-second acclimation.
3. Investigator accepts or repeats the completed acclimation.
4. Five-minute guided-breathing baseline.
5. Post-baseline focus and drowsiness self-report.
6. Deterministic technical-quality evaluation.
7. If valid, generate a single-baseline profile and allow continuation.
8. If invalid, allow at most one complete technical-quality redo.
9. After the allowed redo, return either:
   - `ready_to_continue`; or
   - `insufficient_after_redo`.

### 4.2 Acclimation

- Duration: 60 seconds.
- Preserve the existing connection, HSI, timer, marker, early-end, accept, and repeat behavior.
- Acclimation EEG remains stored but must not enter the baseline calculation.
- An early-ended acclimation cannot be accepted.

### 4.3 Guided baseline

- Duration: exactly 300 seconds.
- Condition identifier: `guided_breathing_baseline`.
- One continuous session, not five separate blocks.
- No Free Thought condition.
- No counterbalancing or participant-order assignment.
- No investigator prompt during recording.
- Do not discard data solely because the participant reports imperfect focus.
- Early end remains an emergency action; an early-ended baseline is stored but is technically ineligible.

### 4.4 Guidance media

Preferred production behavior:

- The calibration page owns playback of the five-minute guidance media.
- A single Start action synchronously initiates:
  - media playback;
  - `BASELINE_START` marker;
  - EEG recording;
  - the 300-second backend timer.
- Perform a preflight check that the media asset exists, can be decoded, and has the expected duration.
- Record playback start, pause, resume, error, ended, and timing-offset events.
- Do not auto-complete a valid baseline if guidance playback failed materially.

If the media asset is not yet available in the repository, implement the media contract and a clear preflight blocker. Do not add an arbitrary replacement audio file.

### 4.5 Post-baseline self-report

Use these questions:

```text
Q1. During the five-minute breathing practice, how focused did you feel?
1 = Not at all focused
7 = Extremely focused

Q2. During the five-minute breathing practice, how drowsy did you feel?
1 = Not at all drowsy
7 = Extremely drowsy
```

Required fields:

```ts
focus: number | null;       // integer 1-7
drowsiness: number | null;  // integer 1-7
investigator_notes: string;
unable_to_judge: boolean;
```

Both ratings are required unless `unable_to_judge` is true.

---

## 5. Signal Processing and Baseline Calculation

### 5.1 Preserve the feature pipeline

Calibration and runtime must use the same implementation:

- Muse 2 raw EEG at 256 Hz.
- AF7 and AF8 frontal channels.
- 60 Hz notch filter.
- 1-35 Hz bandpass.
- Non-overlapping 10-second epochs.
- Welch PSD.
- Existing theta and beta band definitions.
- Channel log-TBR:

  ```text
  logTBR = log((thetaPower + epsilon) / (betaPower + epsilon))
  ```

- Epoch log-TBR is the median of valid AF7/AF8 channel values.
- Preserve existing artifact, packet completeness, HSI, non-finite data, peak-to-peak, jaw-clench, and spectral-calculation rejection rules unless a separate protocol change is approved.

### 5.2 Expected epoch count

Five minutes yields 30 non-overlapping 10-second epochs.

```text
EXPECTED_BASELINE_EPOCHS = 30
MIN_VALID_BASELINE_EPOCHS = 25
```

The baseline is technically usable only when:

- the 300-second recording completed automatically;
- at least 25/30 epochs are usable;
- the feature version is supported;
- a finite baseline median can be computed.

### 5.3 Baseline reference

For valid baseline epoch values `x_i`:

```text
baselineLogTbr = median(x_i)
baselineMad = median(abs(x_i - baselineLogTbr))
baselineScale = 1.4826 * baselineMad
```

Store the unscaled MAD and scaled value explicitly. Do not reuse `pooledMad`, because only one condition now exists.

### 5.4 Near-zero variability protection

A small baseline MAD must not create an exploding normalized score.

Use:

```text
effectiveBaselineScale = max(baselineScale, MIN_BASELINE_SCALE_LOG_TBR)
```

Initial implementation value:

```text
MIN_BASELINE_SCALE_LOG_TBR = 0.05  // TBD_PILOT
```

Keep this value in centralized planner configuration and label it as a provisional pilot hypothesis, not a validated physiological threshold.

---

## 6. New Calibration Profile Contract

Use a new, incompatible live-calibration feature version:

```text
raw_welch_frontal_log_tbr_guided_baseline_protocol_v5
```

Recommended TypeScript contract:

```ts
export interface CalibrationProfile {
  profileId: string;
  participantId?: string;
  baselineLogTbr: number;
  baselineMad: number;
  baselineScale: number;
  effectiveBaselineScale: number;
  expectedEpochCount: 30;
  validEpochCount: number;
  invalidEpochCount: number;
  baselineAvailable: boolean;
  qualityStatus: 'pass' | 'fail';
  qualityIssues: string[];
  selfReportedFocus: number | null;
  selfReportedDrowsiness: number | null;
  featureVersion: string;
}
```

The Python JSON profile should use consistent snake_case equivalents.

Remove live dependencies on:

- `focused_meditation_anchor`
- `free_thought_anchor`
- `difference`
- `direction`
- `pooled_mad`
- `separation_score`
- `separation_assessment`
- `mapping_status`
- `mapping_available`

Replace `mapping_available` semantics with `baseline_available`.

---

## 7. Runtime Baseline-Relative State Estimation

### 7.1 Rolling window

Preserve the 60-second analysis window:

- six recent 10-second epochs;
- at least five valid epochs;
- `currentLogTbr` is the median of valid epoch log-TBR values.

### 7.2 Primary raw delta

```text
deltaFromBaseline = currentLogTbr - baselineLogTbr
```

Interpretation:

- positive: current TBR is higher than baseline;
- negative: current TBR is lower than baseline;
- zero: current TBR is equal or close to baseline.

This field is the primary baseline-relative measurement.

### 7.3 TBR ratio and descriptive percentage

Because the stored feature is a natural-log ratio:

```text
tbrRatioToBaseline = exp(deltaFromBaseline)
tbrPercentChange = (exp(deltaFromBaseline) - 1) * 100
```

The percentage, if displayed, must be labeled `TBR change relative to baseline`. It must never be labeled as a focus percentage.

### 7.4 Robust baseline-relative deviation

```text
robustDeltaFromBaseline =
  deltaFromBaseline / effectiveBaselineScale
```

This is a robust baseline-relative deviation score, not a clinical z-score and not a probability.

### 7.5 Baseline relation

Initial deterministic relation labels:

```ts
type BaselineRelation =
  | 'baseline-consistent'
  | 'tbr-elevated'
  | 'tbr-reduced'
  | 'uncertain';
```

Initial `TBD_PILOT` rule:

```text
robustDelta > +1  -> tbr-elevated
robustDelta < -1  -> tbr-reduced
otherwise         -> baseline-consistent
```

Return `uncertain` when signal/profile requirements are not met.

### 7.6 Required runtime fields

```ts
export interface AttentionState {
  timestampMs: number;
  phase: SessionPhase;
  currentLogTbr: number | null;
  baselineLogTbr: number;
  baselineMad: number;
  baselineScale: number;
  effectiveBaselineScale: number;
  deltaFromBaseline: number | null;
  tbrRatioToBaseline: number | null;
  tbrPercentChange: number | null;
  robustDeltaFromBaseline: number | null;
  baselineRelation: BaselineRelation;
  robustDeltaPrevious: number | null;
  robustDeltaSlope: number | null;
  trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient-history';
  trajectory: 'improving' | 'declining' | 'stable' | 'volatile' | 'unavailable';
  variabilityMad: number | null;
  sustainedElevatedWindows: number;
  sustainedReducedWindows: number;
  measurementConfidence: 'high' | 'medium' | 'low';
  signalQuality: 'good' | 'fair' | 'poor' | 'unavailable';
  validEpochCount: number;
  stateEstimationVersion: 'guided_baseline_delta_v1';
}
```

### 7.7 Fields to remove from live reasoning

Remove or deprecate:

- `focusReferenceLogTbr`
- `mindWanderingReferenceLogTbr`
- `referenceGap`
- `referenceGapAbs`
- `separationRatio`
- `calibrationQuality` based on anchor separation
- `relativePosition`
- `deltaFromFocus`
- `deltaFromMindWandering`
- `nearestReference`
- `coverage` based on two references
- `focusPosition`
- `mindWanderingPosition`
- `unboundedMindWanderingPosition`
- `sustainedMindWanderingWindows`

Do not keep these fields as hidden reasoning inputs merely to preserve old tests.

---

## 8. Trend and Duration

Compute trend from baseline-relative deviation rather than the former two-anchor position.

Use the most recent three eligible checkpoint states. Until three states exist:

```text
trend = insufficient-history
```

Initial slope policy should be centralized and marked `TBD_PILOT`. Do not transfer the old relative-position threshold directly without changing its unit.

Recommended initial implementation:

```text
ROBUST_DELTA_TREND_THRESHOLD = 0.25  // per checkpoint, TBD_PILOT
```

- slope above threshold: `increasing`;
- slope below negative threshold: `decreasing`;
- otherwise: `stable`.

If within-window variability exceeds the centralized high-variability threshold, trajectory may be `volatile`.

Track consecutive relation duration:

- increment `sustainedElevatedWindows` while relation is `tbr-elevated`, otherwise reset;
- increment `sustainedReducedWindows` while relation is `tbr-reduced`, otherwise reset.

Do not rename these counters as sustained mind wandering.

---

## 9. Deterministic Eligibility Gate

Eligibility answers only whether an LLM decision is admissible. It does not mean adaptation is required.

Block Decision 1 when any of the following holds:

1. Unsupported calibration feature version.
2. `baselineAvailable !== true`.
3. Calibration quality is `fail`.
4. Fewer than 5/6 valid runtime epochs.
5. Measurement confidence is below `minimumConfidence`.
6. Session is in opening phase.
7. Decision 1 or Decision 2 is already in flight.
8. Plan validation/application is in flight.
9. A protected scene transition or protected fade is in progress.
10. General adaptation cooldown is active.
11. Required runtime/scene/history context is incomplete.

Required protocol values:

```text
minimumValidEpochs = 5
minimumConfidence = 0.6
adaptationCooldownMs = 80_000
sceneTransitionCooldownMs = 200_000
```

The gate must actually validate the profile argument. Remove the unused `_profile` pattern.

Preserve asset-specific, family, body-anchor, density, salience, and cumulative-patch restrictions already present unless this migration requires a field rename.

### Checkpoint cadence

The intended study protocol is a 60-second window with a 40-second decision cadence. Set:

```text
checkpointIntervalMs = 40_000
```

If the current 20-second value was introduced intentionally for a validated audio reason, stop and report that conflict before changing it. Do not silently choose one.

---

## 10. Decision 1 LLM Migration

Create a new prompt version, for example:

```text
decision-1-guided-baseline-delta-v1
```

### 10.1 Remove old concepts

The prompt and input must no longer reference:

- two calibration values;
- a focus-to-mind-wandering axis;
- `relativePosition`;
- focus or mind-wandering anchor distance;
- anchor separation quality;
- bounded or unbounded focus percentage.

### 10.2 Required input structure

```json
{
  "baselineReference": {
    "baselineLogTbr": 1.24,
    "baselineMad": 0.08,
    "effectiveBaselineScale": 0.1186,
    "validEpochs": 28,
    "qualityStatus": "pass",
    "selfReportedFocus": 5,
    "selfReportedDrowsiness": 2
  },
  "currentWindow": {
    "currentLogTbr": 1.39,
    "deltaFromBaseline": 0.15,
    "tbrRatioToBaseline": 1.16,
    "robustDeltaFromBaseline": 1.27,
    "baselineRelation": "tbr-elevated",
    "trend": "increasing",
    "trajectory": "declining",
    "sustainedElevatedWindows": 3,
    "measurementConfidence": "high",
    "signalQuality": "good"
  },
  "recentTrajectorySummary": [],
  "sceneSummary": {},
  "lastRelevantAdaptation": null,
  "restrictions": {},
  "stasisPressure": false,
  "transitionInProgress": false,
  "adaptationProgress": {},
  "relevantPriorOutcomes": []
}
```

### 10.3 Required prompt rules

The prompt must state:

1. The baseline is an empirical guided-breathing reference, not maximum focus.
2. Positive delta means TBR is higher, not that mind wandering has been objectively detected.
3. Negative delta means TBR is lower, not that the participant is more than 100% focused.
4. Never infer a definitive mental state from one checkpoint.
5. Interpret raw delta, robust deviation, signal quality, confidence, trajectory, duration, scene history, and prior adaptation outcome together.
6. Sustained, high-confidence TBR elevation may support a gentle reorientation hypothesis, but only conservatively.
7. Low-confidence EEG cannot support a corrective claim.
8. Do not invent attention decline merely to create sound changes or meet an adaptation count.
9. Maintain is valid when evidence is transient, already recovering, low-confidence, or awaiting the effect of a recent intervention.
10. Preserve the existing within-scene-before-transition hierarchy.
11. Provide concise, inspectable reasoning without claiming objective mind-wandering detection or exposing hidden chain-of-thought.

### 10.4 Self-report use

Focus and drowsiness ratings may be supplied as baseline context, but Decision 1 must not treat them as current-session real-time ground truth or combine them numerically with EEG.

---

## 11. Decision 2 and Adaptation Behavior

Decision 2 remains responsible for constrained soundscape patch planning and should be called only when Decision 1 returns `adapt`.

Preserve:

- structured output;
- candidate retrieval and grounding;
- canonical asset metadata;
- scene compatibility;
- within-scene adaptation before scene transition;
- maximum patch operations;
- density and salience limits;
- asset/family/body-anchor cooldowns;
- validated-plan authority;
- audible-execution feedback and patch-lifecycle behavior.

Update only the state fields, rationale terminology, mock inputs, and tests required by the new baseline-relative model.

Do not allow Decision 2 to reinterpret EEG or invent a mental-state label.

---

## 12. Calibration UI Requirements

### 12.1 Remove

- Calibration order A/B.
- Four-block schedule cards.
- Focus / Free Thought guidance switching.
- Per-condition redo callouts.
- Mind-wandering self-report question.
- Focused Meditation anchor.
- Free Thought anchor.
- Difference and direction between anchors.
- Separation score.
- Provisional mapping status language.
- Two-condition comparison chart.
- Footer language referring to participant `anchors` in the plural.

### 12.2 Add

- Single guided-breathing baseline protocol summary.
- Guidance-media preflight status.
- Five-minute countdown/progress.
- Clear synchronized Start action.
- Playback failure and interruption warnings.
- Post-baseline focus and drowsiness ratings.
- Technical-quality review.
- Single-baseline result panel.

### 12.3 Result page

Display:

- guided-breathing baseline log-TBR;
- baseline MAD;
- effective baseline scale;
- valid epochs out of 30;
- packet completeness;
- AF7/AF8 channel contribution;
- self-reported focus;
- self-reported drowsiness;
- baseline quality status;
- quality issues;
- ready/not ready for adaptive session.

### 12.4 Runtime Neuro State panel

Replace the 0-1 focus/mind-wandering display with:

- `TBR delta from baseline`;
- `TBR ratio to baseline`;
- `TBR percent change`, if helpful and clearly labeled;
- relation: elevated/reduced/baseline-consistent;
- trend;
- signal quality;
- measurement confidence.

Do not render a focus percentage.

---

## 13. Recording, Export, Import, and Replay

Increment the new recording schema to:

```text
RECORDED_SESSION_SCHEMA_VERSION = 1.4
```

New recordings must store:

- the v5 calibration profile;
- raw/processed live epochs;
- baseline-relative attention states;
- deterministic eligibility results;
- Decision 1 inputs and outputs;
- Decision 2 inputs and outputs;
- patch lifecycle;
- applied plans;
- audio playback evidence;
- audio execution diagnostics.

### Backward compatibility

- Old v4 calibration profiles must not start a new live adaptive session.
- Return a clear recalibration error for live use.
- Existing schema 1.3 recordings should remain replayable from their stored authoritative runtime/neuro snapshots.
- Do not reinterpret a schema 1.3 recording using the new v5 interpreter.
- New exports must use schema 1.4 only.
- Validate import behavior explicitly with tests.

---

## 14. API and State-Machine Migration

The state machine may preserve generic `BLOCK_READY`, `BLOCK_RECORDING`, and `SELF_REPORT` state names if doing so reduces risk, but exposed protocol semantics must refer to a single baseline rather than multiple blocks.

Preferred explicit state names, if safely migrated end to end:

```text
BASELINE_READY
BASELINE_RECORDING
BASELINE_SELF_REPORT
PROCESSING
COMPLETE
```

Do not leave partially migrated states in which the UI says baseline while persisted data and API markers still imply Focus or Free Thought conditions.

Recommended markers:

```text
ACCLIMATION_START
ACCLIMATION_END
ACCLIMATION_ACCEPTED
BASELINE_GUIDANCE_READY
BASELINE_GUIDANCE_PLAYBACK_START
BASELINE_START
BASELINE_GUIDANCE_PAUSE
BASELINE_GUIDANCE_RESUME
BASELINE_GUIDANCE_ERROR
BASELINE_END
BASELINE_SELF_REPORT_SUBMITTED
BASELINE_REDO_REQUIRED
CALIBRATION_COMPLETE
```

Persist sample indices and monotonic/local timestamps consistently with the current implementation.

---

## 15. File-Level Implementation Scope

At minimum, inspect and update the following.

### Python calibration backend

```text
eeg-calibration/backend/app/config.py
eeg-calibration/backend/app/calibration/machine.py
eeg-calibration/backend/app/calibration/service.py
eeg-calibration/backend/app/models/schemas.py
eeg-calibration/backend/app/signal_processing/core.py
eeg-calibration/backend/app/main.py
eeg-calibration/backend/app/storage/session_store.py
```

### Calibration frontend

```text
frontend/src/calibration/CalibrationPage.tsx
frontend/src/calibration/calibration.css
frontend/src/calibration/types.ts
frontend/src/calibration/integration.ts
frontend/src/calibration/services/api.ts
frontend/src/calibration/hooks/useLive.ts
```

### Application handoff and runtime UI

```text
frontend/src/app/App.tsx
frontend/src/ui/components/NeuroStatePanel.tsx
frontend/src/ui/pages/SessionPage.tsx
frontend/src/runtime/RuntimeStore.ts
frontend/src/runtime/validation.ts
```

### Adaptive planner

```text
packages/adaptive-planner/src/types.ts
packages/adaptive-planner/src/config.ts
packages/adaptive-planner/src/interpreter.ts
packages/adaptive-planner/src/gate.ts
packages/adaptive-planner/src/engine.ts
packages/adaptive-planner/src/openai-providers.ts
packages/adaptive-planner/src/mock-providers.ts
packages/adaptive-planner/src/fixtures.ts
```

### Shared contracts and recording

```text
packages/contracts/src/neuro-state.ts
packages/contracts/src/recorded-session.ts
packages/contracts/tests/contracts.test.ts
frontend/src/recording/SessionRecorder.ts
frontend/src/recording/recordingValidation.ts
frontend/tests/recordingFixtures.ts
```

### Documentation

```text
README.md
eeg-calibration/README.upstream.md
docs/EEG_CALIBRATION_LIVE_INTEGRATION.md
relevant architecture and handoff documents
```

Search the full branch for every removed field and concept. The list above is a minimum, not proof that all dependencies have been found.

---

## 16. Required Test Matrix

### 16.1 Backend protocol tests

1. Session creation no longer assigns order A/B.
2. Acclimation remains 60 seconds and does not enter the baseline.
3. Baseline timer is exactly 300 seconds.
4. Baseline produces 30 candidate 10-second epochs.
5. Early-ended baseline is retained but ineligible.
6. At least 25 valid epochs are required.
7. Exactly one technical-quality redo is allowed.
8. Self-report requires focus and drowsiness unless unable to judge.
9. Self-report is stored but does not select epochs or alter the baseline median.
10. Profile uses the new feature version and schema.
11. Old profile version returns an incompatible/recalibrate error.

### 16.2 Signal-processing tests

1. Existing filtering, Welch, theta/beta, channel median, and artifact tests still pass.
2. Baseline median uses only valid finite epochs.
3. Baseline MAD is correct.
4. Effective scale respects the configured floor.
5. Near-zero MAD does not create Infinity or NaN.
6. Runtime and calibration use the same log-TBR implementation.

### 16.3 Interpreter tests

1. Current equals baseline: delta 0, ratio 1, baseline-consistent.
2. Current above baseline: positive delta, ratio above 1.
3. Current below baseline: negative delta, ratio below 1.
4. Robust deviation uses effective scale.
5. Missing/invalid epochs return uncertain state.
6. Fewer than five valid epochs blocks eligibility.
7. Trend is insufficient until enough checkpoints exist.
8. Sustained counters increment and reset correctly.
9. No focus percentage fields are produced.

### 16.4 Eligibility tests

1. Invalid baseline blocks Decision 1.
2. Unsupported feature version blocks Decision 1.
3. Minimum confidence is enforced.
4. Opening phase blocks Decision 1.
5. In-flight decisions/plans block duplicate work.
6. Protected transitions/fades block conflicting adaptation.
7. General 80-second cooldown is enforced.
8. Scene-transition 200-second cooldown is enforced.

### 16.5 LLM tests

1. Decision 1 prompt uses the new version.
2. Prompt contains the empirical-reference caution.
3. Prompt does not contain `two calibration values`.
4. Prompt does not contain old relative-position fields.
5. Structured input includes raw delta, ratio, robust deviation, quality, trend, and duration.
6. Low-confidence evidence cannot produce an unsupported corrective claim.
7. Decision 2 remains constrained and does not reinterpret EEG.

### 16.6 UI tests

1. Four-block schedule is absent.
2. A single five-minute baseline flow is shown.
3. Guidance-media failure blocks a valid start/completion.
4. Focus and drowsiness questions render correctly.
5. Results show a single baseline.
6. Runtime UI never shows focus as a percentage.

### 16.7 Recording/replay tests

1. New schema 1.4 round-trips.
2. New profile and neuro-state fields are recorded.
3. Old schema 1.3 recordings remain replayable.
4. Old profiles cannot start new live sessions.
5. Replay uses stored snapshots without v5 reinterpretation.

### 16.8 End-to-end test

Drive this full path:

```text
connection
-> acclimation
-> guided baseline
-> self-report
-> profile generation
-> live epoch source
-> 60-second rolling state
-> eligibility
-> Decision 1
-> optional Decision 2
-> plan validation/application
-> audio execution evidence
-> session recording
-> export
-> replay
```

---

## 17. Required Validation Commands

Run the repository's supported setup and validation commands. At minimum:

```bash
npm run calibration:setup
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

Also run the Python calibration test suite in its configured environment.

Do not use a formatting command that rewrites unrelated user files. If formatting is needed, scope it to files changed by this feature branch.

Perform a final full-repository search confirming that old live two-anchor fields are absent from production reasoning paths. Historical documentation may retain them only when clearly labeled as an old protocol.

---

## 18. Acceptance Criteria

The migration is complete only when all of the following are true:

1. `validated-plan-audio-fix` remains unchanged.
2. Calibration consists of 60-second acclimation plus one 300-second guided baseline.
3. Free Thought and counterbalancing are removed from the active protocol.
4. Self-report asks focus and drowsiness once after the baseline.
5. A technically valid baseline uses at least 25/30 valid epochs.
6. The profile contains one baseline median and its variability.
7. Runtime computes raw delta, TBR ratio, robust deviation, trend, and sustained duration.
8. No production UI or LLM input represents the result as a focus percentage.
9. The eligibility gate checks profile validity, epoch count, confidence, phase, concurrency, transitions, and cooldowns.
10. Decision 1 understands a single empirical reference and uses cautious language.
11. Decision 2 and audible plan execution remain functionally intact.
12. New recordings use schema 1.4.
13. Old recordings remain replayable without reinterpretation.
14. Old calibration profiles fail fast for new live sessions with a clear recalibration message.
15. All builds, types, lint, formatting checks, backend tests, workspace tests, and end-to-end tests pass.
16. Documentation and code describe the same durations, epoch counts, thresholds, feature version, checkpoint cadence, and cooldown values.

---

## 19. Implementation Order

Use this sequence to reduce partial-migration risk:

1. Create the feature branch and perform a read-only dependency search.
2. Define the new Python and TypeScript profile/state contracts and feature versions.
3. Implement backend protocol, baseline processing, quality gating, persistence, and API changes.
4. Implement the calibration frontend and guidance-media contract.
5. Update the profile adapter and application handoff.
6. Replace the two-anchor interpreter with baseline-relative state estimation.
7. Update eligibility and configuration.
8. Migrate Decision 1 prompt/input and mocks.
9. Update Decision 2 context field names without altering validated audio behavior.
10. Migrate recording/export/import/replay contracts.
11. Update runtime UI.
12. Update tests and fixtures.
13. Update documentation.
14. Run all validation commands and the end-to-end scenario.
15. Produce a completion report containing:
    - changed files;
    - final formulas and thresholds;
    - compatibility behavior;
    - validation commands and results;
    - any remaining `TBD_PILOT` values;
    - confirmation that `validated-plan-audio-fix` was not modified.

---

## 20. Scope Boundaries

This feature does not authorize:

- retraining or adding a personalized ML classifier;
- adding new EEG features beyond the existing log-TBR pipeline;
- changing the sound library or replacing validated audio assets;
- redesigning Decision 2 adaptation goals unrelated to field migration;
- claiming validated mind-wandering detection;
- changing the user-study condition assignment outside calibration;
- changing the non-adaptive control trajectory;
- modifying the reference branch.

Any such expansion requires a separate decision.

