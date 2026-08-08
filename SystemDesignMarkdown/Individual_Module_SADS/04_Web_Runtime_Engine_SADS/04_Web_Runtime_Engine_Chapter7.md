
# NeuroScape Web Runtime Engine (V3)
**Software Architecture Design Specification (SADS)**  
**Chapter 7 — WebSocket Communication**

---

# 7.1 Purpose

This chapter specifies the communication architecture between the browser-side
Web Runtime Engine and external services.

The WebSocket layer is responsible for transporting runtime data while keeping
network communication independent from rendering, audio playback, and user
interface logic.

Its primary objective is to deliver RuntimeWorldState updates with low latency,
high reliability, and deterministic ordering.

---

# 7.2 Architectural Position

```text
Scene Journey Planner
        │
        ▼
Runtime Scene Controller
        │
RuntimeWorldState
        │
──────────── Network Boundary ────────────
        │
        ▼
 WebSocket Server
        │
        ▼
 WebSocket Client
        │
        ▼
 Runtime Store
        │
 ├── Three.js
 ├── Audio Engine
 ├── React UI
 └── Debug Tools
```

The WebSocket client never communicates directly with rendering modules.

---

# 7.3 Design Principles

## Transport Independence

The Runtime Engine depends on messages rather than server implementation.

## Ordered Delivery

RuntimeWorldState snapshots should be processed in timestamp order.

## Non-blocking Communication

Network latency must never pause rendering or audio playback.

## Graceful Degradation

Temporary connection failures should not terminate the meditation session.

---

# 7.4 Message Types

Recommended message categories:

| Type | Direction | Purpose |
|------|-----------|---------|
| RuntimeWorldState | Server → Browser | Runtime updates |
| SessionStatus | Server → Browser | Session lifecycle |
| PlannerStatus | Server → Browser | Planner diagnostics |
| ClientCommand | Browser → Server | User actions |
| Ping / Pong | Bidirectional | Connection health |
| Error | Bidirectional | Error reporting |

---

# 7.5 RuntimeWorldState Message

```json
{
  "type":"RuntimeWorldState",
  "protocolVersion":"1.0",
  "sessionId":"session-001",
  "timestamp":1723051200000,
  "payload":{}
}
```

The payload should conform to the RuntimeWorldState schema defined in Module 03.

---

# 7.6 Client Lifecycle

```text
Browser Start
      │
Create WebSocket
      │
Connect
      │
Handshake
      │
Running
      │
Reconnect (if needed)
      │
Shutdown
```

The connection lifecycle is independent from the rendering lifecycle.

---

# 7.7 Receiving Messages

Processing pipeline:

```text
Receive Message
      │
Decode JSON
      │
Validate Schema
      │
Verify Timestamp
      │
Publish RuntimeWorldState
      │
Runtime Store
```

Malformed messages should be discarded safely.

---

# 7.8 Sending Messages

Typical browser commands include:

- Start session
- Pause session
- Resume session
- End session
- Update user settings
- Request diagnostics

Commands should be lightweight and stateless whenever possible.

---

# 7.9 Connection Health

The client should monitor connection status using heartbeat messages.

```text
Ping
  │
Pong
  │
Connection Healthy
```

If heartbeat timeout occurs:

1. Mark connection as degraded.
2. Continue local rendering.
3. Attempt reconnection.

---

# 7.10 Reconnection Strategy

Recommended strategy:

```text
Disconnect
    │
Wait
    │
Reconnect
    │
Restore Session
```

Use exponential backoff to avoid excessive retry attempts.

The Runtime Store should preserve the latest valid RuntimeWorldState until a new
snapshot is received.

---

# 7.11 Synchronization

Every RuntimeWorldState should contain:

- timestamp
- session identifier
- protocol version

The browser should ignore snapshots older than the current state.

---

# 7.12 Error Handling

If communication fails:

- preserve current RuntimeWorldState
- display connection status in UI
- continue audio and visualization
- log network diagnostics
- resume updates after reconnection

Rendering must never depend on continuous network availability.

---

# 7.13 Security Considerations

Recommendations:

- Use WSS (WebSocket over TLS)
- Validate protocol version
- Validate session identifiers
- Reject malformed payloads
- Sanitize client commands

Authentication should occur before runtime data exchange.

---

# 7.14 Performance Guidelines

The communication layer SHOULD:

- minimize message size
- avoid redundant updates
- compress large payloads when appropriate
- batch non-critical diagnostic messages

Critical runtime updates should always take priority.

---

# 7.15 Sequence Diagram

```text
Runtime Controller
        │
RuntimeWorldState
        │
        ▼
 WebSocket Server
        │
        ▼
 WebSocket Client
        │
        ▼
 Runtime Store
        │
 ├── Three.js
 ├── Audio Engine
 ├── UI
 └── Debug
```

---

# 7.16 Chapter Summary

The WebSocket Communication layer provides a reliable, low-latency transport
between the Runtime Scene Controller and the browser.

By isolating networking from rendering and maintaining an ordered stream of
RuntimeWorldState snapshots, the Web Runtime Engine remains responsive,
fault-tolerant, and synchronized even under variable network conditions.

**Next Chapter:** Performance Optimization
