
# NeuroScape Web Runtime Engine (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 9 — Debugging & Developer Tools**

---

# 9.1 Purpose

This chapter defines the debugging architecture and developer tools used to
inspect, validate, and diagnose the Web Runtime Engine during development and
experimentation.

Debug utilities are first-class engineering components. They improve
development efficiency while remaining completely independent from runtime
execution.

---

# 9.2 Design Goals

The debugging system should:

- observe runtime without changing behavior
- visualize RuntimeWorldState
- expose performance metrics
- simplify fault diagnosis
- support reproducible experiments

---

# 9.3 Debug Architecture

```text
Runtime Store
      │
      ├── Three.js
      ├── Audio Engine
      ├── React UI
      └── Debug Layer
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
 Inspector Timeline Metrics
```

Debug tools subscribe to the Runtime Store exactly like any other module.

---

# 9.4 Runtime Inspector

The Runtime Inspector displays the latest immutable RuntimeWorldState.

Recommended sections:

- Listener
- Ambient
- Action
- Event
- Transition
- Timestamp
- Active planner ID

The inspector is read-only.

---

# 9.5 Scene Inspector

Visual debugging should include:

- listener position
- semantic location labels
- event trajectories
- ambient anchors
- object IDs
- world axes
- coordinate grid

All overlays are optional and toggleable.

---

# 9.6 Audio Inspector

Display runtime audio information:

- active sources
- gain values
- playback state
- spatial category
- source lifetime

This tool helps verify synchronization between RuntimeWorldState and playback.

---

# 9.7 Timeline Viewer

Record important runtime events.

```text
Time ─────────────────────────►

Planner Update

Journey Started

Bird Spawned

Transition Started

Waypoint Reached

Transition Completed
```

The timeline assists replay and debugging.

---

# 9.8 Performance Dashboard

Recommended metrics:

| Metric | Description |
|---------|-------------|
| FPS | Graphics frame rate |
| Frame Time | Render duration |
| Audio Callback | Audio stability |
| Runtime Store Update | Snapshot processing time |
| WebSocket Latency | Network delay |
| Active Objects | Current runtime objects |
| Memory Usage | Browser memory |

Metrics should update continuously.

---

# 9.9 Logging

Structured logs should include:

- timestamp
- module
- severity
- event type
- message
- optional payload

Severity levels:

- INFO
- WARNING
- ERROR
- DEBUG

---

# 9.10 Error Reporting

Errors should include:

- validation failures
- missing audio assets
- invalid RuntimeWorldState
- WebSocket failures
- rendering exceptions

Whenever possible, execution should continue after logging the error.

---

# 9.11 Replay Mode

Replay mode allows recorded RuntimeWorldState snapshots to be loaded without
connecting to a planner.

Benefits:

- deterministic debugging
- regression testing
- demonstration playback
- reproducible experiments

---

# 9.12 Developer Controls

Suggested controls:

- pause rendering
- single-frame stepping
- toggle overlays
- inspect objects
- simulate planner updates
- simulate network latency

These controls are intended for development builds only.

---

# 9.13 Debugging Guidelines

The debugging subsystem SHALL:

- remain read-only
- subscribe through Runtime Store
- avoid modifying runtime state
- minimize performance overhead

The debugging subsystem SHALL NOT:

- execute planner logic
- bypass Runtime Store
- modify RuntimeWorldState

---

# 9.14 Chapter Summary

The Debugging & Developer Tools subsystem provides comprehensive observability
for the Web Runtime Engine.

By combining runtime inspection, visual overlays, audio diagnostics,
performance monitoring, structured logging, and replay capabilities, developers
can validate runtime behavior while preserving the deterministic architecture
of NeuroScape.

**Next Chapter:** Deployment & Browser Integration
