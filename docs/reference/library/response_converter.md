## Response Conversion Architecture

LLM SDKs return provider-specific objects (LiteLLM model responses, streaming wrappers, raw dicts). Agentflow normalises these into its internal `Message` structure so downstream nodes, tool routing, publishers, and checkpointers operate over a consistent schema.

Core pieces live in `agentflow/adapters/llm/`:

| File | Purpose |
|------|---------|
| `base_converter.py` | Abstract `BaseConverter` defining async conversion contracts (single + streaming). |
| `litellm_converter.py` | Concrete implementation for LiteLLM responses & streams. |
| `model_response_converter.py` | Wrapper orchestrating invocation of a callable or static response plus applying a converter. |

### Why a Converter Layer?

- Decouples node logic from vendor response shapes
- Provides a single place to parse tool calls, reasoning tokens, usage metrics
- Supports streaming partial deltas without leaking provider semantics
- Enables future pluggable providers (Anthropic, Google, custom) behind a stable interface

### BaseConverter Contract

```python
class BaseConverter(ABC):
	async def convert_response(self, response: Any) -> Message: ...
	async def convert_streaming_response(
		self, config: dict, node_name: str, response: Any, meta: dict | None = None
	) -> AsyncGenerator[EventModel | Message, None]: ...
```

Implement both methods for a new provider. The streaming variant yields incremental `Message` objects (`delta=True`) and finally a consolidated message (`delta=False`).

### ModelResponseConverter Wrapper

`ModelResponseConverter` accepts either:

- A concrete response object
- A callable (sync or async) that returns a response

And a `converter` argument: either an instance of `BaseConverter` or a shortcut string (currently only `"litellm"`).

Usage inside a node (see `examples/react/react_sync.py`):

```python
from agentflow.adapters.llm.model_response_converter import ModelResponseConverter


def main_agent(state):
    response = completion(model="gemini/gemini-2.5-flash", messages=...)
    return ModelResponseConverter(response, converter="litellm")
```

The invoke handler detects the wrapper, calls `invoke()` (or `stream()` in streaming mode), and appends the resulting `Message`(s) to `state.context`.

### LiteLLM Conversion Details

`LiteLLMConverter` extracts and maps:

| Source (LiteLLM) | Target (Agentflow Message) |
|------------------|-----------------------------|
| `choices[0].message.content` | `TextBlock` in `content[]` |
| `choices[0].message.reasoning_content` | `ReasoningBlock` (if present) |
| `choices[0].message.tool_calls[]` | `ToolCallBlock` + `tools_calls` list |
| `usage.*` | `TokenUsages` (prompt/completion/total, reasoning tokens, cache stats) |
| `model`, `object`, finish reason | `metadata` dict |
| incremental deltas | streaming `Message(delta=True)` chunks |

Final aggregated message includes all accumulated content, reasoning, and tool calls with `delta=False`.

### Streaming Flow

1. Node returns `ModelResponseConverter`
2. Graph executes in streaming mode (`CompiledGraph.stream/astream`)
3. Wrapper invokes LiteLLM streaming call (SDK returns `CustomStreamWrapper`)
4. Each chunk processed `_process_chunk()` → yields partial `Message(delta=True)`
5. After stream ends, a final consolidated `Message(delta=False)` is emitted

Consumers (CLI/UI) can merge or display deltas progressively.

### Tool Call Extraction

During streaming, each new tool call ID is tracked in a set to avoid duplicates. Parsed tool calls are appended both as `ToolCallBlock` objects (for content rendering) and stored in `tools_calls` for routing decisions (`should_use_tools` pattern in example).

### Extending for a New Provider

Implement a subclass:

```python
from agentflow.adapters.llm.base_converter import BaseConverter
from agentflow.utils import Message, TextBlock


class MyProviderConverter(BaseConverter):
    async def convert_response(self, response):
        return Message.role_message("assistant", [TextBlock(text=response.text)])

    async def convert_streaming_response(self, config, node_name, response, meta=None):
        async for part in response:  # provider-specific async iterator
            yield Message(role="assistant", content=[TextBlock(text=part.delta)], delta=True)
        yield Message(role="assistant", content=[TextBlock(text=response.full_text)], delta=False)
```

Then supply it manually:

```python
converter = MyProviderConverter()
return ModelResponseConverter(llm_call(), converter=converter)
```

### Metadata & Observability

Include optional `meta` when streaming (e.g. latency buckets, trace IDs). The LiteLLM converter already injects `provider`, `node_name`, and `thread_id`.

### Testing Strategy

- Mock provider response object; feed into converter; assert `Message` blocks
- For streaming: simulate chunk iterator and collect yielded messages
- Validate token usage mapping for regression detection

### Pitfalls

- Always guard provider imports (as done with `HAS_LITELLM`) to avoid hard runtime deps
- Ensure `delta` semantics: partial messages must be marked `delta=True`
- Do not emit final aggregated message early—collect all content first

### Roadmap Considerations

Future converters may support structured reasoning trees, multimodal blocks, or native tool execution semantics—current design keeps this backwards compatible by enriching `content` blocks and `metadata`.

---

See also: `Graph Fundamentals` (node return types), `State & Messages`, and upcoming `Tools & DI` tutorial for how tool calls produced by converters drive execution.
