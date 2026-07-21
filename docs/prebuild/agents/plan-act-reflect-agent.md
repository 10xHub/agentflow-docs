# PlanActReflectAgent

A self-improving agent that plans before acting, then critically evaluates its own work before deciding whether to iterate or stop.

**Import path:** `agentflow.prebuilt.agent`

---

## Concept

Standard ReAct loops can get stuck or produce incomplete answers because there is no explicit evaluation step. The Plan→Act→Reflect pattern adds a dedicated critic that inspects all work done so far and decides: is the task finished, or should we plan again?

### The full graph

```mermaid
flowchart TD
    START([START]) --> PLAN

    PLAN["PLAN\n(LLM + tools)"]
    ACT["ACT\n(ToolNode)"]
    REFLECT["REFLECT\n(LLM, no tools)"]
    INC["INCREMENT_ITERATIONS"]
    END_NODE([END])

    PLAN -- "has tool calls" --> ACT
    PLAN -- "no tool calls" --> REFLECT
    ACT --> REFLECT
    REFLECT -- "[DONE] or max_iterations reached" --> END_NODE
    REFLECT -- "not done" --> INC
    INC --> PLAN
```

Three separate `Agent` instances run inside the graph:

| Node | Role | Sees tools? |
|---|---|---|
| **PLAN** | Breaks the task into steps; emits tool calls or direct text | Yes |
| **ACT** | `ToolNode` — runs all tool calls in parallel | n/a |
| **REFLECT** | Reviews progress; decides done or iterate | No |

### When there are no tools

Without tools, PLAN always routes directly to REFLECT, skipping ACT entirely:

```mermaid
flowchart TD
    START([START]) --> PLAN["PLAN\n(LLM)"]
    PLAN --> REFLECT["REFLECT\n(LLM)"]
    REFLECT -- "[DONE] or max_iterations" --> END_NODE([END])
    REFLECT -- "not done" --> INC["INCREMENT_ITERATIONS"] --> PLAN
```

### Routing at PLAN

```python
def _route(state: AgentState) -> str:
    last = state.context[-1]
    if has_tools and last.role == "assistant" and last.tools_calls:
        return "ACT"
    return "REFLECT"
```

If the planner's last message contains tool calls it goes to ACT; otherwise it goes straight to REFLECT.

### Routing at REFLECT

```python
def _route(state: AgentState) -> str:
    iterations = state.execution_meta.internal_data.get("par_iterations", 0)
    if iterations >= max_iterations:
        return END                   # hard cap
    if "[done]" in last.text().lower():
        return END                   # reflector signalled completion
    return "INCREMENT_ITERATIONS"    # iterate
```

Two ways to exit: the reflector writes `[DONE]` anywhere in its response, or the iteration counter hits `max_iterations`. Otherwise `INCREMENT_ITERATIONS` bumps the counter and routes back to PLAN.

### Reflect filter

Tool result messages (`role="tool"`) are hidden from the reflector. Long tool outputs can overflow context quickly; the planner still sees them on the next PLAN step. The original context is restored after REFLECT returns.

### Default system prompts

**PLAN** — "break the task into clear, actionable steps; call tools when needed; be concise."

**REFLECT** — "evaluate completeness; if done, summarize and emit `[DONE]`; if not, list gaps and give guidance for the next step."

Both are fully overridable via `plan_system_prompt` and `reflect_system_prompt`.

---

## Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | required | LLM model for all three internal agents |
| `provider` | `str` | required | LLM provider (`"openai"`, `"google"`, `"anthropic"`) |
| `tools` | `Iterable[Callable]` | `None` | Tools available to the PLAN agent |
| `max_iterations` | `int` | `3` | Maximum PLAN→ACT→REFLECT cycles |
| `plan_system_prompt` | `list[dict]` | built-in | Override the planner system prompt |
| `reflect_system_prompt` | `list[dict]` | built-in | Override the reflector system prompt |
| `reasoning_config` | `dict \| bool` | `True` | Applied to all inner agents |
| `memory` | `MemoryConfig` | `None` | Long-term memory (applied to all agents) |
| `retry_config` | `Any` | `True` | Retry behaviour |
| `fallback_models` | `list` | `None` | Backup models if primary fails |
| `trim_context` | `bool` | `False` | Trim old messages when context grows long |
| `client` | `Any` | `None` | FastMCP client for MCP-hosted tools |

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

