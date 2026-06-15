---
title: How to configure Agent
sidebar_label: Configure Agent
description: Complete reference for the Agent constructor — model, provider, system_prompt, tool_node, reasoning_config, retry_config, fallback_models, output_type, output_schema, and more.
keywords:
  - agentflow agent
  - configure llm agent
  - reasoning config
  - retry config
  - fallback models
  - python ai agent framework
sidebar_position: 2
---

# How to configure Agent

`Agent` is the LLM node in a `StateGraph`. This guide covers every constructor parameter with working examples.

## Minimal example

```python
from agentflow.core.graph import Agent

agent = Agent(model="gpt-4o")
```

AgentFlow auto-detects the provider from the model name. For OpenAI models it uses the `openai` SDK; for Gemini models it uses `google-generativeai`.

---

## Model and provider

### Auto-detect (recommended)

```python
agent = Agent(model="gpt-4o")            # → openai
agent = Agent(model="gemini-2.5-flash")  # → google
agent = Agent(model="claude-3-5-sonnet-20241022")  # → openai-compatible
```

### Explicit provider with `/` prefix

```python
agent = Agent(model="openai/gpt-4o")
agent = Agent(model="google/gemini-2.5-flash")
```

### Explicit `provider` kwarg

```python
agent = Agent(model="gpt-4o", provider="openai")
agent = Agent(model="gemini-2.5-flash", provider="google")
```

### Third-party OpenAI-compatible APIs

```python
# Ollama (local)
agent = Agent(
    model="llama3.2",
    provider="openai",
    base_url="http://localhost:11434/v1",
)

# DeepSeek
agent = Agent(
    model="deepseek-chat",
    provider="openai",
    base_url="https://api.deepseek.com/v1",
)

# OpenRouter
agent = Agent(
    model="anthropic/claude-3-5-sonnet",
    provider="openai",
    base_url="https://openrouter.ai/api/v1",
)
```

---

## System prompt

Pass a list of message dicts. The most common pattern is a single `system` role entry.

```python
agent = Agent(
    model="gpt-4o",
    system_prompt=[{
        "role": "system",
        "content": "You are a concise assistant. Reply in at most 3 sentences.",
    }],
)
```

### State interpolation

Placeholders like `{field_name}` are replaced at runtime with values from the current `AgentState`:

```python
from agentflow.core.state import AgentState

class MyState(AgentState):
    user_name: str = "Guest"
    language: str = "English"

agent = Agent(
    model="gpt-4o",
    system_prompt=[{
        "role": "system",
        "content": "You are helping {user_name}. Always reply in {language}.",
    }],
)
```

---

## Tools and ToolNode

Pass a `ToolNode` instance directly, or reference a graph node by name.

```python
from agentflow.core.graph import ToolNode

def search(query: str) -> str:
    """Search the web."""
    return f"Results for: {query}"

tool_node = ToolNode([search])

# Inline: agent owns the tools
agent = Agent(model="gpt-4o", tool_node=tool_node)

# Named reference: ToolNode is a separate graph node
agent = Agent(model="gpt-4o", tool_node="TOOL")
# When using a named reference, add both nodes to the graph
# graph.add_node("MAIN", agent)
# graph.add_node("TOOL", tool_node)
```

### Filter tools by tag

`tools_tags` limits which tools from the `ToolNode` are exposed to the LLM. Tools without matching tags are hidden.

```python
from agentflow.utils.decorators import tool

@tool(tags=["safe"])
def safe_search(query: str) -> str:
    """Safe search."""
    return "..."

@tool(tags=["admin"])
def admin_action(cmd: str) -> str:
    """Admin-only action."""
    return "..."

tool_node = ToolNode([safe_search, admin_action])

# Only expose "safe" tools
agent = Agent(model="gpt-4o", tool_node=tool_node, tools_tags={"safe"})
```

---

## Reasoning configuration

All providers share a unified `reasoning_config` dict. Reasoning is **on by default** at medium effort.

