# StructuredOutputAgent

An agent that guarantees its output matches a Pydantic schema — with automatic validation and self-repair on failure.

**Import path:** `agentflow.prebuilt.agent`

---

## Concept

Standard LLMs sometimes produce malformed JSON or output that does not conform to your expected schema. `StructuredOutputAgent` solves this by adding a validation + repair loop:

```
GENERATE ──[valid output]──────────────────────────────> END
         ──[tool calls]──> TOOL ──> GENERATE
         ──[invalid, attempts < max]──> REPAIR ──> GENERATE
         ──[invalid, max attempts reached]──────────────> END
```

1. **GENERATE** — the LLM receives the conversation and produces output; the provider-level `output_schema` hint is also passed when available.
2. **TOOL** (optional) — if tools are provided, the tool node executes calls and loops back to GENERATE.
3. **REPAIR** — if validation fails, a correction message is injected into the conversation: it includes the validation error and the JSON Schema. On the next GENERATE pass the LLM sees exactly what went wrong.
4. The loop repeats up to `max_attempts` times before returning the best available response.

---

## Code Explanation

### Validation logic (`_validate_message`)

Two-stage validation:
1. If `message.parsed_content` is set (populated by the provider SDK), validate that directly.
2. Otherwise parse `message.text()` as JSON, stripping optional markdown code fences (` ```json ``` `), then validate with `pydantic.TypeAdapter`.

Returns `(is_valid: bool, error: str)`.

### REPAIR node

The default repair node (`_make_repair_fn`) is a lightweight async function (not a full LLM call) that:
1. Increments the attempt counter in `state.execution_meta.internal_data["soa_attempts"]`
2. Builds a correction user message with the validation error and the full JSON Schema
3. Appends it to the conversation

If you pass `repair_system_prompt`, a dedicated `Agent` is used for the repair pass instead — this gives the LLM explicit schema-fixing instructions and uses more tokens.

### Routing

`_make_route_fn` checks (in order):
1. Tool calls present → `"TOOL"`
2. Validation passes → `END`
3. Attempts < max → `"REPAIR"`
4. Max attempts reached → `END` (best-effort)

---

## Full Code

### Pydantic model output

```python
from pydantic import BaseModel, Field
from agentflow.prebuilt.agent import StructuredOutputAgent


class ProductAnalysis(BaseModel):
    product_name: str
    sentiment: str = Field(description="positive, negative, or neutral")
    score: float = Field(ge=0.0, le=10.0)
    key_points: list[str]


agent = StructuredOutputAgent(
    model="gpt-4o-mini",
    output_schema=ProductAnalysis,
    system_prompt=[{
        "role": "system",
        "content": "Analyze the given product review and return a structured analysis.",
    }],
    max_attempts=3,
)

app = agent.compile()

result = await app.ainvoke(
    {"message": "Review: 'Amazing build quality but the battery life is terrible.'"},
    config={"thread_id": "struct-1"},
)
print(result["context"][-1].text())
# {"product_name": "...", "sentiment": "neutral", "score": 6.5, "key_points": [...]}
```

### TypedDict output

```python
from typing import TypedDict

class WeatherReport(TypedDict):
    city: str
    temperature_celsius: float
    conditions: str

agent = StructuredOutputAgent(
    model="gpt-4o-mini",
    output_schema=WeatherReport,
    system_prompt=[{"role": "system", "content": "Extract weather data as JSON."}],
)
app = agent.compile()
```

### With tools and structured output

```python
from agentflow.prebuilt.tools import google_web_search

agent = StructuredOutputAgent(
    model="gpt-4o-mini",
    output_schema=ProductAnalysis,
    tools=[google_web_search],
    system_prompt=[{
        "role": "system",
        "content": (
            "Search for reviews of the given product, then return a structured analysis. "
            "Output must match the required JSON schema."
        ),
    }],
    max_attempts=2,
)
app = agent.compile()
```

### With a dedicated repair agent

```python
agent = StructuredOutputAgent(
    model="gpt-4o",
    output_schema=ProductAnalysis,
    max_attempts=2,
    repair_system_prompt=[{
        "role": "system",
        "content": (
            "You are a JSON repair expert. Fix the JSON to match the schema exactly. "
            "Output only valid JSON — no explanation, no code fences."
        ),
    }],
)
```

---

## Running with `agentflow play`

**`graph.py`**

```python
from pydantic import BaseModel
from agentflow.prebuilt.agent import StructuredOutputAgent


class SummaryOutput(BaseModel):
    title: str
    summary: str
    tags: list[str]


agent = StructuredOutputAgent(
    model="gpt-4o-mini",
    output_schema=SummaryOutput,
    system_prompt=[{
        "role": "system",
        "content": (
            "Summarize the given text. Return a JSON object with title, summary, and tags."
        ),
    }],
    max_attempts=3,
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

```bash
agentflow play
```

---

## Key Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | required | LLM model identifier |
| `output_schema` | `type` | required | Pydantic `BaseModel` or `TypedDict` subclass |
| `tools` | `Iterable[Callable]` | `None` | Optional tools for GENERATE→TOOL loop |
| `system_prompt` | `list[dict]` | `None` | System prompt for the generation agent |
| `max_attempts` | `int` | `2` | Max validation+repair cycles before giving up |
| `repair_system_prompt` | `list[dict] \| None` | `None` | If set, a full LLM repair agent is used; otherwise a lightweight context-injection function |
| `reasoning_config` | `dict \| bool` | `True` | Applied to the generation agent |
| `memory` | `MemoryConfig` | `None` | Long-term memory |
| `retry_config` | `Any` | `True` | Retry on LLM errors |
| `fallback_models` | `list` | `None` | Backup models |
