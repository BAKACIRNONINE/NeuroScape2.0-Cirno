
# NeuroScape Web Runtime Engine (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 5 — Audio Engine**

---

# 5.1 Purpose

This chapter specifies the browser-side Audio Engine responsible for audio
playback, scheduling, source management, gain control, and communication with
the HRTF Spatial Renderer.

The Audio Engine transforms RuntimeWorldState into a collection of active audio
sources. It does **not** perform planner reasoning or scene management.

---

# 5.2 Architectural Position

```text
RuntimeWorldState
        │
        ▼
    Audio Engine
        │
        ├── Audio Asset Manager
        ├── Source Manager
        ├── Playback Scheduler
        ├── Gain Manager
        └── HRTF Spatial Renderer
        │
        ▼
    Browser Audio Output
```

The Audio Engine is the only module responsible for browser audio playback.

---

# 5.3 Responsibilities

The Audio Engine SHALL:

- create and maintain the AudioContext
- load and cache audio assets
- create runtime audio sources
- schedule playback
- update gain
- synchronize source transforms
- forward spatial information to the HRTF renderer

The Audio Engine SHALL NOT:

- interpret EEG
- execute SceneJourneyPlans
- compute listener trajectories
- modify RuntimeWorldState

---

# 5.4 Internal Modules

## AudioContext Manager

Responsible for:

- creating AudioContext
- handling browser autoplay restrictions
- managing suspend/resume
- exposing the master clock

---

## Audio Asset Manager

Responsible for:

- loading audio files
- decoding buffers
- caching decoded assets
- preloading frequently used sounds

Audio assets should never be decoded during rendering if avoidable.

---

## Source Manager

Maintains all active audio sources.

Source categories:

- Global Ambient
- Localized Ambient
- Action
- Event

Each runtime object owns exactly one audio source.

---

## Playback Scheduler

Responsible for:

- starting playback
- stopping playback
- looping ambient sounds
- scheduling event sounds
- synchronizing with RuntimeWorldState

Playback scheduling should be independent of rendering FPS.

---

## Gain Manager

Updates source loudness.

Gain values originate from RuntimeWorldState and are applied using smooth
interpolation.

Responsibilities:

- gain ramping
- cross-fades
- master volume
- category volume

---

# 5.5 Audio Graph

A recommended browser audio graph is:

```text
AudioBufferSource
        │
        ▼
GainNode
        │
        ▼
HRTF Spatial Renderer
        │
        ▼
Master Gain
        │
        ▼
AudioDestination
```

Each active sound owns its own GainNode.

---

# 5.6 Runtime Audio Sources

## Global Ambient

Characteristics

- looping
- persistent
- environment-wide
- normally active for long durations

Examples

- forest ambience
- ocean ambience
- wind bed

---

## Localized Ambient

Characteristics

- looping
- world-anchored
- fixed position
- slow gain evolution

Examples

- stream
- waterfall
- fireplace

---

## Action

Characteristics

- attached to listener
- updated every frame
- activated by listener behaviour

Examples

- breathing
- footsteps
- clothing movement

---

## Event

Characteristics

- independent object
- finite lifetime
- dynamic trajectory

Examples

- birds
- insects
- falling leaves

---

# 5.7 Audio Update Pipeline

Each runtime update follows:

```text
Read RuntimeWorldState
        │
Update Source Lifecycle
        │
Update Gain
        │
Update Spatial Parameters
        │
Schedule Playback
        │
Forward to HRTF Renderer
```

The Audio Engine should avoid reallocating audio nodes whenever possible.

---

# 5.8 Audio Lifecycle

Each audio source follows:

```text
Created
    │
Loading
    │
Ready
    │
Playing
    │
Updating
    │
Stopping
    │
Released
```

Object reuse is preferred over destruction and recreation.

---

# 5.9 Synchronization

Graphics and audio consume the same RuntimeWorldState snapshot.

```text
RuntimeWorldState
      │
      ├── Three.js
      └── Audio Engine
```

Neither subsystem should derive its own world model.

---

# 5.10 Performance Guidelines

The Audio Engine SHOULD:

- reuse decoded buffers
- reuse GainNodes when possible
- preload frequently used assets
- avoid blocking the audio thread
- minimize garbage collection

Target:

- no audible glitches
- stable playback
- low scheduling latency

---

# 5.11 Failure Recovery

If an audio asset is unavailable:

1. log the error
2. skip the missing source
3. continue playback
4. preserve remaining audio objects

Audio failures should never terminate the runtime.

---

# 5.12 Chapter Summary

The Audio Engine is responsible for transforming RuntimeWorldState into active
browser audio playback.

By separating asset management, playback scheduling, source management, gain
control, and spatial rendering, the architecture remains modular, extensible,
and synchronized with the Runtime Scene Controller.

**Next Chapter:** HRTF Spatial Rendering
