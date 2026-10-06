---
title: Agent
seoTitle: "Agent class API reference (Python)"
description: The Agent class — a smart node that handles LLM calls, tool use, memory, skills, and retries.
section: Reference
group: Python library
order: 1420
label: Agent
updated: "2026-09-29"
---

## When to use this

Use `Agent` when you want a graph node to call an LLM. `Agent` handles provider SDK integration, tool routing, memory retrieval, skills injection, streaming, and retry logic so you can focus on your prompt and graph structure.

## Import path

```python
from tenxgraph.core.graph import Agent, ToolNode
```

---

## Constructor

```python
agent = Agent(
    model="gpt-4o",
    provider="openai",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node=tool_node,
)
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | **required** | Model identifier. Examples: `"gpt-4o"`, `"gpt-4o-mini"`, `"gemini-2.0-flash"`, `"gemini-2.5-flash"`. |
| `provider` | `str \| None` | `None` | Provider name. Supported: `"openai"`, `"google"`, `"anthropic"`. If `None`, the provider is inferred from the model name. |
| `output_type` | `str` | `"text"` | Generation modality: `"text"`, `"image"`, `"video"`, or `"audio"`. Structured JSON is requested with `output_schema`, not this field. |
| `system_prompt` | `list[dict] \| None` | `None` | System prompt as a list of message dicts, e.g. `[{"role": "system", "content": "..."}]`. |
| `tool_node` | `str \| ToolNode \| None` | `None` | Tools available to the agent. Pass a `ToolNode` instance or the string name of an existing graph node. |
| `extra_messages` | `list[Message] \| None` | `None` | Additional messages prepended to context before each LLM call. |
| `trim_context` | `bool` | `False` | Trim conversation history to fit within the model's context window. |
| `tools_tags` | `set[str] \| None` | `None` | Filter `ToolNode` tools by tag. Only tools with matching tags are presented to the LLM. |
| `api_style` | `str` | `"chat"` | API calling style. `"chat"` for chat completions, `"responses"` for the Responses API (OpenAI only). |
| `reasoning_config` | `dict \| bool \| None` | default | Reasoning configuration for models that support extended thinking (e.g. `o1`, `gemini`). Pass `True` to enable with defaults, `False` to disable, or a dict with model-specific options. |
| `skills` | `SkillConfig \| None` | `None` | [Agent Skills](https://agentskills.io) configuration. Adds the skill catalog to the system prompt and the `activate_skill` / `read_skill_resource` tools. See [`skills`](/docs/reference/python/skills). |
| `memory` | `MemoryConfig \| None` | `None` | Memory configuration for retrieving relevant long-term memories before each LLM call. |
| `retry_config` | `RetryConfig \| bool \| None` | `True` | Retry, back-off, and circuit-breaker configuration for transient API errors. `True` enables defaults, `False` disables. See [Retry configuration](#retry-configuration). |
| `fallback_models` | `list[str \| tuple[str, str]] \| None` | `None` | Ordered list of fallback model identifiers (or `(model, provider)` tuples) to try if the primary model fails. |
| `multimodal_config` | `MultimodalConfig \| None` | `None` | Image and document handling limits for multimodal requests. See [`media`](/docs/reference/python/media#multimodalconfig). |
| `output_schema` | `type[BaseModel] \| None` | `None` | Pydantic model the final answer must conform to. Only valid with `output_type="text"`; combining it with a media `output_type` raises at construction time. |
| `use_vertex_ai` | `bool` | `False` | Google provider only. Route Gemini calls through Vertex AI instead of the Gemini API. Equivalent to setting `GOOGLE_GENAI_USE_VERTEXAI=true`. See [Using Vertex AI](/docs/providers/google#using-vertex-ai). |
| `**kwargs` | any | — | Additional provider-specific parameters passed directly to the LLM SDK. |

---

## Supported providers

| `provider` | Backend | Models |
|---|---|---|
| [`"openai"`](/docs/providers/openai) | OpenAI API | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3`, `o4-mini` |
| [`"google"`](/docs/providers/google) | Gemini API (Google AI Studio) or Vertex AI | `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro` |
| [`"anthropic"`](/docs/providers/anthropic) | Claude API directly, Vertex AI, or Bedrock | `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-haiku-4-5-20251001` |

