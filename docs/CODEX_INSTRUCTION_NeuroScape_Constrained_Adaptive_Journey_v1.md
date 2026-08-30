# Codex Implementation Instruction — NeuroScape Constrained Adaptive Journey v1

## 0. Mission

Implement the next NeuroScape adaptive-planning architecture on the current working branch, using the three new JSON resources already placed at:

- `packages/contracts/src/audio_library_synced.json`
- `packages/contracts/src/audio_library_semantic_v1.json`
- `packages/contracts/src/scene_graph_v1.json`

Target branch at the time this instruction was written:

- Repository: `yujianing0210/NeuroScape2.0`
- Branch: `calibration-single-guided-baseline`
- Expected branch HEAD when this instruction was prepared: `214da160623229a82a149191cf6080dac6d62f44`

Before editing, verify the actual branch and HEAD. If the branch has advanced, inspect the newer code and adapt this specification to the current implementation rather than blindly reverting newer work.

The goal is **not** to add more heuristic rules. The goal is to move semantic/spatial appropriateness decisions into LLM Decision 2 while keeping feasibility, playback safety, timing, and validation deterministic.

Core principle:

> **Code decides what is feasible and safe. Decision 1 decides whether/why the world should change. Decision 2 decides the most semantically and spatially appropriate feasible change.**

Do not add a third Route Planner LLM call.

---

# 1. Preserve the parts of the current architecture that are already correct

Do not rewrite the EEG/calibration pipeline unless compilation requires a narrow type change.

Preserve:

1. guided-breathing baseline-relative EEG interpretation;
2. deterministic eligibility gate;
3. two-stage LLM architecture:
   - Decision 1 = whether / why to adapt;
   - Decision 2 = what spatial/acoustic change to make;
4. cooldowns, session limits, complexity budgets, freeze buffer, patch horizon;
5. deterministic runtime validation;
6. adaptation lifecycle / outcome reflection;
7. current OpenAI request infrastructure, model logging, prompt/schema logging, usage and latency logging;
8. shared Base Plan concept;
9. non-adaptive/control condition behavior unless a compile-time compatibility change is unavoidable.

Do **not**:

- create a fixed journey;
- create a fixed destination schedule;
- force a scene transition at a specific timestamp;
- infer objective mind wandering from TBR;
- add new audio files;
- create embeddings/vector search for this version;
- add a third LLM call;
- implement participant-level learned personalization;
- redesign the UI except where required to keep existing UI/debug data compiling.

---

# 2. Read these files before changing code

At minimum inspect:

### New data resources
- `packages/contracts/src/audio_library_synced.json`
- `packages/contracts/src/audio_library_semantic_v1.json`
- `packages/contracts/src/scene_graph_v1.json`

### Existing contracts
- `packages/contracts/src/audio_library.json`
- `packages/contracts/src/audio-library.ts`
- `packages/contracts/src/scene-journey-plan.ts`
- related contract exports / index files

### Adaptive planner
- `packages/adaptive-planner/src/audio-retrieval.ts`
- `packages/adaptive-planner/src/openai-providers.ts`
- `packages/adaptive-planner/src/types.ts`
- `packages/adaptive-planner/src/engine.ts`
- `packages/adaptive-planner/src/base-plan.ts`
- `packages/adaptive-planner/src/config.ts`
- `packages/adaptive-planner/src/gate.ts`
- `packages/adaptive-planner/src/patching.ts`
- `packages/adaptive-planner/src/plan-merge.ts`
- `packages/adaptive-planner/src/reflection.ts`

Also inspect all existing tests touching Decision 1, Decision 2, audio retrieval, patching, runtime application, and Base Plan.

---

# 3. Source-of-truth rules for the three audio/scene resources

The three new JSON files have different jobs. Do not collapse their concepts back into one giant metadata object.

## 3.1 `audio_library_semantic_v1.json`

This is the canonical source for **what an audio asset means**.

Use it for LLM-facing semantic information:

- `asset_id`
- `label`
- `description`
- `layer`
- `source_environment`
- `semantic_function`
- `semantic_tags`
- `spatial_character`
- `quality_tier`
- `hard_dependencies`

Technical metadata contained in this file may be used as a cross-check, but the main purpose of this file is semantic reasoning.

Do not recreate semantic ranking scores from these fields.

## 3.2 `scene_graph_v1.json`

This is the canonical source for the spatial world:

- nodes;
- semantic descriptions;
- acoustic character;
- adjacency;
- edge transition semantics;
- node audio coverage;
- edge transition cues.

It defines **where the listener can coherently go**, not what EEG state “should” map to a location.

