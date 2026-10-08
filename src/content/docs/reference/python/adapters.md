---
title: "Response adapters"
description: "Convert LLM responses from OpenAI, Google GenAI, and Anthropic to 10xGraph Message format."
order: 200
group: "Python library"
section: Reference
updated: "2026-10-08"
---

Response adapters convert provider SDK responses into the 10xGraph `Message` object. Each provider has a converter that extracts text, reasoning, tool calls, media and token usage, for both complete and streaming responses. Use them directly when you call a provider SDK yourself and want 10xGraph messages back.

```python
from tenxgraph.runtime.adapters.llm import (
    AnthropicConverter,
    BaseConverter,
    ConverterType,
    GoogleGenAIConverter,
    OpenAIConverter,
    OpenAIResponsesConverter,
)
```

Install the extra for the provider you use: `pip install "10xgraph[openai]"`, `"10xgraph[google-genai]"` or `"10xgraph[anthropic]"`. For the `Message` type these converters return, see [Messages](/docs/reference/python/messages).

## ConverterType

`ConverterType` is a string enum that names the converter kinds. Its values are the lowercase strings shown below.

| Member | Value | Provider API |
|---|---|---|
| `ConverterType.OPENAI` | `"openai"` | OpenAI Chat Completions |
| `ConverterType.OPENAI_RESPONSES` | `"openai_responses"` | OpenAI Responses API |
| `ConverterType.ANTHROPIC` | `"anthropic"` | Anthropic Messages API |
| `ConverterType.GOOGLE` | `"google"` | Google Generative AI |
| `ConverterType.CUSTOM` | `"custom"` | Your own `BaseConverter` subclass |

## BaseConverter

`BaseConverter` is the abstract base class every converter extends. Subclass it to support another provider. It stores an optional `AgentState` on `self.state` and requires two async methods.

```python
class BaseConverter(ABC):
    def __init__(self, state: AgentState | None = None) -> None: ...

    @abstractmethod
    async def convert_response(self, response: Any) -> Message: ...

    @abstractmethod
    async def convert_streaming_response(
        self,
        config: dict,
        node_name: str,
        response: Any,
        meta: dict | None = None,
    ) -> AsyncGenerator[EventModel | Message]: ...
```

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `state` | `AgentState \| None` | `None` | Optional agent state, kept as `self.state` for context during conversion. |

### convert_response

`convert_response` turns one complete provider response into a single `Message`.

| Parameter | Type | Description |
|---|---|---|
| `response` | `Any` | The raw response object from the provider SDK. |

Returns a `Message`. The base implementation raises `NotImplementedError`.

### convert_streaming_response

`convert_streaming_response` is an async generator that consumes a provider stream and yields messages as it goes.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `config` | `dict` | required | Node configuration. The built-in converters read `thread_id` from it for message metadata. |
| `node_name` | `str` | required | Name of the node processing the response, recorded in metadata. |
| `response` | `Any` | required | The raw streaming response from the provider SDK. |
| `meta` | `dict \| None` | `None` | Extra metadata merged into the yielded messages. |

Yields `Message` chunks. The built-in converters yield partial messages with `delta=True` while the stream runs and a final message with `delta=False` when it completes. The base implementation raises `NotImplementedError`.

## OpenAIConverter

`OpenAIConverter` converts OpenAI Chat Completions responses, complete or streamed. It extracts content, reasoning, tool calls, audio, images and token usage. If you pass it a Responses API object, it delegates to `OpenAIResponsesConverter` automatically. It raises `ImportError` if the `openai` package is not installed.

```python
class OpenAIConverter(BaseConverter):
    async def convert_response(self, response: ChatCompletion) -> Message: ...

    async def convert_streaming_response(
        self, config: dict, node_name: str, response: Any, meta: dict | None = None
    ) -> AsyncGenerator[Message]: ...
```

The constructor is inherited from `BaseConverter` (`state` is optional).

```python title="openai_adapter.py"
import asyncio

from openai import AsyncOpenAI

from tenxgraph.runtime.adapters.llm import OpenAIConverter


async def main() -> None:
    client = AsyncOpenAI()  # reads OPENAI_API_KEY from the environment
    converter = OpenAIConverter()

    # Complete response
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello"}],
    )
    message = await converter.convert_response(response)
    print(message.text())

    # Streaming response
    stream = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello"}],
        stream=True,
    )
    async for chunk in converter.convert_streaming_response(
        config={"thread_id": "user-123"},
        node_name="agent",
        response=stream,
    ):
        print(chunk.delta, chunk.text())


asyncio.run(main())
```

