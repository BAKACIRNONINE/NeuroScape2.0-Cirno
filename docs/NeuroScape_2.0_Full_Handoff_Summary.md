# NeuroScape 2.0 — Project Handoff Summary for Follow-up GPT

> **Purpose**  
> This file summarizes the NeuroScape 2.0 discussions, decisions, implementation changes, study design, architecture evolution, pilot-debugging findings, current known issues, and recommended next steps so that another GPT conversation can continue the work without reconstructing the context from scratch.
>
> **Current date/context:** late August 2026  
> **Primary target:** CHI 2027 long paper / final user study preparation  
> **Project repository:** `https://github.com/yujianing0210/NeuroScape2.0`

---

# 1. Project overview

## 1.1 Core project idea

**NeuroScape** is an EEG-informed adaptive spatial soundscape system for meditation.

The current 2.0 concept is:

```text
Muse 2 EEG
   ↓
EEG interpretation / attention-state estimation
   ↓
Deterministic eligibility + safety logic
   ↓
Decision 1 LLM
Should the soundscape change?
Why?
What scope?
   ↓
Decision 2 LLM
What semantic/spatial acoustic change should happen?
   ↓
Deterministic technical materialization
   ↓
Spatial audio runtime
   ↓
User experiences adaptive 3D soundscape
```

The main research emphasis has shifted away from claiming precise or diagnostic EEG detection of "mind wandering."

The preferred framing is closer to:

> **an EEG-informed adaptive spatial soundscape system that periodically interprets attention-related EEG signals and uses them to guide restrained semantic/spatial soundscape adaptation.**

Important scientific caution:

- EEG/TBR is not treated as a direct or diagnostic measurement of mind wandering;
- calibration gives an empirical personal reference, not a minimum/maximum of attention;
- positive TBR delta does not mean objective mind wandering;
- negative TBR delta does not automatically mean “better” or “more focused”;
- the system should be framed as **EEG-informed** rather than an objective mind-state detector.

---

# 2. Research framing evolution

## 2.1 Earlier framing concerns

Earlier versions overemphasized:

- calibration itself as a major contribution;
- EEG-to-attention mapping as if it were a precise measurement;
- spatial vs. non-spatial audio as the central comparison;
- the possibility of overcomplicating the system with a 2D spatial mental map.

The project was gradually reframed toward:

- **adaptive spatial experience**;
- **semantic scene planning**;
- **embodied spatial awareness**;
- **LLM-guided soundscape composition**;
- EEG as a periodic adaptive signal rather than the paper’s main novelty.

## 2.2 Current conceptual emphasis

The most promising high-level framing discussed is:

> NeuroScape translates attention-related EEG variation into restrained evolution of a spatial acoustic world.

The spatial metaphor is important:

- awareness can be experienced as a field or space;
- the user is not just hearing “background sounds”;
- environmental audio can establish an experienced place;
- transitions between places can become a form of embodied spatial navigation;
- footsteps and breathing can act as **embodied anchors** without requiring a literal game-like map.

A useful distinction:

```text
Local Acoustic Adaptation
= change inside the current place

Spatial Progression
= move to an adjacent semantic place

Adaptive Journey
= the accumulated sequence of local adaptations + spatial progressions
```

No third “Journey Planner” LLM should be introduced in v1.

---

# 3. User study context

## 3.1 General study

Current study structure is centered around a 10-minute adaptive meditation condition and a matched/non-adaptive condition.

The adaptive condition uses:

- Muse EEG;
- periodic reasoning;
- spatial environmental audio;
- LLM-guided acoustic adaptation.

The non-adaptive/control condition should preserve as much of the system as possible except the EEG-driven adaptive decision loop.

Preferred control principle discussed:

> keep the same audio materials, spatialization, scene changes, and rendering pipeline, but remove EEG → decision → adaptation.

A possible control implementation is a frozen/pre-generated journey.

## 3.2 Recruitment / practical details

Recent recruitment work included:

- on-site study in Boston / Harvard campus;
- late August to early September;
- roughly 60–70 minute session;
- compensation around $10;
- reminder email and participant logistics.

## 3.3 IRB context

There were PI eligibility complications with the original instructor.

Current practical IRB-related emphasis has been:

