# NeuroScape 2.0 — EEG Logging, Replay Testing, and Audio Plan Updates

Please inspect the current NeuroScape 2.0 codebase first and implement the following three updates.

Before modifying code:

1. Identify the existing implementation for:

   - adaptive session
   - non-adaptive session
   - EEG acquisition and processing
   - TBR calculation and baseline handling
   - Decision 1 / Decision 2 triggering
   - session result visualization
   - base soundscape plans and event sounds

2. Briefly summarize which files/modules are responsible for each part.
3. Preserve the current calibration and adaptive decision logic unless a change is explicitly requested below.
4. Reuse existing EEG/TBR calculation functions wherever possible rather than creating duplicate computation paths.

---

# Update 1 — EEG Recording and Session Comparison Visualization

## Goal

Both the 10-minute **adaptive** and **non-adaptive** sessions should continuously record the EEG-derived metrics required for later analysis.

After each session, the system should generate a detailed plot.

After both sessions are completed, the homepage should provide a comparison visualization between the two sessions.

---

## 1.1 Data to record during BOTH sessions

During both adaptive and non-adaptive 10-minute sessions, continuously record timestamped values for:

- Theta
- Beta
- Calculated TBR baseline
- Real-time TBR

Use the same EEG preprocessing and TBR calculation pipeline currently used by the adaptive system.

The non-adaptive condition should still compute and record EEG metrics even though EEG does not influence its soundscape.

Each sample should at minimum contain:

```text
timestamp
theta
beta
tbr
tbr_baseline
```

If the current system already maintains additional EEG metrics, do not remove them.

---

## 1.2 Decision event logging

For the **adaptive session**, also record the exact timestamps at which the system triggers:

- Decision 1
- Decision 2

The visualization must clearly distinguish between the two event types.

If Decision 2 is triggered as part of a Decision 1 → Decision 2 sequence, preserve both timestamps rather than only recording the final adaptation.

For the non-adaptive session, there should naturally be no Decision 1 / Decision 2 adaptation markers.

---

## 1.3 Individual session result plot

At the end of each 10-minute session, generate a time-series plot covering the full session.

The plot should include:

- Theta
- Beta
- Real-time TBR
- Calculated TBR baseline

The X-axis should represent elapsed session time:

```text
0 → 10 min
```

The adaptive-session plot should additionally annotate:

- Decision 1 trigger points
- Decision 2 trigger points

Prefer vertical markers or another visually clear event annotation so that we can inspect what the EEG/TBR signal looked like immediately before and after each decision.

Do not distort the underlying time-series data just to place the signals on the same numeric scale. If needed, use multiple Y axes, normalized visualization, or clearly separated aligned tracks while preserving the actual recorded values.

The priority is debugging and interpretability rather than visual decoration.

---

## 1.4 Homepage comparison graph

After BOTH the adaptive and non-adaptive sessions have been completed and the participant returns to the homepage, provide a comparison visualization.

Use two vertically stacked plots:

```text
Adaptive
------------------------
0 min              10 min


Non-Adaptive
------------------------
0 min              10 min
```

The two graphs must:

- use the same 0–10 minute X-axis;
- be horizontally aligned;
- use the same visualization convention / scale when appropriate;
- allow direct visual comparison between conditions.

Each graph should show:

- Theta
- Beta
- Real-time TBR

The purpose is to make it easy to visually compare the temporal EEG patterns between adaptive and non-adaptive conditions.

The individual session result plot can contain the TBR baseline and decision markers, but the homepage comparison plot should prioritize comparing:

```text
theta
beta
real-time TBR
```

---

## 1.5 Data persistence

Make sure the EEG history for a completed session is not lost when navigating back to the homepage.

Store enough session-level data to reconstruct the plots after navigation.

Keep adaptive and non-adaptive session data separated and clearly labeled.

If the current system already has participant/session data export, integrate these fields into the existing structure rather than introducing an unrelated parallel format.

---

## Acceptance criteria for Update 1

The implementation is complete when:

