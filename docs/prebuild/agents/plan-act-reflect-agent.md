# PlanActReflectAgent

A self-improving agent that plans before acting, then critically evaluates its own work before deciding whether to iterate or stop.

**Import path:** `agentflow.prebuilt.agent`

---

## Concept

Standard ReAct loops can get stuck or produce incomplete answers because the LLM has no explicit evaluation step. The Plan→Act→Reflect pattern adds a third phase:

```
PLAN ──[tool calls?]──> ACT ──> REFLECT ──[DONE or max_iters]──> END
     ──[no tools]────> REFLECT        \\──[not done]──────────> INCREMENT_ITERATIONS ──> PLAN
```

1. **PLAN** — The LLM receives the task and either produces a direct response (no tools) or emits tool calls for the next step.
2. **ACT** — The `ToolNode` executes the tool calls and appends results to the conversation.
3. **REFLECT** — A second LLM call reviews everything done so far (tool results are filtered out to reduce noise). If the task is complete it emits `[DONE]`; otherwise it gives specific guidance for the next planning step.
4. The loop repeats up to `max_iterations` times.

Three separate `Agent` instances are created internally (planner, actor, reflector), each with its own purpose-specific default system prompt.

---

## Code Explanation

### Graph topology

```
PLAN ──> ACT (optional) ──> REFLECT ──> INCREMENT_ITERATIONS ──> PLAN
                                   ──> END
```

`INCREMENT_ITERATIONS` is a lightweight node that increments a counter in `state.execution_meta.internal_data["par_iterations"]`. This keeps the routing logic simple.

### `_make_plan_route`

Routes PLAN output to `"ACT"` when the planner emitted tool calls, or directly to `"REFLECT"` when it produced a text-only response.

### `_make_reflect_route`

Evaluated after each REFLECT:
1. Hard cap: if `iterations >= max_iterations` → END.
2. If `[DONE]` is in the reflector's response (case-insensitive) → END.
3. Otherwise → `INCREMENT_ITERATIONS` (which then goes to PLAN).

### Reflect node filter

Tool result messages (`role="tool"`) are hidden from the reflector's context to avoid context pollution on long runs. The planner still sees them.

### Default system prompts

- **Planner prompt**: "break the task into steps and call tools when needed"
- **Reflector prompt**: "evaluate completeness; emit `[DONE]` if finished; give guidance if not"

Both are fully overridable.

---

## Full Code

```python
from agentflow.prebuilt.agent import PlanActReflectAgent
from agentflow.prebuilt.tools import fetch_url, google_web_search


def summarize_findings(text: str) -> str:
    """Compress a long text to key points."""
    return text[:2000] + "..." if len(text) > 2000 else text


agent = PlanActReflectAgent(
    model="gpt-4o-mini",
    tools=[fetch_url, google_web_search, summarize_findings],
    max_iterations=4,
)

app = agent.compile()

result = await app.ainvoke(
    {"message": "Research the current state of fusion energy and write a 3-paragraph summary."},
    config={"thread_id": "research-1"},
)
print(result["context"][-1].text())
```

### With custom system prompts

```python
agent = PlanActReflectAgent(
    model="gpt-4o",
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

```python
agent = PlanActReflectAgent(
    model="gpt-4o-mini",
    max_iterations=3,
    # no tools — PLAN always routes directly to REFLECT
)
app = agent.compile()
```

---

## Running with `agentflow play`

**`graph.py`**

```python
from agentflow.prebuilt.agent import PlanActReflectAgent
from agentflow.prebuilt.tools import fetch_url, google_web_search, safe_calculator

agent = PlanActReflectAgent(
    model="gpt-4o-mini",
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

---

## Key Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | required | LLM model for all three internal agents |
| `tools` | `Iterable[Callable]` | `None` | Tools available to the PLAN agent |
| `max_iterations` | `int` | `3` | Maximum PLAN→ACT→REFLECT cycles |
| `plan_system_prompt` | `list[dict]` | built-in | Override the planner system prompt |
| `reflect_system_prompt` | `list[dict]` | built-in | Override the reflector system prompt |
| `reasoning_config` | `dict \| bool` | `True` | Applied to all inner agents |
| `memory` | `MemoryConfig` | `None` | Long-term memory (applied to all agents) |
| `retry_config` | `Any` | `True` | Retry behaviour |
| `fallback_models` | `list` | `None` | Backup models if primary fails |
