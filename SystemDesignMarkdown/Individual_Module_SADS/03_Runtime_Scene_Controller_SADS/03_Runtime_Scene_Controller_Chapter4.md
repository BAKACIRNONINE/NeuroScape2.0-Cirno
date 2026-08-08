
# NeuroScape Runtime Scene Controller (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 4 — Runtime Scheduling & Update Loop**

---

# 4.1 Purpose

This chapter specifies how the Runtime Scene Controller executes continuously
during a meditation session.

Unlike the Scene Journey Planner, which produces sparse semantic plans,
the Runtime executes deterministic updates at rendering frequency.

Its goals are:

- maintain temporal continuity
- synchronize visualization and audio
- interpolate sparse plans into continuous motion
- provide deterministic runtime behavior

---

# 4.2 Runtime Time Scales

The NeuroScape runtime operates on multiple temporal layers.

```text
EEG Stream
      │
      ▼
Neuro State Update
 (~5–60 s)

      │
      ▼
SceneJourneyPlan
(event-driven)

      │
      ▼
Runtime Scene Controller
(60 Hz)

      │
      ▼
HRTF Audio Callback
(audio buffer rate)

      │
      ▼
Headphones
```

Different modules intentionally run at different frequencies.

---

# 4.3 Runtime Loop

The Runtime Scene Controller executes one update per frame.

```text
while(sessionRunning){

    receivePlannerUpdates();

    validatePlans();

    updateJourney();

    updateAmbient();

    updateAction();

    updateEvent();

    applyTransitions();

    buildRuntimeWorldState();

    publishRuntimeWorldState();
}
```

Planner updates are asynchronous.

Rendering never waits for the planner.

---

# 4.4 Runtime Pipeline

Each frame follows the same execution order.

```text
New Planner Update?
        │
        ▼
Merge Active Plan
        │
        ▼
Update Listener
        │
        ▼
Update Ambient
        │
        ▼
Update Action
        │
        ▼
Update Events
        │
        ▼
Apply Transitions
        │
        ▼
Build RuntimeWorldState
        │
        ├──► Three.js
        └──► HRTF Renderer
```

The execution order must remain deterministic.

---

# 4.5 Planner Synchronization

The planner should never control rendering directly.

Instead:

```text
Planner

SceneJourneyPlan #1
        │
        ▼

Runtime executes...

        │
        ▼

SceneJourneyPlan #2
        │
        ▼

Runtime merges changes
```

A new plan modifies future runtime behavior rather than resetting the world.

---

# 4.6 Journey Scheduling

Journey updates are continuous.

The planner provides only sparse waypoints.

Example

```text
Waypoint A
      │
      │
Waypoint B
```

Runtime

```text
A
•
 \
  •
   •
    •
     •
      B
```

Responsibilities:

- interpolate position
- interpolate orientation
- estimate velocity
- detect arrival
- trigger semantic location changes

---

# 4.7 Ambient Scheduling

Global ambient

- persistent
- long lifetime
- slow gain evolution

Localized ambient

- fixed world position
- gain depends on scene importance and distance

Ambient should never suddenly disappear.

Instead

```text
Current Gain

↓

Transition

↓

Target Gain
```

---

# 4.8 Action Scheduling

Action sounds are synchronized with listener behavior.

Examples

Walking

```text
Journey

↓

Footsteps active
```

Pause

```text
Journey

↓

Footsteps fade out
```

Breathing remains active unless explicitly disabled.

---

# 4.9 Event Scheduling

Events have independent lifecycles.

```text
Waiting

↓

Spawn

↓

Active

↓

Finished

↓

Removed
```

Each event stores

- activation time
- lifetime
- trajectory
- transition state

The scheduler updates all active events every frame.

---

# 4.10 Transition Scheduling

Every state modification passes through the Transition Controller.

Transition examples

```text
Bird appears

↓

Fade In

↓

Active
```

```text
Stream louder

↓

Gain interpolation

↓

Target gain
```

```text
Listener reaches destination

↓

Pause

↓

Continue
```

No controller performs abrupt changes directly.

---

# 4.11 Runtime Clock

All runtime updates should be based on elapsed time.

Never assume constant frame rate.

Example

```text
deltaTime

↓

Journey interpolation

↓

Trajectory interpolation

↓

Gain interpolation
```

The Runtime should remain stable under variable browser frame rates.

---

# 4.12 Publishing RuntimeWorldState

At the end of every update cycle

```text
RuntimeWorldState

↓

Publish
```

Consumers

- Three.js
- HRTF Renderer
- Debug Overlay
- Session Logger

Every consumer reads the same immutable frame snapshot.

---

# 4.13 Thread Responsibilities

Conceptually the browser runtime is divided into:

```text
Planner Updates
        │
        ▼
Scene Controller

──────────────

Three.js Render Loop

──────────────

Audio Engine
```

The Scene Controller produces state.

Rendering consumes state.

Rendering must never modify runtime objects.

---

# 4.14 Scheduling Constraints

The Runtime SHALL:

- execute controllers in deterministic order
- avoid blocking the rendering loop
- avoid planner-induced stalls
- preserve active sound objects
- interpolate all continuous motion

The Runtime SHALL NOT:

- recreate the world every planner update
- pause rendering while waiting for the planner
- expose partially updated RuntimeWorldState

---

# 4.15 Sequence Diagram

```text
Planner
   │
   │ SceneJourneyPlan
   ▼
Runtime
   │
Validate
   │
Update Controllers
   │
Build RuntimeWorldState
   │
   ├────────► Three.js
   │
   └────────► HRTF Renderer
```

---

# 4.16 Chapter Summary

The Runtime Scheduling system decouples low-frequency semantic planning from
high-frequency rendering.

By executing a deterministic update loop, interpolating planner outputs, and
publishing a single RuntimeWorldState every frame, the Runtime Scene Controller
guarantees smooth listener motion, continuous soundscape evolution, and
synchronized visualization and HRTF rendering.

**Next Chapter:** Runtime State Machines
