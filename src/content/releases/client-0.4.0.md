---
package: client
version: "0.4.0"
date: 2026-07-27
summary: Fixes tool parameter typing so all-optional tools typecheck, widens thread ID types, and changes WebSocket auth precedence so auth now wins over authToken when both are set.
breaking: true
---

### Breaking

- **WebSocket auth: `auth` now takes precedence over `authToken`.** `resolveBearerToken()` previously checked `authToken` first and only fell back to `auth`. It now resolves `auth` first, matching `buildHeaders()` on the HTTP path, and returns `null` when `auth` is a non-bearer scheme instead of falling back to `authToken`. This affects `wsStream()` and `realtime()`, and only if you set both `auth` and `authToken`.
  - `auth: { type: 'bearer', token: 'b' }` with `authToken: 'tok'` now resolves to `'b'` (it was `'tok'`).
  - `auth` of type `basic` or `header` with `authToken` now resolves to `null` (it was `'tok'`). In a browser, basic auth then sends no credential on the socket. Header auth sends none in any runtime, because `openWebSocket()` never forwards a custom header name.
  - **Migration:** pass the socket credential as bearer with `auth: { type: 'bearer', token }`, or drop `auth` and keep `authToken`.

### Added

- `normalizeToolParameters(parameters?)`, exported from `tools.ts`, applies the JSON Schema defaults (`type: 'object'`, `properties: {}`, `required: []`) to a partial tool schema.
- A version-compatibility table in the README mapping client versions to `10xscale-agentflow-cli` and `10xgraph` versions.

### Changed

- The three thread-state endpoints, `threadState()`, `updateThreadState()` and `clearThreadState()`, now accept `string | number` for `threadId`, matching the other thread methods. Existing calls passing a `number` keep compiling.
- Tool registrations with no `parameters` now serialize to `{ type: 'object', properties: {}, required: [] }` instead of a bare `{}`.

### Fixed

- **`ToolParameter.required` was mandatory, so all-optional tools did not typecheck** (issue #12). `required` and `properties` are now optional, and `ToolParameter` accepts arbitrary JSON Schema keywords such as `additionalProperties` and `$defs`. The wire format is unchanged: `client.setup()` and `ToolExecutor.all_tools()` fill in the omitted keywords.
- **`agent.ts` broke type resolution under `moduleResolution: nodenext`.** Its `./message` import was the only extensionless relative import in `src/`, so `node16` and `nodenext` consumers got `TS2834`. It now imports `./message.js`.
