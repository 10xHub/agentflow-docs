---
title: Media and Files
description: How to build multimodal messages with images, audio, video, and documents using MediaRef, content blocks, and media stores.
---

# Media and files

AgentFlow has first-class multimodal support. Any message can contain a mix of text, images, audio, video, and documents through typed **content blocks**. Media is referenced via `MediaRef`, which decouples the message structure from where the bytes actually live.

---

## Content block types

All block types live in `agentflow.core.state` (re-exported from the top-level `agentflow` package).

| Class | type discriminator | When to use |
|---|---|---|
| `TextBlock` | `"text"` | Plain text content |
| `ImageBlock` | `"image"` | Images (PNG, JPEG, WebP, GIF) |
| `AudioBlock` | `"audio"` | Audio data (WAV, MP3, OGG) |
| `VideoBlock` | `"video"` | Video data (MP4, WebM) |
| `DocumentBlock` | `"document"` | PDFs, Word docs, plain text |
| `DataBlock` | `"data"` | Any raw binary blob with a MIME type |
| `ToolCallBlock` | `"tool_call"` | Tool invocation request from the model |
| `ToolResultBlock` | `"tool_result"` | Result returned from a tool execution |
| `ReasoningBlock` | `"reasoning"` | Chain-of-thought reasoning traces |
| `AnnotationBlock` | `"annotation"` | Citations, references, structured notes |
| `ErrorBlock` | `"error"` | Error information from failed operations |

---

## MediaRef — the reference model

`MediaRef` is how you tell a block *where* the binary data is. It has three `kind` values:

```python
from agentflow import MediaRef

# 1. External URL — the agent fetches it per provider
MediaRef(kind="url", url="https://example.com/photo.png", mime_type="image/png")

# 2. Inline base64 — embed the bytes directly (small payloads only)
MediaRef(kind="data", data_base64="<base64-string>", mime_type="image/png")

# 3. Store key — uploaded to a MediaStore first, then referenced by key
MediaRef(kind="file_id", file_id="a1b2c3d4...", mime_type="image/png")
```

### Full MediaRef fields

```python
class MediaRef(BaseModel):
    kind: Literal["url", "file_id", "data"] = "url"
    url: str | None = None          # https:// or agentflow://media/<key>
    file_id: str | None = None      # opaque key from MediaStore.store()
    data_base64: str | None = None  # base64-encoded bytes (small payloads only)
    mime_type: str | None = None
    size_bytes: int | None = None
    sha256: str | None = None
    filename: str | None = None
    # Media-specific hints
    width: int | None = None
    height: int | None = None
    duration_ms: int | None = None
    page: int | None = None
```

---

## Building multimodal messages

Import all blocks from the top-level `agentflow` package:

```python
from agentflow import (
    AudioBlock,
    DocumentBlock,
    ImageBlock,
    MediaRef,
    Message,
    TextBlock,
    VideoBlock,
)
```

### Example 1: Image from an external URL

```python
messages = [
    Message(
        role="user",
        content=[
            TextBlock(text="What is in this image?"),
            ImageBlock(
                media=MediaRef(
                    kind="url",
                    url="https://upload.wikimedia.org/wikipedia/commons/4/47/example.png",
                    mime_type="image/png",
                )
            ),
        ],
    )
]

result = app.invoke({"messages": messages}, config={"thread_id": "t1"})
```

### Example 2: Image from inline base64

```python
import base64

with open("photo.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

messages = [
    Message(
        role="user",
        content=[
            TextBlock(text="Describe this photo."),
            ImageBlock(
                media=MediaRef(
                    kind="data",
                    data_base64=b64,
                    mime_type="image/jpeg",
                )
            ),
        ],
    )
]
```

### Example 3: File uploaded to MediaStore (recommended for production)

Upload the file once and reference it by key in any number of subsequent messages:

```python
import asyncio
from agentflow import InMemoryMediaStore, ImageBlock, MediaRef, Message, TextBlock

media_store = InMemoryMediaStore()

# Upload — returns an opaque storage key
with open("photo.png", "rb") as f:
    file_key = asyncio.run(media_store.store(data=f.read(), mime_type="image/png"))

# Reference by key in a message
messages = [
    Message(
        role="user",
        content=[
            TextBlock(text="Analyze this uploaded image."),
            ImageBlock(
                media=MediaRef(
                    kind="file_id",
                    file_id=file_key,
                    mime_type="image/png",
                )
            ),
        ],
    )
]
```

### Example 4: Audio

