
# NeuroScape Runtime Scene Controller (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 2 — Runtime Representation Model**

---

# 2.1 Purpose

This chapter defines the internal data representation used by the Runtime Scene Controller.

The Runtime does not operate directly on EEG signals or LLM prompts. Instead, it transforms a high-level `SceneJourneyPlan` into a continuously updated `RuntimeWorldState`.

```text
SceneJourneyPlan
        │
        ▼
Runtime Scene Controller
        │
        ▼
RuntimeWorldState
        │
        ├── Three.js
        └── Web Audio + HRTF
```

The Runtime Representation Model is the contract shared by every runtime subsystem.

---

# 2.2 Representation Layers

The Runtime maintains two levels of representation.

```text
Semantic Representation
        │
        ▼
Spatial Representation
```

## Semantic Representation

Produced by the LLM.

Contains scene intentions such as:

- Move toward the stream.
- Introduce a bird near the clearing.
- Reduce forest wind gradually.

Semantic representations contain **meaning**, not numerical coordinates.

---

## Spatial Representation

Produced by the Runtime Scene Controller.

Contains:

- world positions
- listener orientation
- gains
- trajectories
- runtime states

Only the spatial representation is consumed by rendering.

---

# 2.3 SceneJourneyPlan

The SceneJourneyPlan is the only planning input accepted by the Runtime.

```text
SceneJourneyPlan
├── reasoningSummary
├── userJourney
├── soundscape
│      ├── ambient
│      ├── action
│      └── event
└── transitionPolicy
```

The Runtime ignores reasoning text except for logging.

---

# 2.4 Scene Graph

The Runtime maintains a Scene Graph describing semantic locations.

Example:

```text
Forest

├── forest_entry
├── clearing
├── stream_bank
├── waterfall
└── hill
```

Each node stores:

- unique identifier
- world position
- neighboring nodes
- available ambient sounds
- available event sounds

Example:

```yaml
stream_bank:
  worldPosition: [0,0,-12]

  neighbors:
    - clearing
    - waterfall

  ambient:
    - stream

  events:
    - bird
    - frog
```

The planner references semantic nodes.

The Runtime resolves them into world coordinates.

---

# 2.5 Coordinate System

NeuroScape adopts one global world coordinate system.

```text
+x = right
-x = left

+y = up
-y = down

-z = forward
+z = backward
```

This convention is shared by:

- Runtime
- Three.js
- Web Audio
- HRTF renderer

No subsystem should redefine coordinate directions.

---

# 2.6 RuntimeWorldState

RuntimeWorldState is the single runtime representation.

```text
RuntimeWorldState

Listener
Ambient
Action
Event
Time
```

Every rendering frame is generated from this structure.

---

# 2.7 Listener Representation

The listener represents the user's virtual location.

```ts
interface ListenerState{

    worldPosition:Vector3;

    orientation:Quaternion;

    velocity:Vector3;

    currentSemanticLocation:string;
}
```

Quaternion is preferred over Euler angles to avoid gimbal lock and to align with Three.js.

---

# 2.8 Ambient Representation

Ambient is divided into two categories.

## Global Ambient

Represents environmental sound fields.

Example:

```ts
interface GlobalAmbient{

    id:string;

    gain:number;

    active:boolean;
}
```

No world position is required.

---

## Localized Ambient

Represents persistent environmental objects.

```ts
interface LocalizedAmbient{

    id:string;

    worldPosition:Vector3;

    gain:number;

    active:boolean;
}
```

Localized ambient remains fixed in world space.

---

# 2.9 Action Representation

Action sounds are attached to the listener.

```ts
interface ActionState{

    id:string;

    attachment:"head"|"chest"|"feet";

    relativePosition:Vector3;

    worldPosition:Vector3;

    gain:number;
}
```

The Runtime computes `worldPosition` every update.

The planner never provides it.

---

# 2.10 Event Representation

Events are independent dynamic sound objects.

```ts
interface EventState{

    id:string;

    worldPosition:Vector3;

    velocity:Vector3;

    gain:number;

    state:
      |"waiting"
      |"active"
      |"finished";
}
```

Event trajectories are interpolated by the Runtime.

---

# 2.11 Runtime Relationships

```text
Scene Graph
      │
      ▼
Semantic Location
      │
      ▼
World Position
      │
      ├── Listener
      ├── Ambient
      ├── Event
      └── Action (derived)
```

Action is unique because its world position is derived from the listener transform.

---

# 2.12 Representation Constraints

The Runtime Representation Model follows the following rules.

1. Semantic locations never reach the renderer.
2. Renderer receives numerical runtime state only.
3. Action sounds never own independent world coordinates.
4. Global ambient is not represented as a point source.
5. RuntimeWorldState is the only shared representation used by rendering and visualization.
6. Scene Graph is the only component allowed to translate semantic locations into world coordinates.

---

# 2.13 Chapter Summary

This chapter defines the internal representation model of the Runtime Scene Controller.

The SceneJourneyPlan expresses semantic intentions, while the RuntimeWorldState expresses numerical spatial state.

The Scene Graph connects these two representations by resolving semantic locations into world coordinates.

This separation allows the planner to reason about meaningful places while allowing the renderer to operate exclusively on continuous spatial data.

**Next Chapter:** Runtime Controllers