- study materials prepared;
- recruitment language intentionally avoids overstating EEG/adaptive claims;
- study process should remain compliant with the approved protocol.

---

# 4. Calibration evolution

## 4.1 Original problem

Earlier calibration logic used two practice conditions:

- Focus Breath
- Free Thought

The concern was that the system effectively treated the resulting values as if they were minimum and maximum attention / mind-wandering values.

This was conceptually wrong because the calibration sessions do not guarantee:

- maximal focus;
- maximal mind wandering.

## 4.2 Current approach

The system moved toward a **single guided-breathing baseline reference**.

The baseline is:

- empirical;
- user-specific;
- not a diagnostic bound;
- used to interpret later relative TBR deviations.

Current feature framing:

```text
baselineLogTbr
baselineMad
baselineScale
effectiveBaselineScale
```

Recent pilot calibration quality was good:

- 29 valid epochs out of 30 expected;
- baseline available;
- quality status = pass.

The current calibration feature version observed in the latest study result was:

```text
raw_welch_frontal_log_tbr_guided_baseline_protocol_v5
```

---

# 5. System architecture evolution

## 5.1 Earlier architecture

The initial implementation had:

- hard-coded location graph;
- rule-heavy audio retrieval;
- many numeric heuristic fields;
- Decision 2 receiving a large technical candidate object;
- code strongly influencing which sound was considered “appropriate.”

The key criticism was:

> the retrieval layer had become too rule-based and was partially deciding semantic appropriateness before the LLM ever saw the candidates.

## 5.2 Core architecture principle adopted

The agreed architecture principle became:

> **Code decides what sounds are feasible; the LLM decides which feasible sound is most appropriate.**

More specifically:

```text
Code:
- safety
- cooldowns
- session limits
- technical validity
- adjacency
- playback constraints

Decision 1:
- adapt vs maintain
- why
- scope
- salience

Decision 2:
- semantic/spatial choice
- destination
- asset choice
- conceptual acoustic role

Deterministic materializer:
- exact gain
- fade
- duration
- playback mode
- position/motion
- actual patch
```

## 5.3 Current target architecture

The current intended architecture is:

```text
EEG
↓
Attention Interpreter
↓
Deterministic Eligibility
↓
Decision 1
Should the world change?
↓
maintain / adapt
            ↓
      local evolution
      OR spatial progression
            ↓
Semantic Scene Graph
(current + adjacent locations)
            ↓
Hard Audio Eligibility
            ↓
Decision 2 LLM
WHERE + WHAT + WHY
            ↓
Deterministic Materializer
            ↓
Deterministic Validator
            ↓
Spatial Runtime
```

No separate Route Planner LLM is desired.

---

# 6. Audio Library architecture

## 6.1 Three JSON resources created

Three JSON resources were created and placed by the user in:

```text
packages/contracts/src
```

Files:

```text
audio_library_semantic_v1.json
scene_graph_v1.json
audio_library_synced.json
```

Their intended roles are different.

### `audio_library_semantic_v1.json`

Canonical source for **what sounds mean**.

Contains semantic fields such as:

```text
asset_id
label
description
layer
source_environment
semantic_function
semantic_tags
spatial_character
quality_tier
hard_dependencies
```

It intentionally avoids making old heuristic ranking fields canonical.

### `scene_graph_v1.json`

Canonical source for the **spatial world**:

- nodes;
- adjacency;
- semantic place description;
- acoustic character;
- transition edges;
- audio coverage.

It should describe:

> what a place is and where one can go

not:

> what EEG state should map to that place.

### `audio_library_synced.json`

Runtime-compatible migration snapshot.

Used to preserve real technical facts such as:

- file path;
- loop;
- playback contract;
- gain bounds;
- fades;
- durations;
- default spatial behavior;
- session limits.

---

# 7. Important Audio Library corrections

## 7.1 Waterfall correction

Asset ID retained for compatibility:

```text
forest_water_drop_far_01
```

But the recording is actually a **distant waterfall**, not a literal water drop.

Semantic identity should be:

```text
Distant Forest Waterfall
```

The old name remains only as a stable asset ID.

Important implication:

> this asset can be a meaningful spatial water landmark, especially for Stream Bank → Waterfall transitions.

