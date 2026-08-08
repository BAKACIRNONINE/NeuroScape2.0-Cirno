# NeuroScape — Project Bootstrap Specification

**Document:** `PROJECT_BOOTSTRAP.md`  
**Audience:** Codex / AI coding agent  
**Purpose:** Initialize the NeuroScape codebase before implementing Module 03 and Module 04  
**Status:** Implementation Instruction  
**Priority:** Required before runtime implementation

---

# 1. Objective

This repository intentionally begins from architecture specifications and legacy UI references rather than an existing application scaffold.

Your first task is to create a clean, conventional project structure that supports the implementation of:

- **Module 03 — Runtime Scene Controller**
- **Module 04 — Web Runtime Engine**

Do not redesign the system architecture.

Read all Markdown specifications under the project before modifying or creating implementation code.

The Markdown design documents are the primary source of truth.

---

# 2. Important Architectural Context

NeuroScape follows this pipeline:

```text
Raw EEG
   ↓
Module 01 — Neuro State Interpreter
   ↓
NeuroState
   ↓
Module 02 — Scene Journey Planner
   ↓
SceneJourneyPlan
   ↓
Module 03 — Runtime Scene Controller
   ↓
RuntimeWorldState
   ↓
Module 04 — Web Runtime Engine
   ↓
Three.js + Web Audio/HRTF + React UI
```

The bootstrap must preserve these module boundaries.

---

# 3. Canonical Architecture Decisions

Use the following decisions throughout the new project.

## 3.1 Neuro metric

Use **Arousal** as the canonical runtime metric.

Do not create a first-class `relaxation` runtime metric.

Legacy UI references to Relaxation may later be renamed to Arousal.

The frontend must never infer Relaxation from Arousal.

---

## 3.2 Module 04 data streams

Module 04 may receive three read-only streams:

```text
NeuroState
SceneJourneyPlan
RuntimeWorldState
```

Their roles are:

```text
NeuroState
→ UI neuro-state visualization only

SceneJourneyPlan
→ Journey-plan and AI-adaptation visualization only

RuntimeWorldState
→ authoritative runtime spatial state
```

`RuntimeWorldState` remains the single spatial source of truth.

---

## 3.3 Runtime coordinates

Use the global coordinate convention:

```text
+x = right
+y = up
-z = forward
```

Do not redefine this convention in the frontend.

---

## 3.4 Time representation

Use:

```text
milliseconds since session start
```

for runtime session timestamps unless an external integration later requires a separate wall-clock timestamp.

---

## 3.5 Audio assets

Runtime objects reference:

```ts
assetId: string
```

Do not store direct filesystem paths in runtime state.

The browser-side `AudioAssetManager` resolves:

```text
assetId
   ↓
audio asset
```

---

# 4. Bootstrap Technology Stack

Initialize the implementation using:

- TypeScript
- React
- Vite
- Three.js
- Web Audio API
- Zustand
- Vitest
- ESLint
- Prettier

Prefer lightweight dependencies.

Do not introduce a large framework unless explicitly required by the architecture documents.

Do not use Redux unless a later requirement makes Zustand insufficient.

---

# 5. Workspace Structure

Create the repository structure below.

