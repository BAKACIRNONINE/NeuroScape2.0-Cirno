
# NeuroScape Web Runtime Engine (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 4 — Three.js Scene System**

---

# 4.1 Purpose

This chapter specifies how RuntimeWorldState is visualized using Three.js.

The Three.js Scene System is responsible for converting numerical runtime state
into a synchronized visual representation for debugging, demonstrations, and
future immersive (XR) experiences.

The renderer visualizes the world only. It never performs runtime logic,
planner reasoning, or audio processing.

---

# 4.2 Design Principles

The Three.js Scene System follows four principles.

## Separation of Rendering and Logic

Rendering modules only read RuntimeWorldState.

They never modify runtime objects.

---

## One Visual Object per Runtime Object

Every runtime object has one corresponding visual object.

```text
RuntimeWorldState
      │
      ▼
Three.js Scene Graph
```

---

## World Coordinate Consistency

Three.js uses the same coordinate system defined by the Runtime Scene Controller.

```text
+x → right
+y → up
-z → forward
```

No coordinate conversion should occur inside the renderer.

---

## Frame Synchronization

Graphics are updated from a single immutable RuntimeWorldState snapshot.

---

# 4.3 Scene Architecture

```text
Scene
│
├── Environment
├── Listener
├── Journey
├── Ambient Objects
├── Event Objects
├── Debug Layer
└── Camera
```

Each layer has an independent responsibility.

---

# 4.4 Environment Layer

The Environment Layer visualizes static elements of the meditation world.

Examples

- terrain
- trees
- river
- waterfall
- skybox

These objects provide spatial context and rarely change during runtime.

---

# 4.5 Listener Layer

The Listener represents the user's virtual position.

Responsibilities

- display listener marker
- update world position
- update orientation
- visualize viewing direction

The listener transform is updated every frame.

---

# 4.6 Journey Layer

The Journey Layer visualizes the planned and executed path.

Possible representations

- spline curve
- breadcrumb trail
- animated path

The journey visualization is intended for debugging and demonstrations.

---

# 4.7 Ambient Layer

Localized ambient objects are rendered as persistent scene anchors.

Examples

- stream
- waterfall
- fireplace

Global ambient does not require a visible object unless debugging is enabled.

---

# 4.8 Event Layer

Dynamic event objects represent moving sound sources.

Examples

- bird
- butterfly
- drifting leaves
- insects

Responsibilities

- spawn visual object
- update trajectory
- fade object in/out
- remove object after completion

---

# 4.9 Debug Layer

The Debug Layer is optional and may include

- world axes
- semantic labels
- trajectory lines
- bounding spheres
- active transitions
- object identifiers

Debug rendering must not affect runtime behavior.

---

# 4.10 Camera System

The Camera should support multiple modes.

Recommended modes

- Top-down
- Third-person
- Follow listener
- Free camera

The camera is independent of the audio listener.

---

# 4.11 Scene Update Pipeline

For every animation frame:

```text
Read RuntimeWorldState
        │
Update Listener
        │
Update Journey
        │
Update Ambient Objects
        │
Update Event Objects
        │
Update Debug Layer
        │
Render Scene
```

The renderer should not allocate unnecessary objects during updates.

---

# 4.12 Object Lifecycle

Visual objects mirror runtime object lifecycles.

```text
Create
  │
Visible
  │
Update
  │
Fade
  │
Remove
```

Visual lifecycles should remain synchronized with audio lifecycles.

---

# 4.13 Performance Guidelines

The renderer SHALL

- reuse meshes
- pool dynamic objects
- minimize allocations
- update transforms instead of recreating objects
- avoid blocking the animation loop

Target rendering rate:

- 60 FPS

---

# 4.14 Scene Ownership

| Scene Layer | Owner |
|-------------|-------|
| Environment | Environment Renderer |
| Listener | Listener Renderer |
| Journey | Journey Renderer |
| Ambient | Ambient Renderer |
| Event | Event Renderer |
| Debug | Debug Renderer |

Each renderer updates only its own scene objects.

---

# 4.15 Future Extensions

The architecture supports future additions without changing RuntimeWorldState.

Examples

- WebXR
- volumetric visualization
- voxel overlays
- spatial analytics
- replay mode

---

# 4.16 Chapter Summary

The Three.js Scene System provides a modular visualization layer that maps
RuntimeWorldState to a browser-based 3D scene.

By maintaining strict separation between runtime logic and rendering, the
system ensures synchronized visualization, efficient updates, and compatibility
with future immersive interfaces.

**Next Chapter:** Audio Engine
