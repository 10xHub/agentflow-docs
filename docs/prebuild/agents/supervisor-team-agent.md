# SupervisorTeamAgent

A centralized multi-agent pattern where a dedicated supervisor LLM decides which specialist worker to invoke next.

**Import path:** `agentflow.prebuilt.agent`

---

## Concept

Where a swarm has agents routing to each other directly, a supervisor pattern has a single coordinator that controls all routing decisions:

```
SUPERVISOR ──[pick RESEARCHER]──> RESEARCHER ──> PRE_SUPERVISOR ──> SUPERVISOR
           ──[pick CODER]──────> CODER ────────> PRE_SUPERVISOR ──> SUPERVISOR
           ──[FINISH]──────────> END
```

The SUPERVISOR agent's only job is to output a single word — either the name of the next worker or `FINISH`. Workers complete their task (optionally with tools) and return to the supervisor via a `PRE_SUPERVISOR` increment node that tracks round count.

This pattern works well when:
- The task requires expertise from multiple specialists
- The order of delegation should depend on prior results
- You want centralized control and visibility into routing decisions

---

## Code Explanation

### Auto-generated supervisor prompt

`SupervisorTeamAgent` builds a system prompt from the worker registry:

```
Available workers:
- RESEARCHER: Searches the web for factual information.
- CODER: Writes and runs Python code.
- FINISH: All tasks fully completed.

Respond with only the name of the next worker, or FINISH.
```

You can override this completely with `supervisor_system_prompt`.

### `PRE_SUPERVISOR` node

Before the supervisor runs again, a lightweight `PRE_SUPERVISOR` node increments `state.execution_meta.internal_data["sta_rounds"]`. The supervisor's routing function checks this counter against `max_rounds` to enforce the hard cap.

### Supervisor routing

`_make_supervisor_route` extracts the supervisor's text response (strips punctuation, uppercases) and:
1. If `max_rounds` reached → END
2. If response contains `FINISH` → END
3. If response matches a worker name (word-boundary regex) → route to that worker
4. Unrecognizable response → END (with a warning log)

### Worker tool loops

Each worker that has tools gets a mini react-loop (`WORKER → WORKER_TOOL → WORKER`) so workers can call tools before returning to the supervisor.

### `WorkerConfig`

```python
@dataclass
class WorkerConfig:
    agent: BaseAgent   # fully configured Agent instance
    description: str   # injected into supervisor's system prompt
```

---

## Full Code

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import SupervisorTeamAgent
from agentflow.prebuilt.agent.supervisor_team import WorkerConfig
from agentflow.prebuilt.tools import google_web_search


def run_python(code: str) -> str:
    """Execute Python code and return the output (use a real sandbox in production)."""
    import io, contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        exec(code, {})  # noqa: S102
    return buf.getvalue()


agent = SupervisorTeamAgent(
    supervisor_model="gpt-4o",
    workers={
        "RESEARCHER": WorkerConfig(
            agent=Agent(
                model="gpt-4o-mini",
                tool_node=ToolNode([google_web_search]),
            ),
            description="Searches the web and returns factual information.",
        ),
        "CODER": WorkerConfig(
            agent=Agent(
                model="gpt-4o",
                tool_node=ToolNode([run_python]),
            ),
            description="Writes and executes Python code to solve computational problems.",
        ),
    },
    max_rounds=8,
)

app = agent.compile()

result = await app.ainvoke(
    {
        "message": (
            "Find the current price of Bitcoin, then write Python code to calculate "
            "how much $1000 would be worth if BTC doubles."
        )
    },
    config={"thread_id": "supervisor-1"},
)
print(result["context"][-1].text())
```

### With a custom supervisor prompt

```python
agent = SupervisorTeamAgent(
    supervisor_model="gpt-4o",
    workers={...},
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
    workers={
        "RESEARCHER": WorkerConfig(
            agent=Agent(model="gpt-4o-mini", tool_node=ToolNode([google_web_search])),
            description="Searches the web for facts.",
        ),
        "CALCULATOR": WorkerConfig(
            agent=Agent(model="gpt-4o-mini", tool_node=ToolNode([safe_calculator])),
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

---

## Key Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `supervisor_model` | `str` | required | LLM model for the supervisor agent |
| `workers` | `dict[str, WorkerConfig]` | required | Worker registry (name → config) |
| `supervisor_system_prompt` | `list[dict] \| None` | auto-generated | Override the supervisor prompt |
| `max_rounds` | `int` | `10` | Maximum supervisor→worker delegations |
| `state` | `AgentState \| None` | `None` | Optional custom state |
| `publisher` | `BasePublisher \| None` | `None` | Event publisher |
| `container` | `InjectQ \| None` | `None` | DI container |
| `**supervisor_kwargs` | `Any` | — | Extra kwargs forwarded to the supervisor `Agent` |

### `WorkerConfig` fields

| Field | Type | Description |
|---|---|---|
| `agent` | `BaseAgent` | Pre-built agent instance |
| `description` | `str` | Description injected into the supervisor's system prompt |
