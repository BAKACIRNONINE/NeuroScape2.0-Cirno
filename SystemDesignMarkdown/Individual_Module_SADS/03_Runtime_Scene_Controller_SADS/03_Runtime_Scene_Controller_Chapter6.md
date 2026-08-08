
# NeuroScape Runtime Scene Controller (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 6 — Runtime Algorithms & Mathematical Models**

---

# 6.1 Purpose

This chapter specifies the core algorithms used by the Runtime Scene Controller
to convert semantic intentions into continuous spatial behavior.

Unlike the LLM, which reasons symbolically, the Runtime operates entirely on
numerical state and deterministic update rules.

The algorithms defined here are independent of the rendering engine and can be
implemented in any runtime environment.

---

# 6.2 Runtime Update Equation

For every frame *t*:

```text
RuntimeWorldState(t)

=
F(
    RuntimeWorldState(t-1),
    ActiveSceneJourneyPlan,
    Δt
)
```

where:

- RuntimeWorldState(t-1): previous frame state
- ActiveSceneJourneyPlan: validated semantic plan
- Δt: elapsed time since previous frame

---

# 6.3 Journey Interpolation

The planner provides sparse waypoints.

Example

```text
A -------------------- B
```

The Runtime generates a continuous trajectory.

Recommended methods:

- Catmull-Rom spline
- Cubic spline
- Smoothstep interpolation

Requirements:

- continuous position
- continuous velocity
- no waypoint snapping

Pseudo-code

```text
target = interpolate(path, elapsedTime)

listener.position = target
```

---

# 6.4 Listener Orientation

Listener orientation should follow movement smoothly.

Preferred representation:

```text
Quaternion
```

Advantages:

- avoids gimbal lock
- native to Three.js
- compatible with WebXR

Pseudo-code

```text
direction = normalize(nextPosition-currentPosition)

orientation =
LookRotation(direction, worldUp)
```

If the listener pauses, orientation should remain stable.

---

# 6.5 Action Position Computation

Action sounds do not own independent world positions.

Each frame:

```text
ActionWorldPosition

=

ListenerWorldPosition

+

ListenerOrientation × RelativePosition
```

Example

```text
Feet

relative = [0,-1.5,0.1]

↓

worldPosition computed every frame
```

---

# 6.6 Event Trajectory Interpolation

Each Event owns an independent trajectory.

Example

```text
P0 ---- P1 ---- P2
```

The Runtime interpolates:

```text
position(t)

=
Trajectory(t)
```

Trajectory interpolation should satisfy:

- smooth movement
- bounded velocity
- continuous direction

---

# 6.7 Ambient Gain Model

Global Ambient

```text
Gain

=

SceneGain
```

Localized Ambient

```text
FinalGain

=

SceneGain
×

DistanceGain
×

TransitionGain
```

DistanceGain should decrease gradually.

Avoid aggressive inverse-square attenuation.

Localized ambient should become distant rather than disappear.

---

# 6.8 Event Gain

Event loudness depends on:

```text
EventGain

=

BaseGain
×

DistanceGain
×

TransitionGain
```

Events additionally support:

- fade in
- fade out
- temporary emphasis

---

# 6.9 Transition Interpolation

All transitions are time-based.

Generic interpolation

```text
value(t)

=

lerp(
start,
target,
progress
)
```

where

```text
progress

=

elapsedTime
/
duration
```

Transition Controller manages:

- gain
- position
- trajectory
- activation
- removal

---

# 6.10 Environment Blending

The Runtime supports gradual movement between acoustic regions.

Example

```text
Forest
      │
      ▼
Stream
```

Instead of replacing one ambience with another,

```text
Forest Gain

↓

0.35

↓

0.30

↓

0.25
```

while

```text
Stream Gain

↓

0.15

↓

0.25

↓

0.40
```

The result is perceptual blending rather than scene switching.

---

# 6.11 Runtime Clock

All algorithms must use elapsed time.

```text
Δt

↓

Interpolation

↓

RuntimeWorldState
```

Never assume:

- constant FPS
- fixed rendering interval

This guarantees stable behavior under browser frame variation.

---

# 6.12 Relative Spatialization

The Runtime does not perform HRTF rendering.

It prepares spatial inputs.

For every world-space source

```text
RelativePosition

=

SourceWorldPosition

-

ListenerWorldPosition
```

The renderer converts RelativePosition into:

- azimuth
- elevation
- distance

using listener orientation.

---

# 6.13 Numerical Stability

Algorithms should satisfy:

- deterministic updates
- bounded interpolation
- no discontinuities
- frame-rate independence

Clamp all interpolation parameters to valid ranges.

Avoid accumulating floating-point error over long sessions.

---

# 6.14 Computational Complexity

For one update frame:

| Module | Complexity |
|---------|-----------:|
| Journey | O(1) |
| Ambient | O(A) |
| Action | O(C) |
| Event | O(E) |
| Transition | O(T) |

where

- A = active ambient objects
- C = active action objects
- E = active events
- T = active transitions

Overall complexity:

```text
O(A + C + E + T)
```

Suitable for real-time browser execution.

---

# 6.15 Algorithm Summary

The Runtime Scene Controller converts sparse semantic planning into continuous
numerical behavior through deterministic interpolation, transition scheduling,
trajectory updates, and environment blending.

These algorithms ensure that the RuntimeWorldState evolves smoothly and remains
independent of planner frequency while providing stable input to both Three.js
and the HRTF renderer.

**Next Chapter:** Runtime API & TypeScript Interfaces
