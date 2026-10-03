---
title: Media — Python API reference
sidebar_label: Media
description: MediaOffloadPolicy, ensure_media_offloaded, BaseMediaStore, MediaRefResolver — handling large binary content in agent messages.
keywords:
  - agentflow python reference
  - agent api reference
  - python agent library
  - agentflow
  - python ai agent framework
  - media
sidebar_position: 9
---


# Media

## When to use this

Use the media layer when your agent processes images, audio, video, or documents. Large inline `data_base64` blobs inside messages are expensive to serialise, checkpoint, and send over the network. The media layer automatically offloads them to a dedicated store and replaces the blob with a lightweight URI reference.

## Import path

```python
from agentflow.storage.media import MediaOffloadPolicy, ensure_media_offloaded
```

---

## `MediaOffloadPolicy`

An enum that controls when inline base64 data is offloaded to a `BaseMediaStore`.

```python
from agentflow.storage.media import MediaOffloadPolicy
```

| Value | Description |
|---|---|
| `NEVER` | Never offload. All `data_base64` content stays inline. Use for unit tests. |
| `THRESHOLD` | Offload only when the decoded blob exceeds `max_inline_bytes`. Default policy. |
| `ALWAYS` | Always offload every `data_base64` blob, regardless of size. |

---

## `ensure_media_offloaded`

```python
message = await ensure_media_offloaded(
    message=my_message,
    store=media_store,
    policy=MediaOffloadPolicy.THRESHOLD,
    max_inline_bytes=50_000,
)
```

Inspects all `ImageBlock`, `AudioBlock`, `VideoBlock`, and `DocumentBlock` entries in a message. For any block whose `media.kind == "data"` and `media.data_base64` is present, the function:

1. Decodes the base64 to bytes.
2. Uploads the bytes to `store`.
3. Replaces `block.media` with a new `MediaRef(kind="url", url="agentflow://media/{key}")`.

The message is mutated **in place** and also returned. Blocks without inline data (URL or file_id references) are left unchanged.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `message` | `Message` | **required** | Message to inspect and potentially modify. |
| `store` | `BaseMediaStore` | **required** | Media store to upload blobs into. |
| `policy` | `MediaOffloadPolicy` | `THRESHOLD` | When to offload. |
| `max_inline_bytes` | `int` | `50_000` | Decoded byte threshold for the `THRESHOLD` policy. |

---

## `BaseMediaStore`

Abstract interface for media storage backends. Concrete stores implement `store()`, `retrieve()`, `delete()`, `exists()`, `get_metadata()`, `get_direct_url()`, and `to_media_ref()`.

```python
from agentflow.storage.media import BaseMediaStore
```

### Implementations

| Class | Backend | Notes |
|---|---|---|
| `InMemoryMediaStore` | Process memory | Development and tests. Data is lost on restart. |
| `LocalFileMediaStore` | Local filesystem | Single-server setups. `LocalFileMediaStore(base_dir="./agentflow_media")`. |
| `CloudMediaStore` | S3 / GCS / Azure via `cloud-storage-manager` | Requires the `cloud-storage` extra. Supports signed URLs. |

All three are re-exported from `agentflow.storage.media` (and from `agentflow.storage.media.storage`).

---

## Wiring media storage into the graph

```python
from agentflow.storage.media import LocalFileMediaStore

media_store = LocalFileMediaStore(base_dir="./media_uploads")

app = graph.compile(
    checkpointer=my_checkpointer,
    media_store=media_store,
)
```

When a `media_store` is configured:

1. The framework calls `ensure_media_offloaded()` on incoming messages before they enter the graph.
2. Any blob that exceeds `max_inline_bytes` (default 50 KB) is uploaded and replaced with an `agentflow://media/{key}` reference URI.
3. The checkpointer stores only the lightweight URI, not the binary blob.
4. When the API serves the message back to a client, it resolves `agentflow://media/{key}` to a signed access URL.

---

## Multimodal message construction

When sending a multimodal message to the graph, use `MediaRef` to reference the media:

