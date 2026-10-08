---
title: Media and Files
seoTitle: "Multimodal messages: media and files"
description: "How 10xGraph handles media in multimodal messages: MediaRef decouples location from structure, storage backends serve files, and providers adapt automatically."
section: Concepts
order: 200
group: "Serving"
label: Media and Files
updated: "2026-10-08"
faq:
  - q: "What's the difference between file_id, url, and data?"
    a: "file_id stores media in a backend store and references it by key (best for production); url points to external media the provider fetches; data embeds bytes inline as base64 (only for small payloads)."
  - q: "Do I need to upload files myself?"
    a: "No. For Python, you can inline data or use external URLs directly. For the API server, use /v1/files/upload; the server manages the store. For the TypeScript client, use uploadFile()."
  - q: "Which approach is best for my use case?"
    a: "Inline data (base64) for small, one-off payloads. External URLs if the media is already hosted. file_id for multi-step flows or production systems where durability matters."
---

10xGraph has built-in multimodal support for messages containing text, images, audio, video, and documents. The design separates message structure from data location through **MediaRef**, allowing the same message to reference media from URLs, inline base64, or cloud storage without changing the block types. This page explains the architecture; task guides for sending media are in `/docs/guides/send-media` and `/docs/client/files-and-multimodal`.

## Why separate location from structure

Messages in 10xGraph are lightweight: a message does not hold binary data directly. Instead, blocks (ImageBlock, AudioBlock, DocumentBlock) reference media via `MediaRef`, which specifies where the bytes actually live. This design buys three things: messages stay small and copy fast over the network, media can be deduplicated across runs on the same backend store, and different contexts (Python, REST API, TypeScript) handle media differently without changing your message structure.

## Content block types

All block types live in `tenxgraph.core.state`. Multimodal blocks (Image, Audio, Video, Document, Data) all carry a `MediaRef` that points to the actual media.

| Class | Role |
|---|---|
| `TextBlock` | Plain text content |
| `ImageBlock` | Images referenced by MediaRef (PNG, JPEG, WebP, GIF) |
| `AudioBlock` | Audio referenced by MediaRef (WAV, MP3, OGG) |
| `VideoBlock` | Video referenced by MediaRef (MP4, WebM) |
| `DocumentBlock` | Documents referenced by MediaRef, with optional extracted text (PDFs, Word, plain text) |
| `DataBlock` | Any binary blob with a MIME type |
| `ToolCallBlock` | Tool invocation request from the model |
| `ToolResultBlock` | Result returned from a tool execution |
| `ReasoningBlock` | Chain-of-thought reasoning traces |
| `AnnotationBlock` | Citations and structured references |
| `ErrorBlock` | Error information from failed operations |

## MediaRef — how to reference media

`MediaRef` tells a block where to fetch the binary data. It has three `kind` values, each with different trade-offs:

```python
from tenxgraph.core.state import MediaRef

# 1. URL: external hosted media; provider fetches it
MediaRef(kind="url", url="https://example.com/photo.png", mime_type="image/png")

# 2. Inline base64: bytes embedded in the message (small payloads only)
MediaRef(kind="data", data_base64="iVBORw0KGg...", mime_type="image/png")

# 3. Store key: media uploaded to a MediaStore first, referenced by opaque key
MediaRef(kind="file_id", file_id="a1b2c3d4e5f6...", mime_type="image/png")
```

### Full MediaRef fields

```python
class MediaRef(BaseModel):
    kind: Literal["url", "file_id", "data"] = "url"
    url: str | None = None              # https:// or graph://media/<key>
    file_id: str | None = None          # storage key from MediaStore.store()
    data_base64: str | None = None      # small payloads only
    mime_type: str | None = None
    size_bytes: int | None = None       # optional size hint
    sha256: str | None = None           # optional checksum
    filename: str | None = None         # original filename if applicable
    # Media-specific metadata
    width: int | None = None            # image width
    height: int | None = None           # image height
    duration_ms: int | None = None      # audio/video duration
    page: int | None = None             # document page number
```

### When to use each kind

**kind="url"** is best when media is already hosted (CDN, public web link, or a signed URL from cloud storage). The provider fetches it over HTTPS. No upload step needed, but network access from the provider is required.

**kind="data"** is simplest for small files (icons, small images, short audio clips) but the bytes go over the wire with every message. Avoid for large media or when the same file is sent multiple times.

**kind="file_id"** is production best practice: upload once, reference forever. The file lives in a backend store (in-memory for tests, local filesystem or cloud storage for real systems). Ideal for multi-step flows or when the same document is analyzed by multiple agents.

## MediaStore — persistent storage backends

A `MediaStore` holds media bytes outside the message system. Each backend is a class implementing `BaseMediaStore`:

