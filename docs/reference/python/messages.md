---
title: Messages
description: Message, ContentBlock types, MediaRef, TokenUsages — the wire format for all agent communication.
sidebar_position: 5
---

# Messages

## When to use this

Read this page to understand the message format used by graph nodes, the API, and the TypeScript client. Every piece of content — text, images, tool calls, reasoning — is represented as a typed `ContentBlock` inside a `Message`.

## Import paths

```python
from agentflow.core.state import Message
from agentflow.core.state.message_block import (
    TextBlock, ImageBlock, AudioBlock, VideoBlock,
    DocumentBlock, DataBlock,
    ToolCallBlock, RemoteToolCallBlock, ToolResultBlock,
    ReasoningBlock, AnnotationBlock, ErrorBlock,
    MediaRef, AnnotationRef, ContentBlock,
)
from agentflow.core.state.message import TokenUsages
```

---

## `Message`

The top-level message object. All conversations are `list[Message]`.

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `message_id` | `str \| int` | auto-generated | Unique message identifier. Generated via the DI-registered ID generator. |
| `role` | `"user" \| "assistant" \| "system" \| "tool"` | **required** | Who sent the message. |
| `content` | `Sequence[ContentBlock]` | **required** | Ordered list of typed content blocks. |
| `delta` | `bool` | `False` | `True` for streaming intermediate chunks. Delta messages are not persisted to state. |
| `tools_calls` | `list[dict] \| None` | `None` | Raw tool call dicts from the provider SDK. Used internally. |
| `reasoning` | `str \| None` | `None` | Reasoning trace (deprecated — use `ReasoningBlock` in `content` instead). |
| `timestamp` | `float \| None` | auto | UNIX timestamp of message creation. |
| `metadata` | `dict` | `{}` | Arbitrary key-value metadata. |
| `usages` | `TokenUsages \| None` | `None` | Token usage for this message's LLM call. |
| `raw` | `dict \| None` | `None` | The raw provider API response. |

### Constructors

#### `Message.text_message`

```python
msg = Message.text_message("Hello")
msg = Message.text_message("Hello", role="assistant")
msg = Message.text_message("Hello", role="user", message_id="msg-001")
```

Create a plain text user message. The simplest way to construct input for `invoke()` or `ainvoke()`.

#### Direct construction

```python
from agentflow.core.state.message_block import TextBlock

msg = Message(
    role="user",
    content=[TextBlock(text="Hello, world!")],
    metadata={"source": "api"},
)
```

---

## Content blocks

All content blocks share a `type` discriminator field used for type narrowing.

### `TextBlock`

```python
TextBlock(text="Hello, world!")
TextBlock(text="See reference [1].", annotations=[AnnotationRef(url="https://example.com", title="Source")])
```

| Field | Type | Description |
|---|---|---|
| `type` | `"text"` | Discriminator. |
| `text` | `str` | The text content. |
| `annotations` | `list[AnnotationRef]` | Citations or links embedded in the text. |

---

### `ImageBlock`

```python
ImageBlock(media=MediaRef(kind="url", url="https://example.com/photo.jpg", mime_type="image/jpeg"))
ImageBlock(media=MediaRef(kind="file_id", file_id="file-abc123", mime_type="image/png"))
ImageBlock(media=MediaRef(kind="data", data_base64="...", mime_type="image/png"), alt_text="Chart")
```

| Field | Type | Description |
|---|---|---|
| `type` | `"image"` | Discriminator. |
| `media` | `MediaRef` | Reference to the image. |
| `alt_text` | `str \| None` | Accessibility text. |
| `bbox` | `list[float] \| None` | Bounding box `[x1, y1, x2, y2]`. |

---

### `AudioBlock`

```python
AudioBlock(
    media=MediaRef(kind="url", url="https://example.com/recording.mp3"),
    transcript="Hello, this is a recording.",
)
```

| Field | Type | Description |
|---|---|---|
| `type` | `"audio"` | Discriminator. |
| `media` | `MediaRef` | Reference to the audio. |
| `transcript` | `str \| None` | Transcript of the audio content. |
| `sample_rate` | `int \| None` | Sample rate in Hz. |
| `channels` | `int \| None` | Number of audio channels. |

---

### `VideoBlock`

```python
VideoBlock(
    media=MediaRef(kind="url", url="https://example.com/video.mp4"),
    thumbnail=MediaRef(kind="url", url="https://example.com/thumb.jpg"),
)
```

| Field | Type | Description |
|---|---|---|
| `type` | `"video"` | Discriminator. |
| `media` | `MediaRef` | Reference to the video. |
| `thumbnail` | `MediaRef \| None` | Thumbnail image reference. |

---

### `DocumentBlock`

```python
DocumentBlock(
    media=MediaRef(kind="file_id", file_id="file-def456", mime_type="application/pdf"),
    excerpt="This report covers Q4 earnings...",
    pages=[1, 2, 3],
)
```

| Field | Type | Description |
|---|---|---|
| `type` | `"document"` | Discriminator. |
| `media` | `MediaRef` | Reference to the document file. |
| `text` | `str \| None` | Extracted full text content. |
| `pages` | `list[int] \| None` | Relevant page numbers. |
| `excerpt` | `str \| None` | Short excerpt/preview. |

---

### `DataBlock`

```python
DataBlock(mime_type="application/json", data_base64="eyJrZXkiOiAidmFsdWUifQ==")
```

| Field | Type | Description |
|---|---|---|
| `type` | `"data"` | Discriminator. |
| `mime_type` | `str` | MIME type of the data. |
| `data_base64` | `str \| None` | Base64-encoded payload. |
| `media` | `MediaRef \| None` | External media reference. |

---

### `ToolCallBlock`