Never add fields such as:

- `compatibleIntents`
- `attention_low -> stream`
- `grounding -> river`
- `refresh_engagement -> beach`

The Scene Graph constrains feasibility and supplies semantics. The LLM chooses appropriateness.

## 3.3 `audio_library_synced.json`

This is the latest runtime-compatible migration snapshot and should be used for current technical/runtime facts where available:

- real file paths;
- loop behavior;
- fades;
- durations;
- playback contracts;
- gain bounds;
- session limits;
- authored default positions/motions.

Do not make `audio_library_synced.json` a second permanently active runtime library.

After reconciliation, keep one canonical technical runtime library (`audio_library.json`) that downstream runtime code imports.

### Technical reconciliation precedence

When constructing the active runtime library:

1. For an asset present in `audio_library_synced.json`, use its latest technical record unless it is demonstrably incomplete and the current runtime `audio_library.json` contains the missing authored technical data.
2. If an asset exists in the current branch `audio_library.json` but is missing from `audio_library_synced.json` (for example a previously authored stream asset), preserve the current branch technical record.
3. Use `audio_library_semantic_v1.json` to correct semantic identity/description, but do not invent missing technical values.
4. If no real technical playback contract exists for a semantic asset, do not synthesize one merely to make it planner-eligible. Keep it unavailable and report it.

---

# 4. Mandatory preflight data reconciliation

Before planner refactoring, validate the three local JSON resources and normalize known identity conflicts.

## 4.1 Ocean waves canonicalization

`ocean_waves` and `ocean_waves_soft_01` refer to the **same physical audio source**.

Canonical planner/runtime asset ID:

`ocean_waves_soft_01`

Requirements:

- there must be only one canonical planner asset;
- `ocean_waves` must not appear as a second selectable sound;
- preserve the real physical file reference if the actual file is `ocean_beach/ambient/ocean_waves.wav`;
- update Scene Graph references so beach coverage/edges use only `ocean_waves_soft_01`;
- if the local semantic/graph JSON still contains both IDs, normalize during migration and add a validation test so this cannot regress.

## 4.2 Waterfall semantic correction

Keep the stable ID:

`forest_water_drop_far_01`

But its actual audio identity is a **distant continuous waterfall**, not a single water drop.

The LLM-facing semantic record must describe a waterfall. Do not change the ID merely for naming cleanliness.

## 4.3 Session-only assets

`meditation_opening` and `non_adaptive_10min` are not adaptive environmental candidates.

They may remain in the technical runtime asset inventory if needed by the session system, but must never appear in Decision 2 adaptive candidate cards.

## 4.4 City Park and Lakeside River

The new architecture must support the authored City Park and lakeside-river assets if valid technical records exist.

Extend technical scene/environment typing as required; do not leave them permanently inaccessible merely because the old `AudioLibraryScene` union only allowed `forest | ocean_beach`.

`limited_use` quality means “use cautiously / lower authored quality,” **not automatically planner-ineligible**.

---

# 5. Target architecture

Implement this conceptual flow:

```text
EEG epochs
   ↓
Attention Interpreter
   ↓
Deterministic Eligibility Gate
   ↓
Decision 1
Should the acoustic world change?
Why?
What scope?
   ↓
┌──────────────────────┬────────────────────────┐
│ within-scene         │ scene-transition       │
└──────────────────────┴────────────────────────┘
   ↓
Progression context + current Scene Graph neighborhood
   ↓
Hard audio eligibility only
   ↓
Compact semantic candidate cards
   ↓
Decision 2
Choose WHERE + WHAT + conceptual HOW
   ↓
Deterministic materializer/compiler
   ↓
Deterministic patch + scene-graph validation
   ↓
Runtime
   ↓
Spatial audio
```

There is no independent Route Planner LLM.

The session-level “journey” emerges from multiple local/scene decisions over time.

---

# 6. First-class Semantic Scene Graph

Create a typed loader/contract, preferably a new file such as:

`packages/contracts/src/scene-graph.ts`

Export it through the package’s public index.

Suggested types (adapt naming to repository conventions):

```ts
export interface SemanticSceneNode {
  id: string;
  label: string;
  family: string;
  graph_role: string;
  description: string;
  acoustic_character: string;
  neighbors: string[];
  coverage_status: string;
  audio_coverage: {
    foundation: string[];
    supporting_ambient: string[];
    events: string[];
    actions: string[];
  };
}

export interface SemanticSceneEdge {
  id: string;
  between: [string, string];
  bidirectional: boolean;
  semantic_transition: string;
  available_transition_cues: string[];
}

export interface SemanticSceneGraph {
  schema_version: string;
  start_node_id: string;
  recommended_major_transitions_per_10min_session: number;
  nodes: SemanticSceneNode[];
  edges: SemanticSceneEdge[];
}
```