```python
class BaseMediaStore(ABC):
    async def store(data: bytes, mime_type: str, metadata: dict | None) -> str
    async def retrieve(storage_key: str) -> tuple[bytes, str]
    async def delete(storage_key: str) -> bool
    async def exists(storage_key: str) -> bool
    async def get_metadata(storage_key: str) -> dict | None
```

All methods are async; they are safe to call from agent nodes and tools via normal `await`.

### Available implementations

| Class | Location | Best for |
|---|---|---|
| `InMemoryMediaStore` | `tenxgraph.storage.media` | Tests, development, single-process |
| `LocalFileMediaStore` | `tenxgraph.storage.media.storage` | Development, single-server deployments |
| `CloudMediaStore` | `tenxgraph.storage.media.storage` | Production with S3 / GCS |

**InMemoryMediaStore** stores files in RAM. Data is lost on process restart and is not shared across workers. Use it for testing and local development.

**LocalFileMediaStore** shards files on disk under a base directory. Each file is stored as `{base_dir}/{key[:2]}/{key[2:4]}/{key}.{ext}` with a `.meta.json` sidecar. Suitable for single-server deployments or development environments with persistent storage.

**CloudMediaStore** offloads to S3 or GCS via the cloud-storage-manager SDK. Requires the `[cloud-storage]` extra. Generates signed URLs so providers can fetch media directly without re-downloading to your server. The right choice for distributed systems and production deployments.

## MultimodalConfig — how agents adapt media for providers

Not every LLM provider handles every media type or transport mode the same way. `MultimodalConfig` lets you specify per-agent strategies, and the runtime adapts messages automatically.

```python
from tenxgraph.core.graph import Agent
from tenxgraph.storage.media import ImageHandling, DocumentHandling, MultimodalConfig

agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    multimodal_config=MultimodalConfig(
        image_handling=ImageHandling.BASE64,
        document_handling=DocumentHandling.EXTRACT_TEXT,
        max_image_size_mb=10.0,
        max_image_dimension=2048,
        supported_image_types={"image/jpeg", "image/png", "image/webp", "image/gif"},
        supported_doc_types={"application/pdf"},
    ),
)
```

### Image handling strategies

| Strategy | When to use |
|---|---|
| `ImageHandling.BASE64` | Embed inline (provider must accept base64; best for small images) |
| `ImageHandling.URL` | Send a URL directly (provider fetches it; requires network access) |
| `ImageHandling.FILE_ID` | Use provider-native file APIs (e.g., Google File API; most robust) |

The runtime tries strategies in order of preference. If the first fails, it falls back to the next.

### Document handling strategies

| Strategy | Behavior |
|---|---|
| `DocumentHandling.EXTRACT_TEXT` | Parse the document and send extracted text as TextBlock |
| `DocumentHandling.FORWARD_RAW` | Send raw bytes to the provider (if supported) |
| `DocumentHandling.SKIP` | Ignore document blocks entirely |

## Provider capability matrix and fallback

10xGraph maintains an internal capability matrix (`tenxgraph.storage.media.capabilities`) that maps each provider and model to what it supports. When your agent sends media, the system tries to deliver it in this order:

1. **remote_url**: Send a public or signed HTTPS URL directly.
2. **provider_file**: Use the provider's native file upload API (e.g., Google Files API, OpenAI file search).
3. **inline_bytes**: Embed as base64 data URI.
4. **unsupported**: The provider does not support this media type.

You do not manually manage this chain. `MultimodalConfig` tells the system which strategies you prefer, and the resolver automatically picks the best transport for each provider and falls back gracefully.

### Example: why this matters

If you configure `image_handling=ImageHandling.FILE_ID` but your model does not support file APIs, the resolver automatically tries URL mode, then inline base64. If a file is too large for inline delivery, it switches to URL or file mode. This keeps your code simple: you write one message structure and trust the system to adapt.

## Trade-offs and design decisions

**Inline (base64) vs. URL vs. file_id:**
- Inline is easiest to reason about (everything is in the message) but wastes bandwidth and memory for large or repeated files.
- URL is fast if media is already hosted and the provider has network access, but introduces an external dependency.
- file_id decouples the message from storage and enables deduplication, but requires infrastructure (a MediaStore backend).

**Per-agent config vs. global config:**
MultimodalConfig is per-agent, so different agents in the same graph can use different strategies. A vision agent might prefer inline base64 for speed, while a document processing agent uses file_id for durability.

**Messages stay lightweight:**
By never storing raw bytes in messages, 10xGraph keeps state snapshots small, thread history fast to retrieve, and checkpoints cheap to store. Media bytes live in specialized stores where they belong.

## Related pages

- [Sending media from Python](/docs/guides/send-media) — task guide with code examples for all reference types.
- [REST API files endpoint](/docs/server/files-and-multimodal) — how the API server manages file upload and media serving.
- [TypeScript client files](/docs/client/files-and-multimodal) — using the client SDK for multimodal requests.
- [State and messages](/docs/concepts/state-and-messages) — the full message structure and block types.
