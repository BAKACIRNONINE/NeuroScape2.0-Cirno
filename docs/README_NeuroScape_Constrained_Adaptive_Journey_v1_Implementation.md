# NeuroScape Constrained Adaptive Journey v1 — Implementation Notes

## Result

The adaptive planner now implements a constrained semantic journey: deterministic code controls eligibility, graph adjacency, technical audio feasibility, materialization, validation, and runtime commit; Decision 1 chooses whether and why to adapt; Decision 2 chooses a compact semantic change and an optional adjacent destination.

## Resource boundaries

- Technical runtime source of truth: `packages/contracts/src/audio_library.json`.
- Semantic source of truth: `packages/contracts/src/audio_library_semantic_v1.json`, loaded and normalized by `semantic-audio.ts`.
- Spatial source of truth: `packages/contracts/src/scene_graph_v1.json`, loaded and validated by `scene-graph.ts`.
- `audio_library_synced.json` was used as the migration snapshot; it is not imported as a second runtime library.

## Identity reconciliation

- The physical `ocean_beach/ambient/ocean_waves.wav` recording now has one canonical runtime/planner ID: `ocean_waves_soft_01`.
- Legacy `ocean_waves` references normalize to that ID and are removed from semantic/graph candidate views.
- `forest_water_drop_far_01` retains its stable ID, while its LLM-facing record identifies it as a distant continuous waterfall.
- `meditation_opening` and `non_adaptive_10min` remain runtime inventory entries but are hard-excluded from adaptive candidates.
- `citypark_walk_on_the_street`, `citypark_light_street_ambience`, `citypark_dog`, and `stream_lakeside_river` are planner-eligible because file-backed technical records exist. `limited_use` is exposed qualitatively, not treated as automatic exclusion.

## Planner changes

- Adaptive checkpoint / LLM reasoning cadence is 20 seconds.
- The general experienced-adaptation cooldown is 5 seconds. The independent scene-transition cooldown remains 200 seconds so spatial moves stay sparse.
- D1 version: `decision-1-guided-baseline-progression-v2`.
- D1 receives the canonical current node, elapsed time since the last applied spatial transition, progression pressure, applied transition count, and remaining transition capacity. It returns `adaptationBasis` so progression-driven changes cannot be mislabeled as EEG correction.
- Progression pressure is `low` below 120 seconds, `medium` from 120 seconds, and `high` from 200 seconds. These are centralized `TBD_PILOT` values. Pressure is context only and never forces a transition.
- D2 version: `decision-2-semantic-scene-graph-v10`.
- Retrieval performs hard feasibility checks and graph-local scoping only. It has no semantic score, quality penalty, intent score, or per-layer top-K.
- D2 sees compact semantic candidate cards and factual capacity. Its structured output contains status, optional destination, up to three semantic operations, selected IDs, roles, qualitative mix intent, reason codes, and rationale. It cannot author gains, timestamps, fades, positions, motion, duration, or repeat values.

## Deterministic materialization and commit

`semantic-materializer.ts` resolves canonical technical records, playback policy, bounded authored gain, lifecycle duration, action attachment, event trajectory, freeze-buffer start, and transition duration. Invalid or spatially incoherent selections become `NO_SAFE_PATCH`.

Every applied scene transition also receives a deterministic locomotion layer based on the destination surface: forest grass footsteps, creek steps for stream/water locations, street walking for City Park, or wet-sand footsteps for Beach Shore. These system-generated sounds use authored contracts, attach to `feet`, activate only while the listener is moving, and are included in preload/history traces.

A validated scene transition is stored as `FutureScenePatch.journeyUpdate`. Projection adds the canonical waypoint to the projected Base Plan. The engine keeps it pending until runtime reports `APPLIED` or `PLAN_APPLIED`; only then does it replace the authoritative Base Plan/current plan, append adaptation history, and reset the spatial progression clock. Rejected or failed proposals do not mutate journey state.

## Base Plan and runtime graph

- Base Plan version: `base_plan_v5_constrained_journey`.
- Every session starts at `forest_clearing`; the Base Plan does not schedule a fixed route.
- The scene transition limit is two per session.
- The frontend runtime fixture now recognizes the eight authored semantic nodes while retaining legacy nodes for older Module 03 diagnostic scenarios.

## Known technical-data gap

`forest_stream_ambient_bed_01` is referenced by semantic/graph resources but has no current physical technical runtime record. It is reported as `no_technical_record` and excluded rather than synthesized.

## Validation

- Build, typecheck, and lint pass.
- Full test suite passes: 172 tests across contracts, adaptive planner, runtime controller, study recorder, and frontend.
- Repository-wide formatting remains red because the repository already contains many unformatted files outside this change; changed TypeScript files were formatted.
