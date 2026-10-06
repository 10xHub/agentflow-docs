---
title: Skills
seoTitle: "Skills tutorial: load SKILL.md on demand"
description: Build a 10xGraph graph that loads Agent Skills (SKILL.md) on demand and combines them with normal tools.
section: Tutorials
group: From examples
order: 1350
label: Skills
updated: "2026-09-29"
---

**Source example:** `examples/skills/graph.py`

## What you will build

A graph where one assistant can switch into specialized modes at runtime by loading `SKILL.md` files from disk. The skills follow the [Agent Skills specification](https://agentskills.io/specification), so the same folders also work in Claude Code, Codex and GitHub Copilot.

In this tutorial the agent can:

- answer normal questions directly
- call a regular Python tool like `lookup_order`
- call the auto-injected `activate_skill` tool when a request matches a skill
- return to the main loop after the skill content has been loaded

## Prerequisites

- Python 3.12 or later
- `10xgraph` installed
- `python-dotenv` installed
- a model key for the provider used by the example

Install the basics:

```bash
pip install 10xgraph python-dotenv
```

## How the skills system works

```mermaid
flowchart TD
    A[User message] --> B[MAIN agent]
    B -->|normal reply| G[END]
    B -->|tool call: lookup_order| C[TOOL node]
    B -->|tool call: activate_skill| C
    C -->|tool result message| B
    C -->|skill instructions returned| B
    H[skills directory] --> C
```

The key idea is simple:

1. you keep reusable instructions in `SKILL.md` files
2. `SkillConfig` makes those skills discoverable: each skill's name and description go into an `<available_skills>` catalog in the system prompt
3. 10xGraph injects an `activate_skill` tool automatically, plus `read_skill_resource` when a skill bundles extra files
4. when the model decides a skill fits, it calls `activate_skill("skill-name")`
5. the skill content comes back as a tool result, wrapped in `<skill_content>` tags, and becomes part of the next model turn

## Step 1: Create a skills directory

The example stores skills next to the graph file:

```text
examples/skills/
├── graph.py
├── chat.py
└── skills/
    ├── code-review/
    │   └── SKILL.md
    ├── data-analysis/
    │   └── SKILL.md
    ├── humanizer/
    │   └── SKILL.md
    └── writing-assistant/
        └── SKILL.md
```

Each skill is just a Markdown file with YAML frontmatter.

Example shape:

```markdown
---
name: code-review
description: "Perform thorough code reviews, identify bugs, suggest improvements, and explain code quality issues. Use when the user shares code and asks for a review, bug hunt, or quality feedback."
metadata:
  triggers: "review my code; find bugs"
  tags: "engineering, development"
  priority: "10"
---

You are now in CODE REVIEW mode.
```

The frontmatter gives the runtime enough structure to:

- identify the skill (`name` must match the folder name)
- tell the model what the skill does and when to use it (`description`)
- add example requests as hints in the catalog (`metadata.triggers`, a 10xGraph extension)
- order skills in the catalog (`metadata.priority`, highest first)

The specification requires `metadata` values to be strings, so the triggers are a `;`-separated string and the priority is quoted. Check a skill with `10xgraph skills --validate examples/skills/skills`.

## Step 2 - Point `SkillConfig` at the directory

The example builds the path like this:

```python
from pathlib import Path
from tenxgraph.core.skills import SkillConfig

SKILLS_DIR = str(Path(__file__).parent / "skills")
```

Then it passes that into the agent:

```python
agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[...],
    tool_node=ToolNode([lookup_order]),
    skills=SkillConfig(
        skills_dir=SKILLS_DIR,
        inject_catalog=True,
        hot_reload=True,
    ),
    trim_context=True,
)
```

What these options do:

| Field | Effect |
|---|---|
| `skills_dir` | Tells 10xGraph where to find `SKILL.md` files |
| `inject_catalog=True` | Adds the `<available_skills>` catalog (name, description, trigger hints) to the prompt |
| `hot_reload=True` | Re-reads a `SKILL.md` when it changes on disk, so edits are picked up without a restart |

`hot_reload=True` is especially useful while authoring skills because you can edit a file and retry without restarting the process.

## Step 3 - Combine skills with normal tools

This example is useful because it shows that skills do not replace regular tools.

The graph still exposes a regular support tool:

```python
def lookup_order(order_id: str) -> str:
    orders = {
        "A-1001": "Shipped, arriving Thursday",
        "A-1002": "Processing",
        "A-1003": "Delivered",
    }
    return orders.get(order_id, "Order not found")
```

Then the agent is created with that tool node:

```python
tool_node = ToolNode([lookup_order])
```

When skills are enabled, 10xGraph augments that tool node by injecting `activate_skill` into it (and `read_skill_resource` if a skill bundles files). The final tool node therefore contains both kinds of capability:

- hand-written Python tools
- the automatically generated skill tools

The example makes that explicit:

```python
tool_node = agent.get_tool_node()
```

That is the important call. It returns the final tool node after skill tooling has been attached.

## Step 4 - Route between the agent and tools

The tutorial uses a standard ReAct loop:

```python
def should_use_tools(state: AgentState) -> str:
    if not state.context:
        return END

    last = state.context[-1]

    if last.role == "assistant" and hasattr(last, "tools_calls") and last.tools_calls:
        return "TOOL"

    if last.role == "tool":
        return "MAIN"

    return END
```

Execution flow:

```mermaid
sequenceDiagram
    participant User
    participant Main as MAIN agent
    participant Tools as TOOL node
    participant Files as SKILL.md files

    User->>Main: "Review this Python function"
    Main->>Tools: call activate_skill("code-review")
    Tools->>Files: load code-review/SKILL.md
    Files-->>Tools: markdown instructions
    Tools-->>Main: tool result containing skill content
    Main-->>User: review written using the loaded skill
```

The same loop also handles regular tools. If the user asks about an order, the agent can call `lookup_order` instead of `activate_skill`.

## Step 5 - Understand what the model actually sees

With `inject_catalog=True`, the model gets a compact catalog of skills in the prompt. That helps it decide whether a request like:

- `review this code`
- `analyse this data`
- `humanize this text`
- `write an apology email`

should trigger a skill.

When the skill is loaded, the tool returns the full markdown instructions. That means the next assistant turn is grounded in the exact contents of the relevant `SKILL.md` file. If context trimming later drops that tool result, the agent puts the instructions back into the system prompt on its own.

A useful mental model is:

- the catalog helps the model choose
- `activate_skill` delivers the full instructions
- `read_skill_resource` fetches bundled files (references, scripts) only when the instructions point to them
- the next assistant step applies those instructions

## Step 6 - Compile and run the graph

The example graph is a classic two-node setup:

```python
graph = StateGraph(
    context_manager=MessageContextManager(max_messages=20),
)
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)

graph.add_conditional_edges(
    "MAIN",
    should_use_tools,
    {"TOOL": "TOOL", END: END},
)
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()
```

Run it:

```bash
cd examples/skills
python graph.py
```

Or pass a query directly:

```bash
python graph.py "Review this Python code: def add(a,b): return a+b"
python graph.py "Help me write a professional apology email to a client"
python graph.py "Analyse this data: sales=[120,95,140,88,160] by month"
python graph.py "Where is order A-1001?"
```

## What to verify

When the example starts, it prints the registered tools. You should see:

- `lookup_order`
- `activate_skill`

Then test these scenarios:

| Input | Expected behavior |
|---|---|
| code review request | agent loads `code-review` skill |
| writing request | agent loads `writing-assistant` skill |
| humanization request | agent loads `humanizer` skill |
| order status request | agent uses `lookup_order` instead of a skill |

## Why this pattern works well

This design keeps responsibilities separate:

- graph code handles orchestration
- Python tools handle deterministic actions
- `SKILL.md` files hold specialized writing and reasoning instructions

That separation is valuable because non-engineers can often improve a skill file without touching graph wiring.

## Common mistakes

- Registering the original `ToolNode` instead of `agent.get_tool_node()`. That drops the injected `activate_skill` tool.
- Putting all domain instructions in the base system prompt instead of splitting them into focused skills.
- Forgetting that skill selection is model-driven. The `description` must say when to use the skill; trigger phrases are only hints.
- Leaving `hot_reload=True` in a production environment where you want more predictable file loading behavior.

## Skills architecture recap

```mermaid
flowchart LR
    A[Graph code] --> B[Agent]
    C[SkillConfig] --> B
    D[SKILL.md files] --> C
    B --> E[Injected activate_skill tool]
    F[Custom Python tools] --> G[ToolNode]
    E --> G
    G --> B
```

## Related docs

- [Skills Reference](/docs/reference/python/skills)
- [Agents and Tools](/docs/concepts/agents-and-tools)
- [Tool Decorator Tutorial](/docs/tutorials/from-examples/tool-decorator)

## What you learned

- How 10xGraph discovers `SKILL.md` files.
- How `SkillConfig` injects `activate_skill` (and `read_skill_resource`) into the tool node.
- How to combine skill loading with normal Python tools in one graph.

## Variant: a persistent terminal chat

The repo also ships `examples/skills/chat.py`, which wraps the same graph in a REPL. Three details matter.

Use one `thread_id` for the whole session, and reuse it on every call:

```python
thread_id = f"skills-chat-{uuid4().hex[:8]}"

result = app.invoke(
    {"messages": [Message.text_message(user_input)]},
    config={"thread_id": thread_id, "recursion_limit": 20},
)
```

Detect which skill was loaded by scanning tool messages for the `<skill_content name="...">` tag that `activate_skill` wraps around skill text:

```python
SKILL_CONTENT_RE = re.compile(r'<skill_content name="([^"]+)">')

for msg in result["messages"]:
    if msg.role == "tool":
        match = SKILL_CONTENT_RE.match(msg.text() or "")
        if match:
            print(f"  >> Skill loaded: {match.group(1)}")
```

Print only the latest assistant message with text, since the result also contains tool messages:

```python
for msg in reversed(result["messages"]):
    if msg.role == "assistant" and msg.text():
        print(f"\nAssistant: {msg.text()}\n")
        break
```

Pass the tools through `tool_node=ToolNode([...])` as above. `Agent` has no `tools=` parameter. Create the thread ID once, not per message, or the conversation looks stateless. Handle `KeyboardInterrupt` and `EOFError` in the loop.

## Next step

→ Continue with [Testing](/docs/tutorials/from-examples/testing) to add fast deterministic tests around graphs like this one.