### Minimal example

```python
import asyncio
from dotenv import load_dotenv
from agentflow.prebuilt.agent import PlanActReflectAgent
from agentflow.prebuilt.tools import fetch_url, google_web_search
from agentflow.core.state import Message

load_dotenv()


def summarize_findings(text: str) -> str:
    """Compress a long text to key points."""
    return text[:2000] + "..." if len(text) > 2000 else text


agent = PlanActReflectAgent(
    model="gpt-4o-mini",
    provider="openai",
    tools=[fetch_url, google_web_search, summarize_findings],
    max_iterations=4,
)

app = agent.compile()


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message(
            "Research the current state of fusion energy and write a 3-paragraph summary."
        )]},
        config={"thread_id": "research-1"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### With custom system prompts

```python
from agentflow.prebuilt.agent import PlanActReflectAgent
from agentflow.prebuilt.tools import fetch_url, google_web_search

agent = PlanActReflectAgent(
    model="gpt-4o",
    provider="openai",
    tools=[fetch_url, google_web_search],
    max_iterations=5,
    plan_system_prompt=[{
        "role": "system",
        "content": "You are a systematic researcher. Break each task into numbered steps.",
    }],
    reflect_system_prompt=[{
        "role": "system",
        "content": (
            "Review the work done. Is the research complete and accurate? "
            "If yes, write a summary and end with [DONE]. "
            "If not, list exactly what is still missing."
        ),
    }],
)
```

### No tools (pure reasoning loop)

Without tools, PLAN always routes to REFLECT directly. Useful for multi-step reasoning tasks that do not need external data:

```python
import asyncio
from agentflow.prebuilt.agent import PlanActReflectAgent
from agentflow.core.state import Message

agent = PlanActReflectAgent(
    model="gpt-4o-mini",
    provider="openai",
    max_iterations=3,
)

app = agent.compile()


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("Devise three approaches to reduce LLM hallucination.")]},
        config={"thread_id": "reason-1"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### With a checkpointer (persistent conversations)

```python
import asyncio
from agentflow.prebuilt.agent import PlanActReflectAgent
from agentflow.prebuilt.tools import fetch_url, google_web_search
from agentflow.storage.checkpointer import PgCheckpointer
from agentflow.core.state import Message

agent = PlanActReflectAgent(
    model="gpt-4o-mini",
    provider="openai",
    tools=[fetch_url, google_web_search],
    max_iterations=4,
)

checkpointer = PgCheckpointer(postgres_dsn="postgresql://user:pass@localhost/db")
app = agent.compile(checkpointer=checkpointer)


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("Research recent breakthroughs in solid-state batteries.")]},
        config={"thread_id": "user-42-research"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### Google Gemini

```python
from agentflow.prebuilt.agent import PlanActReflectAgent
from agentflow.prebuilt.tools import google_web_search

agent = PlanActReflectAgent(
    model="google/gemini-2.5-flash",
    provider="google",
    tools=[google_web_search],
    max_iterations=4,
    trim_context=True,
)

app = agent.compile()
```

### Streaming

```python
import asyncio
from agentflow.prebuilt.agent import PlanActReflectAgent
from agentflow.core.state import Message

agent = PlanActReflectAgent(
    model="gpt-4o-mini",
    provider="openai",
    max_iterations=3,
)
app = agent.compile()


async def main():
    async for event in app.astream(
        {"messages": [Message.text_message("Explain the trade-offs between RAG and fine-tuning.")]},
        config={"thread_id": "stream-1"},
    ):
        print(event)


asyncio.run(main())
```

---

## Running with `agentflow play`

**`graph.py`**

```python
from agentflow.prebuilt.agent import PlanActReflectAgent
from agentflow.prebuilt.tools import fetch_url, google_web_search, safe_calculator

agent = PlanActReflectAgent(
    model="gpt-4o-mini",
    provider="openai",
    tools=[fetch_url, google_web_search, safe_calculator],
    max_iterations=4,
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

**`.env`**

```
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
```

```bash
agentflow play
```
