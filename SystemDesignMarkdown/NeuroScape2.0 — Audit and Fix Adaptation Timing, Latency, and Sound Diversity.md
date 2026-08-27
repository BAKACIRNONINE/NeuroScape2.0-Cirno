# NeuroScape2.0 — Audit and Fix Three Remaining Adaptive Experience Issues

After the latest audible-execution feedback-loop fix, I observed three remaining issues during runtime:

1. The first actual audible sound adaptation does not occur until around **120 seconds**.
2. There is a noticeable delay between receiving the LLM Decision 2 result and the sound actually being rendered/audible.
3. Decision 2 repeatedly selects highly similar sounds even though the audio library contains many other valid assets.

Please treat these as three separate problems.

Do **not** immediately change thresholds or prompts.

First audit the real code path and identify the exact cause of each issue. Then make the smallest coherent fixes.

---

# Issue 1 — Why does the first audible adaptation occur only around 120s?

I want to understand the complete timing chain before changing adaptation frequency.

Please trace session time from `0s` until the first actual `AUDIO_STARTED`.

For every potential planning opportunity, report:

```text
session time
EEG checkpoint?
eligibility result
Decision 1 called?
Decision 1 result
Decision 2 called?
Decision 2 result
patch validated?
PLAN_APPLIED?
plannedStartMs
RUNTIME_ACTIVATED?
audioStartMs
```

Specifically inspect all timing mechanisms that could delay the first adaptation:

- opening / settling period;
- EEG analysis-window requirement;
- checkpoint interval;
- eligibility rules;
- cooldown;
- minimum evidence/history requirements;
- Base Plan restrictions;
- Decision 1 returning `maintain`;
- Decision 2 returning no patch;
- patch validation;
- `freezeBufferMs`;
- future execution-time normalization;
- transition duration;
- runtime scheduling;
- asset loading.

I want an explicit equation/timeline showing why the first audible adaptation occurs at ~120s.

For example:

```text
0–X s      calibration/opening
X s        first eligible checkpoint
X–Y s      Decision 1 / Decision 2
Y s        patch validated
Y + buffer planned execution
Z s        AUDIO_STARTED
```

Do not assume that 120s is caused by checkpoint frequency. Prove the actual cause from the code.

### Desired behavior

I do NOT necessarily want aggressive or very frequent adaptation.

However, if the system identifies a strong need for adaptation early in the session, I do not want architecture-level delays to unnecessarily postpone the first audible intervention.

After identifying the cause, distinguish:

```text
intentional research/design constraint
vs.
unintended implementation delay
```

Only remove unintended delay.

Do not change the scientific EEG interpretation or Decision 1 logic merely to make the system react faster.

---

# Issue 2 — Decision 2 result → actual audible playback latency

There is currently a noticeable delay after Decision 2 returns before the participant hears the sound.

Please instrument and trace this latency precisely.

For one successful adaptation, report:

```text
decision2RequestStartMs
decision2ResponseMs
patchValidationCompleteMs
planAppliedMs
plannedStartMs
runtimeActivationMs
assetLoadStartMs
assetLoadCompleteMs
audioStartMs
```

Then calculate:

```text
LLM latency =
decision2ResponseMs - decision2RequestStartMs

post-LLM planning latency =
planAppliedMs - decision2ResponseMs

intentional scheduling delay =
plannedStartMs - planAppliedMs

runtime scheduling delay =
runtimeActivationMs - plannedStartMs

asset loading delay =
audioStartMs - runtimeActivationMs

total Decision2-to-audio delay =
audioStartMs - decision2ResponseMs
```

I need to know which component actually dominates the perceived delay.

### Inspect especially:

#### A. `freezeBufferMs`

Determine:

- current value;
- where it is applied;
- why it exists;
- whether it is larger than technically necessary;
- whether it causes a noticeable artificial gap after Decision 2.

Do not remove it blindly if it protects stale-plan execution.

#### B. Asset loading

Check whether adaptive assets are loaded only when Runtime becomes active.

If yes, investigate whether adaptive candidate assets can be safely **preloaded before their scheduled start**.

Preferred principle:

> Asset loading should not determine the participant's audible adaptation timing when the asset was already known from the validated Plan.

Possible architecture:

```text
PLAN_APPLIED
→ preload selected asset
→ wait until plannedStartMs
→ AUDIO_STARTED at plannedStartMs
```

instead of:

```text
plannedStartMs reached
→ start loading
→ decode
→ AUDIO_STARTED late
```

Please reuse existing AudioAssetManager caching if available.

Do not duplicate audio buffers unnecessarily.

#### C. Runtime tick granularity

Quantify the maximum expected delay introduced by runtime update frequency.

Do not optimize it unless it materially affects the audible delay.

### Desired outcome

The participant should hear the adaptation as close as technically possible to the validated `plannedStartMs`.

We should preserve:

```text
plannedStartMs
runtimeActivationMs
audioStartMs
```

as separate recorded timestamps.

Do not hide residual delay.

---

# Issue 3 — Decision 2 repeatedly selects highly similar sounds

The audio library contains many assets, but Decision 2 appears to repeatedly choose the same or very similar sounds.

Please audit the entire sound-selection pipeline:

```text
audio library
→ metadata
→ retrieval
→ candidate filtering
→ candidate ranking
→ Decision 2 prompt
→ LLM selection
→ adaptation history
```

