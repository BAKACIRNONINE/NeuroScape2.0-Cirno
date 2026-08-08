
# NeuroScape Web Runtime Engine (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 10 — Deployment & Browser Integration**

---

# 10.1 Purpose

This chapter defines how the Web Runtime Engine is packaged, deployed,
configured, and integrated into a production browser environment.

The deployment architecture should preserve the modular separation established
throughout this specification while ensuring reliable real-time operation.

---

# 10.2 Deployment Architecture

```text
                 EEG Device
                     │
                     ▼
          Neuro State Interpreter
                     │
                     ▼
        Scene Journey Planner (LLM)
                     │
                     ▼
      Runtime Scene Controller Server
                     │
             RuntimeWorldState
                     │
──────────────── HTTPS / WSS ────────────────
                     │
                     ▼
              Browser Client
                     │
        Web Runtime Engine
                     │
      ├── Runtime Store
      ├── Three.js
      ├── Audio Engine
      ├── HRTF Renderer
      ├── React UI
      └── Debug Tools
                     │
                     ▼
      Display + Headphones
```

---

# 10.3 Deployment Components

The production system consists of:

- Browser client
- Runtime Scene Controller service
- LLM planning service
- Audio asset server
- Static web server
- WebSocket gateway

Each component should be independently deployable.

---

# 10.4 Browser Requirements

Recommended browser capabilities:

- Web Audio API
- WebGL 2.0 (or WebGPU when available)
- WebSocket
- ES2022+
- HTTPS support

Recommended browsers:

- Chrome
- Edge
- Safari (latest)
- Firefox (where supported)

---

# 10.5 Audio Permissions

Modern browsers restrict audio playback until user interaction.

Initialization sequence:

```text
Load Page
    │
User Click
    │
Resume AudioContext
    │
Load Assets
    │
Start Session
```

The Runtime must gracefully handle suspended AudioContexts.

---

# 10.6 HTTPS & WSS

Production deployments should use:

- HTTPS for static assets
- WSS (secure WebSocket) for runtime communication

Avoid unsecured WebSocket connections outside development.

---

# 10.7 Project Structure

```text
frontend/
├── src/
│   ├── runtime/
│   ├── renderer/
│   ├── audio/
│   ├── network/
│   ├── ui/
│   ├── debug/
│   └── assets/
├── public/
├── package.json
└── vite.config.ts
```

---

# 10.8 Asset Management

Organize assets by category:

```text
assets/
├── ambient/
├── action/
├── event/
├── hrtf/
└── textures/
```

Recommendations:

- preload persistent ambient sounds
- lazy-load infrequent event sounds
- version HRTF datasets independently

---

# 10.9 Configuration

Suggested configuration file:

```yaml
runtime:
  targetFPS: 60

network:
  websocket: wss://server.example/ws

audio:
  masterGain: 1.0
  preloadAmbient: true

debug:
  enabled: false
```

Environment-specific configuration should not require code changes.

---

# 10.10 Build Pipeline

Recommended build process:

```text
TypeScript
      │
      ▼
Vite Build
      │
      ▼
Static Assets
      │
      ▼
Deploy to HTTPS Server
```

Builds should be reproducible and versioned.

---

# 10.11 Deployment Checklist

Before release verify:

- [ ] RuntimeWorldState updates correctly
- [ ] WebSocket reconnects automatically
- [ ] Three.js renders at target frame rate
- [ ] AudioContext initializes successfully
- [ ] HRTF spatialization functions correctly
- [ ] Assets load without errors
- [ ] Browser console is clean
- [ ] Debug mode is disabled for production

---

# 10.12 Monitoring

Recommended production metrics:

- active sessions
- average FPS
- WebSocket latency
- audio initialization failures
- asset loading errors
- browser exceptions
- reconnect count

Metrics should support long-term system evaluation.

---

# 10.13 Future Deployment

The architecture supports future deployment targets including:

- Progressive Web Apps (PWA)
- WebXR
- Cloud-hosted planner services
- Edge inference
- Multi-user shared environments

These extensions should not require changes to RuntimeWorldState.

---

# 10.14 Chapter Summary

The Web Runtime Engine is designed for modular deployment in modern web
browsers.

By separating browser execution, networking, rendering, audio processing, and
configuration, the deployment architecture remains portable, maintainable, and
ready for future extensions while preserving compatibility with the Runtime
Scene Controller.

---

# End of Document

This concludes the **Web Runtime Engine (V3)** specification.

Together with **Runtime Scene Controller (V3)**, these documents define the
complete execution pipeline from semantic scene planning to synchronized
browser-based visualization and real-time HRTF spatial audio rendering.
