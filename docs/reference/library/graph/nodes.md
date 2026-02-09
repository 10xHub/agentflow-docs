# Nodes & Return Types

Nodes are the executable units of a Agentflow graph. Each node is a Python function (sync or async) that receives
state, optional config, and any number of injected dependencies. Its return value determines how the graph proceeds.

---

## Signature Anatomy

```python
from injectq import Inject
from agentflow.state import AgentState
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.utils.command import Command
from agentflow.adapters.llm.model_response_converter import ModelResponseConverter


async def planner(
        state: AgentState,
        config: dict,
        checkpointer: InMemoryCheckpointer = Inject[InMemoryCheckpointer],
) -> list:
    # read from state
    # maybe store something
    return []
```

Rules:

- First param is always `state` (subclass of `AgentState` allowed)
- Second (optional) is `config` (dict passed through `invoke()`)
- Additional params may be injected using `Inject[Type]`
- Type hints are recommended but not mandatory

---

## Supported Return Types

| Return Type | Meaning | Handling |
|-------------|---------|----------|
| `list[Message]` | Append messages to state context | Messages merged in order |
| `AgentState` | Replace/merge overall state | Fields merged; missing fields preserved |
| `Command` | Inline control flow + update | Processes `update`, then jumps to `goto` |
| `ModelResponseConverter` | Deferred LLM normalisation | Converted to `Message`(s) (stream or single) |
| `None` | No-op | Execution proceeds to next edge |
| `Message` (single) | Convenience | Wrapped into list internally |
| `str` | Convenience | Wrapped into `Message.text_message` |

Avoid returning complex nested structures—wrap them into messages or attach to custom state fields.

---

## Command for Inline Routing

```python
from agentflow.utils import END
from agentflow.utils.command import Command


def router(state, config):
    last = state.context[-1].text() if state.context else ""
    if "quit" in last:
        return Command(update="Goodbye!", goto=END)
    if "weather" in last:
        return Command(goto="WEATHER")
    return [Message.text_message("Ask about weather or say quit.")]
```

Use `Command` when runtime state drives a jump not expressible as a static conditional edge.

---

## Dependency Injection in Nodes

Injected services come from the DI container bound at compile time. Common examples:

```python
async def enrich(
    state: AgentState,
    config: dict,
    store: BaseStore = Inject[BaseStore],
    checkpointer: BaseCheckpointer = Inject[BaseCheckpointer],
    publisher: BasePublisher = Inject[BasePublisher],
):
    await publisher.publish_event(...)
    await checkpointer.aset(config, state)
    return state
```

You can inject primitives if registered (`container["temperature"] = 0.2` → `temperature: float = Inject[float]`).

---

## ToolNode vs Regular Nodes

`ToolNode` is a special node that aggregates tool callables. The graph routes to it when an assistant message contains
`tool_calls`. You rarely call it manually. The sequence:

1. LLM response includes tool calls
2. Graph picks edge to tool execution (conditional or via `Command`)
3. ToolNode executes each referenced tool in order
4. Produces `tool` role messages appended to context
5. Flow returns to a reasoning node for a final response

---

## Streaming Return Path

When a node returns a `ModelResponseConverter` and graph is invoked in streaming mode, the framework yields incremental
`Message(delta=True)` chunks. Node logic should remain agnostic; conversion handles splitting.

---

## Idempotency & Side Effects

Node purity matters for resumability. Guidelines:

- Derive outputs from `state` + inputs; avoid hidden globals
- Persist external effects (DB writes) before returning if later nodes depend on them
- For background fire-and-forget tasks use `BackgroundTaskManager`

---

## Testing Nodes

Mock injected dependencies; supply a minimal `AgentState`:

```python
from agentflow.state import AgentState


def test_router_basic():
    s = AgentState()
    s.context.append(Message.text_message("quit"))
    cmd = router(s, {})
    assert isinstance(cmd, Command)
```

---

## Anti-Patterns

| Pattern | Issue | Fix |
|---------|-------|-----|
| Returning dicts | Not recognised by runtime | Wrap in state or messages |
| Mutating `state.context` and also returning messages | Double append risk | Only return messages |
| Long synchronous CPU loops | Blocks async streaming | Offload / background task |
| Injecting unused services | Noise & overhead | Remove unused params |

---

Next: Control Flow (`control_flow.md`) for edges, recursion limits, and interrupts.
