---
title: Skills — Python API reference
sidebar_label: Skills
description: SkillConfig, SkillMeta and SkillsRegistry — load Agent Skills (agentskills.io) into an Agent and let the model activate them on demand.
keywords:
  - agentflow python reference
  - agent api reference
  - python agent library
  - agentflow
  - python ai agent framework
  - skills
  - agent skills
  - SKILL.md
sidebar_position: 4
---


# Skills

## When to use this

Use skills to give an agent specialised instructions that it loads only when a task needs them. For a step-by-step walkthrough, see [How to give an agent skills](/docs/how-to/python/use-skills). Agentflow implements the [Agent Skills specification](https://agentskills.io/specification), so a skill written for Claude Code, Codex, GitHub Copilot or any other compatible client works in Agentflow unchanged, and the other way round.

## Import path

```python
from agentflow.core.skills import (
    SkillConfig,
    SkillDiagnostic,
    SkillMeta,
    SkillResourceError,
    SkillsRegistry,
    validate_skill,
)
```

---

## How skills work

A skill is a directory with a `SKILL.md` file and, optionally, bundled files:

```
.agents/skills/
└── pdf-processing/
    ├── SKILL.md          # required: frontmatter + instructions
    ├── scripts/          # optional: executable code
    │   └── extract.py
    ├── references/       # optional: documentation loaded on demand
    │   └── REFERENCE.md
    └── assets/           # optional: templates, data files
```

Skills load in three steps, so an agent with many skills only pays for the ones it uses:

1. **Catalog.** At startup the agent adds each skill's `name` and `description` to the system prompt as an `<available_skills>` block.
2. **Instructions.** When a task matches a description, the model calls `activate_skill(skill_name)`. The tool returns the `SKILL.md` body wrapped in `<skill_content name="...">` tags, together with a `<skill_resources>` list of the bundled files.
3. **Resources.** When the instructions point to a bundled file, the model calls `read_skill_resource(skill_name, path)` to read it.

`activate_skill` and `read_skill_resource` are added to the agent's `ToolNode` automatically. `read_skill_resource` is only registered when at least one skill bundles files, and no tool or catalog is added when no skill is found.

---

## `SkillConfig`

Configuration passed to the `Agent` constructor via the `skills=` parameter.

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.core.skills import SkillConfig

agent = Agent(
    model="gpt-4o",
    tool_node=ToolNode([]),
    skills=SkillConfig(
        skills_dir=["./.agents/skills", "./shared-skills"],
        hot_reload=True,
    ),
)
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `skills_dir` | `str \| list[str] \| None` | `None` | A directory, or an ordered list of directories, to discover skills from. Each entry is either a folder of skill directories or a single skill directory. When two skills share a name, the one from the earlier directory wins and the other is reported as shadowed. `.agents/skills/` is the cross-client convention for project skills. |
| `inject_catalog` | `bool` | `True` | Add the `<available_skills>` catalog to the system prompt. When `False`, the catalog goes into the `activate_skill` tool description instead. |
| `hot_reload` | `bool` | `True` | Re-read a `SKILL.md` when its modification time changes. With `False`, each body is read once and cached. |
| `max_resource_bytes` | `int` | `262144` | Largest number of bytes `read_skill_resource` returns for one file. Longer files are truncated with a note. |
| `include_skill_path` | `bool` | `False` | Show the absolute skill directory to the model on activation. Turn this on when the agent has its own shell or file tools and should run bundled scripts directly. Off by default so server paths stay private. |
| `mode` | `"on-demand" \| "session"` | `"on-demand"` | Activation strategy. See below. |
| `preload_from` | `str \| None` | `None` | Name of the `AgentState` field holding the skill to preload. Required when `mode="session"`. |

The `skill_dirs` property returns `skills_dir` as a list.

### Activation modes

`mode="on-demand"` is the default. The catalog is added to the system prompt, and the model calls `activate_skill()` when it decides a skill applies.

`mode="session"` pins one skill per call. The framework reads `state.<preload_from>` at the start of every call and injects that skill as a system message. No catalog and no `activate_skill` tool are added, which suits multi-tenant agents where each session has a fixed persona or domain. `read_skill_resource` is still registered when the skill bundles files and the agent has a `ToolNode`.

```python
from agentflow.core.state import AgentState
from agentflow.core.skills import SkillConfig

class FashionState(AgentState):
    SKILL_NAME: str = ""

agent = Agent(
    model="gpt-4o",
    skills=SkillConfig(
        skills_dir="./skills/",
        mode="session",
        preload_from="SKILL_NAME",
    ),
)
```

### Keeping skills in context

Each activation is recorded in `state.execution_meta.internal_data["active_skills"]`. If context trimming or summarisation later removes the tool result that carried a skill's instructions, the agent re-injects them as a system message on the next call, so the model never silently loses a skill it activated. If the model activates a skill whose instructions are still in the conversation, `activate_skill` says so instead of repeating them.

---

## The tools

### `activate_skill(skill_name)`

`skill_name` is an enum of the discovered skill names, so the model cannot request a skill that does not exist. The result looks like this:

```xml
<skill_content name="pdf-processing">
# PDF Processing
...instructions from SKILL.md...

Compatibility: Requires python3 and pypdf
Relative paths in this skill are relative to the skill directory. Read a bundled file with read_skill_resource(skill_name="pdf-processing", path="<relative path>").

<skill_resources>
  <file>references/REFERENCE.md</file>
  <file>scripts/extract.py</file>
</skill_resources>
</skill_content>
```

### `read_skill_resource(skill_name, path)`

Reads any file inside the skill directory as text: markdown, Python and shell scripts, extension-less executables, JSON, CSV and so on. Nothing is executed.

- Text that is not valid UTF-8 is decoded with replacement characters.
- Binary files are described (name and size) instead of dumped.
- A directory path returns a listing of its files.
- Absolute paths, `..` segments and symlinks that leave the skill directory are rejected.
- Hidden files, `__pycache__` and `node_modules` are not listed.

### Callbacks

Calls to `activate_skill` and `read_skill_resource` fire `InvocationType.SKILL` callbacks (not `TOOL`), with `context.function_name` set to the tool name:

```python
from agentflow.utils import CallbackManager, InvocationType

callbacks = CallbackManager()
callbacks.register_before_invoke(
    InvocationType.SKILL,
    lambda context, data: print(context.function_name, data) or data,
)
app = graph.compile(callback_manager=callbacks)
```

Session-mode preloading is not a tool call, so it fires no callback. `agentflow.core.skills.activation.get_active_skills(state)` returns the skills activated in a thread.

---

## `SkillMeta`

Parsed metadata for a single skill.

| Field | Type | Source | Description |
|---|---|---|---|
| `name` | `str` | frontmatter `name` | Skill identifier. |
| `description` | `str` | frontmatter `description` | What the skill does and when to use it. Shown in the catalog. |
| `license` | `str \| None` | frontmatter `license` | License name or bundled license file. |
| `compatibility` | `str \| None` | frontmatter `compatibility` | Environment requirements. Shown to the model on activation. |
| `allowed_tools` | `list[str]` | frontmatter `allowed-tools` | Pre-approved tools (experimental in the spec). Stored but not enforced by Agentflow. |
| `metadata` | `dict[str, str]` | frontmatter `metadata` | Free-form key/value pairs. Non-string values are converted to strings. |
| `triggers` | `list[str]` | `metadata.triggers` | Agentflow extension: example requests, shown in the catalog as hints. |
| `tags` | `set[str]` | `metadata.tags` | Agentflow extension: tags for `SkillsRegistry.get_all(tags=...)`. |
| `priority` | `int` | `metadata.priority` | Agentflow extension: catalog order, highest first. |
| `skill_dir` | `str` | loader | Absolute path of the skill directory. |
| `skill_file` | `str` | loader | Absolute path of `SKILL.md`. |

---

## `SkillsRegistry`

The registry holds discovered skills. `Agent` creates one for you; use it directly to inspect skills or build your own tools.

```python
from agentflow.core.skills import SkillsRegistry

registry = SkillsRegistry()
registry.discover(["./.agents/skills", "./shared-skills"])

for diagnostic in registry.diagnostics:
    print(diagnostic)

catalog = registry.build_catalog()
script = registry.read_file("pdf-processing", "scripts/extract.py", max_bytes=100_000)
```

| Method | Returns | Description |
|---|---|---|
| `discover(skills_dirs)` | `list[SkillMeta]` | Discover skills from one directory or a list, in order, and register them. Later skills with an already-registered name are skipped as shadowed. |
| `diagnostics` | `list[SkillDiagnostic]` | Problems found during discovery (property). |
| `register(meta, *, replace=False)` | `None` | Register a skill by hand. A different skill with the same name raises `ValueError` unless `replace=True`. |
| `get(name)` | `SkillMeta \| None` | Look up one skill. |
| `get_all(tags=None)` | `list[SkillMeta]` | All skills, optionally filtered to those carrying any of `tags`. |
| `names()` | `list[str]` | Sorted skill names. |
| `unregister(name)` | `bool` | Remove a skill. Returns `True` when it was present. |
| `load_content(name, hot_reload=True)` | `str` | The `SKILL.md` body without frontmatter. `""` for unknown names. |
| `list_files(name, limit=200)` | `tuple[list[str], bool]` | Bundled files as relative paths, and whether the list was truncated. |
| `read_file(name, path, max_bytes)` | `str` | A bundled file as text. Raises `KeyError` for an unknown skill and `SkillResourceError` for a bad path. |
| `build_catalog(tags=None)` | `str` | The `<available_skills>` block, ordered by priority then name. `""` when empty. |

`SkillsRegistry` also supports `len(registry)` and `name in registry`.

---

## Writing a SKILL.md file

```markdown
---
name: sql-query-helper
description: >-
  Write and debug SQL queries. Use when the user asks for a query, a JOIN,
  or help with a database error.
license: MIT
metadata:
  triggers: "write a sql query; fix this join; why is my query slow"
  tags: "database, sql"
  priority: "10"
---

# SQL Query Helper

- Use fully qualified column references (table.column).
- Prefer CTEs for readability.
- Explain each JOIN type chosen.

The table definitions are in [references/schema.sql](references/schema.sql).
```

### Frontmatter rules

| Field | Required | Rules |
|---|---|---|
| `name` | Yes | 1-64 characters, lowercase letters, digits and hyphens; no leading, trailing or double hyphen; must match the directory name. |
| `description` | Yes | 1-1024 characters. Say what the skill does **and when to use it**; the model decides from this text alone. |
| `license` | No | License name or bundled license file. |
| `compatibility` | No | Up to 500 characters of environment requirements. |
| `metadata` | No | Map of string keys to **string** values. Quote numbers: `priority: "10"`. |
| `allowed-tools` | No | Space-separated tool list (experimental). |

Other top-level fields are not allowed by the specification. Agentflow's `triggers`, `tags` and `priority` go inside `metadata`. `triggers` is separated by `;` or newlines, and `tags` by commas or spaces.

Refer to bundled files with paths relative to the skill directory, and keep `SKILL.md` under 500 lines by moving detail into `references/`.

### Lenient loading

Agentflow loads skills written for other clients even when they bend the rules, and records a diagnostic instead of failing:

- A name that breaks the naming rules or does not match its directory still loads.
- A description over 1024 characters still loads.
- A value containing `: ` that makes the YAML invalid (for example `description: Use when: ...`) is quoted and loaded.
- A skill is skipped only when its frontmatter cannot be parsed, it has no description, or its name contains whitespace or path separators.

Diagnostics are logged as warnings on the `agentflow.skills.registry` logger and are available from `registry.diagnostics`.

---

## Validating skills

Check skills against the specification before shipping them:

```bash
agentflow skills --validate ./.agents/skills
```

```python
from agentflow.core.skills import validate_skill

for issue in validate_skill("./.agents/skills/sql-query-helper"):
    print(issue)   # e.g. "error: .../SKILL.md: Skill name 'SQL' must be lowercase"
```

`error` diagnostics are specification violations. `warning` diagnostics are recommendations that are not followed, such as a body over 500 lines or a `references/...` path that does not exist.

---

## Example: coding assistant with multiple skills

```python
from agentflow.core.graph import Agent, StateGraph, ToolNode
from agentflow.core.skills import SkillConfig
from agentflow.core.state import AgentState
from agentflow.utils.constants import END

tool_node = ToolNode([])

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a software engineering assistant."}],
    tool_node="TOOL",
    skills=SkillConfig(skills_dir="./.agents/skills", hot_reload=False),
)


def route(state: AgentState) -> str:
    last = state.context[-1]
    return "TOOL" if getattr(last, "tools_calls", None) else END


graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()
```

When a user asks *"Help me write a SQL join"*, the model sees `sql-query-helper` in the catalog, calls `activate_skill("sql-query-helper")`, and then reads `references/schema.sql` with `read_skill_resource` if it needs the table definitions.

---

## Migrating from earlier versions

| Before | Now |
|---|---|
| `set_skill(skill_name, resource)` tool | `activate_skill(skill_name)` and `read_skill_resource(skill_name, path)` |
| `SkillConfig(inject_trigger_table=...)` | `SkillConfig(inject_catalog=...)` |
| Markdown trigger table | `<available_skills>` catalog with name and description |
| `resources:` list in frontmatter | Removed; every file in the skill directory is readable |
| `triggers` / `tags` / `priority` at the top level or as YAML lists | Inside `metadata` as strings (lists still load, with a diagnostic) |
| `SkillsRegistry.build_trigger_table()` | `SkillsRegistry.build_catalog()` |
| `SkillsRegistry.build_set_skill_tool()` / `load_resources()` | `activation.make_activate_skill_tool()` / `SkillsRegistry.read_file()` |
| Duplicate names across directories raised `ValueError` | The earlier directory wins; the later skill is reported as shadowed |

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ValueError: skills_dir must not be an empty string` | `skills_dir=""` passed to `SkillConfig`. | Use `skills_dir=None` to disable, or give a directory path. |
| `RuntimeError: Skills require an existing ToolNode` | On-demand skills were found but the agent has no `ToolNode`. | Pass `tool_node=ToolNode([...])` or `tool_node="TOOL"`. |
| `Skills enabled but no skills were discovered` warning | No subdirectory of `skills_dir` contains a `SKILL.md`. | Check the path and that each skill has its own directory. |
| `Skipped: 'description' is missing or empty` diagnostic | The skill has no description, so it cannot appear in the catalog. | Add a `description` that says when to use the skill. |
| Model never activates a skill | The description does not say when to use it. | Rewrite the description with the requests it should match; optionally add `metadata.triggers`. |
