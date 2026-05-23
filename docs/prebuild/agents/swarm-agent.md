# SwarmAgent

A peer-to-peer multi-agent pattern where agents hand off control to each other directly — no central coordinator.

**Import path:** `agentflow.prebuilt.agent`

---

## Concept

In a supervisor pattern, a single coordinator routes all work. In a swarm, any agent can decide to hand off to any other agent it knows about. This produces a flexible, decentralized flow:

```
TRIAGE ──[transfer_to_researcher]──> RESEARCHER ──[transfer_to_writer]──> WRITER ──> END
       ──[transfer_to_writer]──────> WRITER ──────────────────────────────────────> END
```

Each member:
1. Runs its own LLM call (with its own tools, model, memory, skills, etc.)
2. Either produces a final answer (routing to END) or calls `transfer_to_<name>` to hand off

`SwarmAgent` automatically:
- Generates `transfer_to_<name>` handoff tools for each member based on `can_handoff_to`
- Injects those tools into each member's `ToolNode`
- Wires per-member conditional edges that detect handoff tool calls via the `transfer_to_` naming convention

The graph routing layer intercepts handoff tool calls — the tool body never executes — so there are no spurious tool-result messages in the conversation.

---

## Code Explanation

### `SwarmMemberConfig`

```python
@dataclass
class SwarmMemberConfig:
    agent: BaseAgent          # fully configured Agent instance
    can_handoff_to: list[str] | None = None  # None = all other members
    description: str = ""     # injected into other members' handoff tool descriptions
```

Each member is a **pre-built** `Agent`, so you configure models, tools, memory, and skills per-member independently.

### Handoff tool injection

For each member, `SwarmAgent`:
1. Resolves the target list from `can_handoff_to` (or all other members if `None`)
2. Calls `create_handoff_tool(agent_name=target.lower(), description=target_cfg.description)` for each target
3. Injects the resulting callables into the member's existing `ToolNode` (or creates a new one)

This happens inside `_configure_graph()`, which is called by `compile()`.

### Per-member routing

For each member node, `_make_member_route` returns a routing function that:
1. If the last assistant message contains a `transfer_to_<target>` call and the target is in the allowed set → routes to that target node
2. If it contains regular tool calls → routes to `<NAME>_TOOL` for execution
3. Otherwise → END

### Tool loop per member

Each member that has regular tools gets a mini react-loop: `NAME → NAME_TOOL → NAME`. This runs before handoff detection.

---

## Full Code

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import SwarmAgent
from agentflow.prebuilt.agent.swarm import SwarmMemberConfig
from agentflow.prebuilt.tools import fetch_url, google_web_search


def draft_report(topic: str, facts: str) -> str:
    """Draft a structured report from gathered facts."""
    return f"# Report: {topic}\n\n{facts}"


triage_agent = Agent(
    model="gpt-4o-mini",
    system_prompt=[{
        "role": "system",
        "content": (
            "You are a triage agent. Decide whether the task needs research or can go "
            "directly to the writer. Route accordingly."
        ),
    }],
)

researcher_agent = Agent(
    model="gpt-4o",
    tool_node=ToolNode([fetch_url, google_web_search]),
    system_prompt=[{
        "role": "system",
        "content": "You are a research specialist. Gather facts and hand off to the writer.",
    }],
)

writer_agent = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([draft_report]),
    system_prompt=[{
        "role": "system",
        "content": "You are a writer. Produce the final document from the gathered information.",
    }],
)

swarm = SwarmAgent(
    members={
        "TRIAGE": SwarmMemberConfig(
            agent=triage_agent,
            can_handoff_to=["RESEARCHER", "WRITER"],
            description="Triages the request and routes to the right specialist.",
        ),
        "RESEARCHER": SwarmMemberConfig(
            agent=researcher_agent,
            can_handoff_to=["WRITER"],
            description="Gathers facts from the web. Use after TRIAGE for research tasks.",
        ),
        "WRITER": SwarmMemberConfig(
            agent=writer_agent,
            can_handoff_to=[],  # terminal — no handoffs out
            description="Writes the final document.",
        ),
    },
    entry="TRIAGE",
)

app = swarm.compile()

result = await app.ainvoke(
    {"message": "Write a brief report on quantum computing progress in 2024."},
    config={"thread_id": "swarm-1"},
)
print(result["context"][-1].text())
```

---

## Running with `agentflow play`

**`graph.py`**

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import SwarmAgent
from agentflow.prebuilt.agent.swarm import SwarmMemberConfig
from agentflow.prebuilt.tools import google_web_search


triage = Agent(
    model="gpt-4o-mini",
    system_prompt=[{"role": "system", "content": "Route requests to researcher or writer."}],
)
researcher = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([google_web_search]),
    system_prompt=[{"role": "system", "content": "Research the topic and hand off to writer."}],
)
writer = Agent(
    model="gpt-4o-mini",
    system_prompt=[{"role": "system", "content": "Write the final answer."}],
)

swarm = SwarmAgent(
    members={
        "TRIAGE": SwarmMemberConfig(triage, can_handoff_to=["RESEARCHER", "WRITER"],
                                    description="Routes the task."),
        "RESEARCHER": SwarmMemberConfig(researcher, can_handoff_to=["WRITER"],
                                        description="Researches the topic."),
        "WRITER": SwarmMemberConfig(writer, description="Writes the final answer."),
    },
    entry="TRIAGE",
)

app = swarm.compile()
```

**`agentflow.json`**

```json
{
  "agent": "graph:app",
  "env": ".env",
  "auth": null,
  "checkpointer": null,
  "injectq": null,
  "store": null,
  "redis": null,
  "thread_name_generator": null
}
```

```bash
agentflow play
```

---

## Key Parameters

| Parameter | Type | Description |
|---|---|---|
| `members` | `dict[str, SwarmMemberConfig]` | Mapping of node names to member configs |
| `entry` | `str` | Name of the member that receives the first message |
| `state` | `AgentState \| None` | Optional custom state subclass |
| `publisher` | `BasePublisher \| None` | Optional event publisher for streaming |
| `container` | `InjectQ \| None` | Dependency injection container |

### `SwarmMemberConfig` fields

| Field | Type | Default | Description |
|---|---|---|---|
| `agent` | `BaseAgent` | required | Pre-built agent instance |
| `can_handoff_to` | `list[str] \| None` | `None` | Allowed targets; `None` = all other members |
| `description` | `str` | `""` | Used in handoff tool descriptions for other members |
