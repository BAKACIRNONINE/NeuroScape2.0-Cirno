# NeuroScape V3 → V4 UI Migration Specification
**Target:** Module 03 (Scene Controller) + Module 04 (Runtime Visualization)
**Audience:** Codex
**Status:** Architecture Migration Plan
**Priority:** High

---

# Objective

The previous NeuroScape UI (Flask + Jinja + Vanilla JavaScript) already contains a mature visual language and interaction flow.

**Do NOT redesign the UI from scratch.**

Instead:

> Preserve the existing visual appearance while completely replacing the underlying data architecture so that the interface becomes the frontend of the new NeuroScape runtime.

The new implementation must follow the architecture defined in:

```
Module 01
Neuro State Interpreter

↓

Module 02
Scene Journey Planner

↓

Module 03
Scene Controller

↓

Runtime World State

↓

Module 04
Visualization + Audio Rendering
```

The UI should become a runtime visualization layer instead of performing reasoning itself.

---

# Overall Migration Strategy

## Keep

Keep the existing visual language.

- Dark immersive background
- Glassmorphism panels
- Session layout
- Loading page
- Home page
- Session page
- Summary page
- Typography
- Animation style
- General interaction

These components already fit the NeuroScape paper well.

---

## Replace

Completely replace the underlying runtime logic.

The current implementation mixes

- UI
- reasoning
- EEG interpretation
- scene simulation
- runtime animation

inside `_scripts_v3.html`.

The new architecture must separate these responsibilities.

---

# High-Level Architecture

Old architecture

```
Backend

├── V2.scene
├── V2.payload
├── V2.history
├── Unity Runtime

↓

_scripts_v3.html

↓

Calculate EEG
Generate mental state
Animate sound source
Generate scene adaptation
Draw canvas
```

New architecture

```
Module 01
Neuro State Interpreter

↓

Module 02
Scene Journey Planner

↓

Module 03
Scene Controller

↓

RuntimeWorldState

↓

WebSocket

↓

Runtime Store

↓

React Components
```

The frontend should NEVER calculate mental state.

The frontend should NEVER simulate source motion.

The frontend should NEVER perform adaptation reasoning.

The frontend only visualizes runtime state.

---

# Runtime Data Flow

```
EEG

↓

Module 01

↓

NeuroState

↓

Module 02

↓

SceneJourneyPlan

↓

Module 03

↓

RuntimeWorldState

↓

Frontend Runtime Store

↓

React UI
```

Everything displayed by the UI must originate from RuntimeWorldState or NeuroState.

---

# Page Layout

Keep the existing three-column layout.

```
----------------------------------------------------------

Journey Plan

Active Soundscape

|

Spatial World Viewer

|

Neuro State

AI Adaptation

----------------------------------------------------------

Session Timer

----------------------------------------------------------
```

The layout should remain visually similar to the existing Session page.

---

# Left Panel Migration

## OLD

Scene Design

Contained:

- environment_type
- atmosphere
- narration
- active_audio
- phase
- density

These values were partially generated inside the frontend.

Remove this behavior.

---

## NEW

Rename:

```
Scene Design
```

to

```
Journey Plan
```

Display:

```
Current Location

Destination

Current Goal

Journey Path

Current Transition

Transition Duration

Transition Policy
```

Example

```
Journey Plan

Current Location

forest_entry

Destination

stream_bank

Current Goal

increase grounding

Journey

forest_entry

↓

clearing

↓

stream_bank

Transition

duration: 18 sec

curve: smoothstep
```

Source:

```
SceneJourneyPlan
```

NOT RuntimeWorldState.

---

# Active Soundscape Panel

Rename

```
Sound Library
```

to

```
Active Soundscape
```

Display runtime sound objects.

Example

```
Ambient

● Forest Wind

● Stream

○ Waterfall

Event

● Bird

○ Leaves

Action

● Footsteps

● Breathing
```

Source:

```
RuntimeWorldState

ambient[]

event[]

action[]
```

Never display sounds not currently active.

---

# Center Panel Migration

The current implementation draws a 2D radar using Canvas.

Remove this implementation.

Replace it with

```
Three.js Runtime World Viewer
```

The viewer should visualize

- Listener
- Ambient sound anchors
- Event objects
- Action sounds
- Current path
- Future path
- Spatial movement

The scene must support

```
+x

+y

-z
```

using real world coordinates.

