# SwarmAgent

A peer-to-peer multi-agent pattern where agents hand off control to each other directly — no central coordinator.

**Import path:** `agentflow.prebuilt.agent`

---

## Concept

In a supervisor pattern a single coordinator routes all work. In a swarm, any agent can decide to hand off to any other agent it knows about. This produces a flexible, decentralized flow with no bottleneck at the center.

### Full graph — three-member example

```mermaid
flowchart TD
    START([START]) --> TRIAGE

    TRIAGE["TRIAGE\n(LLM)"]
    RESEARCHER["RESEARCHER\n(LLM + tools)"]
    RESEARCHER_TOOL["RESEARCHER_TOOL\n(ToolNode)"]
    WRITER["WRITER\n(LLM)"]
    END_NODE([END])

    TRIAGE -- "transfer_to_researcher" --> RESEARCHER
    TRIAGE -- "transfer_to_writer" --> WRITER
    TRIAGE -- "no handoff" --> END_NODE

    RESEARCHER -- "transfer_to_writer" --> WRITER
    RESEARCHER -- "regular tool call" --> RESEARCHER_TOOL
    RESEARCHER -- "no tool calls" --> END_NODE
    RESEARCHER_TOOL --> RESEARCHER

    WRITER -- "no handoff" --> END_NODE
```

### Per-member routing logic

Each member node gets its own routing function. After every LLM call it inspects `state.context[-1].tools_calls` and picks a branch in priority order:

```mermaid
flowchart LR
    MEMBER["MEMBER\n(LLM)"]
    TOOL["MEMBER_TOOL\n(ToolNode)"]
    TARGET["TARGET MEMBER"]
    END_NODE([END])

    MEMBER -- "1. handoff tool call\n(transfer_to_X)" --> TARGET
    MEMBER -- "2. regular tool call" --> TOOL
    MEMBER -- "3. no tool calls" --> END_NODE
    TOOL --> MEMBER
```

```python
for tc in last.tools_calls:
    is_handoff, target = is_handoff_tool(tc["name"])   # "transfer_to_X" → target = "x"
    if is_handoff and target.upper() in allowed_set:
        return target.upper()                           # route to that member

if tool_node_name is not None:
    return tool_node_name                              # run regular tools

return END
```

### Handoff tools are never executed

`SwarmAgent` auto-generates `transfer_to_<name>` functions and injects them into each member's `ToolNode`. When the LLM calls one, the routing function intercepts it and navigates the graph — the tool body never runs. No spurious `tool` role messages appear in the conversation history.

### Mini ReAct loop per member

A member with regular tools gets a dedicated `<NAME>_TOOL` node and a `<NAME>_TOOL → NAME` edge. This gives each member its own tool loop before it decides to hand off or stop.

### `can_handoff_to` semantics

| Value | Behaviour |
|---|---|
| `None` | Can hand off to all other members |
| `["A", "B"]` | Can hand off only to A and B |
| `[]` | Terminal — no handoffs; always routes to END |

### Per-member independence

Each member is a fully configured `Agent` instance. Members can use different models, tools, memory, skills, retry config, or multimodal settings. `SwarmAgent` only wires the graph and injects handoff tools; it does not constrain per-member configuration.

---

## `SwarmMemberConfig` fields

| Field | Type | Default | Description |
|---|---|---|---|
| `agent` | `BaseAgent` | required | Pre-built agent instance — do not add handoff tools manually |
| `can_handoff_to` | `list[str] \| None` | `None` | Allowed targets; `None` = all other members |
| `description` | `str` | `""` | Injected into other members' handoff tool docstrings so the LLM knows when to route here |

---

## `SwarmAgent` Constructor Parameters

| Parameter | Type | Description |
|---|---|---|
| `members` | `dict[str, SwarmMemberConfig]` | Mapping of node names to member configs (UPPER-CASE recommended) |
| `entry` | `str` | Name of the member that receives the first message |
| `state` | `AgentState \| None` | Optional custom state subclass |
| `context_manager` | `BaseContextManager \| None` | Optional custom context-trimming manager |
| `publisher` | `BasePublisher \| None` | Optional event publisher for streaming |
| `id_generator` | `BaseIDGenerator` | ID generation strategy |
| `container` | `InjectQ \| None` | Dependency injection container |

---

## `compile()` Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `checkpointer` | `BaseCheckpointer` | `None` | Persist and restore conversation state |
| `store` | `BaseStore` | `None` | Long-term cross-thread storage |
| `interrupt_before` | `list[str]` | `None` | Pause before the named nodes |
| `interrupt_after` | `list[str]` | `None` | Pause after the named nodes |
| `callback_manager` | `CallbackManager` | default | Lifecycle hooks |
| `media_store` | `BaseMediaStore` | `None` | Binary/media file storage |
| `shutdown_timeout` | `float` | `30.0` | Seconds to wait for clean shutdown |

---

## Full Code

### Three-member research swarm

