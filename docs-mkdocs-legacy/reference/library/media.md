# Media & Multimodal Reference

The `agentflow.media` module provides image processing, file storage, security validation, and provider-specific optimizations for multimodal agent workflows.

```python
from agentflow.media import (
    MultimodalConfig,
    MediaProcessor,
    BaseMediaStore,
    InMemoryMediaStore,
    LocalFileMediaStore,
    CloudMediaStore,
    MediaRefResolver,
    ensure_media_offloaded,
    validate_magic_bytes,
    sanitize_filename,
    enforce_file_size,
    ProviderMediaCache,
    should_use_google_file_api,
)
```

---

## Content Block Types

Messages carry multimodal content via **ContentBlock** types defined in `agentflow.state.message_block`:

| Block | Import | Description |
|-------|--------|-------------|
| `TextBlock` | `from agentflow.state.message_block import TextBlock` | Plain or formatted text |
| `ImageBlock` | `from agentflow.state.message_block import ImageBlock` | JPEG, PNG, WebP, GIF images |
| `AudioBlock` | `from agentflow.state.message_block import AudioBlock` | WAV, MP3, OGG audio (optional transcript) |
| `VideoBlock` | `from agentflow.state.message_block import VideoBlock` | MP4, WebM video (Google GenAI) |
| `DocumentBlock` | `from agentflow.state.message_block import DocumentBlock` | PDF, DOCX, etc. with optional extracted text |

All media blocks reference binary data through **MediaRef**:

```python
from agentflow.state.message_block import MediaRef

# By URL
ref = MediaRef(kind="url", url="https://example.com/photo.jpg", mime_type="image/jpeg")

# By inline base64
ref = MediaRef(kind="data", data_base64="iVBOR...", mime_type="image/png")

# By provider file ID
ref = MediaRef(kind="file_id", file_id="file-abc123", mime_type="application/pdf")
```

### Practical Guidance

As a library user, choose the media reference type based on the use case:

- `kind="url"`: Best for production when media already lives in object storage, a CDN, or another reachable URL.
- `kind="file_id"`: Best when you use the API upload flow and want the backend to resolve storage-backed media efficiently.
- `kind="data"`: Fine for small inline payloads, tests, and prototypes, but not the recommended production path.

If you pass `kind="data"` with base64 today, the content is sent inline unless you explicitly offload it. It will not automatically become a signed URL by itself.

### MediaRef Fields

| Field | Type | Description |
|-------|------|-------------|
| `kind` | `str` | `"url"`, `"data"`, or `"file_id"` |
| `url` | `str \| None` | External or `agentflow://` URL |
| `data_base64` | `str \| None` | Inline base64-encoded data |
| `file_id` | `str \| None` | Provider-specific file ID |
| `mime_type` | `str \| None` | MIME type (e.g. `"image/jpeg"`) |
| `size_bytes` | `int \| None` | File size in bytes |
| `filename` | `str \| None` | Original filename |
| `sha256` | `str \| None` | Content hash |
| `width` | `int \| None` | Image/video width in pixels |
| `height` | `int \| None` | Image/video height in pixels |
| `duration_ms` | `int \| None` | Audio/video duration in milliseconds |

---

## MultimodalConfig

Central configuration for how multimodal content is processed.

```python
from agentflow.media import MultimodalConfig, ImageHandling, DocumentHandling

config = MultimodalConfig(
    image_handling=ImageHandling.BASE64,        # BASE64 | URL | FILE_ID
    document_handling=DocumentHandling.EXTRACT_TEXT,  # EXTRACT_TEXT | PASS_RAW | SKIP
    max_image_size_mb=10.0,
    max_image_dimension=2048,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `image_handling` | `ImageHandling` | `BASE64` | How images are passed to the LLM |
| `document_handling` | `DocumentHandling` | `EXTRACT_TEXT` | How documents are processed |
| `max_image_size_mb` | `float` | `10.0` | Maximum image file size in MB |
| `max_image_dimension` | `int` | `2048` | Maximum width/height in pixels (auto-resize) |

---

## MediaProcessor

Validates and processes images before sending to LLMs.

```python
from agentflow.media import MediaProcessor, MultimodalConfig

proc = MediaProcessor(MultimodalConfig(max_image_dimension=2048))
```

### process(block)

Validate image data and resize if it exceeds `max_image_dimension`.

```python
processed = proc.process(image_block)
```

### full_process(block)

Full pipeline: validate → fix EXIF orientation → resize.

```python
processed = proc.full_process(image_block)
```

### fix_orientation(block)

Fix EXIF-based rotation for JPEG/TIFF images.

```python
fixed = proc.fix_orientation(image_block)
```

### generate_thumbnail(block, max_dim=256)

Create a JPEG thumbnail with the given maximum dimension.

```python
thumb = proc.generate_thumbnail(image_block, max_dim=128)
```

### optimize_image(block, target_format="JPEG", quality=85)

Convert format and compress with quality control.

```python
optimized = proc.optimize_image(image_block, target_format="WEBP", quality=80)
```

---

## Media Storage

Store binary media files externally (not in the agent state).

### BaseMediaStore

Abstract base class for all storage backends.

```python
key = await store.store(data: bytes, mime_type: str) -> str
data, mime = await store.retrieve(key: str) -> tuple[bytes, str]
```

### InMemoryMediaStore

In-memory storage for testing and development.

```python
from agentflow.media import InMemoryMediaStore