1. Adaptive session records theta, beta, TBR baseline, and real-time TBR for the entire session.
2. Non-adaptive session records the same EEG metrics.
3. Adaptive session records timestamps for Decision 1 and Decision 2.
4. Each completed session generates a readable 0–10 min plot.
5. Adaptive plots visibly annotate Decision 1 / Decision 2 events.
6. After both conditions are complete, the homepage shows adaptive and non-adaptive plots stacked vertically with aligned time axes.
7. Navigation does not erase the recorded session data.

---

# Update 2 — Real-Time EEG vs Pre-Recorded EEG Testing Mode

## Goal

Add a developer/testing mode that allows the entire EEG-driven system to run using a previously recorded 10-minute EEG dataset instead of waiting for a real Muse session.

This is specifically intended for rapidly debugging:

- EEG processing parameters
- TBR calculation
- thresholds
- Decision 1 behavior
- Decision 2 behavior
- adaptation timing

The same recorded EEG session should be reusable across different parameter configurations.

---

## 2.1 Homepage EEG source toggle

Add a toggle/control on the homepage:

```text
EEG Source

○ Real-time EEG
○ Pre-recorded EEG
```

Default behavior should remain:

```text
Real-time EEG
```

---

## 2.2 Real-time EEG mode

When:

```text
Real-time EEG
```

is selected, preserve the current NeuroScape behavior.

The system should:

- connect to/read the current EEG source exactly as it does now;
- run at normal real-time speed;
- use the current EEG processing pipeline;
- perform adaptations normally.

Avoid changing this path unnecessarily.

---

## 2.3 Pre-recorded EEG mode

When:

```text
Pre-recorded EEG
```

is selected:

1. Show a file-upload control.
2. Allow the developer to upload approximately 10 minutes of raw EEG data.
3. Feed this EEG data through the SAME processing pipeline used for real-time EEG.
4. Replay the EEG stream at **10× real-time speed**.

Therefore:

```text
10-minute EEG recording
→ approximately 1-minute testing run
```

The goal is not simply to visualize the recorded EEG.

The uploaded EEG should behave as a simulated EEG stream so that the rest of the system—including TBR computation and adaptation decisions—runs as if the data were arriving live.

---

## 2.4 Critical implementation principle

Do NOT create separate analysis logic for real-time EEG and pre-recorded EEG.

Prefer an architecture conceptually similar to:

```text
                    ┌─ Real-time EEG source
EEG input interface ┤
                    └─ Replay EEG source
                            ↓
                Shared EEG processing
                            ↓
                 Theta / Beta / TBR
                            ↓
                  Decision pipeline
                            ↓
                      Adaptation
```

Only the **data source and playback clock** should differ.

The following should remain shared:

- EEG preprocessing
- windowing
- artifact handling, if currently implemented
- theta calculation
- beta calculation
- TBR calculation
- TBR baseline
- eligibility logic
- Decision 1
- Decision 2
- adaptation logic
- logging
- visualization

This is important because the purpose of replay mode is to test exactly how the production system would respond to the same EEG data.

---

## 2.5 Time semantics during 10× replay

The EEG data should be replayed at 10× wall-clock speed, but the system should preserve the **original EEG/session timestamps** for analysis.

For example:

```text
Original EEG time: 300 seconds
Wall-clock replay time: 30 seconds
```

The analysis plot should still position this sample at:

```text
5:00
```

rather than:

```text
0:30
```

Likewise, Decision 1 / Decision 2 markers should be stored relative to the original session timeline.

This is necessary so that replay results remain directly comparable with real 10-minute sessions.

Any timer/cooldown/window logic that is fundamentally defined in terms of EEG/session time should therefore behave consistently under replay rather than accidentally becoming ten times longer relative to the data.

---

## 2.6 Replay result

Pre-recorded mode should produce the same debugging outputs as a real adaptive session:

- theta history
- beta history
- TBR baseline
- real-time TBR
- Decision 1 timestamps
- Decision 2 timestamps
- adaptation history
- final plot

This allows us to repeatedly upload the same EEG recording, modify parameters, rerun the simulation, and compare how the decisions change.