No fake projection.

---

# Runtime Rendering

Current implementation contains:

```
animateV3Sources()
```

This function performs fake animation.

Delete this logic completely.

Source positions must come from

```
RuntimeWorldState
```

Example

```
mesh.position.set(

source.worldPosition.x,

source.worldPosition.y,

source.worldPosition.z

)
```

No frontend-generated movement.

---

# Listener

Display

```
Listener

↓

Current Position

↓

Current Heading

↓

Journey Path
```

The listener should move according to RuntimeWorldState.

---

# Right Panel

Keep

```
Neuro State
```

Replace the data source.

Current implementation computes

```
attention

relaxation

stability
```

inside JavaScript using

```
theta_beta_ratio

alpha_beta_ratio

sigmoid()
```

Delete all of these calculations.

The frontend must display

```
NeuroState

↓

attention

arousal

stability

confidence

trend
```

No EEG interpretation is allowed inside the frontend.

---

# AI Adaptation Panel

Replace

```
Recommendation
```

with

```
AI Adaptation
```

Display

```
Planner Interpretation

↓

Reasoning Summary

↓

Current Adaptation Goal

↓

Current Scene Update

↓

Expected Effect
```

Example

```
Attention decreasing

↓

Planner believes

Event density is too high

↓

Reduce bird activity

↓

Increase stream ambience

↓

Maintain grounding
```

Source

```
SceneJourneyPlan.reasoningSummary
```

NOT frontend logic.

---

# Session Timer

Keep the existing timer.

Only replace the source.

The timer should read

```
SessionRuntime.elapsedTime
```

instead of frontend-generated values.

---

# Summary Page

Keep the overall visual language.

Expand the report.

Current report

- Session Overview
- Timeline
- Audio Timeline
- Insight

New report

```
Session Overview

↓

Neuro State Timeline

↓

Scene Journey Timeline

↓

Listener Journey

↓

Spatial Audio Timeline

↓

Planner Decisions

↓

Adaptation Timeline

↓

AI Reflection
```

The summary should visualize the actual journey taken through the virtual environment.

---

# Frontend Responsibilities

Allowed

- Rendering
- Animation interpolation
- Camera
- Three.js
- React state
- Audio playback
- WebSocket synchronization

Not allowed

- EEG interpretation
- Mental state estimation
- Adaptation reasoning
- Scene planning
- Fake source animation
- Source movement generation

---

# Required Runtime Store

Create

```
RuntimeStore
```

containing

```
RuntimeStore

NeuroState

SceneJourneyPlan

RuntimeWorldState

SessionRuntime

AudioRuntime

ConnectionState
```

Every React component should subscribe only to RuntimeStore.

---

# Suggested React Structure

```
frontend/

src/

app/

App.tsx

runtime/

RuntimeStore.ts

RuntimeTypes.ts

network/

WebSocketClient.ts

scene/

ThreeScene.ts

ListenerRenderer.ts

AmbientRenderer.ts

EventRenderer.ts

JourneyRenderer.ts

audio/

AudioEngine.ts

HRTFRenderer.ts

AudioAssetManager.ts

ui/

pages/

HomePage.tsx

LoadingPage.tsx

SessionPage.tsx

SummaryPage.tsx

components/

JourneyPlanPanel.tsx

ActiveSoundscapePanel.tsx

NeuroStatePanel.tsx

AIAdaptationPanel.tsx

SessionTimer.tsx

summary/

SummaryRenderer.tsx

styles/

globals.css

neuroscape.css
```

---

# Migration Checklist

## Preserve

- Visual design
- Layout
- Glass panels
- Typography
- Background
- Session flow
- Summary page appearance

---

## Rewrite

- Runtime architecture
- Data flow
- Runtime Store
- Three.js visualization
- WebSocket synchronization
- React component structure

---

## Remove

- animateV3Sources()
- smoothDisplayScores()
- sigmoid()
- theta_beta_ratio calculations
- alpha_beta_ratio calculations
- Fake Canvas spatial simulation
- Frontend scene reasoning
- Frontend EEG reasoning

---

# Final Goal

The final implementation should transform the existing NeuroScape prototype from

```
Flask + Jinja + Imperative JavaScript Demo
```

into

```
React + TypeScript + Three.js + Runtime Store

↓

Real-time Runtime Visualization Client

↓

Module 03 + Module 04
```

without changing the overall user experience or visual identity.