```python
# Default — medium effort (ON for both OpenAI and Google)
agent = Agent(model="gpt-4o")

# High effort
agent = Agent(model="gpt-4o", reasoning_config={"effort": "high"})

# Disable reasoning entirely
agent = Agent(model="gpt-4o", reasoning_config=None)

# OpenAI: low effort + auto summary
agent = Agent(model="o4-mini", reasoning_config={"effort": "low", "summary": "auto"})

# Google: exact thinking_budget (tokens)
agent = Agent(model="gemini-2.5-flash", reasoning_config={"thinking_budget": 5000})
```

**Google effort → thinking_budget mapping:**

| `effort` | `thinking_budget` |
|---|---|
| `"low"` | 512 |
| `"medium"` (default) | 8192 |
| `"high"` | 24576 |

---

## Retry configuration

`Agent` retries on HTTP 429, 500, 502, 503, and 529 with exponential back-off.

```python
from agentflow.core.graph.agent_internal.constants import RetryConfig

# Default (3 retries, 1s initial, 2x backoff, 30s cap)
agent = Agent(model="gpt-4o")

# Custom retry
agent = Agent(
    model="gpt-4o",
    retry_config=RetryConfig(
        max_retries=5,
        initial_delay=2.0,
        max_delay=60.0,
        backoff_factor=2.0,
    ),
)

# Disable retries
agent = Agent(model="gpt-4o", retry_config=False)
```

### RetryConfig fields

| Field | Default | Notes |
|---|---|---|
| `max_retries` | `3` | Total attempts = max_retries + 1. |
| `initial_delay` | `1.0` | Seconds to wait before the first retry. |
| `max_delay` | `30.0` | Cap on the delay between retries. |
| `backoff_factor` | `2.0` | Multiplier applied after each retry. |
| `circuit_breaker_enabled` | `False` | Enable circuit breaker (opt-in). |
| `circuit_breaker_threshold` | `5` | Consecutive failures that open a circuit. |
| `circuit_breaker_reset_timeout` | `30.0` | Seconds the circuit stays open before a half-open trial. |

### Circuit breaker

The circuit breaker is an opt-in complement to retries and `fallback_models`. Once a `(provider, model)` pair fails `circuit_breaker_threshold` times in a row, its circuit opens and subsequent calls to that target are skipped immediately (moving straight to the next fallback) for `circuit_breaker_reset_timeout` seconds. After the cooldown a single trial is allowed; a successful trial closes the circuit, a failed trial re-opens it.

This prevents a dead provider from being retried on every call while other fallbacks are available.

```python
from agentflow.core.graph.agent_internal.constants import RetryConfig

agent = Agent(
    model="gpt-4o",
    fallback_models=["gpt-4o-mini", ("gemini-2.0-flash", "google")],
    retry_config=RetryConfig(
        max_retries=3,
        circuit_breaker_enabled=True,
        circuit_breaker_threshold=5,
        circuit_breaker_reset_timeout=30.0,
    ),
)
```

Circuit state is per `Agent` instance and scoped to `(provider, model)` pairs. Restarting the process resets all circuit state.

---

## LLM call timeout

All LLM clients apply a default request timeout of 600 seconds so a stalled provider cannot hang a graph run indefinitely.

### Override globally via environment variable

```bash
AGENTFLOW_LLM_TIMEOUT=120   # seconds
```

### Override programmatically

```python
from agentflow.core.llm import set_default_llm_timeout, get_default_llm_timeout

set_default_llm_timeout(120.0)   # apply globally from this point on
set_default_llm_timeout(None)    # reset to env var / built-in default
```

Resolution order (first match wins):

1. A programmatic override set via `set_default_llm_timeout`.
2. The `AGENTFLOW_LLM_TIMEOUT` environment variable.
3. The built-in default of 600 seconds (`DEFAULT_LLM_TIMEOUT_SECONDS`).

