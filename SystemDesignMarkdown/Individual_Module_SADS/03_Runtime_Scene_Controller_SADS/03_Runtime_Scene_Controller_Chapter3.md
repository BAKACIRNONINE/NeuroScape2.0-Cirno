
# NeuroScape Runtime Scene Controller (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 3 — Runtime Controllers**

---

# 3.1 Purpose

This chapter specifies the internal controllers that execute a
`SceneJourneyPlan` and continuously maintain the `RuntimeWorldState`.

Unlike the LLM, which reasons at scene-level timescales (tens of seconds),
the Runtime Controllers execute at rendering frequency (typically 60 Hz).

Each controller owns one aspect of the runtime world and updates only that
aspect.

---

# 3.2 Runtime Update Pipeline

The Runtime executes the following pipeline every update cycle.

```text
Runtime Frame

SceneJourneyPlan
        │
        ▼
Plan Validator
        │
        ▼
Journey Controller
        │
        ▼
Ambient Controller
        │
        ▼
Action Controller
        │
        ▼
Event Controller
        │
        ▼
Transition Controller
        │
        ▼
Runtime World Builder
        │
        ▼
RuntimeWorldState
        │
        ├──► Three.js
        └──► Web Audio + HRTF
```

Controllers execute in a deterministic order.

No controller should directly modify another controller's internal state.

Communication occurs only through the RuntimeWorldState.

---

# 3.3 Plan Validator

## Purpose

Validate every incoming SceneJourneyPlan before runtime execution.

## Responsibilities

- schema validation
- required field checking
- semantic location validation
- trajectory validation
- transition policy validation

## Inputs

- SceneJourneyPlan
- Scene Graph

## Outputs

Validated Runtime Plan.

## Failure Handling

If validation fails:

- reject invalid objects
- preserve previous runtime state
- log the error
- never reset the scene abruptly

---

# 3.4 Semantic Location Mapper

## Purpose

Resolve semantic scene locations into world coordinates.

Example

```text
stream_bank
      │
      ▼
Scene Graph
      │
      ▼
worldPosition = [0,0,-12]
```

The mapper is the **only** component allowed to translate semantic locations
into numerical coordinates.

Every other controller operates only on world coordinates.

---

# 3.5 Journey Controller

## Purpose

Generate continuous listener movement from sparse planner waypoints.

## Inputs

- userJourney
- current listener state

## Outputs

Updated ListenerState.

## Responsibilities

- waypoint interpolation
- movement smoothing
- velocity estimation
- orientation update
- pause handling
- movement completion detection

The LLM supplies sparse waypoints only.

The Journey Controller performs continuous interpolation.

Recommended interpolation:

- Catmull-Rom spline
- cubic spline
- smoothstep

Never snap directly between waypoints.

---

# 3.6 Ambient Controller

## Purpose

Maintain all environmental sound layers.

Ambient is divided into:

- Global Ambient
- Localized Ambient

---

## Global Ambient

Responsibilities

- maintain environmental sound field
- blend gains
- activate/deactivate ambience

Global ambient is not represented as a point source.

---

## Localized Ambient

Responsibilities

- maintain fixed world position
- compute perceptual distance gain
- preserve environmental continuity

Examples

- stream
- waterfall
- fireplace

Localized ambient never follows the listener.

---

# 3.7 Action Controller

## Purpose

Maintain listener-attached sounds.

Examples

- footsteps
- breathing
- clothing

## Responsibilities

Compute world position every frame.

```text
ActionWorldPosition

=

ListenerWorldPosition

+

ListenerOrientation × RelativePosition
```

Action sounds never own independent trajectories.

Their position is entirely determined by the listener transform.

---

# 3.8 Event Controller

## Purpose

Manage dynamic spatial sound objects.

Examples

- birds
- insects
- falling leaves

## Responsibilities

- spawn
- trajectory interpolation
- movement update
- despawn
- lifetime management

Each event owns an independent runtime state.

Example lifecycle

```text
Waiting
   │
Spawn
   │
Active
   │
Finished
   │
Removed
```

---

# 3.9 Transition Controller

## Purpose

Guarantee temporal continuity.

The Transition Controller prevents abrupt scene changes.

Responsibilities

- gain interpolation
- crossfade
- delayed activation
- delayed removal
- trajectory smoothing
- transition scheduling

Every controller submits transition requests.

Only the Transition Controller executes them.

---

# 3.10 Runtime World Builder

## Purpose

Assemble the latest RuntimeWorldState.

Inputs

- ListenerState
- AmbientState
- ActionState
- EventState

Outputs

RuntimeWorldState

The Runtime World Builder is the final stage before rendering.

No rendering module modifies RuntimeWorldState.

---

# 3.11 Controller Communication Rules

Controllers communicate indirectly.

```text
Journey Controller
        │
        ▼
ListenerState
        │
────────┼──────────────
        │
Action Controller
        │
────────┼──────────────
        │
Runtime World Builder
```

Direct dependencies between controllers should be avoided.

Examples

Journey Controller should not directly manipulate Event Controller.

Ambient Controller should not directly manipulate Action Controller.

---

# 3.12 Update Frequencies

Recommended frequencies

| Component | Frequency |
|-----------|-----------|
| LLM Planner | Event-driven (tens of seconds) |
| Scene Controller | 60 Hz |
| Runtime World Builder | 60 Hz |
| Three.js | 60 FPS |
| HRTF Renderer | Audio callback / real time |

Planner updates are asynchronous.

The Runtime interpolates between planner updates.

---

# 3.13 Error Recovery

If a new SceneJourneyPlan conflicts with the current runtime:

1. Validate.
2. Preserve active runtime objects.
3. Merge compatible updates.
4. Fade incompatible objects.
5. Continue execution.

Never rebuild the world from scratch during an active meditation session.

---

# 3.14 Controller Interaction Summary

```text
SceneJourneyPlan
        │
        ▼
Plan Validator
        │
        ▼
Semantic Mapper
        │
        ▼
Journey Controller
Ambient Controller
Action Controller
Event Controller
        │
        ▼
Transition Controller
        │
        ▼
Runtime World Builder
        │
        ▼
RuntimeWorldState
```

---

# 3.15 Chapter Summary

The Runtime Scene Controller is implemented as a collection of independent
controllers rather than a single monolithic manager.

Each controller owns one aspect of runtime behavior while the Transition
Controller guarantees temporal continuity and the Runtime World Builder
constructs the single shared RuntimeWorldState consumed by visualization and
HRTF rendering.

**Next Chapter:** Runtime Scheduling and Update Loop
