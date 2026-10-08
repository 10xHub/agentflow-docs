# Model providers

> 10xGraph supports OpenAI, Google Gemini, and Anthropic Claude through a single Agent interface. Choose your model independently of your graph.

Source: https://10xgraph.com/docs/integrations/models
Last updated: 2026-10-08

10xGraph talks to model providers through a unified `Agent` interface. You choose a model, and the library handles provider detection and SDK interaction. The three supported providers are OpenAI (including compatible endpoints), Google (Gemini and Vertex AI), and Anthropic (direct API, Vertex AI, and Bedrock). Once you select a provider, your graph code remains the same: you pass only the model name and optional configuration to the Agent, and the rest is transparent.

Provider choice is a small decision in 10xGraph. The same tools, state, and checkpointer work across all providers. Your production infrastructure (API server, authentication, persistence) does not change when you switch models.

## How provider selection works

When you create an `Agent`, you pass a `model` string. The library detects the provider in three ways, in order:

### Explicit provider prefix

Use `provider/model` format to explicitly select a provider and strip the prefix from the model name:

```python
agent = Agent(model="openai/gpt-4o")
agent = Agent(model="gemini/gemini-2.5-flash")
agent = Agent(model="anthropic/claude-opus-5")
```

### Auto-detection from model name

If no prefix is given, `detect_provider()` infers the provider from the model name:

| Model prefix | Provider |
|---|---|
| `gemini-`, `imagen-`, `veo-`, `chirp` | `google` |
| `gpt-`, `o1-`, `o3-`, `o4-` | `openai` |
| `claude-`, `anthropic.` | `anthropic` |

Examples:

```python
agent = Agent(model="gpt-4o-mini")          # -> OpenAI
agent = Agent(model="gemini-2.5-pro")       # -> Google
agent = Agent(model="claude-opus-5")        # -> Anthropic
agent = Agent(model="anthropic.claude-3")   # -> Anthropic (Bedrock style)
```

### Fallback and unrecognized prefixes

If the model name does not match any known prefix and no explicit provider is given, the library defaults to `"openai"`. This allows OpenAI-compatible endpoints (Ollama, vLLM, OpenRouter, etc.) to work out of the box. The library logs that it defaulted to OpenAI:

```python
agent = Agent(
    model="my-custom-model",
    base_url="https://my-gateway.example.com/v1"
)
# Logs: "Could not auto-detect provider for model 'my-custom-model'. Defaulting to 'openai'."
```

An unrecognized `provider/` prefix is also treated as OpenAI-compatible:

```python
agent = Agent(model="meta-llama/Llama-3-70b")  # Unrecognized prefix -> OpenAI provider
```

## Provider backends and environments

Each provider supports different deployment environments and backend configurations.

### OpenAI

```python
# Direct API (OpenAI)
agent = Agent(
    model="gpt-4o",
    provider="openai",
    api_key="sk-..."  # Falls back to OPENAI_API_KEY env var
)
```

- Credentials: `api_key` or `OPENAI_API_KEY` environment variable.
- Installation: `pip install "10xgraph[openai]"`

### Google (Gemini API and Vertex AI)

```python
# Gemini API (Google AI Studio)
agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    api_key="..."  # Falls back to GEMINI_API_KEY or GOOGLE_API_KEY env var
)

# Google Cloud Vertex AI
agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    use_vertex_ai=True  # Uses GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION
)
```

- Credentials (Gemini API): `api_key` or `GEMINI_API_KEY` / `GOOGLE_API_KEY` environment variables.
- Credentials (Vertex AI): Google Cloud authentication (ADC or service account).
- Installation: `pip install "10xgraph[google-genai]"`

The `use_vertex_ai=True` flag switches from Gemini API to Vertex AI. It also affects Anthropic when using Claude on Vertex AI (see below).

### Anthropic (Claude API, Vertex AI, and Bedrock)

```python
# Direct Claude API
agent = Agent(
    model="claude-opus-5",
    provider="anthropic",
    api_key="sk-ant-..."  # Falls back to ANTHROPIC_API_KEY env var
)

# Google Cloud Vertex AI
agent = Agent(
    model="claude-opus-5",
    provider="anthropic",
    anthropic_backend="vertex",
    # Uses Google Cloud authentication
)

# AWS Bedrock (Claude via Bedrock Messages API)
agent = Agent(
    model="anthropic.claude-opus-5",
    provider="anthropic",
    anthropic_backend="bedrock",
    # Uses AWS credentials (IAM role, environment variables, or config file)
)
```

- Credentials (Claude API): `api_key` or `ANTHROPIC_API_KEY` environment variable.
- Credentials (Vertex AI): Google Cloud authentication.
- Credentials (Bedrock): AWS authentication (IAM role, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or profile).
- Installation: `pip install "10xgraph[anthropic]"` (Claude API), `pip install "10xgraph[anthropic-vertex]"` (Vertex), or `pip install "10xgraph[anthropic-bedrock]"` (Bedrock).

The `anthropic_backend` parameter selects the backend:
- `None` (default): Direct Claude API
- `"vertex"`: Claude on Google Cloud Vertex AI
- `"bedrock"`: Claude on AWS Bedrock (use model names like `"anthropic.claude-opus-5"`)

## Capability matrix