An explicit `timeout=` kwarg passed directly to the underlying SDK client still takes precedence over this default.

---

## Fallback models

When the primary model exhausts all retries, AgentFlow tries each fallback in order.

```python
# Same-provider fallback
agent = Agent(
    model="gpt-4o",
    fallback_models=["gpt-4o-mini"],
)

# Cross-provider fallback
agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    fallback_models=[
        "gemini-2.0-flash",            # inherit provider (google)
        ("gpt-4o-mini", "openai"),     # explicit (model, provider) tuple
    ],
)
```

---

## Output type

| `output_type` | Use case |
|---|---|
| `"text"` (default) | Text generation |
| `"image"` | Image generation (e.g. DALL-E 3) |
| `"video"` | Video generation |
| `"audio"` | Text-to-speech |

```python
image_agent = Agent(model="dall-e-3", output_type="image")
tts_agent   = Agent(model="tts-1",    output_type="audio")
```

---

## Structured output

Use `output_schema` with a Pydantic model to force JSON output matching a schema. Requires `output_type="text"`.

```python
from pydantic import BaseModel

class ReviewAnalysis(BaseModel):
    sentiment: str          # "positive" | "negative" | "neutral"
    score: float            # 0.0 – 1.0
    summary: str

agent = Agent(
    model="gpt-4o",
    output_schema=ReviewAnalysis,
)
```

The agent's response message will contain a JSON string conforming to `ReviewAnalysis`.

---

## Extra messages

`extra_messages` are injected into every LLM call after the system prompt and before the context. Use them for few-shot examples or static instructions that should always appear.

```python
from agentflow.core.state import Message

examples = [
    Message.text_message("Q: What is 2+2?", role="user"),
    Message.text_message("A: 4", role="assistant"),
]

agent = Agent(
    model="gpt-4o",
    extra_messages=examples,
)
```

---

## API style (OpenAI)

`api_style` selects which OpenAI API surface to use.

```python
# Chat Completions (default)
agent = Agent(model="gpt-4o", api_style="chat")

# Responses API
agent = Agent(model="o4-mini", api_style="responses")
```

---

## Additional LLM kwargs

Any extra keyword argument is forwarded to the provider SDK.

```python
agent = Agent(
    model="gpt-4o",
    temperature=0.3,
    max_tokens=2048,
    top_p=0.9,
)
```

---

## Complete constructor reference

```python
Agent(
    model: str,
    output_type: str = "text",               # "text" | "image" | "video" | "audio"
    system_prompt: list[dict] | None = None,
    tool_node: str | ToolNode | None = None,
    extra_messages: list[Message] | None = None,
    trim_context: bool = False,
    tools_tags: set[str] | None = None,
    reasoning_config: dict | bool | None = {"effort": "medium"},
    skills: SkillConfig | None = None,
    memory: MemoryConfig | None = None,
    retry_config: RetryConfig | bool | None = True,
    fallback_models: list[str | tuple[str, str]] | None = None,
    multimodal_config: MultimodalConfig | None = None,
    output_schema: type[BaseModel] | None = None,
    # kwargs only:
    provider: str | None = None,             # "openai" | "google"
    base_url: str | None = None,
    api_style: str = "chat",                 # "chat" | "responses"
    use_vertex_ai: bool = False,
    temperature: float | None = None,
    max_tokens: int | None = None,
    # ...any other provider kwargs
)
```

---

## What you learned

- `model` is the only required argument; `provider` is auto-detected.
- `tool_node` can be a `ToolNode` instance or the name of a graph node.
- `reasoning_config=None` disables reasoning; the default enables it at medium effort.
- `retry_config` and `fallback_models` make agents resilient to transient API failures.
- `output_schema` enforces structured JSON output via a Pydantic model.

## Next steps

- [Use the @tool decorator](use-tool-decorator.md)
- [Set up checkpointing](set-up-checkpointing.md)
- [Use agent-level memory](use-memory-store.md)
