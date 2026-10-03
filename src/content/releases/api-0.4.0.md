---
package: api
version: "0.4.0"
date: 2026-06-16
summary: Adds realtime audio sessions over WebSocket with connection limits and rate limiting, a global confeval.py for agentflow eval, and requires core 0.8.0 or newer.
breaking: false
---

### Added

- **Realtime audio sessions over WebSocket** at `/v1/graph/live`, alongside the existing streaming socket at `/v1/graph/ws`. `GraphService` configures the realtime session.
- **WebSocket connection limits.** A new `websocket` block in `agentflow.json` accepts `max_connections`, a per-process cap on concurrent WebSocket connections (`null` or `0` means unlimited).
- **WebSocket handshakes share the REST rate-limit bucket.** Client key derivation is now shared between the HTTP rate-limit middleware and the WebSocket connection guard.
- **Global `confeval.py` discovery for `agentflow eval`.** The nearest global `confeval.py` is found and used for criteria, and reports show where each case's configuration came from.
- Agent-skill reference docs for realtime audio agents.

### Changed

- The minimum core dependency is now `10xscale-agentflow>=0.8.0`.
- Logging configuration and log sanitization were updated.

### Fixed

- WebSocket error handling was improved, and `GraphService` now uses a consistent thread ID type for WebSocket sessions.