Provide immutable maps/helpers:

- `sceneGraph`
- `sceneNodeById`
- `sceneEdgeById`
- `getSceneNode(id)`
- `getReachableSceneNodes(currentId)`
- `getSceneEdgeBetween(a, b)`
- `normalizeLegacyLocationId(id)` during migration

### Legacy location compatibility

Normalize legacy IDs where necessary:

- `clearing` → `forest_clearing`
- `waterfall` → `waterfall_vicinity`
- `stream_bank` → `stream_bank`
- `forest_entry` may map to `forest_clearing` for backward compatibility if old plans/tests still emit it

Update the Base Plan so the canonical start waypoint is:

`forest_clearing`

Do not continue emitting old IDs in new Decision 2 outputs.

### Graph validation

Fail fast in tests/startup validation if:

- `start_node_id` does not exist;
- an edge references a missing node;
- a node neighbor does not correspond to a valid graph relation;
- an audio coverage ID does not exist in the semantic audio library;
- an edge transition cue ID does not exist;
- both `ocean_waves` and `ocean_waves_soft_01` survive as separate selectable assets.

---

# 7. The finalized Scene Graph is the v1 world

Use the graph JSON as authored. The intended topology is:

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

- `forest_clearing`
- `dense_forest`
- `stream_bank`
- `waterfall_vicinity`
- `lakeside_river`
- `forest_edge`
- `city_park`
- `beach_shore`

Do not add Ridge, Meadow, Pond, or other imagined locations in this implementation.

Every participant begins at `forest_clearing`.

A 10-minute session should normally have **0–2 major scene transitions**, with local acoustic adaptations providing most of the moment-to-moment variation.

---

# 8. Separate local acoustic stasis from spatial progression

The current boolean `stasisPressure` is based on time since a meaningful adaptation. Keep that concept if useful for local acoustic evolution, but it is insufficient for journey progression.

Add independent spatial progression context.

Suggested types:

```ts
export type ProgressionPressure = 'low' | 'medium' | 'high';

interface DecisionContext {
  ...
  secondsSinceLastSpatialProgression: number;
  progressionPressure: ProgressionPressure;
}
```

### Important behavior

Spatial progression time must reset only after a **successfully applied scene transition**, not after:

- a bird event;
- an ambient gain adjustment;
- an LLM proposal that fails validation;
- a scene-transition proposal that never reaches runtime application.

Use applied lifecycle/history state as the source of truth.

### Thresholds

Introduce centralized config values rather than burying magic numbers in prompt/retrieval code.

A reasonable Phase-1 starting policy is:

```ts
progressionPressureMediumMs: 120_000,
progressionPressureHighMs: 200_000,
maxSceneTransitions: 2,
```

Treat these as `TBD_PILOT`, not validated scientific thresholds.

If the current `sceneTransitionCooldownMs = 200_000` remains, keep the behavior coherent with it.

### Crucial rule

`progressionPressure = high` **does not force a transition**.

It means:

> a non-corrective spatial progression is increasingly worth considering if it is coherent, safe, allowed by phase/cooldown, and not disruptive.

Maintain must remain valid.

---

# 9. Decision 1 update

Decision 1 remains responsible for:

- whether to adapt;
- adaptation intent;
- salience;
- scope (`within-scene` or `scene-transition`);
- concise evidence/reason;
- constraints passed to Decision 2.

Decision 1 still **must not select assets or destinations**.

Bump the prompt version, e.g.:

`decision-1-guided-baseline-progression-v2`

### Keep all current scientific cautions

Preserve:

- guided-breathing baseline is a reference, not maximum focus;
- positive TBR delta is not objective mind wandering;
- negative delta is not >100% focus;
- do not infer mental state from one checkpoint;
- never invent decline/MW to create adaptation;
- low-confidence EEG cannot support a corrective EEG claim;
- prior outcomes are non-causal;
- recent unobserved interventions should not be stacked.

### Modify the old scene-transition rule

The current prompt is too restrictive when it says scene transition should occur only after sustained high-quality EEG evidence plus failed lighter intervention.

New policy:

A scene transition can be justified by either:

1. **EEG-informed adaptive need**:
   sustained, usable evidence plus insufficient lighter interventions; or

2. **non-corrective journey progression**:
   medium/high progression pressure, coherent scene history, and safe transition capacity.