```python
messages = [
    Message(
        role="user",
        content=[
            TextBlock(text="Transcribe this audio clip."),
            AudioBlock(
                media=MediaRef(
                    kind="data",
                    data_base64=base64.b64encode(audio_bytes).decode(),
                    mime_type="audio/wav",
                ),
                # optional hints
                sample_rate=16000,
                channels=1,
            ),
        ],
    )
]
```

### Example 5: Document

```python
messages = [
    Message(
        role="user",
        content=[
            TextBlock(text="Summarize this document."),
            DocumentBlock(
                text="Pre-extracted text content (optional — provide when you already have the text).",
                media=MediaRef(
                    kind="file_id",
                    file_id="doc-storage-key",
                    mime_type="application/pdf",
                ),
            ),
        ],
    )
]
```

### Example 6: Mixed media in one message

```python
messages = [
    Message(
        role="user",
        content=[
            TextBlock(text="Here are multiple inputs — process all of them."),
            ImageBlock(media=MediaRef(kind="url", url="https://example.com/chart.png", mime_type="image/png")),
            DocumentBlock(
                text="This document discusses agent frameworks.",
                media=MediaRef(kind="file_id", file_id="doc-001", mime_type="text/plain"),
            ),
        ],
    )
]
```

---

## MediaStore — binary storage backends

`MediaStore` stores the actual bytes outside the message, keeping messages lightweight. The `BaseMediaStore` interface exposes five methods:

```python
async def store(data: bytes, mime_type: str, metadata: dict | None) -> str  # returns storage key
async def retrieve(storage_key: str) -> tuple[bytes, str]                    # bytes + mime_type
async def delete(storage_key: str) -> bool
async def exists(storage_key: str) -> bool
async def get_metadata(storage_key: str) -> dict | None                      # without loading bytes
```

### Available backends

| Class | Module | Use case |
|---|---|---|
| `InMemoryMediaStore` | `agentflow.storage.media.storage` | Development, tests |
| `LocalFileMediaStore` | `agentflow.storage.media.storage` | Single-server, dev |
| `CloudMediaStore` | `agentflow.storage.media.storage` | S3 / GCS (production) |

#### InMemoryMediaStore

```python
from agentflow import InMemoryMediaStore

store = InMemoryMediaStore()
key = await store.store(data=image_bytes, mime_type="image/png")
bytes_back, mime = await store.retrieve(key)
```

Data is lost on process restart. Thread-safe via asyncio.

#### LocalFileMediaStore

```python
from agentflow.storage.media.storage import LocalFileMediaStore

store = LocalFileMediaStore(base_dir="./agentflow_media")
key = await store.store(data=pdf_bytes, mime_type="application/pdf")
```

Files are sharded on disk as `{base_dir}/{key[:2]}/{key[2:4]}/{key}.{ext}` with a `.meta.json` sidecar.

#### CloudMediaStore (S3 / GCS)

```bash
pip install "10xscale-agentflow[cloud-storage]"
```

```python
from cloud_storage_manager import CloudStorageFactory, StorageProvider, StorageConfig, AwsConfig
from agentflow.storage.media.storage import CloudMediaStore

config = StorageConfig(
    aws=AwsConfig(bucket_name="my-bucket", access_key_id="...", secret_access_key="...")
)
cloud_storage = CloudStorageFactory.get_storage(StorageProvider.AWS, config)
store = CloudMediaStore(cloud_storage, prefix="agentflow-media")
```

Stores binary blobs in the cloud bucket. Supports generating signed URLs via `get_direct_url()` so providers can fetch media directly.

---

## MultimodalConfig — per-agent media handling

Pass `MultimodalConfig` to `Agent` to control how media is delivered to the LLM provider:

```python
from agentflow import Agent, InMemoryMediaStore, MultimodalConfig
from agentflow.storage.media.config import ImageHandling, DocumentHandling

agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    multimodal_config=MultimodalConfig(
        image_handling=ImageHandling.BASE64,           # "base64" | "url" | "file_id"
        document_handling=DocumentHandling.EXTRACT_TEXT,  # "extract_text" | "pass_raw" | "skip"
        max_image_size_mb=10.0,
        max_image_dimension=2048,
        supported_image_types={"image/jpeg", "image/png", "image/webp", "image/gif"},
        supported_doc_types={"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ),
)
```

### Image handling strategies

| Strategy | Description |
|---|---|
| `ImageHandling.BASE64` | Convert image to base64 and embed inline |
| `ImageHandling.URL` | Send a URL (external or signed from `CloudMediaStore`) |
| `ImageHandling.FILE_ID` | Upload via provider-native file API (e.g. Google File API) |