```text
NeuroScape2.0/
│
├── SystemDesign/
│   └── existing architecture Markdown files
│
├── UIreference/
│   └── existing legacy UI reference files
│
├── packages/
│   └── contracts/
│       ├── src/
│       │   ├── neuro-state.ts
│       │   ├── scene-journey-plan.ts
│       │   ├── runtime-world-state.ts
│       │   ├── protocol.ts
│       │   └── index.ts
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
│
├── module-03-runtime-scene-controller/
│   ├── src/
│   │   ├── core/
│   │   │   ├── RuntimeController.ts
│   │   │   └── RuntimeWorldStateBuilder.ts
│   │   │
│   │   ├── scene-graph/
│   │   │   ├── SceneGraph.ts
│   │   │   ├── SceneGraphLoader.ts
│   │   │   ├── SemanticLocationMapper.ts
│   │   │   └── scene-graph.example.json
│   │   │
│   │   ├── validation/
│   │   │   └── PlanValidator.ts
│   │   │
│   │   ├── controllers/
│   │   │   ├── JourneyController.ts
│   │   │   ├── AmbientController.ts
│   │   │   ├── ActionController.ts
│   │   │   ├── EventController.ts
│   │   │   └── TransitionController.ts
│   │   │
│   │   ├── events/
│   │   ├── logging/
│   │   └── index.ts
│   │
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── public/
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   │
│   │   ├── runtime/
│   │   │   ├── RuntimeStore.ts
│   │   │   ├── selectors.ts
│   │   │   └── validation.ts
│   │   │
│   │   ├── network/
│   │   │   └── WebSocketClient.ts
│   │   │
│   │   ├── scene/
│   │   │   ├── ThreeScene.ts
│   │   │   ├── ListenerRenderer.ts
│   │   │   ├── JourneyRenderer.ts
│   │   │   ├── AmbientRenderer.ts
│   │   │   ├── ActionRenderer.ts
│   │   │   ├── EventRenderer.ts
│   │   │   └── DebugRenderer.ts
│   │   │
│   │   ├── audio/
│   │   │   ├── AudioEngine.ts
│   │   │   ├── AudioAssetManager.ts
│   │   │   ├── SourceManager.ts
│   │   │   ├── PlaybackScheduler.ts
│   │   │   └── HRTFRenderer.ts
│   │   │
│   │   ├── ui/
│   │   │   ├── pages/
│   │   │   │   ├── HomePage.tsx
│   │   │   │   ├── LoadingPage.tsx
│   │   │   │   ├── PreviewPage.tsx
│   │   │   │   ├── SessionPage.tsx
│   │   │   │   └── SummaryPage.tsx
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── JourneyPlanPanel.tsx
│   │   │   │   ├── ActiveSoundscapePanel.tsx
│   │   │   │   ├── NeuroStatePanel.tsx
│   │   │   │   ├── AIAdaptationPanel.tsx
│   │   │   │   └── SessionTimer.tsx
│   │   │   │
│   │   │   └── summary/
│   │   │
│   │   ├── debug/
│   │   ├── replay/
│   │   ├── styles/
│   │   └── assets/
│   │       ├── ambient/
│   │       ├── action/
│   │       ├── event/
│   │       ├── hrtf/
│   │       └── textures/
│   │
│   ├── tests/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── package.json
├── tsconfig.base.json
├── eslint.config.js
├── .prettierrc
├── .gitignore
└── README.md
```

Do not create duplicate world-state definitions across packages.

---

# 6. Workspace Rules

The root repository should act as a workspace.

Use npm workspaces if available.

Recommended root `package.json` structure:

```json
{
  "private": true,
  "workspaces": [
    "packages/*",
    "module-03-runtime-scene-controller",
    "frontend"
  ]
}
```

The exact script syntax may be adjusted to the installed Node/npm version.

---

# 7. Shared Contracts Package

Create:

```text
packages/contracts
```

This package owns public data contracts shared across module boundaries.

It must NOT contain:

- controller logic
- Three.js code
- Web Audio code
- React code
- LLM reasoning
- EEG processing

It contains data definitions only.

---

# 8. Initial Shared Types

Create basic types first.

```ts
export type Vector3 = [number, number, number];

export type Quaternion = [
  number,
  number,
  number,
  number
];

export type SessionTimestampMs = number;
```

---

# 9. NeuroState Contract

Create a minimal canonical contract based on the architecture specification.

```ts
export type NeuroTrend =
  | "increasing"
  | "decreasing"
  | "stable";

export interface NeuroMetric {
  value: number;
  trend: NeuroTrend;
}

export interface NeuroState {
  timestampMs: SessionTimestampMs;

  attention: NeuroMetric;

  arousal: NeuroMetric;

  stability: number;

  confidence: number;

  historySummary?: string;
}
```

Do not calculate these values in Module 03 or Module 04.

---

# 10. RuntimeWorldState Contract

Create the public Module 03 output contract.

```ts
export interface ListenerState {
  worldPosition: Vector3;
  orientation: Quaternion;
  velocity: Vector3;
  semanticLocation: string;
}

export interface AmbientState {
  id: string;
  assetId: string;

  mode:
    | "global"
    | "localized";

  worldPosition?: Vector3;

  gain: number;

  active: boolean;
}

export type ActionAttachment =
  | "head"
  | "chest"
  | "feet"
  | "body";

export interface ActionState {
  id: string;
  assetId: string;

  attachment: ActionAttachment;

  relativePosition: Vector3;

  worldPosition: Vector3;

  gain: number;

  active: boolean;
}

export type EventLifecycle =
  | "waiting"
  | "active"
  | "finished";

export interface EventState {
  id: string;
  assetId: string;

  worldPosition: Vector3;

  velocity: Vector3;

  gain: number;

  lifecycle: EventLifecycle;

  active: boolean;
}
```

---

# 11. Journey Visualization Metadata

Module 03 should later expose numerical journey metadata for visualization.

Prepare the contract now.

```ts
export interface RuntimeJourneyState {
  plannedPath: Vector3[];

  currentSegmentIndex: number;

  remainingWaypoints: Vector3[];
}
```

The frontend may display these values.

The frontend must never reconstruct the path from semantic locations.

---

# 12. RuntimeWorldState Root

Use:

```ts
export interface RuntimeWorldState {
  timestampMs: SessionTimestampMs;

  listener: ListenerState;

  journey?: RuntimeJourneyState;

  ambient: AmbientState[];

  action: ActionState[];

  event: EventState[];
}
```