If route progression is the basis, Decision 1 must not frame the transition as an EEG correction or mind-wandering response.

### Recommended inspectability field

Add:

```ts
adaptationBasis:
  | 'none'
  | 'eeg_informed'
  | 'progression_driven'
  | 'mixed'
  | 'continuity_preserving';
```

For maintain, normally `none` or `continuity_preserving`.

This is useful in study logs because a progression-driven transition should not later be described as evidence that EEG detected mind wandering.

### D1 input

Add to `sceneSummary` / context:

- canonical current node ID;
- current node label/short description;
- seconds since last spatial progression;
- `progressionPressure`;
- count of applied scene transitions;
- transitions remaining.

Do not send the list of destination semantics to Decision 1. Destination selection belongs to Decision 2.

---

# 10. Replace heuristic audio ranking with hard eligibility + semantic candidate scope

The current `retrieveDecision2Candidates()` must be fundamentally simplified.

Remove semantic appropriateness scoring from code.

Delete/deprecate use of these for numeric ranking:

- `goalTags`
- `stateTags`
- `priority * selection_weight`
- `use_when` match score
- `avoid_when` penalty
- `suddenness` penalty
- `intensity` penalty
- quality numeric penalty
- recency numeric penalty
- repetition numeric penalty
- scene mismatch numeric penalty
- hand-tuned final score
- per-layer top-8 truncation

Do not replace them with a differently weighted scoring formula.

### Hard eligibility may enforce

Code may filter for actual feasibility:

1. asset has a real technical runtime record;
2. asset has a semantic record;
3. asset is an adaptive environmental asset (not opening/control);
4. `planner_eligible !== false` after migration;
5. session `max_appearances` not exceeded;
6. exact authored minimum interval/cooldown satisfied;
7. hard dependency can be satisfied;
8. operation is technically supported;
9. asset is graph-relevant to the current D1 scope;
10. runtime layer is supported;
11. canonical alias/identity is valid.

### Graph-relevant candidate scope

Do not send the entire global library if it is irrelevant. Use **semantic graph locality**, not heuristic scoring.

#### If D1 scope = `within-scene`

Candidate pool should be:

- assets listed in the current node’s `audio_coverage`;
- common/body assets that are intentionally global (e.g. breathing), when technically eligible;
- currently active assets exposed as modification targets even if they are not in coverage.

#### If D1 scope = `scene-transition`

Candidate pool should include:

- current node coverage;
- every *adjacent* destination node’s coverage;
- transition cues on edges from current node to those adjacent nodes;
- common/body assets;
- currently active modification targets.

Decision 2 then chooses the destination and the acoustic realization jointly.

This is feasibility pruning, not an appropriateness ranking.

### No top-K for v1

The current library is small enough to pass all hard-eligible local candidates after graph scoping.

Do not reintroduce `top 8 per layer`.

If the library later grows to hundreds/thousands of assets, retrieval can be redesigned with semantic/vector retrieval. That is out of scope now.

---

# 11. Compact LLM-facing semantic candidate cards

Do not send Decision 2 the current huge `Decision2Candidate` object.

Create a compact semantic type, e.g.:

```ts
export interface SemanticAudioCandidate {
  assetId: string;
  label: string;
  description: string;
  layer: 'ambient' | 'event' | 'action';
  semanticFunction: string;
  spatialCharacter: {
    behaviors: string[];
    defaultDistance: string;
  };
  qualityTier: 'preferred' | 'standard' | 'limited_use' | null;

  currentlyActive: boolean;
  activeElementId?: string;
  allowedOperations: Array<'ADJUST' | 'REPLACE' | 'SUPPRESS' | 'INSERT'>;

  recentUse: {
    status: 'unused' | 'recent' | 'used_before';
    useCount: number;
    secondsSinceLastUse?: number;
  };
}
```

`semantic_tags` may be included only if genuinely useful, but avoid dumping long repetitive metadata when the description already captures the semantics.

### Do NOT send as LLM candidate fields

Do not expose these merely so the model can reimplement technical logic:

- exact cooldown seconds;
- session limit numbers;
- max-safe-gain internals;
- `selection_weight`;
- `priority`;
- `suddenness` floats;
- `intensity` floats;
- raw playback contract details;
- exact fade numbers;
- exact repeat counts;
- raw default XYZ positions;
- exact authored event duration;
- numeric quality attenuation.

These remain code-side technical facts.

---

# 12. Replace `OperationGuidance` heuristic preference ordering with factual capacity context

The current code produces `preferredOperations` based on low/medium/high density. Remove the ordered recommendation list from Decision 2 input.

