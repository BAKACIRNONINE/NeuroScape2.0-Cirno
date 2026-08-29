# NeuroScape Project Context

## Purpose

NeuroScape is a neuroadaptive spatial-audio meditation system. The current repository
contains EEG calibration/live integration, adaptive planning, semantic scene/runtime
control, browser visualization/spatial audio, recording, and replay.

The browser must consume authoritative runtime state rather than independently
reinterpreting EEG or simulating a second world model.

## High-level data flow

```text
Raw EEG
-> signal processing / epoch features
-> attention state relative to calibration
-> deterministic eligibility policy
-> bounded adaptation decision
-> semantic plan / patch
-> deterministic validation
-> RuntimeWorldState
-> visualization / spatial audio / recording / replay
```

An LLM may participate in bounded planning, but it is not the runtime safety boundary.

## Scene architecture

The Runtime module already has a SceneGraph abstraction with semantic node IDs,
world positions, and legal neighbors. Runtime plan validation checks semantic movement
against graph adjacency.

The adaptive planner also currently contains planner-facing location/topology knowledge.
The current redesign goal is to remove topology drift by introducing one shared semantic
topology representation consumed by both planner-facing logic and Runtime integration.

Do not solve this by creating a second independent SceneGraph implementation.

## Planned Forest Scene Graph v1

The current design direction adds semantic locations such as:

```text
forest_entry
clearing
forest_path
dense_forest
meadow
stream_approach
stream_bank
waterfall
```

The graph is constrained and branchable. It is not a fixed scripted route.

## Progression policy

Generic adaptation stasis and semantic scene-location stasis are different concepts.

A small within-scene audio adaptation may be a meaningful soundscape change while the
participant is still semantically in the same location. Future progression policy should
therefore track scene progression separately enough to avoid indefinitely resetting scene
pressure with local texture changes.

Progression pressure may encourage consideration of a scene transition. It must not by
itself select an illegal destination or bypass Runtime validation.

## Research constraints

- Keep deterministic gating and safety boundaries explicit.
- Treat current numerical thresholds as pilot/TBD unless validated evidence is documented.
- Preserve enough structured trace data to explain why an adaptation was proposed,
  rejected, applied, or blocked.
- Research, demo, debug, and replay shortcuts must remain distinguishable in recorded
  outputs when those modes are implemented.
