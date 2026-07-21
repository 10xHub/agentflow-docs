---
title: Skills — Python API reference
sidebar_label: Skills
description: SkillConfig and SkillMeta — inject SKILL.md documents into Agent system prompts at runtime.
keywords:
  - agentflow python reference
  - agent api reference
  - python agent library
  - agentflow
  - python ai agent framework
  - skills
sidebar_position: 4
---


# Skills

## When to use this

Use skills to inject context documents into an agent's system prompt dynamically based on what the user asks. Skills are Markdown files with YAML frontmatter that describe a capability, its triggers, and the resources needed to execute it.

## Import path

```python
from agentflow.core.skills.models import SkillConfig, SkillMeta
```

---

## How skills work

1. You create a directory of `SKILL.md` files. Each file has YAML frontmatter with `name`, `description`, `triggers`, `tags`, and optional `resources`.
2. You attach a `SkillConfig` to an `Agent` pointing at that directory.
3. When the agent processes a message, it evaluates trigger phrases against the user input. If a trigger matches, the full `SKILL.md` content is injected into the system prompt for that turn.
4. With `hot_reload=True` (default), skill files are re-read on every call — no restart needed during development.

---

## `SkillConfig`

Configuration passed to the `Agent` constructor via the `skills=` parameter.

```python
from agentflow.core.skills.models import SkillConfig

agent = Agent(
    model="gpt-4o",
    skills=SkillConfig(
        skills_dir="./skills",
        inject_trigger_table=True,
        hot_reload=True,
    ),
)
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `skills_dir` | `str \| None` | `None` | Path to the directory containing `SKILL.md` files. Relative paths are resolved from the working directory. Set to `None` to disable skills entirely. |
| `inject_trigger_table` | `bool` | `True` | When `True`, the agent's system prompt includes a summary table of all available skills and their triggers. This helps the LLM discover skills before they are triggered. |
| `hot_reload` | `bool` | `True` | Re-read skill files on every agent call. Set to `False` in production for better performance once skills are stable. |
| `mode` | `"on-demand" \| "session"` | `"on-demand"` | Activation strategy. See below. |
| `preload_from` | `str \| None` | `None` | Name of the `AgentState` field holding the skill to preload. Only used when `mode="session"`. |

**Validation:** `skills_dir` must not be an empty string. Pass `None` to disable. `preload_from` must not be an empty string.

### Activation modes

`mode="on-demand"` is the default: the trigger table is injected into the system prompt and the LLM calls `set_skill()` to pull in the skill body when it decides a skill applies.

`mode="session"` pins one skill for the whole session. The framework reads `state.<preload_from>` at the start of every call, resolves that name to a `SKILL.md`, and injects it as a system message before the first LLM call. No trigger table and no `set_skill` tool are injected. This suits multi-tenant agents where each session has a fixed persona or domain.

```python
from agentflow.core.state import AgentState
from agentflow.core.skills.models import SkillConfig

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

---

## `SkillMeta`

Parsed metadata for a single skill file. Returned when you inspect loaded skills programmatically.

### Fields

| Field | Type | Constraints | Description |
|---|---|---|---|
| `name` | `str` | Lowercase alphanumeric, hyphens, underscores. Max 128 chars. | Slug identifier for the skill. |
| `description` | `str` | Non-empty, max 2000 chars. | Human-readable description of what this skill does. |
| `triggers` | `list[str]` | Max 50 triggers, each max 500 chars. | Phrases that activate this skill. The agent checks if any trigger appears in the user message. |
| `resources` | `list[str]` | Max 100 items. Relative paths only. No `..` or absolute paths. | Additional files the skill may reference. |
| `tags` | `set[str]` | Max 50 tags. | Tags for filtering and discovery. |
| `priority` | `int` | 0 to 1000. | Order in which skills are injected when multiple trigger simultaneously. Higher = earlier. |
| `skill_dir` | `str` | — | Directory containing the skill file. Set automatically by the loader. |
| `skill_file` | `str` | — | Path to the `SKILL.md` file. Set automatically by the loader. |

---

