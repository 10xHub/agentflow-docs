---
package: client
version: "0.5.0"
date: 2026-10-08
summary: Final release as @10xscale/agentflow-client. Removes client.setup(), since remote tool schemas are now declared on the server, and adds registerToolHandler() for their client-side code.
breaking: true
---

This is the final release of the TypeScript client under the name `@10xscale/agentflow-client`. It continues as `10xgraph-client` from 0.6.0.

### Breaking

- **`client.setup()` is removed**, together with its endpoint module and the `SetupGraphContext`, `SetupGraphRequest`, `SetupGraphResponse` and `RemoteTool` types. The server removed `POST /v1/graph/setup` in API 0.6.0, so the call could no longer succeed.

  **Migration:** declare each client-executed tool (node, name, description, parameters) under `remote_tools` in the server config file, register only its handler on the client with `client.registerToolHandler(name, handler)`, and delete any `await client.setup()` call. See [Remote tools](/docs/server/remote-tools).

### Added

- `client.registerToolHandler(name, handler)` registers the client-side code for a remote tool whose schema is declared on the server.

### Changed

- `ToolRegistration.node` is optional. `registerTool()` still works, but its `description` and `parameters` are no longer sent.
- `RealtimeInit.model` is optional. The server uses it only when the model is listed in `websocket.realtime_models`, and otherwise uses the agent's own model.
- `MultimodalConfigResponse.data` no longer declares `media_storage_path`; the server does not return it.

### Compatibility

Requires API 0.6.0 or newer, the first server release with `remote_tools` in the config file. It works with `10xgraph-api` 0.7.0, which still accepts the `agentflow-bearer` WebSocket subprotocol this client sends.
