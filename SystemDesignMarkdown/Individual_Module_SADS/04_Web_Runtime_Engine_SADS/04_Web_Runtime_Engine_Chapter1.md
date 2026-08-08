
# NeuroScape Web Runtime Engine (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 1 — Web Runtime Overview**

**Project:** NeuroScape  
**Module:** Web Runtime Engine  
**Version:** 3.0 (Draft)

---

# 1. Introduction

## 1.1 Background

The NeuroScape Runtime Scene Controller is responsible for converting a semantic
SceneJourneyPlan into a continuously evolving RuntimeWorldState.

However, RuntimeWorldState itself cannot produce any user experience.

A browser-based runtime engine is therefore required to transform numerical
runtime state into synchronized visual and auditory experiences.

This document specifies the browser-side execution engine responsible for
real-time visualization, spatial audio rendering, networking, debugging, and
user interaction.

---

## 1.2 Purpose

The Web Runtime Engine acts as the execution environment of NeuroScape inside
the browser.

It consumes RuntimeWorldState produced by the Runtime Scene Controller and
renders it through multiple synchronized subsystems.

Its responsibilities include:

- maintaining browser runtime state
- rendering the virtual scene
- spatializing audio
- synchronizing visualization and sound
- communicating with backend services
- providing debugging utilities

The Web Runtime Engine never performs EEG interpretation or LLM reasoning.

---

# 2. Architectural Position

```text
EEG
 │
 ▼
Neuro State Interpreter
 │
 ▼
Scene Journey Planner
 │
 ▼
Runtime Scene Controller
 │
 ▼
RuntimeWorldState
 │
──────────────── Browser Boundary ────────────────
 │
 ▼
Web Runtime Engine
 │
 ├── Runtime Store
 ├── Three.js Renderer
 ├── Audio Engine
 ├── HRTF Spatial Renderer
 ├── React UI
 ├── Debug Tools
 └── WebSocket Client
 │
 ▼
Headphones + Browser Display
```

The Runtime Scene Controller and Web Runtime Engine communicate exclusively
through RuntimeWorldState.

---

# 3. Design Goals

The Web Runtime Engine is designed around five goals.

## Goal 1 — Rendering Independence

Rendering technologies should be replaceable.

Examples:

- Three.js
- Babylon.js
- custom WebGPU renderer

The rest of the architecture should remain unchanged.

---

## Goal 2 — Audio–Visual Synchronization

Visualization and audio must consume the same RuntimeWorldState.

This guarantees that:

- visible object positions
- audible source positions
- debugging overlays

always represent the same virtual world.

---

## Goal 3 — Centralized Runtime State

The browser should maintain one shared Runtime Store.

```text
RuntimeWorldState
        │
        ▼
Runtime Store
        │
 ├── Three.js
 ├── Audio Engine
 ├── UI
 └── Debug
```

Subsystems subscribe to the Runtime Store instead of communicating directly.

---

## Goal 4 — Low Latency

The engine should support continuous rendering while accepting asynchronous
planner updates.

Rendering must never block waiting for network communication.

---

## Goal 5 — Extensibility

Future modules should be added without redesigning the runtime.

Examples include:

- XR support
- recording
- analytics
- additional sensors

---

# 4. Scope

The Web Runtime Engine SHALL:

- consume RuntimeWorldState
- maintain Runtime Store
- render the scene
- render spatial audio
- synchronize browser subsystems
- display debugging information

The Web Runtime Engine SHALL NOT:

- interpret EEG
- execute LLM prompts
- modify SceneJourneyPlans
- perform runtime planning

---

# 5. Core Browser Subsystems

The Web Runtime Engine consists of the following subsystems.

## Runtime Store

Maintains the latest immutable RuntimeWorldState.

Acts as the single source of truth inside the browser.

---

## Three.js Renderer

Visualizes:

- listener
- user journey
- ambient anchors
- event trajectories
- debugging overlays

---

## Audio Engine

Responsible for:

- AudioContext
- decoding assets
- gain management
- scheduling playback

---

## HRTF Spatial Renderer

Consumes RuntimeWorldState and computes spatial audio parameters from listener
and source transforms.

It never reasons about semantic scene meaning.

---

## React UI

Displays:

- session controls
- runtime status
- metrics
- configuration panels

The UI must never directly modify runtime objects.

---

## Debug Tools

Provide developers with:

- RuntimeWorldState inspector
- controller status
- latency metrics
- scene graph visualization
- event timeline

---

## WebSocket Client

Maintains communication with backend services.

Receives updated RuntimeWorldState or control messages asynchronously.

---

# 6. Browser Runtime Workflow

```text
RuntimeWorldState
        │
        ▼
Runtime Store
        │
 ├────────► Three.js
 ├────────► Audio Engine
 ├────────► Debug Tools
 └────────► React UI
```

Each subsystem observes Runtime Store updates independently.

---

# 7. Runtime Lifecycle

```text
Browser Start
      │
Initialize Runtime Store
      │
Initialize Renderers
      │
Connect WebSocket
      │
Running
      │
Receive Runtime Updates
      │
Render Frame
      │
Shutdown
```

Initialization order should remain deterministic.

---

# 8. Inputs and Outputs

## Input

The Web Runtime Engine accepts:

- RuntimeWorldState
- browser timing information
- user interaction events

## Output

The engine produces:

- synchronized 3D visualization
- binaural audio
- debugging information
- runtime telemetry

---

# 9. Success Criteria

A successful Web Runtime Engine should:

- render RuntimeWorldState continuously
- maintain audio-visual synchronization
- support asynchronous updates
- remain independent from planner implementation
- expose clear debugging interfaces
- achieve stable browser performance

---

# 10. Chapter Summary

The Web Runtime Engine is the browser-side execution environment of NeuroScape.

It transforms RuntimeWorldState into synchronized visual and auditory
experiences through a modular architecture centered on a shared Runtime Store.

By separating browser execution from runtime planning, the architecture remains
extensible, maintainable, and compatible with future rendering technologies.

**Next Chapter:** Browser Runtime Architecture