Additional diagnostic metadata may be added later without changing spatial ownership.

---

# 13. SceneJourneyPlan

The architecture specification references nested plan structures that are not fully defined yet.

Do NOT invent a large planning schema.

Create a conservative initial type surface sufficient for Phase 1.

Clearly mark unresolved fields with TODO comments.

Example:

```ts
export interface SceneJourneyPlan {
  planId: string;

  planningHorizonSec: number;

  reasoningSummary?: string;

  userJourney: UserJourneyPlan;

  soundscape: SoundscapePlan;

  transitionPolicy: TransitionPolicy;
}
```

Create minimal placeholder interfaces for:

```text
UserJourneyPlan
SoundscapePlan
TransitionPolicy
```

Only include fields directly supported by the existing specification files.

Do not add speculative AI features.

---

# 14. Protocol Definitions

Prepare browser message envelopes.

At minimum:

```ts
export interface RuntimeWorldStateMessage {
  type: "RuntimeWorldState";

  protocolVersion: string;

  sessionId: string;

  timestampMs: SessionTimestampMs;

  payload: RuntimeWorldState;
}
```

Also reserve discriminated message types for:

```text
NeuroState
SceneJourneyPlan
SessionStatus
PlannerStatus
ClientCommand
Ping
Pong
Error
```

Do not implement networking behavior during bootstrap.

---

# 15. Module 03 Bootstrap

During this bootstrap stage, create the Module 03 directory and source-file placeholders.

Do NOT fully implement the controllers yet.

The initial scaffold should compile with placeholder classes/interfaces.

Example:

```ts
export class JourneyController {
  initialize(): void {
    // TODO: Module 03 Phase 2
  }
}
```

Do not place rendering dependencies in Module 03.

Module 03 must not import:

```text
react
three
zustand
Web Audio APIs
```

---

# 16. Module 04 / Frontend Bootstrap

Initialize a React + Vite + TypeScript frontend.

Install:

```text
react
react-dom
three
zustand
```

Add development/testing dependencies for:

```text
vite
typescript
vitest
eslint
prettier
@types/react
@types/react-dom
```

Use the standard Vite React TypeScript setup.

Do not implement HRTF processing during bootstrap.

Do not migrate all legacy UI code during bootstrap.

---

# 17. Legacy UI Policy

The files under:

```text
UIreference/
```

are **reference material only**.

Do not directly continue the old Flask/Jinja architecture.

The final UI should use:

```text
React
+
TypeScript
```

Preserve the following visual identity:

- dark immersive environmental backgrounds
- glass panels
- muted white typography
- NeuroScape branding
- three-column session composition
- central spatial view
- neuro-state visualization
- session timer
- loading experience
- summary/report visual language

Do not copy old frontend reasoning logic.

---

# 18. Explicit Legacy Logic to Avoid

Do NOT port the following behaviors into the new frontend:

```text
animateV3Sources()
smoothDisplayScores()
sigmoid()
theta/beta attention inference
alpha/beta relaxation inference
frontend stability inference
frontend scene reasoning
frontend atmosphere reasoning
fake spatial motion
fake source positions
V2.scene compatibility
Unity runtime compatibility
```

The old UI may be inspected for appearance and interaction patterns only.

---

# 19. Runtime Store Bootstrap

Create a typed Zustand store shell.

Conceptually:

```text
RuntimeStore

├── neuroState
├── sceneJourneyPlan
├── runtimeWorldState
├── sessionRuntime
├── audioRuntime
└── connectionState
```

`RuntimeWorldState` is the only authoritative spatial state.

During bootstrap, these slices may contain placeholder interfaces.

Do not add spatial calculations to the store.

---

# 20. Three.js Bootstrap

Create structural files only.

For example:

```text
ThreeScene
ListenerRenderer
JourneyRenderer
AmbientRenderer
ActionRenderer
EventRenderer
DebugRenderer
```

During bootstrap they may expose empty lifecycle methods.

Example:

```ts
export interface SceneRenderer {
  initialize(): void;
  update(state: RuntimeWorldState): void;
  dispose(): void;
}
```

Do not generate fake motion.

---

# 21. Audio Bootstrap

Create only the audio architecture skeleton.

```text
AudioEngine
AudioAssetManager
SourceManager
PlaybackScheduler
HRTFRenderer
```

No planner logic is allowed here.

No semantic location logic is allowed here.

---

# 22. HRTF Boundary

Prepare the following conceptual flow:

```text
RuntimeWorldState
       ↓
Audio Engine
       ↓
HRTF Spatial Renderer
       ↓
Binaural output
```

Later the HRTF renderer will calculate:

```text
source world position
-
listener world position

↓

listener-relative position

↓

azimuth
elevation
distance

↓

HRTF
```

