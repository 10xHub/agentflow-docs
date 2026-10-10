---
package: client
version: "0.6.0"
date: 2026-10-10
summary: First release as 10xgraph-client. Classes are renamed TenxGraph*, the old AgentFlow* names stay as deprecated aliases, and WebSocket bearer auth needs 10xgraph-api 0.7.0 or newer.
breaking: true
---

Agentflow is now 10xGraph. This package replaces `@10xscale/agentflow-client`, whose last version is 0.5.0. The client's behavior is unchanged apart from the names below.

```bash
npm uninstall @10xscale/agentflow-client
npm install 10xgraph-client
```

### Breaking

- **WebSocket bearer auth uses the `10xgraph-bearer` subprotocol** (`WS_BEARER_SUBPROTOCOL`), replacing `agentflow-bearer`. `10xgraph-api` 0.7.0 accepts both. An older `10xscale-agentflow-cli` server knows only the old name, so `wsStream()` and `realtime()` with bearer auth fail against it. **Migration:** upgrade the server to `10xgraph-api` 0.7.0 or newer. HTTP endpoints are unaffected.
- **`TenxGraphError.name` is `'TenxGraphError'`** (was `'AgentFlowError'`). Code that compares `error.name` should use `instanceof` instead.

### Changed

- The package is `10xgraph-client`: `import { TenxGraphClient } from '10xgraph-client'`.
- Exported names are renamed: `TenxGraphClient`, `TenxGraphConfig`, `TenxGraphError`, `TenxGraphAuth`, `TenxGraphBearerAuth`, `TenxGraphBasicAuth` and `TenxGraphHeaderAuth`.
- The debug log prefix is `TenxGraphClient:`.

### Deprecated

- `AgentFlowClient`, `AgentFlowConfig`, `AgentFlowError`, `AgentFlowAuth`, `AgentFlowBearerAuth`, `AgentFlowBasicAuth` and `AgentFlowHeaderAuth` are exported as aliases of the same classes and types, so existing code and `instanceof` checks keep working. They are removed in 2.0.

See [Coming from Agentflow](/docs/get-started/coming-from-agentflow) for the full migration.