Added by the agent when the LLM requests a tool call. Application code usually does not construct these directly.

```python
ToolCallBlock(id="call_abc", name="get_weather", args={"location": "London"})
```

| Field | Type | Description |
|---|---|---|
| `type` | `"tool_call"` | Discriminator. |
| `id` | `str` | Tool call ID (matches the corresponding `ToolResultBlock`). |
| `name` | `str` | Tool function name. |
| `args` | `dict` | Arguments dict. |
| `tool_type` | `str \| None` | Optional type hint e.g. `"web_search"`, `"computer_use"`. |

---

### `RemoteToolCallBlock`

Sent by the server to the TypeScript client when a tool needs to run in the browser. Do not construct manually.

| Field | Type | Description |
|---|---|---|
| `type` | `"remote_tool_call"` | Discriminator. |
| `id` | `str` | Call ID. |
| `name` | `str` | Tool name registered via `client.registerTool()`. |
| `args` | `dict` | Arguments. |
| `tool_type` | `str` | Always `"remote"`. |

---

### `ToolResultBlock`

The result of a tool call execution. Constructed by `ToolNode` and returned to the LLM.

```python
ToolResultBlock(tool_call_id="call_abc", content="Sunny, 25°C", is_error=False)
```

| Field | Type | Description |
|---|---|---|
| `type` | `"tool_result"` | Discriminator. |
| `tool_call_id` | `str` | Matches the `ToolCallBlock.id` this is a response to. |
| `content` | `str \| list \| dict` | The result returned by the tool. |
| `is_error` | `bool` | `True` if the tool execution raised an exception. |

---

### `ReasoningBlock`

Returned by reasoning models (`o1`, `o3`, Gemini thinking) to expose the model's thinking trace.

| Field | Type | Description |
|---|---|---|
| `type` | `"reasoning"` | Discriminator. |
| `thinking` | `str` | The reasoning/thinking text. |
| `signature` | `str \| None` | Provider-specific signature for verifying thinking. |

---

### `AnnotationBlock`

Structured annotation/citation attached to a text response.

| Field | Type | Description |
|---|---|---|
| `type` | `"annotation"` | Discriminator. |
| `annotation` | `AnnotationRef` | The annotation reference. |

---

### `ErrorBlock`

Represents an error that occurred during execution.

| Field | Type | Description |
|---|---|---|
| `type` | `"error"` | Discriminator. |
| `error` | `str` | Error message. |
| `code` | `str \| None` | Optional error code. |

---

## `MediaRef`

A polymorphic reference to binary media content. Use the `kind` discriminator to choose the reference strategy.

```python
# By URL
MediaRef(kind="url", url="https://cdn.example.com/image.png", mime_type="image/png")

# By provider file ID (OpenAI/Gemini uploaded file)
MediaRef(kind="file_id", file_id="file-abc123", mime_type="image/png")

# Inline base64 (small files only — prefer offloading to media store)
MediaRef(kind="data", data_base64="iVBORw0KGgo...", mime_type="image/png")
```

### Fields

| Field | Type | Description |
|---|---|---|
| `kind` | `"url" \| "file_id" \| "data"` | Reference type discriminator. |
| `url` | `str \| None` | HTTP(S) URL or `agentflow://media/{key}` for offloaded media. |
| `file_id` | `str \| None` | Provider-managed file ID (OpenAI Files API, Gemini File API). |
| `data_base64` | `str \| None` | Base64-encoded content. Use only for small payloads (< 50 KB). |
| `mime_type` | `str \| None` | MIME type, e.g. `"image/jpeg"`, `"application/pdf"`. |
| `size_bytes` | `int \| None` | File size hint. |
| `sha256` | `str \| None` | Content hash for integrity verification. |
| `filename` | `str \| None` | Original filename. |
| `width` | `int \| None` | Image width in pixels. |
| `height` | `int \| None` | Image height in pixels. |
| `duration_ms` | `int \| None` | Audio/video duration in milliseconds. |
| `page` | `int \| None` | Page number for documents. |

---

## `AnnotationRef`

```python
AnnotationRef(url="https://arxiv.org/abs/2303.08774", title="GPT-4 Technical Report", page=1)
```

| Field | Type | Description |
|---|---|---|
| `url` | `str \| None` | Source URL. |
| `file_id` | `str \| None` | File reference. |
| `page` | `int \| None` | Page number. |
| `index` | `int \| None` | Index position in the source. |
| `title` | `str \| None` | Display title. |

---

## `TokenUsages`

Token consumption statistics for a single LLM response.

```python
usages = TokenUsages(
    completion_tokens=150,
    prompt_tokens=320,
    total_tokens=470,
)
```

| Field | Type | Default | Description |
|---|---|---|---|
| `completion_tokens` | `int` | required | Tokens generated in the response. |
| `prompt_tokens` | `int` | required | Tokens in the input prompt. |
| `total_tokens` | `int` | required | Sum of completion and prompt tokens. |
| `reasoning_tokens` | `int` | `0` | Tokens used for extended reasoning (o1, Gemini thinking). |
| `cache_creation_input_tokens` | `int` | `0` | Prompt cache write tokens (Anthropic-style). |
| `cache_read_input_tokens` | `int` | `0` | Prompt cache read tokens. |
| `image_tokens` | `int \| None` | `0` | Image modality tokens (multimodal models). |
| `audio_tokens` | `int \| None` | `0` | Audio modality tokens. |

---

## Inspecting a response

```python
from agentflow.core.state.message_block import TextBlock, ToolCallBlock

result = await app.ainvoke({"messages": [Message.text_message("Hello")]})

for msg in result["messages"]:
    for block in msg.content:
        if block.type == "text":
            print(block.text)
        elif block.type == "tool_call":
            print(f"Called {block.name}({block.args})")
```