The `"google"` provider supports both the Gemini API and Vertex AI. Toggle Vertex AI with `use_vertex_ai=True` on the agent or `GOOGLE_GENAI_USE_VERTEXAI=true` in the environment — see [Using Vertex AI](/docs/providers/google#using-vertex-ai).

See the [Providers](/docs/providers) section for setup, environment variables, and full examples.

### Provider inference

If `provider` is `None`, the library infers the provider from the `model` string:

- Models starting with `"gpt"`, `"o1"`, `"o3"`, `"o4"` → `"openai"`
- Models starting with `"gemini"` → `"google"`
- Models starting with `"claude-"` or `"anthropic."` → `"anthropic"`

The Anthropic provider reads `anthropic_backend` from the agent kwargs: omit it for the direct Claude API, or pass `"vertex"` or `"bedrock"`.

---

## Using Agent in a graph

```python
from tenxgraph.core.graph import StateGraph, Agent, ToolNode
from tenxgraph.utils import START, END

# 1. Define tools
def lookup_order(order_id: str) -> dict:
    return {"order_id": order_id, "status": "shipped"}

def refund_order(order_id: str, amount: float) -> dict:
    return {"order_id": order_id, "refunded": amount}

tool_node = ToolNode([lookup_order, refund_order])

# 2. Create the agent
agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a support agent for an online store."}],
    tool_node=tool_node,
)

# 3. Build the graph
graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.set_entry_point("MAIN")

# 4. Route: if agent called tools, run them; otherwise finish
def route(state, config):
    last = state.context[-1]
    if any(b.type == "tool_call" for b in last.content):
        return "TOOL"
    return END

graph.add_conditional_edges("MAIN", route)
graph.add_edge("TOOL", "MAIN")

app = graph.compile()
```

---

## Tool routing shortcut

When `tool_node` is given, `Agent` adds the standard "call tools if requested, else end" routing pattern automatically if you use the `react` preset. For manual control, set up conditional edges as shown above.

---

## Retry configuration

```python
from tenxgraph.core.graph.agent_internal.constants import RetryConfig

agent = Agent(
    model="gpt-4o",
    retry_config=RetryConfig(
        max_retries=3,
        initial_delay=1.0,
        backoff_factor=2.0,
    ),
)

# Disable retries
agent = Agent(model="gpt-4o", retry_config=False)
```

### `RetryConfig` fields

| Field | Default | Description |
|---|---|---|
| `max_retries` | `3` | Attempts against the primary model before moving to the next fallback. |
| `initial_delay` | `1.0` | Seconds before the first retry. |
| `max_delay` | `30.0` | Upper bound on the exponential back-off delay. |
| `backoff_factor` | `2.0` | Multiplier applied after each retry. |
| `retryable_status_codes` | `{429, 500, 502, 503, 529}` | HTTP status codes treated as transient. |
| `circuit_breaker_enabled` | `False` | Track consecutive failures per `(provider, model)` and skip open circuits. |
| `circuit_breaker_threshold` | `5` | Consecutive failures that open a circuit. |
| `circuit_breaker_reset_timeout` | `30.0` | Seconds a circuit stays open before a half-open trial. |

### Circuit breaker (opt-in)

The circuit breaker tracks consecutive failures per `(provider, model)` pair. Once a target fails `circuit_breaker_threshold` times in a row, its circuit opens and calls to it are skipped (moving to the next fallback) for `circuit_breaker_reset_timeout` seconds. After the cooldown a single trial is allowed; success closes the circuit.

```python
agent = Agent(
    model="gpt-4o",
    fallback_models=["gpt-4o-mini"],
    retry_config=RetryConfig(
        circuit_breaker_enabled=True,        # default: False
        circuit_breaker_threshold=5,         # consecutive failures before open
        circuit_breaker_reset_timeout=30.0,  # seconds to stay open
    ),
)
```

See [Configure Agent](/docs/how-to/python/configure-agent#circuit-breaker) for more detail.

---

## Reasoning models

For OpenAI `o1`, `o3`, `o4-mini` or Gemini thinking models:

```python
# Enable with default settings
agent = Agent(model="o4-mini", reasoning_config=True)

# Disable reasoning
agent = Agent(model="o4-mini", reasoning_config=False)

# OpenAI-style: effort level
agent = Agent(model="o4-mini", reasoning_config={"effort": "high"})

# Gemini-style: budget tokens
agent = Agent(model="gemini-2.5-pro", reasoning_config={"thinking_budget": 8000})
```

---

## Fallback models

```python
agent = Agent(
    model="gpt-4o",
    fallback_models=[
        "gpt-4o-mini",               # same provider inferred
        ("gemini-2.0-flash", "google"),  # explicit provider
    ],
)
```

If the primary model returns an error the agent tries each fallback in order.

---

## Memory-augmented agent

Wire long-term memory retrieval into the agent:

```python
from tenxgraph.storage.store import MemoryConfig, ReadMode

memory_config = MemoryConfig(
    store=my_qdrant_store,
    retrieval_mode=ReadMode.POSTLOAD,
    limit=5,
)

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a personal assistant."}],
    memory=memory_config,
)

# Provide the store when compiling
app = graph.compile(store=my_qdrant_store)
```

Before each LLM call the agent retrieves up to `limit` relevant memories and prepends them to the context.

`MemoryConfig` fields: `store`, `retrieval_mode`, `limit`, `score_threshold`, `max_tokens`, `inject_system_prompt`, `config`, `user_memory`, `agent_memory`. See [Memory stores](/docs/reference/python/memory-stores).

---

## Multimodal config

```python
from tenxgraph.storage.media.config import MultimodalConfig

agent = Agent(
    model="gpt-4o",
    multimodal_config=MultimodalConfig(
        max_image_size_mb=10.0,
        max_image_dimension=2048,
    ),
)
```

`MultimodalConfig` fields: `image_handling` (`base64`, `url` or `file_id`; default `base64`), `document_handling` (`extract_text`, `pass_raw` or `skip`; default `extract_text`), `max_image_size_mb` (default 10.0), `max_image_dimension` (default 2048), `supported_image_types` and `supported_doc_types`.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AuthenticationError` | Missing or invalid API key. | Set `OPENAI_API_KEY`, `GOOGLE_API_KEY`/`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or Vertex AI credentials in your environment. |
| `ValueError: GOOGLE_CLOUD_PROJECT environment variable must be set` | Vertex AI was enabled (`use_vertex_ai=True` or `GOOGLE_GENAI_USE_VERTEXAI=true`) without a GCP project. | Export `GOOGLE_CLOUD_PROJECT` and ensure Application Default Credentials are configured. |
| `ImportError: google-genai SDK is required` | The `google-genai` SDK is not installed. | Install it: `pip install 10xgraph[google-genai]` (or `pip install google-genai`). |
| `ValueError: Invalid tool_node` | `tool_node` is a string but no node with that name exists in the graph. | Add the ToolNode to the graph before using its name as a reference. |