The table below shows which provider supports each capability. A check mark means the feature is available; a dash means it is not supported by that provider's current API.

| Feature | OpenAI | Google | Anthropic |
|---|---|---|---|
| **Tool calling** | Yes | Yes | Yes |
| **Structured output** | Yes (JSON) | Yes (JSON, image, video, audio) | Yes (JSON) |
| **Streaming** | Yes | Yes | Yes |
| **Reasoning models** | Yes (o1, o3, o4) | Experimental (gemini-3-thinking) | Yes (Claude with thinking) |
| **Prompt caching** | Yes | Yes (cache_control) | Yes (cache_control) |
| **Multimodal input** | Image, audio | Image, video, audio, file | Image, PDF |
| **Batch API** | Yes (OpenAI Batch) | - | Yes (Anthropic Batch) |

### Tools

All three providers support tool calling. When you attach tools to an Agent, the library converts the tool schema to the provider's format and handles the request/response cycle.

```python
from tenxgraph import Agent

agent = Agent(model="gpt-4o", tools=[my_tool_1, my_tool_2])
agent = Agent(model="gemini-2.5-flash", tools=[my_tool_1, my_tool_2])
agent = Agent(model="claude-opus-5", tools=[my_tool_1, my_tool_2])
```

### Structured output

Pass `output_schema` to the Agent to request a specific JSON structure from the model:

```python
from pydantic import BaseModel

class Summary(BaseModel):
    title: str
    bullet_points: list[str]

agent = Agent(
    model="gpt-4o",
    output_schema=Summary,
    # Or use output_type="json" for untyped JSON
)
```

- **OpenAI and Anthropic** output JSON text (validated on the client side).
- **Google** supports JSON through `output_type="json"` but also video, image, and audio generation via `output_type`.

### Streaming

All three providers support streaming responses token-by-token or event-by-event:

```python
async for event in agent.astream({"messages": [...]}):
    print(event)
```

Streaming is transparent: the provider handles it, and the library collects events.

### Reasoning models

Some models include explicit reasoning or thinking capabilities:

- **OpenAI:** Models with prefixes `o1-`, `o3-`, `o4-` include reasoning. Pass `reasoning_config={"effort": "high"}` to control effort (for o3/o4).
- **Anthropic:** Claude models support thinking via `reasoning_config={"effort": "high"}`. The model emits a hidden thinking block before generating the response.
- **Google:** Gemini experimental thinking models are available; check the model list.

```python
agent = Agent(model="o3-mini", reasoning_config={"effort": "high"})
agent = Agent(model="claude-opus-5", reasoning_config={"effort": "high"})
```

### Prompt caching

Caching reduces cost and latency for repeated requests with long context:

- **OpenAI:** Pass `cache_control` on system and tool messages (OpenAI SDK integration).
- **Google:** Use `cache_control` on images and long text passages.
- **Anthropic:** Use `cache_control` on system messages and long context blocks.

Caching is configured at the SDK/request level and handled transparently by the library.

### Multimodal input

Each provider supports different input types:

- **OpenAI:** Images (JPEG, PNG, GIF, WebP) and audio (MP3, WAV, etc.). Attach via `ImageBlock` or `AudioBlock` in the message content.
- **Google:** Images, video files, and audio. Use corresponding content block types.
- **Anthropic:** Images (JPEG, PNG, GIF, WebP) and PDF documents via `ImageBlock` or `DocumentBlock`.

See `/docs/guides/send-media` for detailed examples.

### Batch API

For cost-sensitive bulk processing, OpenAI and Anthropic offer batch APIs:

- **OpenAI:** `OpenAIBatch` class. Submit up to 10,000 requests at a time; results are ready in 24 hours.
- **Anthropic:** `AnthropicBatch` class. Similar interface and semantics.

Batch is not for interactive workloads; use the regular invoke/stream API for agent interactions. See `/docs/guides/batch-llm-calls` for examples.

## Other models: OpenAI-compatible endpoints

Any model served behind an OpenAI-compatible API can be used with 10xGraph:

```python
agent = Agent(
    model="my-model",
    provider="openai",
    base_url="https://my-gateway.example.com/v1",
    api_key="...",
)
```

Common examples:

- **Ollama:** `base_url="http://localhost:11434/v1"`
- **vLLM:** `base_url="http://localhost:8000/v1"`
- **OpenRouter:** `base_url="https://openrouter.io/api/v1"`, with model names like `"openrouter/meta-llama/llama-2-70b"`
- **Self-hosted:** Any private gateway that mimics the OpenAI Chat Completions API.

Some gateways only support the legacy Chat Completions endpoint and not the newer Responses API. In that case, pass `api_style="chat"`:

```python
agent = Agent(
    model="my-model",
    provider="openai",
    base_url="https://legacy-gateway.example.com/v1",
    api_style="chat",
)
```

## Related pages

- [OpenAI integration](/docs/integrations/openai): model list, pricing, keys, and options.
- [Google integration](/docs/integrations/google): Gemini and Vertex AI setup.
- [Anthropic integration](/docs/integrations/anthropic): Claude, Vertex, and Bedrock setup.
- [Agents and tools](/docs/concepts/agents-and-tools): how Agent works with tool calling.
- [LLM utilities reference](/docs/reference/python/llm): `detect_provider`, `create_llm_client`, and batch classes.
