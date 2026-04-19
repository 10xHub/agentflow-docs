---
title: Agent
description: The Agent class — a smart node that handles LLM calls, tool use, memory, skills, and retries.
sidebar_position: 2
---

# Agent

## When to use this

Use `Agent` when you want a graph node to call an LLM. `Agent` handles provider SDK integration, tool routing, memory retrieval, skills injection, streaming, and retry logic so you can focus on your prompt and graph structure.

## Import path

```python
from agentflow.core.graph import Agent, ToolNode
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
| `provider` | `str \| None` | `None` | Provider name. Supported: `"openai"`, `"google"`, `"vertex_ai"`. If `None`, the provider is inferred from the model name. |
| `output_type` | `str` | `"text"` | Expected output type. Use `"text"` for normal responses or `"json"` for structured JSON output. |
| `system_prompt` | `list[dict] \| None` | `None` | System prompt as a list of message dicts, e.g. `[{"role": "system", "content": "..."}]`. |
| `tool_node` | `str \| ToolNode \| None` | `None` | Tools available to the agent. Pass a `ToolNode` instance or the string name of an existing graph node. |
| `extra_messages` | `list[Message] \| None` | `None` | Additional messages prepended to context before each LLM call. |
| `trim_context` | `bool` | `False` | Trim conversation history to fit within the model's context window. |
| `tools_tags` | `set[str] \| None` | `None` | Filter `ToolNode` tools by tag. Only tools with matching tags are presented to the LLM. |
| `api_style` | `str` | `"chat"` | API calling style. `"chat"` for chat completions, `"responses"` for the Responses API (OpenAI only). |
| `reasoning_config` | `dict \| bool \| None` | default | Reasoning configuration for models that support extended thinking (e.g. `o1`, `gemini`). Pass `True` to enable with defaults, `False` to disable, or a dict with model-specific options. |
| `skills` | `SkillConfig \| None` | `None` | Skills configuration for injecting skill documents into the system prompt. See [`skills`](skills.md). |
| `memory` | `MemoryConfig \| None` | `None` | Memory configuration for retrieving relevant long-term memories before each LLM call. |
| `retry_config` | `RetryConfig \| bool \| None` | `True` | Retry configuration for transient API errors. `True` enables default retry, `False` disables. |
| `fallback_models` | `list[str \| tuple[str, str]] \| None` | `None` | Ordered list of fallback model identifiers (or `(model, provider)` tuples) to try if the primary model fails. |
| `multimodal_config` | `MultimodalConfig \| None` | `None` | Configuration for multimodal file handling — controls auto-offload thresholds. |
| `**kwargs` | any | — | Additional provider-specific parameters passed directly to the LLM SDK. |

---

## Supported providers

| `provider` | Backend | Models |
|---|---|---|
| [`"openai"`](../../providers/openai.md) | OpenAI API | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3`, `o4-mini` |
| [`"google"`](../../providers/google.md) | Gemini API (Google AI Studio) | `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro` |
| [`"vertex_ai"`](../../providers/vertex-ai.md) | Gemini via Google Cloud Vertex AI | `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro` |

See the [Providers](../../providers/index.md) section for setup, environment variables, and full examples.

### Provider inference

If `provider` is `None`, the library infers the provider from the `model` string:

- Models starting with `"gpt"`, `"o1"`, `"o3"`, `"o4"` → `"openai"`
- Models starting with `"gemini"` → `"google"`

`"vertex_ai"` is never inferred — set it explicitly, since its model names overlap with `"google"`.

---

## Using Agent in a graph

```python
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.utils import START, END

# 1. Define tools
def get_weather(location: str) -> str:
    return f"It's sunny in {location}"

tool_node = ToolNode([get_weather])

# 2. Create the agent
agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a weather assistant."}],
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
from agentflow.core.graph.agent_internal.constants import RetryConfig

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
from agentflow.storage.store.memory_config import MemoryConfig

memory_config = MemoryConfig(
    enabled=True,
    top_k=5,
    memory_type="semantic",
)

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a personal assistant."}],
    memory=memory_config,
)

# Provide the store when compiling
app = graph.compile(store=my_qdrant_store)
```

Before each LLM call the agent retrieves the top-k relevant memories and prepends them to the context.

---

## Multimodal config

```python
from agentflow.storage.media.config import MultimodalConfig

agent = Agent(
    model="gpt-4o",
    multimodal_config=MultimodalConfig(
        auto_offload=True,
        max_inline_bytes=50_000,
    ),
)
```

When `auto_offload=True` and a `media_store` is attached to the compiled graph, large inline `data_base64` blobs are automatically offloaded to the media store and replaced with lightweight references before the context is sent to the LLM.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AuthenticationError` | Missing or invalid API key. | Set `OPENAI_API_KEY`, `GOOGLE_API_KEY`/`GEMINI_API_KEY`, or Vertex AI credentials in your environment. |
| `ValueError: GOOGLE_CLOUD_PROJECT environment variable must be set` | `provider="vertex_ai"` was used without a GCP project. | Export `GOOGLE_CLOUD_PROJECT` and ensure Application Default Credentials are configured. |
| `ImportError: google-genai SDK is required` | The `google-genai` SDK is not installed. | Install it: `pip install 10xscale-agentflow[google-genai]` (or `pip install google-genai`). |
| `InferenceError` | LLM provider returned an unexpected response. | Check the model name and provider. If using fallbacks, inspect the `fallback_models` list. |
| `ValueError: Invalid tool_node` | `tool_node` is a string but no node with that name exists in the graph. | Add the ToolNode to the graph before using its name as a reference. |