---

## 2.7 Input validation

Please handle at least these cases gracefully:

- file cannot be parsed;
- required EEG columns/channels are missing;
- recording is shorter than expected;
- recording is longer than 10 minutes;
- timestamps are missing or malformed.

Do not silently substitute fake EEG values.

If the exact supported raw EEG format is constrained by the current codebase/Muse export format, document the expected input schema clearly in the UI or README.

---

## Acceptance criteria for Update 2

The implementation is complete when:

1. Homepage contains an EEG source selector.
2. Real-time mode preserves existing system behavior.
3. Pre-recorded mode supports uploading raw EEG.
4. A 10-minute recording can run through the system at approximately 10× speed.
5. Replay uses the exact same downstream EEG/TBR/decision pipeline as real-time EEG.
6. EEG windows, cooldowns, decisions, and plots remain based on the original session timeline.
7. Replay mode generates Decision 1 / Decision 2 events normally.
8. The same EEG file can be rerun after parameter changes for debugging.

---

# Update 3 — Simplify Base Soundscapes and Remove Event Sounds

## Goal

Remove pre-scripted event sounds from both experimental conditions so that the experimental distinction is cleaner.

The initial soundscape should contain only the forest ambient layer plus the initial voice instruction.

---

# 3.1 Non-adaptive condition

Remove all event sounds from the non-adaptive condition.

The entire 10-minute non-adaptive soundscape should contain only:

```text
1. Initial voice instruction
2. Continuous ambient forest sound
```

There should be:

- no event sound injection;
- no scheduled sound events;
- no adaptation;
- no additional foreground environmental events.

The forest ambience should continue normally for the session.

Do not remove the initial voice guidance.

---

# 3.2 Adaptive condition base plan

Remove all event sounds from the **initial/base plan** of the adaptive condition.

At the start of the adaptive session, the soundscape should therefore also contain only:

```text
1. Initial voice instruction
2. Continuous ambient forest sound
```

This establishes the same starting soundscape as the non-adaptive condition.

---

## 3.3 Subsequent adaptation

After initialization, the adaptive condition should continue using the existing adaptation pipeline.

Conceptually:

```text
Initial state:
voice instruction + forest ambience
                ↓
EEG monitoring
                ↓
Decision 1
                ↓
Decision 2
                ↓
adaptive soundscape modification
```

Do NOT globally delete the event-sound capability from the adaptive system if Decision 2 may intentionally introduce sounds as part of an adaptation.

The requested change is:

> Remove event sounds from the adaptive **base plan**, not necessarily from the adaptation vocabulary.

In other words:

```text
Non-adaptive:
base ambience only → never adapts

Adaptive:
base ambience only → EEG-informed adaptation may subsequently modify the soundscape
```

This distinction is important.

---

# Cross-cutting constraints

While implementing these changes:

1. Do not modify the calibration algorithm as part of this task.
2. Do not redesign Decision 1 / Decision 2 unless necessary to support replay timing.
3. Do not duplicate EEG-processing logic for replay mode.
4. Avoid breaking the current real-time Muse workflow.
5. Avoid removing existing logging/data fields that may be needed for the user study.
6. Keep experimental-condition logic explicitly separated so that adaptive/non-adaptive data cannot accidentally overwrite each other.
7. Prefer small, modular changes over a large rewrite.
8. Add comments around replay-time/session-time handling because this is particularly important for future debugging.

---

# Expected deliverables

After inspecting the existing implementation, please:

1. Provide a short implementation plan.
2. List the files that need to change and why.
3. Implement all three updates.
4. Summarize the final changes by file.
5. Explain the expected raw EEG upload format.
6. Explain how the 10× replay clock is implemented.
7. Explain where the following data are stored:

   - theta
   - beta
   - TBR
   - TBR baseline
   - Decision 1 timestamps
   - Decision 2 timestamps

8. Report any assumptions you had to make based on the existing code.
9. Run the available tests/build checks and report any remaining issues.

Please do not make unrelated architectural or UI changes.
