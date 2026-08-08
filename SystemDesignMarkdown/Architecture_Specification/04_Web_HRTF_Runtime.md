
# NeuroScape Spec 04 — Web HRTF Runtime

## Responsibility
Render RuntimeWorldState in the browser.

## Technology Stack
- TypeScript
- React (UI only)
- Three.js
- Web Audio API
- HRTF spatializer
- WebSocket

## Coordinate System

+x right
+y up
-z forward

## Runtime Loop

RuntimeWorldState
      ↓
Update Listener
      ↓
Update Ambient
      ↓
Update Action
      ↓
Update Event
      ↓
HRTF Rendering
      ↓
Audio Output

## Rendering Rules

Global Ambient
- environment layer
- no strong attenuation

Localized Ambient
- world anchored
- slow distance attenuation

Action
- listener attached
- computed by controller

Event
- independent moving objects

## HRTF

Renderer uses:

RelativePosition =
SourceWorldPosition -
ListenerWorldPosition

Listener orientation determines azimuth/elevation.

## Visualization

Three.js consumes the same RuntimeWorldState as the audio renderer.

## Constraints

Renderer must never:
- interpret EEG
- perform LLM reasoning
- understand semantic locations

Renderer only consumes numerical runtime state.