### Document handling strategies

| Strategy | Description |
|---|---|
| `DocumentHandling.EXTRACT_TEXT` | Extract text and send as text context |
| `DocumentHandling.FORWARD_RAW` | Forward the raw bytes to the provider |
| `DocumentHandling.SKIP` | Ignore document blocks entirely |

---

## Full graph wiring with a media store

```python
import asyncio
from agentflow import (
    Agent, StateGraph, InMemoryCheckpointer, InMemoryMediaStore,
    ImageBlock, MediaRef, Message, MultimodalConfig, TextBlock, END,
)
from agentflow.storage.media.config import ImageHandling, DocumentHandling

checkpointer = InMemoryCheckpointer()
media_store = InMemoryMediaStore()

agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    system_prompt=[{"role": "system", "content": "You are a helpful multimodal assistant."}],
    multimodal_config=MultimodalConfig(
        image_handling=ImageHandling.BASE64,
        document_handling=DocumentHandling.EXTRACT_TEXT,
    ),
)

graph = StateGraph()
graph.add_node("agent", agent)
graph.set_entry_point("agent")
graph.add_edge("agent", END)

# Pass media_store to compile so the resolver can dereference file_id refs
app = graph.compile(checkpointer=checkpointer)

# Upload a file and invoke
with open("chart.png", "rb") as f:
    key = asyncio.run(media_store.store(data=f.read(), mime_type="image/png"))

messages = [
    Message(
        role="user",
        content=[
            TextBlock(text="Describe this chart."),
            ImageBlock(media=MediaRef(kind="file_id", file_id=key, mime_type="image/png")),
        ],
    )
]

result = app.invoke({"messages": messages}, config={"thread_id": "media-demo"})
```

---

## File upload via REST API

When running behind the API server, upload a file with multipart form data:

```bash
curl -X POST http://127.0.0.1:8000/v1/files/upload \
  -F "file=@photo.jpg"
```

Response:

```json
{
  "file_id": "a1b2c3d4e5f6...",
  "filename": "photo.jpg",
  "content_type": "image/jpeg",
  "size_bytes": 24576,
  "access_url": "/v1/files/a1b2c3d4e5f6..."
}
```

Use the returned `file_id` in subsequent `invoke` or `stream` requests:

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "What is in this image?"},
        {"type": "image", "media": {"kind": "file_id", "file_id": "a1b2c3d4e5f6...", "mime_type": "image/jpeg"}}
      ]
    }
  ],
  "config": {"thread_id": "media-demo", "recursion_limit": 10}
}
```

## File upload via TypeScript client

```typescript
import { AgentFlowClient } from "@10xscale/agentflow-client";

const client = new AgentFlowClient({ baseUrl: "http://127.0.0.1:8000" });

const file = new File([imageBytes], "photo.jpg", { type: "image/jpeg" });
const upload = await client.uploadFile(file);

const result = await client.invoke(
  [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe this image." },
        { type: "image", media: { kind: "file_id", file_id: upload.file_id, mime_type: "image/jpeg" } },
      ],
    },
  ],
  { config: { thread_id: "ts-media-demo" } },
);
```

---

## Provider capability matrix

Not all providers support all media types and transport modes. AgentFlow's internal capability matrix (`agentflow.storage.media.capabilities`) determines the best transport for each provider/model combination. The resolver tries transport modes in preference order:

| Transport mode | Description |
|---|---|
| `remote_url` | Send a public or signed HTTPS URL directly |
| `provider_file` | Upload via provider-native file API (e.g. Google File API) |
| `inline_bytes` | Send raw bytes inline (base64 data URI) |
| `unsupported` | The provider/model cannot handle this media type |

You do not need to manage this yourself — `MultimodalConfig` and `Agent` handle the fallback chain automatically based on your configured strategy.

---

## Related concepts

- [State and messages](./state-and-messages.md)
- [REST API: Files](../reference/rest-api/files.md)

## Accessing an uploaded file

```bash
GET /v1/files/{file_id}
```

This returns the raw file bytes with the correct `Content-Type` header.

## What you learned

- Upload files with `POST /v1/files/upload` and receive a `file_id`.
- Reference the `file_id` in message content blocks.
- `AgentFlowClient.uploadFile` handles the multipart upload in TypeScript.
- File content is stored in the configured `MediaStore`.

## Related concepts

- [REST API: Files](../reference/rest-api/files.md)
- [State and messages](./state-and-messages.md)
