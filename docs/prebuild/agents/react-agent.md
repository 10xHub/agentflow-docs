# ReactAgent

The simplest and most common prebuilt agent pattern: a single LLM that loops through tool calls until it has a final answer.

**Import path:** `agentflow.prebuilt.agent`

---

## Concept

ReAct stands for **Reason + Act**. The model reasons about what to do next, acts by calling a tool, observes the result, then reasons again — repeating until it has enough information to answer.

### The two-node graph

```mermaid
flowchart LR
    START([START]) --> MAIN
    MAIN["MAIN\n(LLM)"]
    TOOL["TOOL\n(ToolNode)"]
    END_NODE([END])

    MAIN -- "has tool calls?" --> TOOL
    MAIN -- "no tool calls" --> END_NODE
    TOOL -- "results appended" --> MAIN
```

- **MAIN** — the LLM receives the full conversation history and either produces a final answer or emits one or more tool-call requests.
- **TOOL** — `ToolNode` executes every requested tool call (in parallel by default) and appends each result as a `tool` role message.
- The loop repeats until MAIN produces a message with no tool calls, at which point the graph exits.

### When there are no tools

If you construct `ReactAgent` without any tools, the graph collapses to a single node with a direct edge to END:

```mermaid
flowchart LR
    START([START]) --> MAIN["MAIN\n(LLM)"] --> END_NODE([END])
```

### Routing logic

The conditional edge is a single predicate — `_should_use_tools` — that inspects the last message in `state.context`:

```python
def _should_use_tools(state: AgentState) -> str:
    if not state.context:
        return END
    last = state.context[-1]
    if last.role == "assistant" and last.tools_calls:
        return "TOOL"
    return END
```

Nothing else controls the loop. There is no step counter or planner; the LLM decides when it has enough information simply by not emitting any tool calls.

### Parallel tool execution

When the LLM emits multiple tool calls in a single response, `ToolNode` runs all of them concurrently — reducing wall-clock time for independent lookups such as weather in three cities or searching two databases at once.

### Multi-turn memory

`ReactAgent` is stateless by itself. Pass a `checkpointer` to `compile()` and a `thread_id` in config to get persistent, resumable conversations. Each invocation on the same thread picks up exactly where the last one left off.

---

## Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | required | LLM model identifier |
| `provider` | `str` | required | LLM provider (`"openai"`, `"google"`, `"anthropic"`) |
| `tools` | `Iterable[Callable]` | `None` | Tool functions to expose to the LLM |
| `system_prompt` | `list[dict]` | `None` | System-role messages prepended to every turn |
| `output_type` | `str` | `"text"` | `"text"` or `"json"` |
| `reasoning_config` | `dict \| bool` | `True` | Extended-thinking / reasoning configuration |
| `memory` | `MemoryConfig` | `None` | Long-term semantic memory |
| `retry_config` | `Any` | `True` | Retry behavior on LLM errors |
| `fallback_models` | `list` | `None` | Backup models if the primary fails |
| `trim_context` | `bool` | `False` | Trim old messages when context grows long |
| `main_node_name` | `str` | `"MAIN"` | Graph node name for the LLM step |
| `tool_node_name` | `str` | `"TOOL"` | Graph node name for the tool-execution step |
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
from agentflow.prebuilt.agent import ReactAgent
from agentflow.core.state import Message

load_dotenv()


def get_weather(city: str) -> str:
    """Return the current weather for a city."""
    return f"Sunny, 24°C in {city}"


agent = ReactAgent(
    model="gpt-4o-mini",
    provider="openai",
    tools=[get_weather],
    system_prompt=[{
        "role": "system",
        "content": "You are a helpful assistant. Use tools whenever they help you answer.",
    }],
)

app = agent.compile()


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("What is the weather in Paris?")]},
        config={"thread_id": "demo-1"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### With prebuilt tools

```python
from agentflow.prebuilt.agent import ReactAgent
from agentflow.prebuilt.tools import fetch_url, safe_calculator, google_web_search
from agentflow.core.state import Message

agent = ReactAgent(
    model="gpt-4o-mini",
    provider="openai",
    tools=[fetch_url, safe_calculator, google_web_search],
    system_prompt=[{
        "role": "system",
        "content": "You are a helpful assistant with web and math capabilities.",
    }],
)

app = agent.compile()
```

### With a checkpointer (persistent conversations)

```python
import asyncio
from agentflow.prebuilt.agent import ReactAgent
from agentflow.prebuilt.tools import fetch_url
from agentflow.storage.checkpointer import PostgresCheckpointer
from agentflow.core.state import Message

agent = ReactAgent(
    model="gpt-4o-mini",
    provider="openai",
    tools=[fetch_url],
)

checkpointer = PostgresCheckpointer(dsn="postgresql://user:pass@localhost/db")
app = agent.compile(checkpointer=checkpointer)


async def main():
    # First turn
    result = await app.ainvoke(
        {"messages": [Message.text_message("Fetch https://example.com and summarize it")]},
        config={"thread_id": "user-123-session-1"},
    )
    print(result["context"][-1].text())

    # Follow-up turn — picks up the same thread
    result = await app.ainvoke(
        {"messages": [Message.text_message("Now translate that summary to French")]},
        config={"thread_id": "user-123-session-1"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### Streaming

```python
import asyncio
from agentflow.prebuilt.agent import ReactAgent
from agentflow.core.state import Message

agent = ReactAgent(model="gpt-4o-mini", provider="openai")
app = agent.compile()


async def main():
    async for event in app.astream(
        {"messages": [Message.text_message("Explain the ReAct pattern")]},
        config={"thread_id": "stream-1"},
    ):
        print(event)


asyncio.run(main())
```

### Google Gemini

```python
from agentflow.prebuilt.agent import ReactAgent
from agentflow.prebuilt.tools import google_web_search

agent = ReactAgent(
    model="google/gemini-2.5-flash",
    provider="google",
    tools=[google_web_search],
    system_prompt=[{
        "role": "system",
        "content": "You are a helpful assistant with web search capability.",
    }],
    trim_context=True,
)

app = agent.compile()
```

---

## Running with `agentflow play`

**`graph.py`**

```python
from agentflow.prebuilt.agent import ReactAgent
from agentflow.prebuilt.tools import fetch_url, safe_calculator, google_web_search

agent = ReactAgent(
    model="gpt-4o-mini",
    provider="openai",
    tools=[fetch_url, safe_calculator, google_web_search],
    system_prompt=[{
        "role": "system",
        "content": "You are a helpful assistant with web and math capabilities.",
    }],
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
```

**Start the playground:**

```bash
agentflow play
```

This starts the API server on `:8000` and opens the React playground in your browser.
