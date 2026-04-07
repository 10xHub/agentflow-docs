# Skills System

The Agentflow Skills system lets a single `Agent` dynamically switch between specialized "skill modes" at runtime. Each skill injects domain-specific instructions, resources, and behavioral guidelines without restarting the graph or creating multiple agents.

## Why Skills?

Traditional approaches to multi-domain agents require either:
- **Multiple agents** coordinated via routing logic
- **Massive system prompts** covering all possible domains
- **Dynamic prompt engineering** with complex state management

Skills offer a cleaner approach: define each domain as a separate file, and let the agent activate the right one on demand.

## Key Features

| Feature | Description |
|---------|-------------|
| **Runtime Activation** | LLM calls `set_skill("skill-name")` to switch modes |
| **File-based Definition** | Each skill is a `SKILL.md` file with YAML frontmatter |
| **Resource Injection** | Reference additional files (style guides, protocols, etc.) |
| **Auto Trigger Table** | System prompt automatically lists when to use each skill |
| **Hot Reload** | Edit skill files while running - changes apply immediately |
| **Context-Trim Safe** | Skills survive even when message history is trimmed |

## Quick Start

### 1. Create a skills folder

```
my-project/
├── skills/
│   ├── code-review/
│   │   └── SKILL.md
│   ├── data-analysis/
│   │   └── SKILL.md
│   └── writing-assistant/
│       └── SKILL.md
└── graph.py
```

### 2. Define a skill (`skills/code-review/SKILL.md`)

```markdown
---
name: code-review
description: Perform thorough code reviews, identify bugs, and suggest improvements
metadata:
  triggers:
    - review my code
    - find bugs
    - code review
  tags:
    - engineering
  priority: 10
---

You are now in **CODE REVIEW** mode.

## Review Checklist

- Check for logical errors and edge cases
- Evaluate code readability and naming
- Identify performance issues
- Flag security concerns

Always provide a summary verdict and specific, actionable feedback.
```

### 3. Configure your Agent

```python
from agentflow.graph import Agent, StateGraph
from agentflow.skills import SkillConfig
from agentflow.utils.constants import END

agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[{
        "role": "system",
        "content": "You are a multi-skilled assistant.",
    }],
    skills=SkillConfig(
        skills_dir="./skills/",
        inject_trigger_table=True,
        hot_reload=True,
    ),
)

# The tool_node already includes set_skill and clear_skill
tool_node = agent.get_tool_node()

def should_use_tools(state):
    last = state.context[-1]
    if last.role == "assistant" and hasattr(last, "tools_calls") and last.tools_calls:
        return "TOOL"
    if last.role == "tool":
        return "MAIN"
    return END

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()
```

### 4. Use it

```python
from agentflow.state import Message

result = app.invoke(
    {"messages": [Message.text_message("Review this code: def add(a,b): return a+b")]},
    config={"thread_id": "demo-1"},
)
```

The agent will:
1. See the trigger table in its system prompt
2. Recognize "review this code" matches the `code-review` skill
3. Call `set_skill("code-review")`
4. Receive the full skill instructions
5. Respond as a specialized code reviewer

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent.execute()                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Base system prompt                                          │
│  2. Trigger table (all available skills)                        │
│  3. Active skill content (if skill is active)                   │
│  4. User messages from state.context                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                         LLM Response
                              │
         ┌────────────────────┴────────────────────┐
         │                                         │
    Text response                          Tool call: set_skill()
         │                                         │
         ▼                                         ▼
        END                                   ToolNode
                                                   │
                                   "SKILL_ACTIVATED:code-review"
                                                   │
                                    State updated with active skill
                                                   │
                                              Back to MAIN
                                                   │
                                    Skill content now injected
```

## Next Steps

- [SKILL.md Format Reference](./skill-format.md) - Complete syntax guide
- [API Reference](./api-reference.md) - SkillConfig, SkillMeta, SkillsRegistry
- [Skills Tutorial](../../../Tutorial/skills.md) - Step-by-step walkthrough
