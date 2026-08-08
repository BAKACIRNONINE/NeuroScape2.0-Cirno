# NeuroScape end-to-end development guide

## Repository architecture

- `packages/contracts`: contracts and versioned protocol/recording envelopes shared by all modules.
- `module-03-runtime-scene-controller`: rendering-independent semantic-to-numerical runtime. This is the only owner of trajectories, world positions, orientations, gains, and lifecycle evolution.
- `frontend`: Module 04 React, Runtime Store, WebSocket transport, Three.js, Web Audio/HRTF, recording, replay, summary, and developer integration harness.
- `SystemDesign`: immutable architectural specifications.
- `UIreference`: immutable legacy visual references.

Module 04 independently subscribes to `NeuroState`, `SceneJourneyPlan`, and `RuntimeWorldState`. Neuro and planner streams are presentation-only. Three.js and audio consume the same accepted runtime snapshot.

## Install and run

Requirements: a current Node.js LTS release and npm.

```bash
npm install
npm run dev
```

Production validation:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Deterministic integration demo

1. Open the frontend.
2. Select **Demo / Integration · deterministic forest**.
3. Select **Audio: disabled** to satisfy browser autoplay requirements.
4. Use Pause/Resume or End. The demo ends automatically at 27 session seconds (approximately 11 real seconds at the development time scale).
5. Inspect **Runtime diagnostics**.
6. The completed recording opens Session Reflection and can be exported or replayed.

The demo uses the real Module 03 `RuntimeController`. Its only simulated inputs are explicitly labeled canonical Module 01/02 fixtures. Runtime snapshots cross the same protocol parser and dispatcher used by live WebSocket traffic.

Scenario:

```text
forest_entry → clearing (pause) → stream_bank → waterfall
```

Plan updates occur at session times 9,000 ms and 19,000 ms. Global forest ambience remains non-spatial, stream/waterfall ambience remains world-anchored, action sources use Module 03 listener-attached positions, and events follow Module 03 trajectories.

## Production audio assets

Set an HTTPS base URL before starting or building:

```bash
VITE_AUDIO_ASSET_BASE_URL=https://cdn.example.com/neuroscape npm run dev
```

Windows PowerShell:

```powershell
$env:VITE_AUDIO_ASSET_BASE_URL='https://cdn.example.com/neuroscape'
npm run dev
```

Expected layout:

```text
<base>/ambient/forest-light.ogg
<base>/ambient/stream-near.ogg
<base>/ambient/waterfall.ogg
<base>/action/guided-breath.ogg
<base>/action/footsteps.ogg
<base>/event/bird-pass.ogg
<base>/event/leaves.ogg
```

Edit the central catalog in `frontend/src/audio/audioAssetManifest.ts` when adding approved assets. Runtime contracts continue to contain only `assetId`. Without the environment variable, small generated tones are used for development. A failed asset is isolated to its source and does not stop the runtime.

## Live WebSocket backend

Set `VITE_RUNTIME_WS_URL` to the secure runtime endpoint. The server must use protocol version `1.0`, echo the active `sessionId`, and send typed envelopes with session-relative millisecond timestamps.

```json
{
  "type": "RuntimeWorldState",
  "protocolVersion": "1.0",
  "sessionId": "browser-issued-session-id",
  "timestampMs": 1000,
  "payload": {}
}
```

Supported server streams are `NeuroState`, `SceneJourneyPlan`, `RuntimeWorldState`, `SessionStatus`, `PlannerStatus`, `Ping`, `Pong`, and `Error`. Invalid, wrong-session, malformed, or stale data is rejected before it reaches rendering.

## Future Module 01 connection

Module 01 should publish canonical `NeuroState` values normalized to `[0,1]`, with Attention, Arousal, Stability, Confidence, and supplied trends. It must use milliseconds since session start. Do not send raw EEG to this frontend contract and do not ask React to calculate neuro metrics.

## Future Module 02 connection

Module 02 should publish a validated `SceneJourneyPlan` containing semantic waypoints, soundscape intentions, transition policy, planning horizon, and optional reasoning summary. It must not publish numerical runtime trajectories. Module 03 accepts and merges plan updates without resetting the current listener.

## Diagnostics and performance

The read-only diagnostics panel reports:

- Module 03 update frequency and measured update duration.
- `RuntimeWorldStateBuilder` duration.
- Runtime Store dispatch duration.
- Three.js snapshot-render frequency and frame duration.
- listener position and active object counts.
- AudioContext status, managed sources, and HRTF diagnostics.
- rejected-message count, recording status, and browser heap estimate when supported.

Measurements use a bounded 240-sample window. Three.js “FPS” is the accepted-snapshot render rate because the current renderer draws on authoritative state replacement, not an independent simulation loop. Chrome exposes an approximate heap value; browsers without `performance.memory` show unavailable.

For memory validation, run multiple demo/replay cycles in browser DevTools and compare heap after garbage collection. Managed audio nodes, Three.js objects, timers, subscriptions, and recordings all have explicit cleanup paths.

## Failure and recovery expectations

- Invalid or unknown-location plans are rejected by Module 03 before application.
- Malformed/stale/wrong-session runtime messages preserve the last valid world.
- Missing audio assets skip only the failed source.
- WebSocket loss preserves rendering/audio and reconnects with exponential backoff.
- Suspended AudioContext resumes only after an explicit user gesture.
- Invalid replay imports are rejected atomically without resetting current runtime state.

## Acceptance test

`frontend/tests/EndToEndRuntime.test.ts` is the primary in-process acceptance test. It does not mock Module 03. It drives canonical upstream fixtures through Module 03, protocol parsing, Module 04 store, Three.js, AudioEngine, SessionRecorder, Summary selectors, and the existing replay controller.
