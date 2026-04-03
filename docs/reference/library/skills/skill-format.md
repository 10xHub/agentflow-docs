# SKILL.md Format Reference

Every skill is defined in a `SKILL.md` file within its own subdirectory. The file combines YAML frontmatter (metadata) with markdown content (instructions).

## Directory Structure

```
skills/
├── code-review/
│   ├── SKILL.md           # Required: skill definition
│   └── style-guide.md     # Optional: resource file
├── data-analysis/
│   └── SKILL.md
└── writing-assistant/
    ├── SKILL.md
    └── templates/         # Subdirectories are ignored
        └── email.md
```

The subdirectory name (`code-review/`) is for organization only. The canonical skill name comes from the `name:` field in the frontmatter.

## Basic Format

```markdown
---
name: skill-name
description: One sentence describing when to use this skill
metadata:
  triggers:
    - trigger phrase 1
    - trigger phrase 2
  resources:
    - resource-file.md
  tags:
    - category
  priority: 10
---

## Skill Instructions

Your detailed instructions here. This content is injected as a system
message when the skill is active.
```

## Frontmatter Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier for the skill. Used in `set_skill("name")` |
| `description` | string | One sentence explaining what this skill does and when to use it |

### Optional Fields (in `metadata:` block)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `triggers` | list | `[]` | Example phrases that should activate this skill |
| `resources` | list | `[]` | Filenames of additional files to inject |
| `tags` | list | `[]` | Category labels for filtering skills programmatically |
| `priority` | int | `0` | Higher values appear first in the trigger table |

### Why use `metadata:` block?

The Claude Code VS Code extension validates markdown frontmatter against its schema. Nesting custom fields under `metadata:` avoids IDE warnings. The loader also supports top-level fields for backwards compatibility:

```yaml
# Preferred (no IDE warnings)
---
name: code-review
description: Review code
metadata:
  triggers:
    - review my code
---

# Also works (backwards compatible)
---
name: code-review
description: Review code
triggers:
  - review my code
---
```

## Triggers

Triggers are example phrases that help the LLM decide when to activate a skill. They appear in the auto-generated trigger table.

```yaml
metadata:
  triggers:
    - review my code
    - find bugs
    - code review
    - check this code
    - is this code good
```

Only the first 4 triggers are shown in the table. Choose the most distinctive ones first.

**Tip:** Make triggers natural and varied. The LLM uses semantic matching, so you don't need to cover every possible phrase.

## Resources

Resources are additional files that can be loaded on-demand during a conversation. They're useful for:

- Style guides
- Reference documentation
- Example templates
- Protocol definitions

```yaml
metadata:
  resources:
    - style-guide.md
    - examples.md
```

Resources must be in the same directory as `SKILL.md`:

```
code-review/
├── SKILL.md
├── style-guide.md    ✓ Will be found
└── deep/
    └── other.md      ✗ Won't be found (relative path doesn't traverse dirs)
```

### Loading Resources

Resources are loaded via the `set_skill` tool by passing the resource filename as the second argument:

```python
# Load a specific resource file
set_skill("code-review", "style-guide.md")
# Returns: ## Resource: style-guide.md\n\n{content of the file}
```

The trigger table shows available resources, and the LLM knows to call `set_skill("skill-name", "resource-name")` to load them.

## Tags

Tags are metadata for filtering skills programmatically. They're not used by the LLM.

```yaml
metadata:
  tags:
    - engineering
    - code-quality
```

Filter skills by tag:

```python
registry.get_all(tags={"engineering"})  # Only engineering skills
```

## Priority

Priority controls the order skills appear in the trigger table. Higher numbers appear first.

```yaml
# code-review/SKILL.md
metadata:
  priority: 10   # Appears first

# writing-assistant/SKILL.md
metadata:
  priority: 5    # Appears second
```

## Skill Body (Instructions)

Everything after the closing `---` is the skill body. This content is returned as a tool result when the LLM calls `set_skill("skill-name")`.

### Best Practices

1. **Start with mode declaration**
   ```markdown
   You are now in **CODE REVIEW** mode.
   ```

2. **Structure with headings**
   ```markdown
   ## Review Checklist

   ## Output Format

   ## Examples
   ```

3. **Be specific about output format**
   ```markdown
   Always respond with:
   1. **Summary** - one sentence verdict
   2. **Issues** - numbered list with severity markers
   3. **Improved Version** - if changes needed
   ```

4. **Include behavioral guidance**
   ```markdown
   Be direct and specific. Reference exact line numbers.
   ```

## Complete Example

```markdown
---
name: code-review
description: Perform thorough code reviews, identify bugs, and suggest improvements
metadata:
  triggers:
    - review my code
    - find bugs
    - code review
    - check this code
  resources:
    - style-guide.md
  tags:
    - engineering
    - development
  priority: 10
---

You are now in **CODE REVIEW** mode.

Your job is to carefully review code and provide structured, actionable feedback.

## Review Checklist

### 1. Correctness
- Are there logical errors or off-by-one mistakes?
- Are edge cases handled (empty inputs, None, zero)?
- Are exceptions handled appropriately?

### 2. Code Quality
- Is the code readable and self-documenting?
- Are variable/function names descriptive?
- Is there unnecessary complexity?

### 3. Performance
- Are there obvious inefficiencies?
- Are there unnecessary loops or repeated calls?

### 4. Security
- Is user input validated?
- Are there injection risks?
- Are secrets hardcoded?

## Output Format

Always respond with:
1. **Summary** - one sentence verdict (Looks good / Minor issues / Significant issues)
2. **Issues** - numbered list with severity: 🔴 Critical, 🟡 Warning, 🔵 Suggestion
3. **Improved Version** - rewrite with fixes (if needed)

Be direct and specific. Reference exact line numbers or variable names.
```

## Validation Errors

The loader logs warnings for common issues:

| Warning | Cause |
|---------|-------|
| `no valid YAML frontmatter` | Missing `---` delimiters or YAML syntax error |
| `missing 'name' or 'description'` | Required fields not present |
| `Resource not found` | Listed resource file doesn't exist |

Check your logs during startup to catch configuration issues.
