---
package: core
version: "0.9.1"
date: 2026-07-27
summary: Small fix release. The synchronous tool listing on ToolNode now includes remote tools, and AudioAgent is exported from agentflow.prebuilt.
breaking: false
---

### Added

- `AudioAgent` is now exported from `agentflow.prebuilt`.

### Fixed

- **`ToolNode.all_tools_sync()` silently dropped remote tools.** The async path (`all_tools()`) included them, so client-side tools were visible to the model in one path and invisible in the other. The sync path now returns the same set: local, MCP and remote tools.
- `UserSimulator` now sets the per-simulation `thread_id` at the top level of the run config (it previously nested it under `configurable`), so each simulation gets its own thread.
- The `CompiledGraph.attach_remote_tools()` docstring now documents the expected schema: OpenAI function-calling format, with the tool name read from `function.name`.