## 7.2 Ocean waves duplicate

The user confirmed:

```text
ocean_waves
```

and

```text
ocean_waves_soft_01
```

are the same recording.

Canonical ID chosen:

```text
ocean_waves_soft_01
```

`ocean_waves` should only be treated as an alias / old source identifier.

There must not be two separately selectable wave sounds for the same recording.

## 7.3 City Park assets

Current City Park assets include approximately:

```text
citypark_walk_on_the_street
citypark_light_street_ambience
citypark_dog
```

Earlier metadata was placeholder/TBD and was semantically cleaned.

## 7.4 Lakeside river

Asset:

```text
stream_lakeside_river
```

represents a broad, calm freshwater river / lakeside water ambience.

This is important as a persistent water foundation.

---

# 8. Semantic Scene Graph v1

## 8.1 Final graph

The agreed v1 graph is:

```text
                         Dense Forest
                              ▲
                              │
                       Forest Clearing
                          START
                       /             \
                      /               \
               Stream Bank         Forest Edge
                WATER HUB       CROSS-SCENE HUB
                /      \           /       \
               /        \         /         \
       Waterfall      Lakeside  City Park  Beach Shore
        Vicinity        River
```

Canonical node IDs:

```text
forest_clearing
dense_forest
stream_bank
waterfall_vicinity
lakeside_river
forest_edge
city_park
beach_shore
```

## 8.2 Node semantics

### Forest Clearing

Shared starting location.

Characteristics:

- forest-enclosed but somewhat open;
- stable;
- protected;
- default forest ambience.

### Dense Forest

More enclosed and close-textured.

Possible assets:

- alternate forest ambient;
- insects;
- rustles;
- sparse owl;
- small animal sounds.

### Stream Bank

Forest remains present, but water becomes a clear spatial anchor.

Important destination foundation:

```text
stream_lakeside_river
```

### Waterfall Vicinity

Water becomes stronger and more localized.

Important landmark:

```text
forest_water_drop_far_01
```

interpreted as waterfall.

### Lakeside River

Broad, calm, expansive freshwater soundscape.

### Forest Edge

Threshold / transition node.

Important conceptual role:

- forest becomes less enclosed;
- external world starts entering;
- gateway toward Beach or City Park.

### City Park

Natural + light urban coexistence.

### Beach Shore

Open, horizontal, expansive.

Important assets:

- ocean waves;
- breeze;
- shoreline wash;
- shorebirds;
- footsteps on wet sand.

---

# 9. Scene Graph design principles

The Scene Graph should **not** become another rule engine.

Do NOT encode mappings like:

```text
attention_low -> stream_bank
grounding -> lakeside_river
refresh -> beach
```

The node tells the system:

> what the place is.

Decision 2 determines:

> whether the place is appropriate now.

The Scene Graph constrains adjacency, not mental-state interpretation.

---

# 10. Progression Pressure

A dedicated `progressionPressure` concept was introduced.

Purpose:

> prevent indefinite spatial stasis without forcing route transitions.

Suggested values:

```text
low
medium
high
```

Important rule:

```text
high progression pressure ≠ MUST transition
```

It only means:

> spatial progression is increasingly worth considering.

A scene transition may be:

- EEG-informed;
- progression-driven;
- mixed;
- continuity-preserving.

Important scientific framing:

If a transition is progression-driven, the system must not describe it as:

> EEG detected mind wandering.

---

# 11. Decision 1 responsibilities

Decision 1 currently decides:

```text
adapt / maintain
intent
salience
scope
adaptation basis
reason
constraints for Decision 2
```

Typical intents:

```text
gently_reorient_attention
support_grounding
reduce_stimulation
support_sustained_focus
refresh_engagement
preserve_recovery
maintain
```

Scope:

```text
within-scene
scene-transition
maintain
```

Important scientific rules:

- no objective mind-wandering claim;
- one checkpoint is insufficient;
- low-confidence EEG cannot support a corrective claim;
- high progression pressure can support non-corrective scene evolution;
- Decision 1 should not select the sound asset or destination.

Recent insight:

> Decision 1 was still sometimes micromanaging Decision 2 too much, e.g. saying “use one brief natural cue,” which indirectly causes repetitive bird/leaf choices.