store = InMemoryMediaStore()
key = await store.store(image_bytes, "image/jpeg")
data, mime = await store.retrieve(key)
```

### LocalFileMediaStore

Filesystem storage for single-server deployments.

```python
from agentflow.media import LocalFileMediaStore

store = LocalFileMediaStore(base_path="./uploads")
key = await store.store(image_bytes, "image/jpeg")
```

### CloudMediaStore

S3/GCS storage for production multi-server deployments.

```python
from agentflow.media import CloudMediaStore

store = CloudMediaStore(bucket="my-bucket", prefix="media/")
```

---

## Media Offloading

Automatically strip inline base64 data from messages before checkpointing.

```python
from agentflow.media import ensure_media_offloaded, LocalFileMediaStore

store = LocalFileMediaStore(base_path="./uploads")
message = ensure_media_offloaded(message, store)
# ImageBlock.media now has kind="url", url="agentflow://media/abc123"
```

### Recommended Ingestion Pattern

If your application accepts base64 images from users, call `ensure_media_offloaded()` before graph execution.

That gives you the production path:

1. receive inline media from the client
2. offload it into a `BaseMediaStore`
3. replace base64 with a lightweight `agentflow://media/{key}` reference
4. let the resolver produce direct URLs for model providers when supported

This is the safest way to prevent large base64 blobs from inflating message payloads and memory usage.

### MediaOffloadPolicy

Configure when and how offloading occurs.

```python
from agentflow.media import MediaOffloadPolicy

policy = MediaOffloadPolicy(
    offload_images=True,
    offload_audio=True,
    offload_documents=True,
    min_size_bytes=1024,  # Only offload files larger than 1KB
)
```

---

## MediaRefResolver

Resolve `agentflow://` URLs back to binary data.

```python
from agentflow.media import MediaRefResolver

resolver = MediaRefResolver(store=store)
data = await resolver.resolve(media_ref)
```

---

## Security

### validate_magic_bytes(data, claimed_mime)

Verify that file content matches its claimed MIME type by checking magic byte signatures (PNG, JPEG, GIF, WebP, BMP, TIFF, PDF, ZIP).

```python
from agentflow.media import validate_magic_bytes

is_valid = validate_magic_bytes(file_bytes, "image/jpeg")  # True or False
```

### sanitize_filename(filename)

Remove path traversal, null bytes, and unsafe characters. Truncates to 255 chars preserving the extension.

```python
from agentflow.media import sanitize_filename

safe = sanitize_filename("../../../etc/passwd")  # "etcpasswd"
safe = sanitize_filename("")                      # "unnamed"
```

### enforce_file_size(data, max_mb)

Raise `ValueError` if data exceeds the size limit.

```python
from agentflow.media import enforce_file_size

enforce_file_size(data, max_mb=25.0)
```

---

## Provider Optimizations

### ProviderMediaCache

Content-addressed SHA-256 cache that prevents re-uploading the same file.

```python
from agentflow.media import ProviderMediaCache

cache = ProviderMediaCache(max_entries=1000)

key = cache.content_key(file_bytes)
cached = cache.get("google", key)

if not cached:
    ref = upload(file_bytes)
    cache.put("google", key, ref)
```

| Method | Description |
|--------|-------------|
| `content_key(data)` | SHA-256 hash of data |
| `get(provider, key)` | Lookup cached reference (or `None`) |
| `put(provider, key, ref)` | Store a reference with LRU eviction |
| `clear(provider=None)` | Clear one provider or all caches |

### should_use_google_file_api(data_size)

Returns `True` if the file exceeds the 20 MB inline threshold for Google GenAI.

```python
from agentflow.media import should_use_google_file_api

if should_use_google_file_api(len(data)):
    # Use google.genai File API
    pass
```

### create_openai_file_search_tool(file_ids)

Create an OpenAI `file_search` tool definition.

```python
from agentflow.media import create_openai_file_search_tool

tool = create_openai_file_search_tool(["file-abc", "file-def"])
# {"type": "file_search", "file_search": {"file_ids": [...]}}
```

### create_openai_file_attachment(file_id, tools)

Create an OpenAI file attachment dict.

```python
from agentflow.media import create_openai_file_attachment

attachment = create_openai_file_attachment("file-abc123", tools=["file_search"])
```

---

## See Also

- [Multimodal How-To Guide](../../how-to/multimodal.md) — End-to-end usage examples
- [Messages Reference](context/message.md) — Message structure and content blocks
- [TypeScript File Upload API](../client/file-upload.md) — Client-side file upload
