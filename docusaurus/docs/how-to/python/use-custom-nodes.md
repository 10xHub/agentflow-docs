---
title: How to write custom nodes
sidebar_label: Custom nodes
description: Write graph nodes as plain Python functions without the Agent class. Covers state and config auto-injection, InjectQ service injection, and return types.
keywords:
  - agentflow custom node
  - graph node function
  - state injection
  - config injection
  - injectq node
  - agentflow python
sidebar_position: 2
---

# How to write custom nodes

A graph node does not have to be an `Agent` or a `ToolNode`. Any plain Python function — sync or async — can be registered as a node. This is the lower-level building block for custom logic, pre-processing, routing, side effects, or anything that does not need an LLM call.

---

## Minimal node

```python
from agentflow.core.state import AgentState, Message

def greet(state: AgentState, config: dict) -> dict:
    user_id = config.get("user_id", "stranger")
    return {
        "messages": [Message.text_message(f"Hello, {user_id}!", role="assistant")],
    }
```

Register and wire it like any other node:

```python
from agentflow.core.graph import StateGraph
from agentflow.utils import END

graph = StateGraph()
graph.add_node("greet", greet)
graph.set_entry_point("greet")
graph.add_edge("greet", END)

app = graph.compile()
```

---

## Auto-injected parameters

The runtime inspects the function signature and provides two parameters by name, no import required:

| Parameter | Type | What it contains |
|---|---|---|
| `state` | `AgentState` | The current graph state — messages, context, custom fields. |
| `config` | `dict` | Runtime config: `thread_id`, `user_id`, and any keys you passed to `invoke()`. |

Declare only the ones you need. A node that only reads `config` can omit `state` entirely, and vice versa.

```python
def audit_log(config: dict) -> dict:
    print(f"thread={config['thread_id']} user={config.get('user_id')}")
    return {}
```

```python
def summarize(state: AgentState) -> dict:
    count = len(state.context)
    return {
        "messages": [Message.text_message(f"Conversation has {count} messages.", role="assistant")],
    }
```

---

## Return types

A node function can return any of the following:

| Return value | Effect |
|---|---|
| `str` | Wrapped in `Message.text_message(content, role="assistant")` and appended to state. |
| `Message` | Appended to state as-is. |
| `list[Message \| str]` | Each item is processed individually and appended. |
| `AgentState` | Replaces the current state; new context entries are extracted and recorded as new messages. |
| `Command` | Updates state **and** overrides the next node at runtime (see below). |

```python
from agentflow.core.state import AgentState, Message

# Return a string — wrapped automatically
def node_str(state: AgentState, config: dict) -> str:
    return "Processing complete."

# Return a single Message
def node_msg(state: AgentState, config: dict) -> Message:
    return Message.text_message("done", role="assistant")

# Return a list of messages
def node_list(state: AgentState, config: dict) -> list:
    return [
        Message.text_message("step 1", role="assistant"),
        Message.text_message("step 2", role="assistant"),
    ]

# Return a modified state (custom state fields updated inline)
def node_state(state: AgentState, config: dict) -> AgentState:
    updated = state.model_copy(deep=True)
    updated.metadata["processed"] = True   # requires a custom state with this field
    return updated
```

---

## Calling an LLM yourself

If your node calls an LLM directly you have three options.

**Option 1 — return a `str`:** simplest; the framework wraps it as an assistant message.

```python
import openai

async def call_llm(state: AgentState, config: dict) -> str:
    client = openai.AsyncOpenAI()
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": state.context[-1].text()}],
    )
    return response.choices[0].message.content
```

**Option 2 — build a `Message` yourself:** gives full control over content blocks, role, and metadata.

```python
from agentflow.core.state import Message

async def call_llm_message(state: AgentState, config: dict) -> Message:
    client = openai.AsyncOpenAI()
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": state.context[-1].text()}],
    )
    return Message.text_message(
        response.choices[0].message.content,
        role="assistant",
    )
```

**Option 3 — use `ModelResponseConverter`:** lets you hand the raw SDK response to AgentFlow's built-in converters so tool calls, content blocks, and metadata are normalized automatically.