Recommended change:

Decision 1 constraints should focus on:

- scope;
- salience ceiling;
- continuity;
- safety;
- evidentiary framing;

and avoid prescribing:

- event vs ambient;
- bird vs leaf;
- specific acoustic tactic.

---

# 12. Decision 2 responsibilities

Decision 2 should receive:

- D1 intent/scope/salience;
- current node;
- reachable nodes;
- edge semantics;
- compact semantic audio cards;
- active soundscape;
- recent sound history;
- progression pressure;
- recent journey history;
- factual capacity.

It decides:

```text
WHERE
WHAT
WHY
```

It should not decide:

```text
exact gain
exact fade
exact duration
exact playback mode
exact repeat count
exact XYZ
```

Those belong to deterministic materialization.

---

# 13. Retrieval redesign

Old retrieval used too many heuristics, including:

```text
priority
selection_weight
use_when
avoid_when
suddenness
intensity
numeric recency penalties
top-K per layer
```

The intended redesign is:

```text
Hard eligibility only
+
graph-local candidate scope
+
LLM semantic selection
```

Examples of legitimate hard eligibility:

- technical record exists;
- real file exists;
- planner eligibility;
- cooldown;
- session max appearances;
- hard dependency;
- supported layer;
- valid graph scope;
- not a session-only opening/control asset.

The current library is small enough that no numeric top-K semantic ranking is needed.

---

# 14. Deterministic materializer

A deterministic compiler/materializer was introduced after Decision 2.

It should own:

```text
gain
fade
duration
playback mode
repeat behavior
event lifecycle
position/motion
activation timing
body attachment
```

The LLM selects the semantic intent.

Code compiles that into valid audio execution.

---

# 15. Early implementation issue: scene transition state persistence

An earlier pilot exposed:

```text
Planner current node = stream_bank
Runtime listener.semanticLocation = forest_clearing
```

This was a serious inconsistency.

The architecture was updated so that:

- scene transition updates the journey;
- arrival is persisted;
- runtime semantic location is committed.

Latest pilot results show this issue has improved / been fixed:

> runtime now successfully commits `stream_bank` after arrival.

---

# 16. Cooldown and cadence changes

There were several important parameter changes during pilot debugging.

The user changed:

```text
adaptation cooldown = 5 s
LLM/checkpoint interval = 20 s
```

Important interpretation:

Even with a 5 s cooldown:

> the fastest possible new D1 decision is still every 20 seconds.

The 5-second value is only a hard operational floor.

An earlier system had:

```text
checkpointIntervalMs = 40 s
adaptationCooldownMs = 80 s
sceneTransitionCooldownMs = 200 s
```

These old values should not be accidentally restored.

---

# 17. Patch-budget issue discovered

An earlier pilot showed:

- D1 continued returning `adapt`;
- only 6 patches were ultimately applied;
- later changes stopped.

This matched the old config:

```text
maxCumulativePatches = 6
targetAdaptationsMin = 5
targetAdaptationsMax = 6
```

A debugging pass was created to distinguish:

```text
target adaptation count
```

from:

```text
hard safety ceiling
```

Recommended pilot ceiling discussed:

```text
maxCumulativePatches ≈ 10
```

with explicit rejection logging.

---

# 18. Transition timing issue

An earlier system had:

```text
sceneTransitionCooldownMs = 200 s
```

This made two transitions in a 10-minute session nearly impossible if the first transition happened late.

Recommended pilot change:

```text
sceneTransitionCooldownMs ≈ 120 s
maxSceneTransitions = 2
```

However, the latest study shows that **cooldown is not the only reason transitions happen late**.

The first transition proposal can happen earlier but be rejected during validation.

---

# 19. Latest pilot study result — key findings

Latest uploaded session:

```text
participantId: P002
sessionId: session-20260830014232555-2d5924e7
duration: 600000 ms
plannerMode: openai
basePlanVersion: base_plan_v5_constrained_journey
```

Calibration passed.

No finalization errors.

The study felt somewhat better than the previous version, but the user noticed:

- event sounds are too short;
- event sounds are often too quiet relative to ambient;
- sometimes triggered events are barely audible or inaudible;
- footsteps are too short;
- scene transitions feel abrupt rather than like actual travel;
- scene transitions often happen around 6–7 minutes;
- repeated runs tend toward stream or forest;
- beach / city park rarely or never appear.

These perceptions were supported by the logs.

---

# 20. Latest pilot — event audibility issue

Observed events included approximately:

```text
120 s -> forest_bird_far_01
160 s -> forest_leaf_rustle_mid_01
200 s -> forest_bird_far_02
```

Typical event target gain:

```text
~0.17–0.204
```

Base ambient gain:

```text
0.38
```

Thus even before source-loudness differences, the event is already significantly quieter.

More importantly:

- some bird events had runtime activation records but no `audioStartedAtMs`;
- leaf rustle did actually start;
- leaf rustle effective exposure was only around 5 seconds.

This suggests two separate issues:

1. some triggered assets may fail to truly start playback;
2. short-event fade/envelope policy suppresses their perceptual presence.

---

# 21. Latest pilot — short-event envelope problem

The system still appears to use something like:

```text
transition duration ≈ 5 s
```

for short events.

For a 6–7 second bird/leaf asset:

- a long fade-in consumes most of the asset;
- there is little or no audible plateau;
- fade-out begins almost immediately;
- maximum runtime gain may remain far below intended target gain.

Recommended direction:

### Separate these concepts

```text
General / scene transition duration
≠
short event envelope
```

Suggested short-event envelope:

```text
fade in: 0.5–1.0 s
plateau: 3–5 s
fade out: 0.5–1.5 s
```

Waterfall or other abruptly edited sources may use longer bespoke fades.

---

# 22. Loudness normalization idea

Because source recordings can have very different intrinsic loudness, raw gain values are not comparable enough.

Potential improvement:

Offline precompute per asset:

```text
RMS / integrated loudness / LUFS-like metric
normalization gain
```

Then runtime mixing becomes:

```text
normalized asset loudness
×
semantic mix gain
```

This would make event vs ambient balance more reliable.

This is not yet implemented, but is considered a useful perceptual refinement.

---

# 23. Footstep issue

Latest successful transition:

```text
forest_clearing
→ stream_bank
```

The system-generated locomotion cue was:

```text
forest_body_slow_creek_steps_01
```

but it lasted only about:

```text
~5 seconds planned
~4 seconds effective exposure
```

This is why the transition feels like:

> a few quick footsteps

rather than:

> slowly walking from one place to another.

---

# 24. Major new design insight: Scene Transition should mean “Traversing an Edge”

The strongest current direction is:

> **Do not treat scene transition as an instantaneous node swap. Treat it as a 20–30 second spatial choreography across an edge.**

Current conceptual model:

```text
Node = place
Edge = experience of moving between places
```

Example 25-second transition:

```text
0–5 s:
origin scene still dominant
destination faintly previewed

5–15 s:
footsteps / body movement begins
origin slowly attenuates

10–22 s:
destination ambience becomes increasingly audible
directionality becomes clearer

22–25 s:
footsteps fade out
destination ambience stabilizes
semantic arrival commits
```

Example:

```text
Forest Clearing
↓
forest background begins softening
↓
walking / breathing support
↓
water gradually appears in the distance
↓
river gets louder and spatially clearer
↓
footsteps stop
↓
arrive at Stream Bank
```

This is a central proposed refinement.

---

# 25. Embodied transition cues: footsteps and breathing

Footsteps and breathing should have different roles.

```text
Footsteps
= external locomotion cue

Breathing
= internal body-relative attentional anchor
```

A scene transition can potentially use:

```text
none
breath
locomotion
breath + locomotion
```

The system should not mechanically use both every time.

A richer transition can be:

```text
old ambient
↓
breathing subtly appears
↓
footsteps begin
↓
destination starts approaching
↓
old ambient recedes
↓
footsteps end
↓
breathing briefly remains
↓
new place stabilizes
```

This creates a more embodied sense of spatial movement.

---

# 26. Latest pilot — why first scene transition was late

The first major transition proposal happened earlier than the final transition.

Approximate sequence:

```text
~340 s
Decision 1:
progression-driven scene transition

Decision 2:
forest_clearing -> dense_forest
```

But the patch failed validation.

Reason:

```text
target_not_suppressible
```

Decision 2 wanted to suppress the base forest ambient:

```text
forest_ambient_bed_01
```

but the base ambient was not suppressible.

Thus the transition opportunity was lost.

Later:

```text
~420 s
forest_clearing -> stream_bank
```

succeeded.

Arrival was around:

```text
~440 s
```

or approximately 7:20 into the session.

Thus:

> the transition was late not just because of cooldown; the earlier transition attempt was rejected.

---

# 27. Transition validation lesson

The transition system must understand that changing destination identity may require:

- attenuating origin ambient;
- crossfading;
- replacing or lowering base layers.

If the base ambient is permanently non-suppressible / non-adjustable, certain destinations become difficult to represent.

Potential policy refinement:

> base ambient should remain protected from destructive removal, but scene transition should be allowed to **attenuate/crossfade** it when needed.

This is preferable to forcing D2 to suppress a protected element and then rejecting the transition.

---

# 28. Persistent destination acoustic identity

An earlier bug was:

```text
forest
→ footsteps
→ waterfall event
→ forest again
```

instead of:

```text
forest clearing
→ transition
→ stream bank
→ stream ambience remains
```

The architecture was changed to require persistent destination identity.

Current intended rule:

> a scene transition is not complete unless a destination-defining acoustic layer persists after arrival.

Example Stream Bank:

```text
stream_lakeside_river
+
reduced forest ambience
```

The latest implementation improved this behavior.

---

# 29. Why beach and city park rarely appear

This is not mainly a numeric weighting issue.

It is primarily a **graph topology + representation bias**.

From:

```text
forest_clearing
```

the first reachable nodes are:

```text
dense_forest
stream_bank
forest_edge
```

Beach and City Park are second-hop destinations:

```text
forest_clearing
→ forest_edge
→ beach_shore
```

or:

```text
forest_clearing
→ forest_edge
→ city_park
```

If the first scene transition happens around 6–7 minutes, there is no time for the second hop.

Thus beach and city park are structurally disadvantaged.

---

# 30. Forest Edge representation bias

Among first-hop nodes:

### Dense Forest has clear acoustic identity

```text
forest_ambient_bed_02
```

### Stream Bank has clear acoustic identity

```text
stream_lakeside_river
```

### Forest Edge is weak

Its foundation may still be:

```text
forest_ambient_bed_01
```

which is already the starting sound.

Thus Decision 2 sees:

```text
Dense Forest:
clearly representable

Stream Bank:
clearly representable

Forest Edge:
not very different from current scene
```

This makes Stream/Dense Forest more likely even without explicit weights.

The issue is better understood as:

> **representation bias, not numeric weight bias.**

---

# 31. Proposed Forest Edge fix

No new audio recording is necessarily required.

Existing asset:

```text
forest_wind_leaves_01
```

can help define Forest Edge.

Example acoustic identity:

```text
forest_ambient_bed_01:
0.38 → 0.20

forest_wind_leaves_01:
0 → 0.30

spatial field:
enclosed → open/wide/directional
```

Important design change:

> destination acoustic identity should not require only a `foundation` layer.

A persistent `supporting_ambient` can also define the destination.

This would make Forest Edge a perceptually meaningful place.

Then Beach / City Park become much more plausible second-hop destinations.

---

# 32. Participant variability vs structural bias

Different participants can produce different:

- EEG patterns;
- adaptation timing;
- D1 intent;
- salience;
- escalation.

Therefore the route can vary.

However:

> changing the participant alone is not expected to solve route diversity if the Scene Graph and audio coverage structurally favor Stream Bank / Dense Forest.

If repeated pilot sessions continue to choose Stream or Dense Forest, this should be treated as an architecture signal rather than random participant variance.

---

# 33. Recommended progression timing

To allow meaningful two-hop journeys in 10 minutes, the system should create an opportunity for the first major transition earlier.

A useful experiential target discussed:

```text
first major transition:
~3:30–5:00

second major transition:
~6:00–7:30
```

This should **not** become a fixed schedule.

Suggested progression-pressure direction:

```text
medium:
~90–120 s

high:
~160–180 s
```

Then Decision 1 can increasingly consider non-corrective spatial progression.

Still:

