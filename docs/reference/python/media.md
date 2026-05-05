---
title: Media — AgentFlow Python AI Agent Framework
sidebar_label: Media
description: MediaOffloadPolicy, ensure_media_offloaded, BaseMediaStore — handling large binary content in agent messages.
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
from agentflow.storage.media.offload import MediaOffloadPolicy, ensure_media_offloaded
```

---

## `MediaOffloadPolicy`

An enum that controls when inline base64 data is offloaded to a `BaseMediaStore`.

```python
from agentflow.storage.media.offload import MediaOffloadPolicy
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

Abstract interface for media storage backends. Provides `store(data, mime_type)` and `retrieve(key)`.

```python
from agentflow.storage.media.storage.base import BaseMediaStore
```

### Implementations

| Class | Backend | Notes |
|---|---|---|
| `LocalMediaStore` | Local filesystem | Development and single-server setups. |
| `S3MediaStore` | AWS S3 / S3-compatible | Requires `boto3`. |
| `GCSMediaStore` | Google Cloud Storage | Requires `google-cloud-storage`. |

Import from `agentflow.storage.media.storage`.

---

## Wiring media storage into the graph

```python
from agentflow.storage.media.storage.local import LocalMediaStore

media_store = LocalMediaStore(base_dir="./media_uploads")

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
from agentflow.core.state.message import Message
from agentflow.core.state.message_block import ImageBlock, MediaRef

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

Configuration for the `Agent` class's auto-offload behaviour:

```python
from agentflow.storage.media.config import MultimodalConfig

agent = Agent(
    model="gpt-4o",
    multimodal_config=MultimodalConfig(
        auto_offload=True,
        max_inline_bytes=50_000,
        offload_policy=MediaOffloadPolicy.THRESHOLD,
    ),
)
```

| Field | Type | Default | Description |
|---|---|---|---|
| `auto_offload` | `bool` | `True` | Automatically offload large blobs during ingestion. |
| `max_inline_bytes` | `int` | `50_000` | Size threshold for `THRESHOLD` policy. |
| `offload_policy` | `MediaOffloadPolicy` | `THRESHOLD` | Override the default policy. |

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
