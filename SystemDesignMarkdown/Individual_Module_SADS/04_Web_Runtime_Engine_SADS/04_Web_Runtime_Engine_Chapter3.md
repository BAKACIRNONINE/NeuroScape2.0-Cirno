
# NeuroScape Web Runtime Engine (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 3 — Runtime Data Flow**

---

# 3.1 Purpose

This chapter specifies how RuntimeWorldState flows through the browser runtime,
from network reception to synchronized visual and auditory rendering.

The objective is to guarantee deterministic updates, minimize latency, and
maintain consistency across all browser subsystems.

---

# 3.2 Design Philosophy

The Web Runtime follows a **unidirectional data flow** architecture.

```text
Runtime Scene Controller
        │
        ▼
 RuntimeWorldState
        │
        ▼
   Runtime Store
        │
        ▼
Browser Subsystems
```

No subsystem modifies RuntimeWorldState after it enters the Runtime Store.

---

# 3.3 End-to-End Data Flow

```text
WebSocket
     │
     ▼
Receive RuntimeWorldState
     │
     ▼
Validate Snapshot
     │
     ▼
Runtime Store
     │
 ┌───┼───────────────┐
 ▼   ▼               ▼
Three.js      Audio Engine     React UI
 │              │              │
 └──────┬───────┴──────────────┘
        ▼
   Browser Output
```

---

# 3.4 Receiving Runtime Updates

The WebSocket client receives RuntimeWorldState snapshots asynchronously.

Responsibilities:

- decode message
- validate schema
- verify timestamp
- discard malformed data
- forward valid snapshot to Runtime Store

The network layer must never perform rendering.

---

# 3.5 Runtime Store Update

Each incoming snapshot replaces the previous snapshot atomically.

```text
Previous Snapshot
        │
        ▼
Receive New Snapshot
        │
Validate
        │
Replace
        │
Notify Subscribers
```

Subscribers always observe a complete snapshot.

---

# 3.6 Subscriber Notification

Every subscriber is notified independently.

```text
Runtime Store
      │
      ├── Three.js
      ├── Audio Engine
      ├── UI
      └── Debug
```

Notification order should not affect rendering correctness.

---

# 3.7 Three.js Data Flow

Three.js consumes:

- listener transform
- journey path
- ambient anchors
- event positions
- lifecycle states

Typical update:

```text
RuntimeWorldState
      │
Update Scene Objects
      │
Render Frame
```

---

# 3.8 Audio Data Flow

The Audio Engine consumes:

- listener transform
- source transforms
- gain values
- lifecycle state

Pipeline:

```text
RuntimeWorldState
      │
Update Audio Sources
      │
Update HRTF Parameters
      │
Audio Playback
```

Audio rendering should use the same snapshot as graphics.

---

# 3.9 UI Data Flow

React UI consumes only high-level state.

Examples:

- session status
- latency
- active scene
- diagnostics

UI updates should never block rendering.

---

# 3.10 Frame Synchronization

Every rendering frame is associated with exactly one RuntimeWorldState.

```text
Frame N
      │
RuntimeWorldState N
      │
Graphics
Audio
Debug
```

Never mix data from different snapshots within one frame.

---

# 3.11 Snapshot Strategy

RuntimeWorldState should be treated as immutable.

Advantages:

- deterministic rendering
- simplified debugging
- predictable synchronization
- thread-safe sharing

A new snapshot replaces the old snapshot rather than mutating it.

---

# 3.12 Timing Model

Three independent clocks exist:

| Component | Timing |
|-----------|--------|
| Network | asynchronous |
| Graphics | requestAnimationFrame |
| Audio | audio callback |

The Runtime Store bridges these timing domains.

---

# 3.13 Latency Budget

Recommended browser targets:

| Stage | Target |
|-------|--------|
| WebSocket receive | < 5 ms |
| Store update | < 1 ms |
| Graphics update | < 16.7 ms |
| Audio update | real-time callback |

The system should prioritize continuity over immediate response.

---

# 3.14 Error Handling

If an incoming snapshot is invalid:

1. Reject snapshot.
2. Keep current RuntimeWorldState.
3. Log error.
4. Continue rendering.

Rendering should never stop because of one malformed update.

---

# 3.15 Data Flow Constraints

The browser runtime SHALL:

- maintain immutable snapshots
- synchronize graphics and audio
- isolate network from rendering
- support asynchronous planner updates

The browser runtime SHALL NOT:

- mutate RuntimeWorldState during rendering
- allow rendering modules to communicate directly
- render partially updated snapshots

---

# 3.16 Sequence Diagram

```text
Runtime Controller
        │
        │ RuntimeWorldState
        ▼
 WebSocket Client
        │
        ▼
 Runtime Store
        │
   ┌────┼─────┐
   ▼    ▼     ▼
Three Audio  UI
   │    │
   └────┴────► Browser Frame
```

---

# 3.17 Chapter Summary

The Runtime Data Flow defines how RuntimeWorldState propagates through the
browser in a deterministic, one-way pipeline.

By centralizing updates in the Runtime Store and distributing immutable
snapshots to visualization, audio, UI, and debugging modules, the Web Runtime
Engine maintains synchronization, low latency, and architectural simplicity.

**Next Chapter:** Three.js Scene System