```text
high progression pressure ≠ forced transition
```

---

# 34. Current preferred experiential hierarchy

The system should feel like a layered evolving environment.

A useful hierarchy:

```text
1. Stable ambient foundation
2. Local spatial event / subtle acoustic change
3. Embodied anchor (breath / footsteps)
4. Gradual scene-edge traversal
5. New destination stabilizes
6. Further local evolution
7. Optional second spatial progression
8. Quiet closing
```

This is richer than simply:

```text
ambient + occasional event
```

but more restrained than:

```text
game-like continuous navigation
```

---

# 35. Current high-priority issues

## P0 — event playback correctness

Some triggered bird events may activate in runtime but not actually start audio.

Need to debug:

```text
runtimeActivated
vs
AUDIO_STARTED
```

No event-gain tuning should be trusted until actual playback is verified.

## P0 — short-event envelope

Short events should not use long 5-second transition envelopes.

## P0 — 20–30 second edge traversal

Scene transitions should become temporal/spatial sequences, not instant patches.

## P1 — earlier first spatial progression

Give the system time for a second meaningful transition.

## P1 — Forest Edge identity

Fix route diversity by strengthening the Forest Edge representation.

## P1 — transition crossfade permissions

Avoid validation failures caused by trying to suppress a non-suppressible base ambient.

---

# 36. Codex instruction documents created

Two major Codex handoff documents were created during the discussion.

## 36.1 Full architecture migration

File previously generated:

```text
CODEX_INSTRUCTION_NeuroScape_Constrained_Adaptive_Journey_v1.md
```

It describes the migration toward:

```text
Semantic Scene Graph
+
Progression Pressure
+
Decision 1
+
Semantic Decision 2
+
Deterministic Runtime
```

## 36.2 Pilot debugging / architecture fix

File previously generated:

```text
CODEX_Pilot_Debugging_Architecture_Fix.md
```

It addressed:

- patch-budget ceiling;
- runtime/planner location synchronization;
- persistent destination ambience;
- scene transition cooldown;
- D1 overconstraint;
- D1 adapt terminal status logging;
- locomotion cues;
- replay tests.

The next likely Codex document should be something like:

```text
CODEX_Perceptual_Audio_and_Spatial_Transition_Refinement.md
```

focused on:

- event audibility;
- short-event envelopes;
- source loudness normalization;
- 20–30 second edge traversal;
- footsteps / breath choreography;
- crossfading old/new ambience;
- earlier progression opportunity;
- Forest Edge representation;
- route diversity.

---

# 37. Current logging philosophy

For study/debugging, every D1 `adapt` should end with a visible terminal status.

Examples:

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

The system should separately log:

```text
LLM selected
materialized
validated
runtime activated
audio started
audio finished
effective exposure
```

This distinction became important because an event can be:

```text
selected
runtime activated
but never actually audible
```

---

# 38. Important architectural invariants

The following principles should be preserved unless explicitly reconsidered.

1. Decision 1 does not select assets.
2. Decision 1 does not select destination nodes.
3. Decision 2 does not reinterpret raw EEG.
4. There are only two LLM calls.
5. Scene Graph defines adjacency and place semantics, not EEG-to-place mappings.
6. Audio retrieval enforces feasibility rather than semantic appropriateness scoring.
7. Decision 2 gets compact semantic cards, not dozens of raw technical parameters.
8. Exact playback numbers are deterministic.
9. Scene transition becomes authoritative only after runtime arrival/commit.
10. Spatial progression can be non-corrective.
11. Different participants can take different routes.
12. The system should avoid fixed routes.
13. A destination must be perceptually established after transition.
14. Footsteps represent locomotion, not the destination.
15. Breathing can be an embodied anchor but should not be mandatory.
16. Opening/control recordings must never become adaptive candidates.
17. `forest_water_drop_far_01` is semantically a waterfall.
18. `ocean_waves_soft_01` is the canonical wave recording ID.

---

# 39. Current conceptual direction for paper contribution

The system should not be framed as:

> a highly accurate EEG classifier that detects mind wandering and chooses corrective sounds.

A stronger framing is:

> an EEG-informed adaptive spatial soundscape system where LLM-based semantic reasoning translates uncertain attention-related EEG variation into restrained evolution of a navigable acoustic world.

