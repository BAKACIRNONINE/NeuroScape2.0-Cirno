
# NeuroScape Runtime Scene Controller (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 7 — Runtime API & TypeScript Interfaces**

---

# 7.1 Purpose

This chapter defines the public APIs and data interfaces exposed by the
Runtime Scene Controller.

The objective is to establish a stable contract between:

- Scene Journey Planner
- Runtime Scene Controller
- Three.js Visualization
- Web Audio / HRTF Renderer
- Debug & Logging tools

The Runtime should be replaceable without changing any upstream or downstream
modules, provided these interfaces remain unchanged.

---

# 7.2 Interface Layers

```text
LLM Planner
      │
      ▼
SceneJourneyPlan
      │
──────── Runtime Boundary ────────
      │
      ▼
Runtime Scene Controller
      │
      ▼
RuntimeWorldState
      │
      ├──► Three.js
      ├──► Web Audio / HRTF
      ├──► Debug Overlay
      └──► Session Logger
```

Only two public data contracts exist:

1. SceneJourneyPlan (input)
2. RuntimeWorldState (output)

---

# 7.3 Core Types

```ts
type Vector3 = [number, number, number];

type Quaternion = [number, number, number, number];

type Timestamp = number;
```

---

# 7.4 SceneJourneyPlan

```ts
interface SceneJourneyPlan{

  planId:string;

  planningHorizonSec:number;

  reasoningSummary?:ReasoningSummary;

  userJourney:UserJourneyPlan;

  soundscape:SoundscapePlan;

  transitionPolicy:TransitionPolicy;
}
```

The Runtime ignores `reasoningSummary` except for logging.

---

# 7.5 RuntimeWorldState

```ts
interface RuntimeWorldState{

  timestamp:Timestamp;

  listener:ListenerState;

  ambient:AmbientState[];

  action:ActionState[];

  event:EventState[];
}
```

This object represents the complete acoustic world for one runtime frame.

---

# 7.6 ListenerState

```ts
interface ListenerState{

  worldPosition:Vector3;

  orientation:Quaternion;

  velocity:Vector3;

  semanticLocation:string;
}
```

---

# 7.7 AmbientState

```ts
interface AmbientState{

  id:string;

  mode:"global"|"localized";

  worldPosition?:Vector3;

  gain:number;

  active:boolean;
}
```

Global Ambient does not require a world position.

---

# 7.8 ActionState

```ts
interface ActionState{

  id:string;

  attachment:
    |"head"
    |"chest"
    |"feet"
    |"body";

  relativePosition:Vector3;

  worldPosition:Vector3;

  gain:number;

  active:boolean;
}
```

`worldPosition` is computed by the Runtime every update.

---

# 7.9 EventState

```ts
interface EventState{

  id:string;

  worldPosition:Vector3;

  velocity:Vector3;

  gain:number;

  lifecycle:
    |"waiting"
    |"active"
    |"finished";

  active:boolean;
}
```

---

# 7.10 Runtime Controller API

```ts
interface RuntimeController{

  initialize(
      plan:SceneJourneyPlan
  ):void;

  update(
      deltaTime:number
  ):RuntimeWorldState;

  applyPlan(
      plan:SceneJourneyPlan
  ):void;

  shutdown():void;
}
```

---

# 7.11 Internal Controller Interface

All runtime controllers expose a common interface.

```ts
interface IRuntimeModule{

    initialize():void;

    update(deltaTime:number):void;

    reset():void;
}
```

Examples:

- JourneyController
- AmbientController
- ActionController
- EventController
- TransitionController

---

# 7.12 Runtime Events

Recommended event bus:

```ts
type RuntimeEvent =

    |"JourneyStarted"

    |"WaypointReached"

    |"SemanticLocationChanged"

    |"EventSpawned"

    |"EventFinished"

    |"TransitionStarted"

    |"TransitionCompleted";
```

These events are intended for debugging, analytics and visualization.

---

# 7.13 WebSocket Contract

Planner → Runtime

```json
{
  "type":"SceneJourneyPlan",
  "payload":{ }
}
```

Runtime → Visualization

```json
{
  "type":"RuntimeWorldState",
  "payload":{ }
}
```

Future protocol versions should include:

- protocolVersion
- sessionId
- timestamp

---

# 7.14 Error Handling

If malformed data is received:

1. Reject invalid payload.
2. Preserve previous RuntimeWorldState.
3. Log validation error.
4. Continue runtime execution.

The Runtime should never crash because of planner output.

---

# 7.15 API Design Guidelines

Interfaces should satisfy:

- backward compatibility
- immutable output snapshots
- deterministic behavior
- explicit ownership
- versioned protocol

Avoid exposing internal controller state.

---

# 7.16 Example Update Flow

```text
WebSocket
      │
      ▼
SceneJourneyPlan
      │
      ▼
RuntimeController.applyPlan()

      │

update(deltaTime)

      │

RuntimeWorldState

      │
      ├──► Three.js
      └──► HRTF Renderer
```

---

# 7.17 Chapter Summary

This chapter defines the stable software interfaces of the Runtime Scene
Controller.

The Runtime exposes a small number of well-defined APIs while hiding all
internal scheduling, interpolation and controller logic.

A stable interface layer allows the planner, visualization engine and HRTF
renderer to evolve independently without breaking system integration.

**Next Chapter:** Development Roadmap & Testing Strategy
