# Skills API Reference

This page documents the Python classes and functions in the `agentflow.skills` package.

## SkillConfig

User-facing configuration for enabling skills on an Agent.

```python
from agentflow.skills import SkillConfig

config = SkillConfig(
    skills_dir="./skills/",
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
| `inject_trigger_table` | `bool` | `True` | Appends a markdown table of all skills to the system prompt so the LLM knows when to use each skill. |
| `hot_reload` | `bool` | `True` | Re-reads SKILL.md files when their modification time changes. Safe for production (mtime check is cheap). |

### Example

```python
# Configure skills
config = SkillConfig(
    skills_dir="./skills/",
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
# ### How to Use Skills
# When the user's request matches a skill:
# 1. Call `set_skill(skill_name)` to load the skill instructions
# 2. Read the loaded content — it may reference additional resources
# 3. If you need a specific resource mentioned in the skill, call `set_skill(skill_name, resource_name)`
# 4. Then provide your answer using the loaded content
# ### Skills & Resources
#
# **`code-review`** — triggers: "review my code", "find bugs", "code review"
# ...
```

---

## Tool: set_skill

When skills are enabled, the Agent's ToolNode automatically includes the `set_skill` tool.

### set_skill(skill_name: str, resource: str | None = None) -> str

Activates a skill or loads a specific resource. The LLM calls this when a user request matches a skill domain.

**Arguments:**
- `skill_name` (required): Name of the skill to load
- `resource` (optional): If provided, loads this specific resource file instead of the skill instructions

**Returns:**
- `"## SKILL: {NAME}\n\n{skill content}"` on success
- `"## Resource: {filename}\n\n{resource content}"` when loading a resource
- `"ERROR: Unknown skill '<name>'. Available: ..."` if skill not found

**Example LLM interaction:**
```
User: Can you review my Python code?
Assistant: [calls set_skill("code-review")]
Tool Result: ## SKILL: CODE-REVIEW

You are now in **CODE REVIEW** mode...
Assistant: [responds using code-review skill instructions]
```

**Loading a resource:**
```
Assistant: [calls set_skill("code-review", "style-guide.md")]
Tool Result: ## Resource: style-guide.md

# Style Guide
...
```

---

## How Skills Work

The skill system works differently from the old "active skill injection" model:

1. **Trigger Table**: The LLM sees all available skills in the system prompt
2. **Skill Activation**: When the LLM calls `set_skill("skill-name")`, the tool returns the full skill content
3. **Resource Loading**: `set_skill("skill-name", "resource.md")` loads specific resource files
4. **No State Storage**: Skills don't store state in `execution_meta` - instead, content is returned as tool results and the LLM uses it directly

This design is simpler and works better with context trimming - skill content is re-loaded fresh when needed.

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