## OpenAIResponsesConverter

`OpenAIResponsesConverter` converts OpenAI Responses API objects, which use an `output` list of items and semantic stream events instead of Chat Completions choices. `OpenAIConverter` uses it for you when it detects a Responses object, so create it directly only when you always use that API.

```python
class OpenAIResponsesConverter(BaseConverter):
    async def convert_response(self, response: Any) -> Message: ...

    async def convert_streaming_response(
        self, config: dict, node_name: str, response: Any, meta: dict | None = None
    ) -> AsyncGenerator[Message]: ...
```

For a stream it yields a `delta=True` message per event and a final `delta=False` message when the stream completes. For a non-iterable Responses object it yields one converted message. Any other non-iterable input raises `TypeError`.

```python title="openai_responses_adapter.py"
import asyncio

from openai import AsyncOpenAI

from tenxgraph.runtime.adapters.llm import OpenAIResponsesConverter


async def main() -> None:
    client = AsyncOpenAI()
    converter = OpenAIResponsesConverter()

    # The Responses API takes `input`, not `messages`
    response = await client.responses.create(
        model="gpt-4o",
        input="What is 2 + 2?",
    )
    message = await converter.convert_response(response)
    print(message.text())


asyncio.run(main())
```

## GoogleGenAIConverter

`GoogleGenAIConverter` converts `GenerateContentResponse` objects from the `google-genai` SDK. It reads candidate parts for text, reasoning (thought) parts, function calls, inline and file media, and token usage. If you pass `convert_streaming_response` a complete `GenerateContentResponse`, it yields one message; anything else is treated as a stream.

```python
class GoogleGenAIConverter(BaseConverter):
    async def convert_response(self, response: GenerateContentResponse) -> Message: ...

    async def convert_streaming_response(
        self, config: dict, node_name: str, response: Any, meta: dict | None = None
    ) -> AsyncGenerator[Message]: ...
```

```python title="google_adapter.py"
import asyncio

from google import genai

from tenxgraph.runtime.adapters.llm import GoogleGenAIConverter


async def main() -> None:
    client = genai.Client()  # reads GEMINI_API_KEY or GOOGLE_API_KEY
    converter = GoogleGenAIConverter()

    # Complete response
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents="Hello",
    )
    message = await converter.convert_response(response)
    print(message.text())

    # Streaming response
    stream = await client.aio.models.generate_content_stream(
        model="gemini-2.5-flash",
        contents="Hello",
    )
    async for chunk in converter.convert_streaming_response(
        config={"thread_id": "user-123"},
        node_name="agent",
        response=stream,
    ):
        print(chunk.delta, chunk.text())


asyncio.run(main())
```

## AnthropicConverter

`AnthropicConverter` converts Anthropic Messages API responses. It extracts text, extended-thinking reasoning, tool calls and token usage (including cache token counts), builds a message for refusals, and handles server-provided tool results. Tool call arguments are assembled across stream fragments and only parsed when each content block ends.

```python
class AnthropicConverter(BaseConverter):
    async def convert_response(self, response: Any) -> Message: ...

    async def convert_streaming_response(
        self, config: dict, node_name: str, response: Any, meta: dict | None = None
    ) -> AsyncGenerator[Message]: ...
```

The streaming method accepts either the object returned by `client.messages.stream(...)` or the iterator returned by `client.messages.create(..., stream=True)`.

```python title="anthropic_adapter.py"
import asyncio

from anthropic import AsyncAnthropic

from tenxgraph.runtime.adapters.llm import AnthropicConverter


async def main() -> None:
    client = AsyncAnthropic()  # reads ANTHROPIC_API_KEY from the environment
    converter = AnthropicConverter()

    # Complete response
    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello"}],
    )
    message = await converter.convert_response(response)
    print(message.text())

    # Streaming response (messages.stream is not awaited)
    stream = client.messages.stream(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello"}],
    )
    async for chunk in converter.convert_streaming_response(
        config={"thread_id": "user-123"},
        node_name="agent",
        response=stream,
    ):
        print(chunk.delta, chunk.text())


asyncio.run(main())
```

## Related pages

- [Messages](/docs/reference/python/messages) describes the `Message` object and its content blocks.
- [State](/docs/reference/python/state) describes `AgentState`, which converters accept as optional context.
