# SupervisorTeamAgent

A centralized multi-agent pattern where a dedicated supervisor LLM decides which specialist worker to invoke next.

**Import path:** `agentflow.prebuilt.agent`

---

## Concept

Where a swarm has agents routing to each other directly, a supervisor pattern has a single coordinator that controls every routing decision. The supervisor's only job is to output a single word — the next worker's name, or `FINISH`.

### Full graph — two-worker example

```mermaid
flowchart TD
    START([START]) --> SUPERVISOR

    SUPERVISOR["SUPERVISOR\n(LLM — outputs one word)"]
    PRE_SUPERVISOR["PRE_SUPERVISOR\n(increment rounds)"]
    RESEARCHER["RESEARCHER\n(LLM + tools)"]
    RESEARCHER_TOOL["RESEARCHER_TOOL\n(ToolNode)"]
    CODER["CODER\n(LLM + tools)"]
    CODER_TOOL["CODER_TOOL\n(ToolNode)"]
    END_NODE([END])

    SUPERVISOR -- "RESEARCHER" --> RESEARCHER
    SUPERVISOR -- "CODER" --> CODER
    SUPERVISOR -- "FINISH or max_rounds" --> END_NODE

    RESEARCHER -- "regular tool call" --> RESEARCHER_TOOL
    RESEARCHER -- "done" --> PRE_SUPERVISOR
    RESEARCHER_TOOL --> RESEARCHER

    CODER -- "regular tool call" --> CODER_TOOL
    CODER -- "done" --> PRE_SUPERVISOR
    CODER_TOOL --> CODER

    PRE_SUPERVISOR --> SUPERVISOR
```

### Worker without tools

A worker that has no tools routes directly back to `PRE_SUPERVISOR` after its LLM call:

```mermaid
flowchart LR
    SUPERVISOR["SUPERVISOR"] -- "WRITER" --> WRITER["WRITER\n(LLM, no tools)"]
    WRITER --> PRE_SUPERVISOR["PRE_SUPERVISOR"] --> SUPERVISOR
    SUPERVISOR -- "FINISH" --> END_NODE([END])
```

### Auto-generated supervisor prompt

`SupervisorTeamAgent` builds the supervisor's system prompt automatically from the worker registry:

```
Available workers:
- RESEARCHER: Searches the web for factual information.
- CODER: Writes and runs Python code.
- FINISH: All tasks fully completed.

Respond with only the name of the next worker, or FINISH.
Rules:
- Respond with a single word — exactly one worker name or FINISH.
- Do NOT explain your choice.
- Do NOT include any other text.
```

Override this entirely with `supervisor_system_prompt`.

### Supervisor routing logic

```python
def _route(state: AgentState) -> str:
    rounds = state.execution_meta.internal_data.get("sta_rounds", 0)

    if rounds >= max_rounds:
        return END                              # hard cap

    raw = last.text().strip().upper()

    if "FINISH" in raw:
        return END                              # task complete

    for name in worker_names:
        if re.search(rf"\b{re.escape(name)}\b", raw):
            return name                         # delegate to worker

    return END                                  # unrecognized — terminate
```

Word-boundary regex prevents `"CODE"` from matching a worker named `"CODER"`. An unrecognized response logs a warning and terminates rather than looping forever.

### `PRE_SUPERVISOR` node

Every time a worker finishes, it routes to `PRE_SUPERVISOR` — a lightweight node that increments `execution_meta.internal_data["sta_rounds"]` — before handing back to the supervisor. This keeps the hard-cap check simple and decoupled from the worker logic.

### Mini ReAct loop per worker

Each worker that has tools gets `WORKER → WORKER_TOOL → WORKER` wired automatically, giving the worker its own tool loop before it returns to the supervisor.

---

## `WorkerConfig` fields

| Field | Type | Default | Description |
|---|---|---|---|
| `agent` | `BaseAgent` | required | Pre-built agent instance, configured independently |
| `description` | `str` | `""` | Injected into the supervisor's system prompt so the LLM knows when to delegate here |

---

## Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `supervisor_model` | `str` | required | LLM model for the supervisor agent |
| `workers` | `dict[str, WorkerConfig]` | required | Worker registry — name → config (UPPER-CASE recommended) |
| `supervisor_system_prompt` | `list[dict] \| None` | auto-generated | Override the supervisor prompt |
| `max_rounds` | `int` | `10` | Maximum supervisor→worker delegations before terminating |
| `state` | `AgentState \| None` | `None` | Optional custom state subclass |
| `context_manager` | `BaseContextManager \| None` | `None` | Optional custom context manager |
| `publisher` | `BasePublisher \| None` | `None` | Event publisher for streaming |
| `container` | `InjectQ \| None` | `None` | Dependency injection container |
| `**supervisor_kwargs` | `Any` | — | Forwarded to the supervisor `Agent` only (e.g. `provider`, `temperature`) |

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

### Two-worker team (researcher + coder)

