
# NeuroScape Runtime Scene Controller (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 5 — Runtime Object Lifecycle**

---

# 5.1 Purpose

This chapter defines the lifecycle of every runtime object managed by the
Runtime Scene Controller.

A runtime object is any entity that persists across multiple update frames.

Examples include:

- Listener
- Global Ambient
- Localized Ambient
- Action Sound
- Event Sound

Rather than creating and destroying objects abruptly, NeuroScape manages every
object through explicit lifecycle transitions to preserve perceptual continuity.

---

# 5.2 Design Principles

Every runtime object follows the same principles:

- predictable lifecycle
- deterministic state transitions
- smooth activation and deactivation
- no abrupt appearance or disappearance
- transition-driven updates

All lifecycle changes are coordinated by the Transition Controller.

---

# 5.3 Generic Lifecycle

Every runtime object follows the conceptual lifecycle below.

```text
Created
   │
Initialized
   │
Active
   │
Updating
   │
Transitioning
   │
Inactive
   │
Destroyed
```

Not every object uses every state, but all objects should support
non-disruptive transitions.

---

# 5.4 Listener Lifecycle

The Listener exists throughout the meditation session.

```text
Initialize
     │
Moving
     │
Pause
     │
Moving
     │
Session End
```

Responsibilities during lifecycle:

- update world position
- update orientation
- update semantic location
- notify Action Controller
- notify Event proximity triggers

The listener is never destroyed until the session ends.

---

# 5.5 Global Ambient Lifecycle

Global ambient represents the persistent environmental sound field.

```text
Disabled
    │
Fade In
    │
Active
    │
Gain Adjustment
    │
Fade Out
    │
Disabled
```

Characteristics:

- long lifetime
- persistent background
- environment-wide
- no world position

Examples:

- forest atmosphere
- wind bed
- ocean ambience

---

# 5.6 Localized Ambient Lifecycle

Localized ambient represents fixed environmental objects.

```text
Registered
     │
Active
     │
Gain Update
     │
Fade Out
     │
Inactive
```

Localized ambient remains at a fixed world position.

Only its perceptual gain changes over time.

Examples:

- stream
- waterfall
- fireplace

---

# 5.7 Action Lifecycle

Action sounds depend on listener behaviour.

Example: footsteps

```text
Idle
   │
Walking
   │
Stopping
   │
Idle
```

Example: breathing

```text
Initialize
      │
Active
      │
Gain Update
      │
Session End
```

Action sounds never own independent trajectories.

Their lifecycle follows the listener state.

---

# 5.8 Event Lifecycle

Events are temporary dynamic sound objects.

```text
Waiting
   │
Spawn
   │
Fade In
   │
Active
   │
Fade Out
   │
Finished
   │
Removed
```

Typical examples:

- bird
- insect
- drifting leaves

Each event owns:

- trajectory
- activation time
- duration
- transition state

---

# 5.9 Transition Lifecycle

Every transition is itself a runtime object.

Example:

```text
Scheduled
      │
Started
      │
Interpolating
      │
Completed
```

Transition types:

- gain transition
- position transition
- trajectory transition
- activation transition
- removal transition

The Transition Controller manages all active transitions.

---

# 5.10 Runtime Object Ownership

Each runtime object has exactly one owner.

| Runtime Object | Owner |
|----------------|-------|
| Listener | Journey Controller |
| Global Ambient | Ambient Controller |
| Localized Ambient | Ambient Controller |
| Action | Action Controller |
| Event | Event Controller |
| Transition | Transition Controller |

Controllers may read shared state but only the owner may modify it.

---

# 5.11 Runtime Dependencies

Runtime objects interact through dependencies rather than direct control.

```text
Listener
    │
    ├────────► Action
    │
    ├────────► Event Trigger
    │
    └────────► Localized Ambient Gain
```

Examples:

- Listener movement updates Action world position.
- Listener proximity influences localized ambient gain.
- Listener entering a semantic region may activate an Event.

Objects should communicate through RuntimeWorldState instead of direct references.

---

# 5.12 Lifecycle Constraints

The Runtime SHALL:

- preserve active objects across planner updates
- reuse objects whenever possible
- fade objects before removal
- avoid duplicate runtime objects
- maintain deterministic state transitions

The Runtime SHALL NOT:

- recreate every object after each planner update
- instantly delete audible objects
- skip transition states

---

# 5.13 Example Lifecycle Timeline

```text
Time ─────────────────────────────────────────────►

Forest Wind
FadeIn ───────── Active ─────────────── FadeOut

Stream
Inactive ─ Active ───────────── Active

Bird
Waiting ─ Spawn ─ Active ─ FadeOut ─ Remove

Footsteps
Idle ─ Walking ─ Idle ─ Walking ─ Idle
```

Each object evolves independently while sharing the same runtime clock.

---

# 5.14 Chapter Summary

Runtime objects are persistent entities whose behaviour is governed by explicit
lifecycles rather than one-time commands.

By managing listener movement, ambient layers, action sounds, event sounds, and
transitions through deterministic lifecycle models, the Runtime Scene
Controller preserves continuity, avoids abrupt scene changes, and provides a
stable foundation for the RuntimeWorldState.

**Next Chapter:** Runtime Algorithms