I need to know whether the lack of diversity is caused by:

- candidate retrieval returning only a narrow subset;
- semantic metadata being too similar;
- ranking strongly favoring a few assets;
- recommended gain/salience constraints removing alternatives;
- layer restrictions;
- environment restrictions;
- Decision 1 intent narrowing candidate types;
- Decision 2 prompt encouraging conservative reuse;
- previous sound history not being passed to Decision 2;
- previous sound history being passed but not emphasized;
- no repetition penalty;
- no recency penalty;
- no diversity criterion;
- certain sounds having richer descriptions and therefore being easier for the LLM to select;
- asset IDs / descriptions unintentionally biasing the LLM.

For at least 5 representative Decision 2 calls, show:

```text
Decision 1 intent

full eligible library size

retrieved candidate count

candidate assetIds + metadata

previously used assets

Decision 2 selected asset

why that asset was selected
```

This is important:

> I do not want random sound selection merely for diversity.

The LLM should still choose the sound that best supports its current reasoning.

But when multiple candidates are semantically appropriate, the system should avoid unnecessary repetition and encourage meaningful variation.

---

# Sound diversity design principle

Please preserve the LLM as the semantic decision maker.

Do NOT implement:

```text
randomly choose a different sound
```

after the LLM makes its decision.

Instead, improve the information and candidate-selection context available to Decision 2.

Preferred architecture:

```text
Current EEG / attention context
+
scene context
+
recent adaptation history
+
recently played assets
+
candidate sound metadata
↓
LLM Decision 2
↓
semantically appropriate selection
```

Potentially provide Decision 2 with explicit recent-use metadata such as:

```ts
recentlyUsedAssets: [
  {
    assetId,
    lastPlayedMs,
    useCount,
    lastIntent
  }
]
```

and instruct it conceptually:

> Avoid recently used or perceptually redundant assets when another equally appropriate candidate can achieve the current adaptation intent. Reuse is allowed when it is clearly the best semantic choice.

Do NOT impose a hard ban on reuse unless there is already a justified repetition policy.

---

# Check candidate diversity before changing the prompt

Before changing Decision 2 prompting, verify whether the LLM actually receives a diverse candidate set.

For each relevant layer, report:

```text
total assets in library
eligible assets after filtering
assets returned by retrieval
assets shown to Decision 2
```

Also group candidate assets by meaningful characteristics if metadata supports them, such as:

```text
layer
sound family
semantic function
salience
spatial behavior
environment compatibility
grounding / orienting / engagement function
```

If the candidate retrieval stage already collapses 30 assets into 3 nearly identical leaf/bird sounds, fix retrieval first rather than blaming the LLM.

---

# Check repetition history

Verify whether Decision 2 currently knows:

```text
what sounds were recently played
how many times each was used
when each was last used
what adaptation intent it served
whether it was actually experienced
```

Use **experienced/audio-started history**, not merely Plan-applied history.

A sound that was planned but never played should not count as a recently experienced sound.

---

# Desired behavior

The final system should balance:

```text
semantic appropriateness
+
scene coherence
+
adaptation intent
+
recent sound history
+
perceptual diversity
```

The goal is NOT maximum novelty.

The goal is:

> avoid repetitive, perceptually redundant choices when other equally suitable sounds exist.

---

# Required observability additions

Please make these three issues measurable in future sessions.

For every adaptation, persist enough timing data to derive:

```text
Decision 2 response → Plan applied
Plan applied → planned start
planned start → runtime activation
runtime activation → audio start
Decision 2 response → audio start
```

For sound selection, persist or trace:

```text
eligibleCandidateCount
retrievedCandidateIds
recentlyUsedAssetIds
selectedAssetId
```

If storing the entire candidate metadata would make recordings unnecessarily large, store IDs and relevant ranking/selection metadata only.

---

# Required final report

Before modifying code, report the root cause for each issue.

## Issue 1

Explain exactly why the first audible adaptation currently occurs around 120s.

Break down every intentional and accidental delay.

## Issue 2

Give the measured/expected Decision2-to-Audio latency decomposition:

```text
LLM
validation
freeze/scheduling
runtime
asset loading
audio scheduling
```

Identify the dominant component.

## Issue 3

Explain why similar sounds are repeatedly selected.

Show whether the bottleneck is:

```text
library
retrieval
candidate filtering
ranking
prompt
history
LLM preference
```

Then implement the smallest justified fixes.

---

# Constraints

Do NOT modify unless directly required:

- EEG calibration;
- TBR formula;
- AttentionInterpreter semantics;
- HRTF behavior;
- Validated Plan authority model;
- audible lifecycle evidence;
- Adaptive vs Non-adaptive rendering architecture;
- Base Plan content.

Do not increase adaptation frequency simply to make the system feel more adaptive.

Do not add random sound selection after Decision 2.

Do not remove scheduling safeguards without identifying their purpose.

---

# Success criteria

After this task we should be able to explain and verify:

### Timing

> Why did this adaptation happen at this exact session time?

### Latency

> How many milliseconds elapsed between Decision 2 and actual audio playback, and which component caused the delay?

### Selection

> Why did the LLM select this sound instead of the other available candidates, and did it know what the participant had recently heard?

The fixes should make the adaptive experience more responsive and varied **without sacrificing semantic reasoning, scene coherence, deterministic execution, or experimental traceability**.