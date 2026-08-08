
# NeuroScape Spec 03 — Scene Controller

## Responsibility
Convert SceneJourneyPlan into RuntimeWorldState.

## Internal Modules
- Plan Validator
- Semantic Location Mapper
- Journey Controller
- Ambient Controller
- Action Controller
- Event Controller
- Transition Controller
- Runtime State Builder

## Responsibilities

Journey Controller
- interpolate listener trajectory
- compute listener transform

Ambient Controller
- manage global ambient
- resolve localized ambient positions

Action Controller
- attach sounds to listener
- compute world positions from relative positions

Event Controller
- interpolate trajectories
- spawn/despawn dynamic sources

Transition Controller
- fades
- scheduling
- continuity

Runtime State Builder
Generate a shared RuntimeWorldState for rendering.

## Output

RuntimeWorldState

```ts
listener{
  worldPosition;
  orientation;
}

ambient[]
action[]
event[]
```

The Scene Controller is the only module that converts semantic locations into world coordinates.