Potential contribution dimensions:

```text
1. EEG-informed adaptive spatial audio architecture
2. semantic scene graph for environmental meditation soundscapes
3. LLM-mediated scene/audio composition
4. embodied spatial navigation through adaptive sound
5. user experience of adaptive acoustic environments
```

Calibration is supporting infrastructure, not necessarily the main contribution.

---

# 40. Current open research/design questions

## 40.1 How much should the system move?

Still open:

- how often scene transitions should occur;
- how much local acoustic evolution is enough;
- whether every session should have at least one transition;
- whether 0 transitions can be valid.

Current preference:

> do not force transitions mechanically.

## 40.2 How much route diversity is desirable?

Need to balance:

- adaptive personalization;
- study comparability;
- narrative coherence;
- coverage of the Scene Graph.

## 40.3 Should breathing accompany movement?

Promising but unresolved.

Possible roles:

```text
transition preparation
embodied grounding
arrival stabilization
```

but not every transition.

## 40.4 How should audio loudness be normalized?

Need to decide whether to:

- manually tune gains;
- precompute RMS/LUFS-like normalization;
- store normalization metadata in the library.

## 40.5 How much of scene transition choreography should be LLM vs deterministic?

Current preferred split:

Decision 2 chooses:

```text
destination
semantic sound choices
embodied transition style
```

Deterministic code chooses:

```text
20–30 s timeline
crossfade curves
event envelope
technical playback
```

---

# 41. Recommended immediate next implementation task

The next implementation pass should be **perceptual refinement**, not another conceptual architecture rewrite.

Suggested scope:

```text
P0
- fix events that activate but do not audio-start
- separate short-event envelope from scene-transition duration
- make event gain perceptually audible

P0
- implement 20–30 s scene-edge traversal

P1
- crossfade origin ambience down and destination ambience up
- use footsteps/breath as optional embodied support
- ensure arrival stabilizes destination scene

P1
- create earlier progression opportunity
- strengthen Forest Edge acoustic identity
- improve route diversity toward Beach / City Park

P2
- consider offline loudness normalization
```

Do not change:

```text
calibration math
TBR feature computation
general study framing
number of LLM stages
Scene Graph topology
```

unless a new pilot reveals a direct necessity.

---

# 42. Current user preference / working style relevant to follow-up

The user prefers:

- Chinese discussion mixed with English technical terminology;
- systematic architecture reasoning;
- concrete code/Codex instructions;
- diagrams and timelines where useful;
- critical diagnosis rather than superficial agreement;
- clear separation of conceptual design vs implementation details;
- iterative pilot-based refinement;
- avoiding scope creep;
- keeping the system publishable and explainable rather than only “making it work.”

For long technical replies, a useful structure is:

```text
TL;DR
↓
main diagnosis
↓
evidence
↓
architecture implication
↓
recommended next step
```

---

# 43. Useful handoff prompt for the next GPT

A new GPT can continue with:

```text
Please use the attached NeuroScape handoff summary as the current source of truth.

We are currently at the perceptual-refinement stage of NeuroScape 2.0.
The architecture is already:
EEG -> deterministic eligibility -> Decision 1 -> Semantic Scene Graph + hard audio eligibility -> Decision 2 -> deterministic materializer -> spatial runtime.

Do not redesign calibration or add a third LLM.

The latest pilot shows:
1. some event sounds are too short/quiet and may not actually audio-start;
2. footsteps during scene transition are only ~4–5 seconds;
3. we want scene transitions to feel like 20–30 second traversal of an edge, with origin ambience fading out and destination ambience fading in;
4. first successful scene transitions still happen late (~7 min in the latest run);
5. route diversity is biased toward Stream Bank / Dense Forest because Forest Edge has weak acoustic identity, making Beach / City Park hard to reach.

Please continue from this state rather than reconstructing earlier architecture decisions.
```

---

# 44. One-sentence current project state

> **NeuroScape has moved from a rule-heavy EEG-to-sound adaptation system toward a constrained semantic spatial journey architecture; the current challenge is no longer whether the system can decide to adapt, but whether those decisions are rendered as perceptually clear, gradual, embodied, and diverse spatial experiences.**