Decision 2 should see factual soundscape capacity, while deterministic validation enforces hard limits.

Suggested context:

```ts
export interface SoundscapeCapacityContext {
  activeSourceCount: number;
  activeAmbientCount: number;
  activeEventCount: number;
  activeActionCount: number;
  currentSalienceLoad: number;
  remainingConcurrentSourceHeadroom: number;
  remainingAmbientHeadroom: number;
  remainingSalienceHeadroom: number;
}
```

The LLM can reason that a dense scene should probably be simplified, but code should not pre-decide an operation order.

---

# 13. Decision 2 becomes Semantic Spatial Planning

Bump version, e.g.:

`decision-2-semantic-scene-graph-v10`

Decision 2 remains one LLM call.

It receives:

1. Decision 1 intent/salience/scope/constraints;
2. current canonical scene node semantic card;
3. if scope is `scene-transition`, semantic cards for adjacent nodes and their edges;
4. current active soundscape summary;
5. factual soundscape capacity;
6. progression pressure;
7. recent location history;
8. recent asset use summary;
9. prior outcome summaries (non-causal);
10. compact hard-eligible semantic audio cards.

It must **not** receive raw EEG for reinterpretation beyond the already-decided D1 summary.

### D2 responsibilities

Decision 2 chooses:

- remain in current node or, only when D1 authorizes scene transition, choose one adjacent destination;
- which asset(s) best realize the D1 intent and scene semantics;
- whether to insert, adjust, replace, suppress, or keep;
- a qualitative mix intent where needed;
- the semantic role of each change.

Decision 2 does **not** choose:

- exact gain values;
- exact fade seconds;
- exact playback mode;
- exact repeat count;
- exact event duration;
- exact XYZ coordinates;
- arbitrary motion curves;
- exact activation timestamps;
- non-adjacent locations.

### Remove old prompt policies that pre-decide sound type

Delete or substantially rewrite rules such as:

- gently-reorient must prioritize an event;
- support-grounding must prioritize body action;
- refresh-engagement must prioritize a novel event;
- “if last adaptation was ambient, next must prefer event/action”;
- quality/priority/selectionWeight/suddenness/intensity numeric ranking instructions.

D1 intent plus semantic descriptions should be enough for the LLM to reason about what is appropriate.

Keep only real safety/coherence constraints.

### D2 spatial rules

- `within-scene`: destination must be null/current; do not imply listener locomotion.
- `scene-transition`: destination must be exactly one graph-adjacent node.
- no non-adjacent teleportation;
- footsteps may support movement but are not required mechanically;
- transition cues should build continuity, not act as arbitrary events;
- destination scene should become acoustically recognizable by the end of transition;
- do not imply listener motion for a purely local event;
- do not create a fixed route;
- high progression pressure is context, not a command.

---

# 14. Simplify Decision 2 structured output

Do not ask the LLM to author a complete low-level `SoundscapePlanPatch`.

Create a semantic output, for example:

```ts
export interface Decision2SemanticOutput {
  status: 'CHANGE_PROPOSED' | 'NO_SAFE_CHANGE';

  destinationNodeId: string | null;

  changes: Array<{
    operation: 'KEEP' | 'ADJUST' | 'REPLACE' | 'SUPPRESS' | 'INSERT';

    // New/replacement asset. Null for KEEP/ADJUST/SUPPRESS when no new asset.
    assetId: string | null;

    // Existing element when modifying current sound.
    targetElementId: string | null;

    semanticRole:
      | 'foundation'
      | 'supporting_ambient'
      | 'event'
      | 'body_anchor'
      | 'transition_cue';

    mixIntent:
      | 'default'
      | 'slightly_softer'
      | 'slightly_more_present'
      | null;
  }>;

  selectedAssetIds: string[];
  reasonCodes: string[];
  rationale: string;
}
```

You may adjust exact names to fit current types, but preserve the separation:

> LLM outputs semantic intent; code materializes technical execution.

Prefer a maximum of 3 semantic changes, consistent with the existing restrained patch budget.

Do not expose arbitrary numerical scheduling fields in the LLM schema.

---

# 15. Add a deterministic materializer/compiler between D2 and patch validation

Introduce a function/module with a clear boundary, for example:

`materializeSemanticDecision2(...)`

Input:

- Decision 2 semantic output;
- current plan/base plan;
- current session time;
- config;
- canonical technical audio library;
- Scene Graph;
- D1 decision.

Output:

- deterministic `SoundscapePlanPatch` / `FutureScenePatch` compatible with downstream validation/runtime.

