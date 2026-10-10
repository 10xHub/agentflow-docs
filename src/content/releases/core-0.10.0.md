---
package: core
version: "0.10.0"
date: 2026-10-10
summary: First release as 10xgraph (import tenxgraph). Adds interrupt() for human approval, per-run client tools and Agent Skills spec support, and fixes remote tool pauses and checkpoint loading.
breaking: true
---

Agentflow is now 10xGraph. This is the first release of the `10xgraph` package. It contains everything since 0.9.2, including the changes that shipped in `10xscale-agentflow` 0.10.0 and 0.10.1, the final releases under the old name.

### Breaking

- **The package is renamed.** Install `10xgraph` and import `tenxgraph`. Every canonical path is the old one with `agentflow` replaced by `tenxgraph`, for example `tenxgraph.core.graph` and `tenxgraph.storage.checkpointer`. The top level also exports `StateGraph`, `Agent`, `ToolNode`, `AgentState`, `Message`, `START` and `END`. Uninstall `10xscale-agentflow` first: both packages ship an `agentflow` module.
- **Observable identifiers changed.** The OpenTelemetry tracer and meter name and `GEN_AI_SYSTEM` are now `10xgraph`, logger names are `tenxgraph.*`, and the prebuilt tools user-agent is `10xgraph-prebuilt-tools/1.0`. Update dashboards, alerts and log filters that match the old values.
- **Skills API reworked around the Agent Skills specification.** **Migration:**
  - The `set_skill` tool is replaced by `activate_skill(skill_name)` and `read_skill_resource(skill_name, path)`. Prompts that mention `set_skill` or parse its `## SKILL:` header must use the new names and the `<skill_content name="...">` wrapper.
  - `SkillConfig.inject_trigger_table` is renamed `inject_catalog`, and `SkillsRegistry.build_trigger_table()` is replaced by `build_catalog()`.
  - `build_set_skill_tool()` and `load_resources()` are removed. Use `activation.make_activate_skill_tool()` and `SkillsRegistry.read_file()`.
  - The `resources:` frontmatter list is removed; every file in the skill directory is readable.
  - `triggers`, `tags` and `priority` are read only from `metadata`, as strings.
  - Skill names are no longer lowercased. Discovering the same name in two directories no longer raises: the first wins and the second is reported as shadowed.
- **One checkpointer instance serves one state class.** `compile()` binds the graph's state class to the checkpointer, and binding a different class raises `ValueError`. **Migration:** give each graph with its own state class its own checkpointer, and call `checkpointer.bind_state_type(MyState)` when reading threads outside a compiled graph.

### Added

- **`interrupt()` pauses a graph from inside a node or tool.** `from tenxgraph.utils import interrupt`. The run saves the thread paused before that node; resume with `ainvoke({"resume": value}, config)` and `interrupt()` returns `value`. It supports `message`, `reason` and `response_schema`, several calls per node, and parallel tool calls, where finished siblings are served from the tool ledger instead of running again. `GraphInterrupt` derives from `BaseException`, so tool and node error handling cannot swallow it. `tenxgraph.utils.pending_interrupt(state)` returns the open request.
- **Per-run client tools.** `config["remote_tools"]` lets one run bring its own client-executed tool schemas without changing the graph. The tool node offers them for that run and hands calls to them back to the client.
- **Agent Skills specification support (agentskills.io).** Skills written for Claude Code, Codex or GitHub Copilot load unchanged. The system prompt gets an `<available_skills>` catalog, `read_skill_resource` reads any bundled file as text, and `validate_skill()` checks a skill against the spec. Loading is lenient: a spec violation is recorded as a diagnostic instead of dropping the skill.
- **Activated skills survive context trimming.** If a context manager drops the tool result that carried a skill's instructions, the agent re-injects them.
- **Skill tool calls fire `InvocationType.SKILL` callbacks** instead of `TOOL`.
- `tenxgraph.utils.injection.fresh()` resolves `Inject[...]` defaults per call.

### Changed

- **`import agentflow` keeps working as a deprecated alias until 2.0.** It resolves to the same module objects as `tenxgraph` and emits one `DeprecationWarning`.
- **Media URI scheme** is `graph://media/`. Old `agentflow://media/` URIs are still read.
- **Default home directory** is `~/.10xgraph`, falling back to `~/.agentflow` when only that exists. This sets the default `SqliteCheckpointer` path.
- **Cloud media prefix** is `10xgraph-media`. Objects under `agentflow-media` are still read.
- The server config file is `10xgraph.json`; the CLI falls back to `agentflow.json`.

### Fixed

- **Client-side (remote) tool calls now pause the graph.** The check compared a class against block instances, so it was never true and the graph kept running. The graph now pauses after the tool node and resumes when the client sends the results on the same thread.
- **Messages a node appends to `state.context` are streamed** and returned, instead of only being saved.
- **`Inject[...]` defaults no longer pin the first resolved dependency for the whole process.** The first graph that ran used to decide which checkpointer every later graph used.
- **Parallel tool calls no longer lose `execution_meta.internal_data` writes.**
- **Reading a non-UTF-8 skill resource no longer crashes the tool.**
- **Checkpointers no longer import a class named by stored data.** Rows now store the state as JSON plus a format header and are rebuilt into the state class bound at `compile()`. Old rows still load, and the stored class path is never imported.

### Migration

```bash
pip uninstall 10xscale-agentflow
pip install 10xgraph
```

```python
# before
from agentflow.core.graph import StateGraph
# after
from tenxgraph import StateGraph
```

See [Coming from Agentflow](/docs/get-started/coming-from-agentflow) for every renamed identifier.