```python
import asyncio
from dotenv import load_dotenv
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import SwarmAgent
from agentflow.prebuilt.agent.swarm import SwarmMemberConfig
from agentflow.prebuilt.tools import fetch_url, google_web_search
from agentflow.core.state import Message

load_dotenv()


def draft_report(topic: str, facts: str) -> str:
    """Draft a structured report from gathered facts."""
    return f"# Report: {topic}\n\n{facts}"


triage_agent = Agent(
    model="gpt-4o-mini",
    provider="openai",
    system_prompt=[{
        "role": "system",
        "content": (
            "You are a triage agent. Decide whether the task needs research "
            "or can go directly to the writer. Route accordingly."
        ),
    }],
)

researcher_agent = Agent(
    model="gpt-4o",
    provider="openai",
    tool_node=ToolNode([fetch_url, google_web_search]),
    system_prompt=[{
        "role": "system",
        "content": "You are a research specialist. Gather facts and hand off to the writer.",
    }],
)

writer_agent = Agent(
    model="gpt-4o-mini",
    provider="openai",
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
            description="Gathers facts from the web. Use for research tasks.",
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


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message(
            "Write a brief report on quantum computing progress in 2024."
        )]},
        config={"thread_id": "swarm-1"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### Two-member swarm (no triage)

When every member can hand off to every other, omit `can_handoff_to` (defaults to `None` = all others):

```python
import asyncio
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import SwarmAgent
from agentflow.prebuilt.agent.swarm import SwarmMemberConfig
from agentflow.prebuilt.tools import google_web_search, safe_calculator
from agentflow.core.state import Message

researcher = Agent(
    model="gpt-4o-mini",
    provider="openai",
    tool_node=ToolNode([google_web_search]),
    system_prompt=[{"role": "system", "content": "Research topics and hand off to analyst when done."}],
)

analyst = Agent(
    model="gpt-4o-mini",
    provider="openai",
    tool_node=ToolNode([safe_calculator]),
    system_prompt=[{"role": "system", "content": "Analyse data and produce a final answer."}],
)

swarm = SwarmAgent(
    members={
        "RESEARCHER": SwarmMemberConfig(
            agent=researcher,
            description="Searches the web for facts.",
        ),
        "ANALYST": SwarmMemberConfig(
            agent=analyst,
            description="Runs calculations and produces the final answer.",
        ),
    },
    entry="RESEARCHER",
)

app = swarm.compile()


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("What is the GDP of Germany in USD? Convert at today's rate.")]},
        config={"thread_id": "two-member-1"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### With a checkpointer (persistent conversations)

```python
import asyncio
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import SwarmAgent
from agentflow.prebuilt.agent.swarm import SwarmMemberConfig
from agentflow.storage.checkpointer import PostgresCheckpointer
from agentflow.prebuilt.tools import google_web_search
from agentflow.core.state import Message

triage = Agent(model="gpt-4o-mini", provider="openai",
               system_prompt=[{"role": "system", "content": "Route requests."}])
researcher = Agent(model="gpt-4o-mini", provider="openai",
                   tool_node=ToolNode([google_web_search]),
                   system_prompt=[{"role": "system", "content": "Research and answer."}])

swarm = SwarmAgent(
    members={
        "TRIAGE": SwarmMemberConfig(triage, can_handoff_to=["RESEARCHER"],
                                    description="Routes requests."),
        "RESEARCHER": SwarmMemberConfig(researcher, description="Researches the topic."),
    },
    entry="TRIAGE",
)

checkpointer = PostgresCheckpointer(dsn="postgresql://user:pass@localhost/db")
app = swarm.compile(checkpointer=checkpointer)


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("Who won the 2024 Nobel Prize in Physics?")]},
        config={"thread_id": "user-99-session-1"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### Google Gemini members

Each member can use a different provider independently:

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import SwarmAgent
from agentflow.prebuilt.agent.swarm import SwarmMemberConfig
from agentflow.prebuilt.tools import google_web_search

researcher = Agent(
    model="google/gemini-2.5-flash",
    provider="google",
    tool_node=ToolNode([google_web_search]),
    system_prompt=[{"role": "system", "content": "Research and hand off to writer."}],
    trim_context=True,
)

writer = Agent(
    model="gpt-4o-mini",
    provider="openai",
    system_prompt=[{"role": "system", "content": "Write the final answer."}],
)

swarm = SwarmAgent(
    members={
        "RESEARCHER": SwarmMemberConfig(researcher, can_handoff_to=["WRITER"],
                                        description="Researches the topic."),
        "WRITER": SwarmMemberConfig(writer, can_handoff_to=[],
                                    description="Writes the final document."),
    },
    entry="RESEARCHER",
)

app = swarm.compile()
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
    provider="openai",
    system_prompt=[{"role": "system", "content": "Route requests to researcher or writer."}],
)
researcher = Agent(
    model="gpt-4o-mini",
    provider="openai",
    tool_node=ToolNode([google_web_search]),
    system_prompt=[{"role": "system", "content": "Research the topic and hand off to writer."}],
)
writer = Agent(
    model="gpt-4o-mini",
    provider="openai",
    system_prompt=[{"role": "system", "content": "Write the final answer."}],
)

swarm = SwarmAgent(
    members={
        "TRIAGE": SwarmMemberConfig(triage, can_handoff_to=["RESEARCHER", "WRITER"],
                                    description="Routes the task."),
        "RESEARCHER": SwarmMemberConfig(researcher, can_handoff_to=["WRITER"],
                                        description="Researches the topic."),
        "WRITER": SwarmMemberConfig(writer, can_handoff_to=[],
                                    description="Writes the final answer."),
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