```python
import asyncio
from dotenv import load_dotenv
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import SupervisorTeamAgent
from agentflow.prebuilt.agent.supervisor_team import WorkerConfig
from agentflow.prebuilt.tools import google_web_search
from agentflow.core.state import Message

load_dotenv()


def run_python(code: str) -> str:
    """Execute Python code and return stdout (use a real sandbox in production)."""
    import io, contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        exec(code, {})  # noqa: S102
    return buf.getvalue()


agent = SupervisorTeamAgent(
    supervisor_model="gpt-4o",
    provider="openai",               # forwarded to the supervisor Agent
    workers={
        "RESEARCHER": WorkerConfig(
            agent=Agent(
                model="gpt-4o-mini",
                provider="openai",
                tool_node=ToolNode([google_web_search]),
                system_prompt=[{"role": "system",
                                "content": "Search the web and return factual results."}],
            ),
            description="Searches the web and returns factual information.",
        ),
        "CODER": WorkerConfig(
            agent=Agent(
                model="gpt-4o",
                provider="openai",
                tool_node=ToolNode([run_python]),
                system_prompt=[{"role": "system",
                                "content": "Write and run Python code to solve problems."}],
            ),
            description="Writes and executes Python code to solve computational problems.",
        ),
    },
    max_rounds=8,
)

app = agent.compile()


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message(
            "Find the current price of Bitcoin, then calculate how much $1000 "
            "would be worth if BTC doubles."
        )]},
        config={"thread_id": "supervisor-1"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### With a custom supervisor prompt

```python
from agentflow.prebuilt.agent import SupervisorTeamAgent
from agentflow.prebuilt.agent.supervisor_team import WorkerConfig

agent = SupervisorTeamAgent(
    supervisor_model="gpt-4o",
    provider="openai",
    workers={
        "RESEARCHER": WorkerConfig(agent=..., description="..."),
        "CODER": WorkerConfig(agent=..., description="..."),
    },
    supervisor_system_prompt=[{
        "role": "system",
        "content": (
            "You manage a RESEARCHER and CODER. "
            "Always research before coding. "
            "Respond with only one word: RESEARCHER, CODER, or FINISH."
        ),
    }],
    max_rounds=6,
)
```

### With a checkpointer (persistent conversations)

```python
import asyncio
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import SupervisorTeamAgent
from agentflow.prebuilt.agent.supervisor_team import WorkerConfig
from agentflow.storage.checkpointer import PostgresCheckpointer
from agentflow.prebuilt.tools import google_web_search, safe_calculator
from agentflow.core.state import Message

agent = SupervisorTeamAgent(
    supervisor_model="gpt-4o-mini",
    provider="openai",
    workers={
        "RESEARCHER": WorkerConfig(
            agent=Agent(model="gpt-4o-mini", provider="openai",
                        tool_node=ToolNode([google_web_search])),
            description="Searches the web for facts.",
        ),
        "CALCULATOR": WorkerConfig(
            agent=Agent(model="gpt-4o-mini", provider="openai",
                        tool_node=ToolNode([safe_calculator])),
            description="Performs arithmetic and numeric calculations.",
        ),
    },
    max_rounds=6,
)

checkpointer = PostgresCheckpointer(dsn="postgresql://user:pass@localhost/db")
app = agent.compile(checkpointer=checkpointer)


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message(
            "What is the compound interest on $5000 at 7% over 10 years?"
        )]},
        config={"thread_id": "user-10-finance"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### Google Gemini supervisor with OpenAI workers

`**supervisor_kwargs` goes to the supervisor only — each worker `Agent` is configured independently:

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import SupervisorTeamAgent
from agentflow.prebuilt.agent.supervisor_team import WorkerConfig
from agentflow.prebuilt.tools import google_web_search

agent = SupervisorTeamAgent(
    supervisor_model="google/gemini-2.5-flash",
    provider="google",                    # supervisor uses Gemini
    workers={
        "RESEARCHER": WorkerConfig(
            agent=Agent(
                model="gpt-4o-mini",
                provider="openai",        # worker uses OpenAI
                tool_node=ToolNode([google_web_search]),
            ),
            description="Researches topics on the web.",
        ),
    },
    max_rounds=5,
)
```

---

## Running with `agentflow play`

**`graph.py`**

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import SupervisorTeamAgent
from agentflow.prebuilt.agent.supervisor_team import WorkerConfig
from agentflow.prebuilt.tools import google_web_search, safe_calculator

agent = SupervisorTeamAgent(
    supervisor_model="gpt-4o-mini",
    provider="openai",
    workers={
        "RESEARCHER": WorkerConfig(
            agent=Agent(model="gpt-4o-mini", provider="openai",
                        tool_node=ToolNode([google_web_search])),
            description="Searches the web for facts.",
        ),
        "CALCULATOR": WorkerConfig(
            agent=Agent(model="gpt-4o-mini", provider="openai",
                        tool_node=ToolNode([safe_calculator])),
            description="Performs arithmetic and numeric calculations.",
        ),
    },
    max_rounds=6,
)

app = agent.compile()
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