### Materializer responsibilities

For every selected asset, code resolves from technical metadata:

- real file-backed canonical ID;
- playback mode using `canonicalPlaybackPolicy`;
- gain using authored recommended volume, bounded by `max_safe_gain`;
- quality attenuation if the existing runtime contract requires it;
- fade behavior;
- repeat behavior;
- event duration from authored lifecycle/default motion;
- default position/motion;
- action attachment;
- activation condition;
- event trajectory representation;
- earliest legal effective start after request latency/freeze buffer;
- transition duration using existing transition policy/authored fades.

If new deterministic mappings are unavoidable (for example translating `slightly_softer` into a gain change), put them in one centralized config/helper and mark them `TBD_PILOT`. Do not scatter magic multipliers through planner code.

### Attachment defaults

Keep deterministic semantic/technical rules such as:

- footsteps → `feet`;
- breathing/body cue → `chest` or existing canonical body attachment;
- environmental events are not body attached.

### Do not let the LLM invent technical numbers

If the semantic selection cannot be materialized safely from authored data, return `NO_SAFE_CHANGE` / reject the patch.

---

# 16. Scene transition must update the actual journey state

This is critical.

In the current Base Plan patch path, a `patch.journey` can be lost because `normalizeLegacyPlanPatch()` primarily projects sound elements while `BaseScenePlan.journey` may remain unchanged.

Fix this architecture.

A successfully validated and applied scene transition must:

1. validate `destinationNodeId` against current graph adjacency;
2. update the projected Base Plan journey;
3. persist the new canonical current node in `SceneJourneyPlan.userJourney`;
4. survive `materializeBasePlan()`;
5. only become authoritative after runtime/application acknowledgement, consistent with existing commit-boundary semantics;
6. update spatial progression history only after successful application.

Consider adding to `FutureScenePatch` something like:

```ts
journeyUpdate?: {
  fromNodeId: string;
  toNodeId: string;
};
```

or an equivalent typed field.

Do not use the LLM-authored journey array as the source of truth.

Code constructs the journey transition from validated `destinationNodeId`.

---

# 17. Base Plan update

Keep the Base Plan simple and shared.

The starting soundscape remains a stable forest foundation.

Update:

- initial waypoint → `forest_clearing`;
- Base Plan goal text to reflect a restrained adaptive forest-origin journey rather than implying a fixed forest route.

Do **not** schedule a fixed series of future scene nodes in Base Plan.

Maintain still means:

> preserve the current scheduled plan and allow the adaptive planner to act at later eligible checkpoints.

It does not mean freezing runtime execution.

---

# 18. Hard scene/audio coherence validation

Add deterministic validation after D2 selection and/or materialization.

## Within-scene

If scope is `within-scene`, a newly selected asset must be one of:

- current node audio coverage;
- common/global adaptive asset;
- an active modification target.

## Scene transition

If scope is `scene-transition`:

- destination must be adjacent;
- selected new destination-defining assets must belong to:
  - current node coverage,
  - destination node coverage,
  - the connecting edge’s transition cues,
  - common/global adaptive assets;
- the transition must not create a destination that cannot be acoustically represented.

Do not use numeric “scene mismatch penalty.” Invalid spatial choices should be rejected, not scored down.

## Waterfall

Because `forest_water_drop_far_01` is a waterfall, it can serve as a waterfall landmark/transition cue.

Do not keep the old semantic assumption that it is a tiny water-drop attention event.

## Beach

Use only canonical `ocean_waves_soft_01` for the shared wave recording.

## City Park

Do not automatically reject City Park because its authored quality is `limited_use`. Quality is an LLM-visible qualitative attribute; technical validation is separate.

---

# 19. Logging / study traceability

Preserve current prompt/output/model/usage/latency logging.

Replace score-heavy retrieval audit with a feasibility-oriented audit.

Suggested trace:

```ts
selectionTrace: {
  currentNodeId: string;
  reachableNodeIds: string[];
  progressionPressure: 'low' | 'medium' | 'high';
  fullSemanticLibrarySize: number;

  hardEligibleCandidateIds: string[];
  excludedCandidates: Array<{
    assetId: string;
    reason:
      | 'no_technical_record'
      | 'not_planner_eligible'
      | 'session_limit'
      | 'cooldown'
      | 'hard_dependency'
      | 'outside_graph_scope'
      | 'session_only'
      | 'alias_duplicate';
  }>;

  destinationNodeId?: string;
  selectedAssetIds?: string[];
}
```

Do not retain misleading fields like `finalScore`, `intentTagScore`, etc. once they no longer influence retrieval.