```python
from agentflow.runtime.adapters.llm.model_response_converter import ModelResponseConverter

async def call_llm_converter(state: AgentState, config: dict) -> ModelResponseConverter:
    client = openai.AsyncOpenAI()
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": state.context[-1].text()}],
    )
    # Pass the raw response and a converter name: "openai", "openai_responses", or "google"
    return ModelResponseConverter(response, converter="openai")
```

The framework awaits `ModelResponseConverter.invoke()` internally and appends the resulting `Message` to state. Use this option when the response contains tool calls or structured content blocks that you want normalized for free.

---

## Requesting framework services via InjectQ

For anything beyond `state` and `config` — checkpointer, store, publisher, context manager, background task manager — use `Inject[T]` as the parameter default. The DI container resolves the dependency automatically at call time.

```python
from injectq import Inject
from agentflow.storage.checkpointer import BaseCheckpointer
from agentflow.storage.store import BaseStore
from agentflow.runtime.publisher import BasePublisher
from agentflow.core.state import AgentState, Message

async def persist_result(
    state: AgentState,
    config: dict,
    checkpointer: BaseCheckpointer = Inject[BaseCheckpointer],
    store: BaseStore = Inject[BaseStore],
    publisher: BasePublisher = Inject[BasePublisher],
) -> dict:
    # checkpointer, store, and publisher are resolved by the container —
    # you never pass them manually.
    await store.aput(
        namespace=("results", config["user_id"]),
        key=config["thread_id"],
        value={"count": len(state.context)},
    )
    return {}
```

### All injectable framework services

| Parameter name | Type | Provided by |
|---|---|---|
| `checkpointer` | `BaseCheckpointer` | `Inject[BaseCheckpointer]` |
| `store` | `BaseStore` | `Inject[BaseStore]` |
| `publisher` | `BasePublisher` | `Inject[BasePublisher]` |
| `context_manager` | `BaseContextManager` | `Inject[BaseContextManager]` |
| `task_manager` | `BackgroundTaskManager` | `Inject[BackgroundTaskManager]` |
| `generated_id` | `str` | `Inject[...]` or `container.try_get("generated_id")` |

The framework registers all of these automatically when `compile()` is called. If a service was not configured (e.g. no store passed to `compile()`), the injected value is `None` — guard accordingly.

For your own services, bind them first:

```python
from injectq import InjectQ, Inject

class Analytics:
    def record(self, event: str, meta: dict) -> None:
        print(f"[analytics] {event}", meta)

InjectQ.get_instance().bind_instance(Analytics, Analytics())

def track(state: AgentState, config: dict, analytics: Analytics = Inject[Analytics]) -> dict:
    analytics.record("node_visited", {"thread": config["thread_id"]})
    return {}
```

See [use-dependency-injection.md](use-dependency-injection.md) for the full DI reference.

---

## Async nodes

Async functions work identically. The runtime awaits them automatically.

```python
import asyncio

async def fetch_context(
    state: AgentState,
    config: dict,
    store: BaseStore = Inject[BaseStore],
) -> dict:
    data = await store.aget(
        namespace=("context", config["user_id"]),
        key="profile",
    )
    if data:
        return {"state": {**state.model_dump(), "profile": data.value}}
    return {}
```

---

## Dynamic routing with Command

Return `Command` when a node must both update state and choose the next node at runtime:

```python
from agentflow.utils import Command, END

def router(state: AgentState, config: dict) -> Command:
    last = state.context[-1].text() if state.context else ""

    if "urgent" in last.lower():
        return Command(update={"priority": "high"}, goto="ESCALATE")

    return Command(goto=END)
```

Use `Command` for exceptional branching. For normal routing, prefer `add_conditional_edges` — it is easier to visualize and test.

---

## Sync vs async — quick reference

```python
# Both are valid.

def sync_node(state: AgentState, config: dict) -> dict:
    return {"messages": [Message.text_message("sync result", role="assistant")]}

async def async_node(state: AgentState, config: dict) -> dict:
    await asyncio.sleep(0)   # any async work here
    return {"messages": [Message.text_message("async result", role="assistant")]}
```

---

## Complete example

