# Skills API Reference

This page documents the Python classes and functions in the `agentflow.skills` package.

## SkillConfig

User-facing configuration for enabling skills on an Agent.

```python
from agentflow.skills import SkillConfig

config = SkillConfig(
    skills_dir="./skills/",
    max_active=1,
    auto_deactivate=True,
    inject_trigger_table=True,
    hot_reload=True,
)

agent = Agent(
    model="google/gemini-2.5-flash",
    skills=config,
)
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skills_dir` | `str \| None` | `None` | Path to folder containing skill subdirectories. If `None`, no skills are discovered from disk. |
| `max_active` | `int` | `1` | Maximum number of simultaneously active skills. |
| `auto_deactivate` | `bool` | `True` | When `True`, activating a new skill automatically clears the previous one. |
| `inject_trigger_table` | `bool` | `True` | Appends a markdown table of all skills to the system prompt so the LLM knows when to use each skill. |
| `hot_reload` | `bool` | `True` | Re-reads SKILL.md files when their modification time changes. Safe for production (mtime check is cheap). |

### Example: Multiple Active Skills

```python
# Allow up to 2 skills active at once
config = SkillConfig(
    skills_dir="./skills/",
    max_active=2,
    auto_deactivate=False,  # Don't clear previous skills
)
```

---

## SkillMeta

Metadata about a single skill, parsed from a SKILL.md file. You typically don't create these directly; they're created by the loader when scanning the skills directory.

```python
from agentflow.skills import SkillMeta

meta = SkillMeta(
    name="code-review",
    description="Perform thorough code reviews",
    triggers=["review my code", "find bugs"],
    resources=["style-guide.md"],
    tags={"engineering"},
    priority=10,
    skill_dir="/path/to/skills/code-review/",
    skill_file="/path/to/skills/code-review/SKILL.md",
)
```

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | `str` | Unique identifier for the skill |
| `description` | `str` | One-sentence description of what the skill does |
| `triggers` | `list[str]` | Example phrases that should activate this skill |
| `resources` | `list[str]` | Relative paths to resource files |
| `tags` | `set[str]` | Category labels for filtering |
| `priority` | `int` | Higher values appear first in trigger table |
| `skill_dir` | `str` | Absolute path to the skill's folder |
| `skill_file` | `str` | Absolute path to SKILL.md |

---

## SkillsRegistry

Central index of all discovered skills. Owned by the Agent when skills are enabled.

```python
from agentflow.skills import SkillsRegistry

registry = SkillsRegistry()
registry.discover("./skills/")

# Look up a skill
meta = registry.get("code-review")

# Get all skills
all_skills = registry.get_all()

# Filter by tag
engineering_skills = registry.get_all(tags={"engineering"})

# List skill names
names = registry.names()  # ["code-review", "data-analysis", ...]
```

### Methods

#### `discover(skills_dir: str) -> list[SkillMeta]`

Scan a directory for skills and register them. Returns the list of discovered skills.

```python
found = registry.discover("./skills/")
print(f"Found {len(found)} skills")
```

#### `register(meta: SkillMeta) -> None`

Register a single skill manually.

```python
registry.register(SkillMeta(
    name="custom-skill",
    description="A programmatically defined skill",
))
```

#### `get(name: str) -> SkillMeta | None`

Look up a skill by name. Returns `None` if not found.

#### `get_all(tags: set[str] | None = None) -> list[SkillMeta]`

Get all skills, optionally filtered by tags.

#### `names() -> list[str]`

Get a sorted list of all skill names.

#### `load_content(name: str, hot_reload: bool = True) -> str`

Load the body content of a skill's SKILL.md (frontmatter stripped).

```python
content = registry.load_content("code-review")
```

#### `load_resources(name: str) -> dict[str, str]`

Load all resource files for a skill. Returns `{filename: content}`.

```python
resources = registry.load_resources("code-review")
# {"style-guide.md": "# Style Guide\n..."}
```

#### `build_trigger_table(tags: set[str] | None = None) -> str`

Generate the markdown trigger table for the system prompt.

```python
table = registry.build_trigger_table()
# Returns:
# ## Available Skills
#
# | Skill | When to use |
# |-------|-------------|
# | `code-review` | review my code; find bugs; code review |
# ...
```

---

## Tools: set_skill and clear_skill

When skills are enabled, the Agent's ToolNode automatically includes two tools:

### set_skill(skill_name: str) -> str

Activates a skill. The LLM calls this when a user request matches a skill domain.

**Returns:**
- `"SKILL_ACTIVATED:<skill_name>"` on success
- `"ERROR: Unknown skill '<name>'. Available: ..."` if skill not found

**Example LLM interaction:**
```
User: Can you review my Python code?
Assistant: [calls set_skill("code-review")]
Tool Result: SKILL_ACTIVATED:code-review
Assistant: [responds using code-review skill instructions]
```

### clear_skill() -> str

Deactivates all active skills, returning to general mode.

**Returns:** `"SKILL_DEACTIVATED"`

---

## SkillInjector

Internal class that builds system prompt messages from active skills. You typically don't use this directly.

```python
from agentflow.skills.injection import SkillInjector

injector = SkillInjector(registry, config)

# Build prompts for active skills
prompts = injector.build_skill_prompts(["code-review"])
# Returns: [{"role": "system", "content": "## ACTIVE SKILL: CODE REVIEW\n..."}]
```

### Methods

#### `build_skill_prompts(active_skills: list[str]) -> list[dict[str, str]]`

Builds system prompt dicts for each active skill. Each dict contains:
- Skill body content
- Appended resource files
- Routing note (tells LLM to check other skills on next turn)

---

## State Storage

Active skills are stored in `state.execution_meta.internal_data["active_skills"]` as a list of strings.

```python
# Check active skills
active = state.execution_meta.internal_data.get("active_skills", [])

# Manually set (not recommended - use set_skill tool instead)
state.execution_meta.internal_data["active_skills"] = ["code-review"]
```

**Why this location?**

- `state.context` (message history) can be trimmed by `MessageContextManager`
- `execution_meta.internal_data` is never trimmed
- Skills survive context trimming automatically

---

## Imports Summary

```python
# Main imports
from agentflow.skills import SkillConfig, SkillMeta, SkillsRegistry

# Agent integration
from agentflow.graph import Agent, StateGraph

agent = Agent(
    model="google/gemini-2.5-flash",
    skills=SkillConfig(skills_dir="./skills/"),
)
```