This trace should make it possible to explain:

- what the model was allowed to choose;
- what it chose;
- which scene transition occurred;
- whether the transition was EEG-informed, progression-driven, or mixed;
- what actually reached runtime.

---

# 20. Config changes

Keep existing safety/timing values unless directly required.

Recommended changes/additions:

```ts
progressionPressureMediumMs: 120_000,
progressionPressureHighMs: 200_000,
maxSceneTransitions: 2,
```

Keep `sceneTransitionCooldownMs` unless tests reveal a contradiction.

Do not alter EEG thresholds/calibration thresholds as part of this task.

Keep any new policy values explicitly documented as `TBD_PILOT`.

---

# 21. Version bumps

Use inspectable version identifiers so study logs distinguish the old and new architecture.

Suggested:

- D1: `decision-1-guided-baseline-progression-v2`
- D2: `decision-2-semantic-scene-graph-v10`
- Base Plan: bump from `base_plan_v4` if canonical waypoint semantics change
- patch/materializer version: bump if the old patch format is replaced

Exact suffixes may follow existing naming style, but do not silently reuse old prompt versions.

---

# 22. Tests that must be added or updated

Do not finish after TypeScript compiles. Add focused tests for the architecture.

## Data/contract tests

1. Scene Graph loads and validates.
2. All graph node IDs are unique.
3. All graph edge endpoints exist.
4. All graph audio coverage IDs resolve to semantic assets.
5. All transition cue IDs resolve.
6. `ocean_waves` is not a second selectable asset.
7. `ocean_waves_soft_01` is the canonical wave ID.
8. `forest_water_drop_far_01` LLM semantics identify it as waterfall.
9. session-only opening/control assets cannot enter D2 candidates.
10. City Park / Lakeside River types compile and can be represented.

## Retrieval tests

11. Retrieval no longer changes numeric ranking based on D1 intent.
12. There is no top-8-per-layer truncation.
13. Within-scene candidate scope is current-node/local.
14. Scene-transition candidate scope includes adjacent nodes + edge cues.
15. Non-adjacent destination assets cannot be used to teleport.
16. active assets remain available as modification targets.
17. cooldown/session-limit hard filtering still works.
18. hard dependencies still work.

## Progression tests

19. local audio adaptation does not reset spatial progression timer.
20. successfully applied scene transition does reset spatial progression timer.
21. rejected/proposed transition does not reset it.
22. high progression pressure does not deterministically force a transition.
23. scene-transition count cannot exceed 2.

## Decision 2 / materializer tests

24. D2 output cannot choose non-candidate asset IDs.
25. D2 output cannot choose non-adjacent destination.
26. within-scene D2 output cannot change destination.
27. exact gain/playback/duration are materialized from technical metadata, not LLM numbers.
28. action attachment is deterministic.
29. invalid technical asset fails safely.
30. materialized patch obeys existing concurrency/salience/event/body-anchor constraints.
31. waterfall transition can be represented from stream context.
32. beach transition uses only canonical wave ID.

## Journey-state tests

33. a validated/applied `forest_clearing -> stream_bank` transition updates `userJourney`.
34. the updated node is visible at the next checkpoint.
35. subsequent reachable nodes come from `stream_bank`, not stale `forest_clearing`.
36. failed runtime application does not commit destination/history.

## Regression tests

37. Decision 1 still refuses objective mind-wandering claims.
38. low-confidence EEG cannot support corrective EEG claim.
39. maintain remains a valid result.
40. Base Plan continuous forest ambience still works.
41. existing reflection/outcome logic still compiles and runs.
42. non-adaptive/control behavior is unchanged.

---

# 23. Build / validation commands

Run from repository root:

```bash
npm run build
npm run typecheck
npm test
npm run lint
npm run format:check
```

If `format:check` fails only because of changed files, format those files using the repository’s existing formatter, then rerun checks.

Do not claim completion if tests fail.

If an existing unrelated test is already failing before your change, clearly separate:

- pre-existing failure;
- new failure introduced by this migration.

---

# 24. Expected implementation surface

Likely files to modify/create include, but are not limited to:

### Contracts
- `packages/contracts/src/audio-library.ts`
- `packages/contracts/src/audio_library.json`
- `packages/contracts/src/audio_library_semantic_v1.json` only if canonicalization validation reveals the local duplicate
- `packages/contracts/src/scene_graph_v1.json` only if canonicalization validation reveals stale `ocean_waves`
- new `packages/contracts/src/scene-graph.ts`
- new semantic audio loader/type file if cleaner than overloading `audio-library.ts`
- contracts package exports/index
- relevant contract tests

