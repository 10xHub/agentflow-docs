# ReactAgent

The simplest and most common prebuilt agent pattern: a single LLM that loops through tool calls until it has a final answer.

**Import path:** `agentflow.prebuilt.agent`

---

## Concept

The ReAct (Reason + Act) pattern is a tight loop:

```
MAIN ──[has tool calls?]──> TOOL ──> MAIN
     ──[no tool calls]────> END
```

1. **MAIN** — the LLM receives the conversation and either produces a final answer or emits one or more tool calls.
2. **TOOL** — the `ToolNode` executes each tool call (in parallel by default) and appends the results to the conversation.
3. The loop repeats until the LLM produces a message with no tool calls.

`ReactAgent` encapsulates this two-node graph so you never have to wire it manually. Pass a model name and a list of tool functions — it handles the rest.

---

## Code Explanation

### `ReactAgent.__init__`

The constructor accepts:
- `model` — LLM model identifier (e.g. `"gpt-4o-mini"`, `"gemini-2.5-flash"`)
- `tools` — iterable of callable tool functions
- `system_prompt` — list of message dicts; the LLM's persona and instructions
- `main_node_name` / `tool_node_name` — rename the graph nodes (useful when composing graphs)
- All standard `Agent` kwargs: `reasoning_config`, `memory`, `skills`, `retry_config`, `fallback_models`, etc.

Internally it creates:
- An `Agent` instance wrapping the LLM call
- A `ToolNode` from the provided tools
- A `StateGraph` (wired lazily on `compile()`)

### `_should_use_tools` routing

```python
def _should_use_tools(state: AgentState) -> str:
    last = state.context[-1]
    if last.role == "assistant" and last.tools_calls:
        return "TOOL"
    return END
```

This conditional edge function is the only routing logic: if the last assistant message contains tool calls, go to TOOL; otherwise end.

### `compile()`

Wires the graph, attaches a checkpointer and/or store, and returns a `CompiledGraph` that you invoke with `ainvoke` or `astream`.

---

## Full Code

```python
from agentflow.prebuilt.agent import ReactAgent
from agentflow.prebuilt.tools import fetch_url, safe_calculator


def get_weather(city: str) -> str:
    """Return the current weather for a city."""
    # replace with a real weather API call
    return f"Sunny, 24°C in {city}"


agent = ReactAgent(
    model="gpt-4o-mini",
    tools=[get_weather, fetch_url, safe_calculator],
    system_prompt=[{
        "role": "system",
        "content": (
            "You are a helpful assistant. "
            "Use tools whenever they help you answer the user's question."
        ),
    }],
)

app = agent.compile()
```

### With a checkpointer (persistent conversations)

```python
from agentflow.storage.checkpointer import PostgresCheckpointer

checkpointer = PostgresCheckpointer(dsn="postgresql://user:pass@localhost/db")

app = agent.compile(checkpointer=checkpointer)

result = await app.ainvoke(
    {"message": "What is the weather in Paris?"},
    config={"thread_id": "user-123-session-1"},
)
print(result["context"][-1].text())
```

### Streaming

```python
async for event in app.astream(
    {"message": "Fetch https://example.com and summarize it"},
    config={"thread_id": "t1"},
):
    print(event)
```

---

## Running with `agentflow play`

Create a project file and config, then launch the playground.

**`graph.py`**

```python
from agentflow.prebuilt.agent import ReactAgent
from agentflow.prebuilt.tools import fetch_url, safe_calculator, google_web_search

agent = ReactAgent(
    model="gpt-4o-mini",
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

---

## Key Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | required | LLM model identifier |
| `tools` | `Iterable[Callable]` | `None` | Tool functions to expose |
| `system_prompt` | `list[dict]` | `None` | System prompt messages |
| `output_type` | `str` | `"text"` | `"text"` or `"json"` |
| `reasoning_config` | `dict \| bool` | `True` | Reasoning/thinking configuration |
| `memory` | `MemoryConfig` | `None` | Long-term memory configuration |
| `retry_config` | `Any` | `True` | Retry behaviour on LLM errors |
| `fallback_models` | `list` | `None` | Backup models if primary fails |
| `main_node_name` | `str` | `"MAIN"` | Name of the agent node in the graph |
| `tool_node_name` | `str` | `"TOOL"` | Name of the tool node in the graph |