## `SkillsRegistry`

The registry holds discovered `SkillMeta` entries and builds the prompt fragments the agent injects. `Agent` creates and drives one for you; use it directly when you want to inspect or preload skills outside a graph.

```python
from agentflow.core.skills import SkillsRegistry

registry = SkillsRegistry()
registry.discover("./skills")

table = registry.build_trigger_table()
set_skill = registry.build_set_skill_tool()
```

| Method | Returns | Description |
|---|---|---|
| `discover(skills_dir)` | `list[SkillMeta]` | Scan a directory for `SKILL.md` files and register everything found. |
| `register(meta)` | `None` | Register a single `SkillMeta` by hand. |
| `get(name)` | `SkillMeta \| None` | Look up one skill. |
| `get_all(tags=None)` | `list[SkillMeta]` | All registered skills, optionally filtered to those carrying any of `tags`. |
| `names()` | `list[str]` | Registered skill names. |
| `unregister(name)` | `bool` | Remove a skill. Returns `True` when it was present. |
| `load_content(name, hot_reload=True)` | `str` | The body of the skill's `SKILL.md`. Returns `""` for unknown names. With `hot_reload=True` the file mtime is refreshed so edits are picked up. |
| `load_resources(name)` | `dict[str, str]` | Every resource file declared by the skill, keyed by filename. |
| `build_trigger_table(tags=None)` | `str` | The markdown trigger table injected into the system prompt, sorted by descending `priority` then name. Empty string when no skills are registered. |
| `build_set_skill_tool(hot_reload=True)` | callable | The `set_skill(skill_name, resource_name=None)` tool the LLM calls to load a skill on demand. |

`SkillsRegistry` also supports `len(registry)` and `name in registry`.

---

## Writing a SKILL.md file

```markdown
---
name: sql-query-helper
description: Help the user write and debug SQL queries.
triggers:
  - "sql"
  - "query"
  - "database"
  - "join"
  - "SELECT"
tags:
  - database
  - sql
priority: 10
resources:
  - schemas/users.sql
  - schemas/orders.sql
---

# SQL Query Helper

You are an expert SQL assistant. Always produce:
- Fully qualified column references (table.column)
- Use CTEs for readability
- Explain each JOIN type chosen

Available schema files are provided in context.
```

---

## Skills directory layout

```
my_agent/
├── graph/
│   └── react.py
└── skills/
    ├── sql-query-helper/
    │   └── SKILL.md
    ├── code-reviewer/
    │   └── SKILL.md
    └── summariser/
        └── SKILL.md
```

Each skill lives in its own subdirectory. The directory name is ignored — the `name` field in frontmatter determines the skill identifier.

---

## Filtering skills by tag

Pass `tools_tags` to `Agent` to restrict which tools are available. Similarly, you can filter skills at load time by tags (future feature). For now, all skills in `skills_dir` are loaded.

---

## Example: coding assistant with multiple skills

```python
from agentflow.core.graph import Agent, ToolNode, StateGraph
from agentflow.core.skills.models import SkillConfig
from agentflow.utils import START, END

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a software engineering assistant."}],
    skills=SkillConfig(
        skills_dir="./skills",
        inject_trigger_table=True,
        hot_reload=False,   # disabled in production
    ),
)

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.set_entry_point("MAIN")
graph.add_edge("MAIN", END)

app = graph.compile()
```

When a user says *"Help me write a SQL join"*, the `sql-query-helper` skill is triggered and its full `SKILL.md` content is prepended to the system prompt for that turn.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ValueError: skills_dir must not be an empty string` | `skills_dir=""` passed to `SkillConfig`. | Use `skills_dir=None` to disable or provide a valid directory path. |
| `ValueError: Invalid skill name` | Skill `name` contains uppercase or special characters. | Use lowercase alphanumeric with hyphens/underscores only. |
| `ValueError: Invalid resource path` | `resources` entry contains `..` or starts with `/`. | Use only relative paths within the skill directory. |
| Skill not triggering | Trigger phrase not present in the user message. | Check that the trigger appears (case-insensitive substring match) in the input. |