```python
import asyncio
from injectq import Inject, InjectQ
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.storage.store import BaseStore
from agentflow.utils import END


# --- Custom node: runs before the agent, enriches state ---
async def load_user_profile(
    state: AgentState,
    config: dict,
    store: BaseStore = Inject[BaseStore],
) -> dict:
    if store is None:
        return {}
    profile = await store.aget(
        namespace=("profiles", config.get("user_id", "anon")),
        key="data",
    )
    if profile:
        # Merge profile into custom state field (requires a custom state with `profile` field)
        return {"profile": profile.value}
    return {}


# --- Custom node: runs after the agent, logs the result ---
def log_response(state: AgentState, config: dict) -> dict:
    last = state.context[-1] if state.context else None
    if last:
        print(f"[{config.get('thread_id')}] assistant: {last.text()}")
    return {}


# --- Standard agent node ---
agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
)

graph = StateGraph()
graph.add_node("LOAD", load_user_profile)
graph.add_node("MAIN", agent)
graph.add_node("LOG", log_response)

graph.set_entry_point("LOAD")
graph.add_edge("LOAD", "MAIN")
graph.add_edge("MAIN", "LOG")
graph.add_edge("LOG", END)

app = graph.compile()

result = app.invoke(
    {"messages": [Message.text_message("Hello!")]},
    config={"thread_id": "demo", "user_id": "user-42"},
)
print(result["messages"][-1].content)
```

---

## What you learned

- Any Python function (sync or async) can be a graph node — no class required.
- The runtime auto-injects `state` and `config` by parameter name.
- Framework services (checkpointer, store, publisher, etc.) are requested via `Inject[T]` defaults.
- Your own services are registered with `InjectQ.get_instance().bind_instance(...)` and injected the same way.
- Return a `str`, `Message`, `list`, `AgentState`, or `Command`.

---

## Agent class vs custom node

Both are valid graph nodes and share the same execution path. The difference is what each handles for you.

| | `Agent` class | Custom node |
|---|---|---|
| **LLM call** | Handled internally | You make the call (or skip it) |
| **Message conversion** | Automatic — raw SDK response normalized to `Message` | Your responsibility; return `str`, `Message`, or `ModelResponseConverter` |
| **Tool call loop** | Built-in — detects tool calls, routes to `ToolNode` | Manual |
| **System prompt** | Declared at construction, supports `{state_field}` interpolation | You compose the prompt |
| **Context trimming** | `trim_context=True` | Manual |
| **Retry / fallback** | `retry_config`, `fallback_models` built in | Manual |
| **Reasoning** | `reasoning_config` for OpenAI and Google | Manual |
| **Multimodal output** | `output_type="image"/"audio"/"video"` | Manual |
| **Skills / memory** | `skills=`, `memory=` built in | Manual |
| **Provider support** | OpenAI, Google, any OpenAI-compatible API | Any provider, any library |
| **InjectQ services** | Not applicable | `Inject[T]` on any parameter |
| **Testing** | Swap with `TestAgent` | Swap the function directly |

### When to use `Agent`

- The node's job is to call an LLM and produce a response.
- You need built-in tool call detection, retry logic, fallback models, or reasoning config.
- You are on OpenAI, Google, or a compatible API and want normalized output without writing a converter.

### When to use a custom node

- **Pre/post-processing** — enrich state, validate input, log output, write to a database.
- **Routing** — inspect state and return `Command` to choose the next node dynamically.
- **Side effects** — publish an event, send a notification, update an external system.
- **Custom LLM integration** — call a provider `Agent` does not support, or apply prompt logic too complex for `system_prompt` interpolation.
- **Non-LLM steps** — retrieve documents, run a calculation, call an external API.

### Quick decision

```
Does this node need to call an LLM?
│
├── Yes
│   ├── Standard provider (OpenAI / Google / compatible)?  →  Agent
│   └── Exotic provider or complex prompt logic?           →  Custom node + ModelResponseConverter
│
└── No  →  Custom node
```

---

## Next steps

- [Dependency injection reference](use-dependency-injection.md) — full guide to InjectQ bindings.
- [Build a graph](build-a-graph.md) — wire custom nodes into a full workflow.
- [Configure Agent](configure-agent.md) — all `Agent` constructor options.
- [Callbacks and Command](../../concepts/callbacks-and-command.md) — observe, validate, and intercept node execution.
