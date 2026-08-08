
# NeuroScape Web Runtime Engine (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 2 — Browser Runtime Architecture & Runtime Store**

---

# 2.1 Purpose

This chapter specifies the internal architecture of the browser runtime and
defines the Runtime Store, which serves as the central coordination mechanism
between visualization, spatial audio, networking, and user interface modules.

Unlike the Runtime Scene Controller, which owns execution logic, the browser
runtime is responsible for consuming RuntimeWorldState and presenting it to the
user.

---

# 2.2 Architectural Principles

The browser runtime follows four architectural principles.

## Single Source of Truth

All browser subsystems observe the same RuntimeWorldState.

```text
RuntimeWorldState
        │
        ▼
   Runtime Store
```

No subsystem maintains its own independent copy of world state.

---

## Unidirectional Data Flow

```text
Runtime Controller
        │
        ▼
RuntimeWorldState
        │
        ▼
Runtime Store
        │
 ├── Three.js
 ├── Audio Engine
 ├── React UI
 └── Debug Tools
```

Rendering modules consume state but never modify it.

---

## Loose Coupling

Modules communicate through the Runtime Store instead of directly referencing
each other.

For example:

- Three.js never calls the Audio Engine.
- Audio Engine never updates React UI.
- Debug tools never modify renderer state.

---

## Frame Consistency

Every rendering frame should use exactly one immutable RuntimeWorldState
snapshot.

This guarantees synchronization between graphics and audio.

---

# 2.3 Browser Runtime Architecture

```text
                RuntimeWorldState
                        │
                        ▼
                 Runtime Store
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
   Three.js   Audio Engine   React UI
        │          │          │
        └──────────┼──────────┘
                   ▼
              Debug Overlay
```

The Runtime Store is the center of the browser runtime.

---

# 2.4 Runtime Store

## Purpose

The Runtime Store maintains the latest RuntimeWorldState and distributes it to
all browser subsystems.

The Store is **not** responsible for reasoning, rendering, or audio
processing.

Its responsibilities are:

- receive new runtime snapshots
- publish immutable snapshots
- notify subscribers
- preserve update order

---

## Internal Structure

```ts
interface RuntimeStore {

    currentState: RuntimeWorldState;

    previousState?: RuntimeWorldState;

    subscribers: Subscriber[];

}
```

Only the Store may replace the current RuntimeWorldState.

---

# 2.5 Store Update Pipeline

Whenever a new RuntimeWorldState arrives:

```text
Receive Snapshot
        │
Validate
        │
Replace Current State
        │
Notify Subscribers
        │
Render Frame
```

Updates are atomic.

Subscribers should never observe partially updated state.

---

# 2.6 Subscriber Model

Every browser module subscribes independently.

```text
Runtime Store
      │
      ├── Three.js Renderer
      ├── Audio Engine
      ├── React UI
      └── Debug Tools
```

Each subscriber determines which parts of RuntimeWorldState it requires.

---

# 2.7 Three.js Integration

Three.js consumes:

- listener transform
- ambient anchors
- event positions
- journey path

Responsibilities:

- update scene graph
- update camera
- render visualization

Three.js never performs spatial audio calculations.

---

# 2.8 Audio Engine Integration

The Audio Engine consumes:

- listener transform
- source transforms
- gain values
- lifecycle states

Responsibilities:

- playback scheduling
- source activation
- gain updates
- communication with HRTF renderer

The Audio Engine does not modify RuntimeWorldState.

---

# 2.9 React UI Integration

React UI consumes:

- session status
- metrics
- planner status
- runtime diagnostics

React should only display information and dispatch user commands.

It should never own runtime objects.

---

# 2.10 Debug System

The Debug System subscribes to Runtime Store for development purposes.

Recommended views:

- RuntimeWorldState inspector
- listener inspector
- event inspector
- transition inspector
- performance metrics
- frame timing

Debugging must never affect runtime execution.

---

# 2.11 Synchronization Strategy

Graphics and audio operate independently but remain synchronized because they
read the same RuntimeWorldState snapshot.

```text
Runtime Store
      │
      ├── Graphics Frame
      └── Audio Update
```

Neither subsystem blocks the other.

---

# 2.12 Store Constraints

The Runtime Store SHALL:

- expose immutable snapshots
- publish updates in order
- support multiple subscribers
- avoid duplicate state

The Runtime Store SHALL NOT:

- execute rendering logic
- perform audio processing
- contain planner logic
- expose mutable internal objects

---

# 2.13 Browser Module Ownership

| Module | Owns |
|--------|------|
| Runtime Store | RuntimeWorldState |
| Three.js | Scene Graph Objects |
| Audio Engine | Audio Graph |
| React UI | UI Components |
| Debug Tools | Diagnostic Views |
| WebSocket Client | Network Connection |

Ownership prevents conflicting updates.

---

# 2.14 Example Runtime Flow

```text
WebSocket

↓

RuntimeWorldState

↓

Runtime Store

↓

Three.js updates scene

↓

Audio Engine updates sources

↓

React refreshes UI

↓

Debug refreshes overlay
```

All modules remain synchronized through the Store.

---

# 2.15 Chapter Summary

The Runtime Store is the architectural core of the Web Runtime Engine.

Rather than allowing browser subsystems to communicate directly, the Runtime
Store distributes immutable RuntimeWorldState snapshots to every subscriber,
ensuring deterministic updates, loose coupling, and synchronized graphics and
spatial audio.

**Next Chapter:** Runtime Data Flow
