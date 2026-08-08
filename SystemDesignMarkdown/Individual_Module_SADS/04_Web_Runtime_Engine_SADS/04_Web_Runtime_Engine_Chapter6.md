
# NeuroScape Web Runtime Engine (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 6 — HRTF Spatial Rendering**

---

# 6.1 Purpose

This chapter specifies how the Web Runtime Engine transforms the
RuntimeWorldState into real-time binaural audio using Head-Related Transfer
Function (HRTF) rendering.

Unlike the Audio Engine, which is responsible for playback and source
management, the HRTF Spatial Renderer is responsible only for spatialization.

Its task is to transform the geometric relationship between the listener and
sound sources into perceptually correct binaural audio.

---

# 6.2 Architectural Position

```text
RuntimeWorldState
        │
        ▼
Audio Engine
        │
        ▼
HRTF Spatial Renderer
        │
        ▼
Binaural Audio
        │
        ▼
Headphones
```

The renderer receives only numerical spatial information.

It never interprets EEG, planner output, or semantic scene information.

---

# 6.3 Design Principles

## Separation of Spatialization and Playback

The Audio Engine controls:

- playback
- looping
- scheduling
- gain

The HRTF Renderer controls:

- source direction
- source distance
- listener orientation
- binaural filtering

---

## Coordinate Consistency

All calculations use the Runtime coordinate system.

```text
+x → right
+y → up
-z → forward
```

No additional coordinate conversion should occur inside the renderer.

---

## Runtime Independence

The renderer depends only on RuntimeWorldState.

It can therefore be reused with different planners or runtime
implementations.

---

# 6.4 Spatial Audio Model

Each rendered sound is defined by:

```text
Listener Transform

+

Source Transform

↓

Relative Position

↓

HRTF
```

Every audible source is spatialized independently.

---

# 6.5 Listener Model

The listener is described by:

```ts
interface ListenerState{

    worldPosition: Vector3;

    orientation: Quaternion;
}
```

The listener transform defines the acoustic reference frame.

Every source is rendered relative to this frame.

---

# 6.6 Source Model

The renderer supports four source categories.

## Global Ambient

Characteristics

- no fixed point source
- environment-wide
- weak spatial cues
- persistent

Examples

- forest ambience
- ocean ambience

---

## Localized Ambient

Characteristics

- world anchored
- fixed position
- slowly varying gain

Examples

- stream
- waterfall

---

## Action

Characteristics

- attached to listener
- updated every frame
- relative position defined by Runtime

Examples

- breathing
- footsteps

---

## Event

Characteristics

- independent trajectory
- dynamic position
- finite lifetime

Examples

- bird
- insect

---

# 6.7 Relative Position Computation

For every audible source

```text
RelativePosition

=

SourceWorldPosition

-

ListenerWorldPosition
```

The Runtime Scene Controller provides world-space transforms.

The renderer computes only relative spatial relationships.

---

# 6.8 Orientation Transformation

RelativePosition is transformed into listener space.

```text
Listener Orientation

↓

Rotate Relative Position

↓

Listener Coordinate Frame
```

This ensures that head rotation changes perceived sound direction.

---

# 6.9 Spatial Parameters

For every source the renderer computes:

- azimuth
- elevation
- distance

Conceptually:

```text
Relative Position

↓

Azimuth

Elevation

Distance
```

These parameters become the inputs to the HRTF algorithm.

---

# 6.10 HRTF Rendering Pipeline

```text
RuntimeWorldState
        │
        ▼
Relative Position
        │
        ▼
Orientation Transform
        │
        ▼
Azimuth / Elevation
        │
        ▼
HRTF Filter Selection
        │
        ▼
Binaural Output
```

Each active source is processed independently.

---

# 6.11 Update Strategy

Different source categories require different update frequencies.

| Source | Position Update | Gain Update |
|---------|-----------------|------------|
| Global Ambient | Event-driven | Continuous |
| Localized Ambient | Static | Continuous |
| Action | Every frame | Continuous |
| Event | Every frame | Continuous |

Only sources that move require continuous position updates.

---

# 6.12 Spatial Continuity

The renderer must avoid audible discontinuities.

Recommended techniques:

- smooth position interpolation
- gain ramping
- gradual source activation
- gradual source removal

Abrupt parameter changes should be avoided.

---

# 6.13 Performance Considerations

The renderer SHOULD:

- reuse HRTF processing objects
- avoid unnecessary filter recreation
- minimize memory allocation
- update only active sources

The renderer SHOULD NOT:

- recompute static transforms unnecessarily
- allocate new objects during every frame

---

# 6.14 Future Extensions

The architecture allows future support for:

- personalized HRTFs
- SOFA datasets
- WebGPU acceleration
- dynamic room acoustics
- head tracking
- WebXR integration

No architectural changes are required to support these extensions.

---

# 6.15 Chapter Summary

The HRTF Spatial Renderer converts the numerical spatial relationships stored
in RuntimeWorldState into real-time binaural audio.

By separating playback, runtime logic, and spatial rendering, the browser
runtime achieves a modular architecture in which listener motion, sound source
movement, and HRTF processing remain synchronized while preserving clear
software boundaries.

**Next Chapter:** WebSocket Communication