```python
from agentflow.core.state import ImageBlock, MediaRef, Message, TextBlock

# From a URL
msg = Message(
    role="user",
    content=[
        TextBlock(text="What's in this image?"),
        ImageBlock(
            media=MediaRef(kind="url", url="https://example.com/photo.jpg", mime_type="image/jpeg")
        ),
    ],
)

# From base64 (will be offloaded if media_store is configured and blob is large)
import base64
with open("chart.png", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

msg = Message(
    role="user",
    content=[
        TextBlock(text="Describe this chart"),
        ImageBlock(
            media=MediaRef(kind="data", data_base64=b64, mime_type="image/png")
        ),
    ],
)
```

---

## `MultimodalConfig`

Per-agent configuration for how media is validated and delivered to the provider:

```python
from agentflow.storage.media import DocumentHandling, ImageHandling, MultimodalConfig

agent = Agent(
    model="gpt-4o",
    multimodal_config=MultimodalConfig(
        image_handling=ImageHandling.BASE64,
        document_handling=DocumentHandling.EXTRACT_TEXT,
        max_image_dimension=2048,
    ),
)
```

| Field | Type | Default | Description |
|---|---|---|---|
| `image_handling` | `ImageHandling` | `BASE64` | How images are sent to the provider. |
| `document_handling` | `DocumentHandling` | `EXTRACT_TEXT` | How documents are processed before sending. |
| `max_image_size_mb` | `float` | `10.0` | Maximum accepted image size in megabytes. |
| `max_image_dimension` | `int` | `2048` | Images are resized when either dimension exceeds this. |
| `supported_image_types` | `set[str]` | jpeg, png, webp, gif | Allowed image MIME types. |
| `supported_doc_types` | `set[str]` | pdf, docx | Allowed document MIME types. |

Offload behaviour is not configured here. It is driven by `MediaOffloadPolicy` and the `media_store` passed to `graph.compile()`.

---

## `MediaRefResolver`

Resolves a `MediaRef` into the concrete content part a provider expects: it fetches `agentflow://media/{key}` references out of the media store, and can hand out signed direct URLs instead of re-uploading bytes on every turn.

```python
from agentflow.storage.media import MediaRefResolver

resolver = MediaRefResolver(media_store=media_store)

# Optional: share signed URLs across processes through a cache backend
resolver = resolver.with_cache(
    cache_backend=my_redis_cache,
    expiration_seconds=3600,
    refresh_buffer_seconds=60,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `media_store` | `BaseMediaStore \| None` | `None` | Store used to resolve internal `agentflow://media/{key}` references. Internal references raise when omitted. |
| `cache_backend` | `Any \| None` | `None` | Optional cache for generated signed URLs. |
| `direct_url_expiration_seconds` | `int` | `3600` | Lifetime of a generated signed URL. |
| `direct_url_refresh_buffer_seconds` | `int` | `60` | Regenerate a cached URL this many seconds before it expires. |

---

## OpenAI file helpers

For documents already uploaded through the OpenAI Files API, two helpers build the request fragments OpenAI expects:

```python
from agentflow.storage.media import (
    create_openai_file_attachment,
    create_openai_file_search_tool,
)

tool = create_openai_file_search_tool(["file-abc123"])
# -> {"type": "file_search", "file_search": {...}}  — pass in the `tools` list

attachment = create_openai_file_attachment("file-abc123", tools=["file_search"])
# -> {"file_id": "file-abc123", "tools": [{"type": "file_search"}]}
```

`create_openai_file_search_tool(file_ids)` returns a tool dict for the `tools` parameter. `create_openai_file_attachment(file_id, tools=None)` returns a message attachment dict; `tools` defaults to `["file_search"]`.

---

## Security note

`ensure_media_offloaded` uses `base64.b64decode()` with no URL-safe alphabet option. Ensure incoming `data_base64` values are standard base64-encoded. The media store should validate MIME types before accepting uploads to prevent arbitrary file storage.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `agentflow://media/...` reference not resolved | Client receives an internal URI instead of an accessible URL. | Ensure the API server is configured with a `media_store` that supports signed URL generation. |
| No offloading happening | `media_store` not passed to `graph.compile()`. | Add `media_store=your_store` to the `compile()` call. |
| Blob stays inline despite `ALWAYS` policy | `ensure_media_offloaded` is not called on the message. | Confirm the graph is compiled with a `media_store`. The framework calls offload automatically on ingestion. |
