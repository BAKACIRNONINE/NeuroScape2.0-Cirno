
# NeuroScape Runtime Scene Controller (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 1 — Runtime Overview**

**Project:** NeuroScape  
**Module:** Runtime Scene Controller  
**Document Version:** 3.0 (Draft)  
**Status:** Design Specification  

---

# 1. Introduction

## 1.1 Motivation

NeuroScape is a neuroadaptive spatial audio system that transforms continuously changing neurophysiological states into adaptive three-dimensional soundscapes for meditation.

The system intentionally separates **cognitive reasoning** from **real-time execution**.

The LLM reasons about **how the acoustic world should evolve**, while the Runtime Scene Controller executes that intention as smooth spatial behaviors suitable for real-time rendering.

This separation prevents the LLM from becoming responsible for frame-level rendering decisions while allowing the runtime to guarantee temporal continuity and rendering stability.

---

## 1.2 Design Objective

The Runtime Scene Controller bridges the gap between semantic planning and numerical rendering.

Its objective is to transform a high-level Scene Journey Plan into a continuously evolving runtime representation that can be consumed simultaneously by:

- Web-based HRTF renderer
- Three.js visualization
- Runtime debugger
- Logging subsystem

The Runtime Scene Controller is therefore **the single source of truth** describing the current virtual acoustic world.

---

# 2. Architectural Position

The Runtime Scene Controller sits between the planner and the rendering layer.

```text
EEG
 │
 ▼
Neuro State Interpreter
 │
 ▼
Scene Journey Planner (LLM)
 │
 ▼
SceneJourneyPlan
 │
 ─────────────────────────────────────────────
 │
 ▼
Runtime Scene Controller
 │
 ▼
RuntimeWorldState
 │
 ├──────────────► Three.js
 │
 └──────────────► Web Audio + HRTF
```

The Runtime never communicates directly with EEG processing.

The renderer never communicates directly with the planner.

---

# 3. Scope

The Runtime Scene Controller is responsible for **execution**, not **decision making**.

## Responsibilities

The Runtime SHALL:

- validate incoming scene plans
- resolve semantic locations into world coordinates
- simulate listener movement
- manage runtime sound objects
- schedule transitions
- maintain runtime state
- publish RuntimeWorldState every update cycle

## Non-Responsibilities

The Runtime SHALL NOT:

- interpret EEG
- estimate cognitive state
- perform LLM reasoning
- generate new adaptation strategies
- perform HRTF convolution
- render graphics

These responsibilities belong to other system components.

---

# 4. Design Principles

## Principle 1 — Separation of Reasoning and Execution

The planner decides **what** should happen.

The runtime decides **how** it should happen.

Example:

```text
Planner
"Guide the listener toward the stream."

↓

Runtime

continuous listener trajectory
continuous ambient blending
continuous event scheduling
```

---

## Principle 2 — Continuous World Evolution

Meditation environments should evolve gradually.

The Runtime must never produce abrupt changes caused by transient neurophysiological fluctuations.

Every adaptation should be executed through:

- interpolation
- transition scheduling
- gain smoothing
- trajectory smoothing

---

## Principle 3 — Single Runtime Representation

Every downstream subsystem consumes exactly the same RuntimeWorldState.

```text
RuntimeWorldState
      │
      ├── Three.js
      ├── HRTF Renderer
      ├── Debug UI
      └── Session Logger
```

This guarantees synchronization between visualization and audio.

---

## Principle 4 — Modular Independence

Each subsystem can evolve independently.

Examples:

- EEG algorithm changes
- LLM prompt changes
- rendering engine replacement

should not require modifications to the Runtime Scene Controller.

---

# 5. Runtime Workflow

The Runtime operates continuously after receiving a SceneJourneyPlan.

```text
Receive SceneJourneyPlan
        │
        ▼
Validate
        │
        ▼
Resolve Semantic Locations
        │
        ▼
Initialize Runtime Objects
        │
        ▼
Continuous Runtime Loop
```

During each runtime update:

1. Update listener trajectory.
2. Update ambient layer.
3. Update action layer.
4. Update event layer.
5. Apply transitions.
6. Build RuntimeWorldState.
7. Publish RuntimeWorldState.

---

# 6. Runtime World Model

The Runtime maintains a persistent virtual acoustic world.

This world contains four categories of runtime entities:

- Listener
- Ambient
- Action
- Event

The Runtime does not reason about their meaning.

Instead, it updates their numerical spatial state.

The rendering layer derives HRTF spatialization from this numerical world representation.

---

# 7. Inputs

The Runtime accepts only one planning input:

**SceneJourneyPlan**

Its content includes:

- reasoning summary (ignored by runtime logic)
- user journey
- ambient adaptation
- action adaptation
- event adaptation
- transition policy

The Runtime never consumes raw EEG or prompt text.

---

# 8. Outputs

The Runtime publishes a continuously updated RuntimeWorldState.

Conceptually:

```text
RuntimeWorldState

Listener
Ambient
Action
Event
```

Every output frame represents the complete state of the virtual environment at that instant.

No rendering subsystem should derive its own independent world representation.

---

# 9. Runtime Lifecycle

The Runtime exists throughout a meditation session.

Its lifecycle is:

```text
Waiting
   │
Receive Plan
   │
Initialize
   │
Running
   │
Receive Updated Plan
   │
Merge
   │
Running
   │
Session End
   │
Shutdown
```

Receiving a new SceneJourneyPlan should not reset the world.

Instead, the Runtime merges new intentions into the existing world through the Transition Controller.

---

# 10. Success Criteria

A successful Runtime Scene Controller should satisfy the following properties:

- Stable under continuous planner updates.
- Smooth listener movement.
- Continuous soundscape evolution.
- Shared state for visualization and rendering.
- Independent from EEG implementation.
- Independent from rendering implementation.
- Replaceable without changing planner logic.

---

# 11. Chapter Summary

The Runtime Scene Controller is the execution core of NeuroScape.

It receives semantic scene adaptation plans from the LLM and transforms them into a continuously evolving RuntimeWorldState suitable for browser visualization and real-time HRTF rendering.

By separating semantic reasoning from runtime execution, the controller provides a stable architectural boundary that supports extensibility, modularity, and consistent spatial behavior across the entire system.

**Next Chapter:** Runtime Data Model