### Adaptive planner
- `packages/adaptive-planner/src/types.ts`
- `packages/adaptive-planner/src/config.ts`
- `packages/adaptive-planner/src/audio-retrieval.ts`
- `packages/adaptive-planner/src/openai-providers.ts`
- `packages/adaptive-planner/src/engine.ts`
- `packages/adaptive-planner/src/base-plan.ts`
- `packages/adaptive-planner/src/patching.ts`
- possibly `packages/adaptive-planner/src/plan-merge.ts`
- new semantic materializer/compiler module
- planner tests

Update other files only when required by compilation/runtime contracts.

---

# 25. Key architectural invariants

Before considering the task complete, verify these statements are true:

1. **Decision 1 never selects a destination or asset.**
2. **Decision 2 never reinterprets EEG.**
3. **There are still only two LLM calls.**
4. **Scene Graph defines legal spatial adjacency, not EEG-to-scene rules.**
5. **Audio retrieval enforces feasibility, not semantic appropriateness scoring.**
6. **LLM sees compact semantic cards, not a long list of technical parameters.**
7. **LLM does not author exact playback/gain/duration/motion numbers.**
8. **Deterministic code materializes technical execution.**
9. **All safety/complexity/session limits are still enforced deterministically.**
10. **Progression pressure never dictates a fixed destination.**
11. **High progression pressure does not mechanically force a transition.**
12. **A successful scene transition actually updates persistent journey state.**
13. **All sessions begin in Forest Clearing.**
14. **Different participants can end in different graph nodes.**
15. **The system supports 0–2 major transitions in a 10-minute session.**
16. **`forest_water_drop_far_01` is treated semantically as waterfall.**
17. **`ocean_waves_soft_01` is the only canonical selectable wave asset for that recording.**
18. **City Park and lakeside-river assets can participate when their technical records are valid.**
19. **Opening/control recordings never become adaptive candidates.**
20. **No new audio assets or imagined locations were invented.**

---

# 26. Example behavioral expectations

These are examples, not fixed schedules.

## Example A — water-oriented journey

A valid participant trajectory could emerge as:

```text
Forest Clearing
→ local forest evolution
→ Stream Bank
→ local water/forest evolution
→ Waterfall Vicinity
```

Possible realization:

- forest ambience begins as the foundation;
- water becomes faintly perceptible before the stream transition;
- stream ambience gains presence while forest remains;
- creek footsteps may support actual locomotion;
- the waterfall recording becomes a directional landmark;
- closing simplifies rather than stacking more salient events.

The system must not encode “TBR elevated -> waterfall.”

## Example B — coastal journey

Another valid trajectory could be:

```text
Forest Clearing
→ Forest Edge
→ Beach Shore
```

Possible realization:

- forest foundation becomes less enclosing;
- wind becomes more open;
- sea breeze/waves gradually appear;
- wet-sand footsteps may support listener movement;
- beach waves become the final stable foundation;
- sparse shorebird/seagull/human-life events are optional, not mandatory.

The system must not encode “stable EEG -> beach.”

## Example C — no major transition

A participant may validly remain in:

`Forest Clearing`

or move once to:

`Dense Forest`

while receiving only restrained local acoustic adaptations.

Adaptive does not mean “must travel.”

---

# 27. Completion report required from Codex

After implementation, return a concise but concrete report containing:

1. files changed/created;
2. final active runtime audio source-of-truth;
3. final semantic source-of-truth;
4. final Scene Graph loader location;
5. final D1 prompt version;
6. final D2 prompt version;
7. final Decision 2 semantic output schema;
8. how deterministic materialization works;
9. how progression pressure is computed;
10. how journey state is committed after runtime application;
11. how `ocean_waves` duplication was resolved;
12. how waterfall semantics were resolved;
13. which City Park/Lakeside assets are planner-eligible;
14. tests added;
15. exact output of build/typecheck/test/lint/format checks;
16. any unresolved technical-data gaps that were **not** silently invented.

If any part of the implementation requires deviating from this architecture because of an existing runtime contract, explain the conflict before introducing a new heuristic workaround.

---

# 28. Final design sentence

The resulting system should be accurately describable as:

> **A constrained adaptive spatial journey in which deterministic code enforces EEG gating, technical audio feasibility, scene adjacency, playback safety, and complexity limits; Decision 1 determines whether and why the soundscape should evolve; and Decision 2 uses semantic scene and audio representations to choose the smallest coherent local adaptation or adjacent spatial progression.**