Do not implement custom HRTF DSP during bootstrap.

---

# 23. Testing Scaffold

Set up Vitest.

Create basic smoke tests.

At minimum:

```text
contracts import successfully
RuntimeWorldState fixture is valid TypeScript
RuntimeController can be instantiated
RuntimeStore can be instantiated
```

Do not attempt complex runtime behavior tests yet.

---

# 24. TypeScript Configuration

Create a shared strict TypeScript configuration.

Recommended compiler principles:

```text
strict = true
noImplicitAny = true
noUncheckedIndexedAccess = true
forceConsistentCasingInFileNames = true
```

Use modern ECMAScript modules.

Avoid `any` unless unavoidable at external boundaries.

---

# 25. ESLint and Formatting

Configure ESLint and Prettier.

The purpose is consistency, not excessive rule complexity.

Avoid adding a large number of opinionated plugins.

---

# 26. README

Create a root `README.md` explaining:

```text
What NeuroScape is

System pipeline

Module 03 responsibility

Module 04 responsibility

Repository structure

Development commands

Testing commands
```

Clearly state:

```text
SystemDesign/
```

contains architecture source documents.

---

# 27. Root Development Commands

Prepare scripts equivalent to:

```bash
npm install

npm run typecheck

npm run test

npm run lint

npm run dev
```

`npm run dev` should start the frontend.

Add module-specific commands if useful.

---

# 28. No Node Available in Current Agent Environment

If Node/npm/TypeScript are not available in the current execution environment:

Do NOT treat this as a blocker.

Create the project scaffold and configuration files anyway.

Perform static inspection.

Document the exact verification commands that should be run later in an environment with Node installed.

Do not claim that tests passed if they were not actually executed.

Use wording such as:

```text
Tests configured but not executed because Node/npm are unavailable in the current environment.
```

---

# 29. Bootstrap Acceptance Criteria

The bootstrap is complete when all of the following are true:

- Project workspace exists.
- `packages/contracts` exists.
- Module 03 project exists.
- React frontend project exists.
- TypeScript configuration exists.
- Vite configuration exists.
- Zustand store shell exists.
- Three.js renderer structure exists.
- Audio architecture structure exists.
- Vitest structure exists.
- ESLint and Prettier configuration exists.
- Root README exists.
- Legacy UI remains untouched in `UIreference`.
- No business logic from the legacy frontend has been copied into the new runtime.
- No Module 03 controller contains rendering code.
- No Module 04 code performs EEG reasoning.
- No frontend code generates runtime source trajectories.

---

# 30. What NOT To Implement Yet

Do not implement the following during the bootstrap task:

- Full JourneyController algorithms
- Catmull-Rom journey interpolation
- Ambient gain models
- Event trajectory interpolation
- Transition scheduling engine
- HRTF convolution
- WebSocket server
- Full WebSocket client reconnection logic
- Complete React UI migration
- Session summary generation
- Module 01 integration
- Module 02 integration

Those belong to later implementation phases.

---

# 31. Next Phase

After bootstrap is complete, proceed to:

```text
Module 03 — Phase 1
```

in this order:

```text
1. Finalize public TypeScript contracts
2. Scene Graph schema
3. Scene Graph loader
4. Plan Validator
5. Semantic Location Mapper
6. Minimal RuntimeController
7. RuntimeWorldStateBuilder
8. Unit tests
```

Do not start Module 04 implementation beyond the scaffold until Module 03 Phase 1 produces valid test RuntimeWorldState snapshots.

---

# 32. Codex Workflow Requirement

Before making changes:

1. Read all architecture Markdown files.
2. Inspect the existing repository.
3. Do not overwrite `SystemDesign`.
4. Do not overwrite `UIreference`.
5. Create the scaffold described in this document.

After changes:

1. List every created file.
2. Explain any deviations from this specification.
3. Report which checks were actually executed.
4. Report which checks could not be executed because of environment limitations.
5. Stop before implementing Module 03 Phase 2.

---

# 33. Architecture Safety Rule

If a future ambiguity appears:

> Do not invent a new architecture.

Prefer the existing Markdown specification.

If the specification is genuinely incomplete:

```text
leave a TODO
document the ambiguity
choose the smallest non-destructive placeholder
continue implementing the established architecture
```

Do not perform speculative large-scale redesigns.

---

# Final Instruction to Codex

Initialize NeuroScape from scratch according to this specification.

The current repository intentionally contains architecture documents and legacy UI references but no application scaffold.

Create the complete workspace and compile-ready project structure first.

Preserve the existing architecture boundaries.

Preserve the legacy UI files as reference material.

Do not implement full Module 03 or Module 04 business logic during this bootstrap step.

When the scaffold is complete, report the created structure and stop before Module 03 Phase 2.
