# Multimodal Guide

Send images, audio, video, and documents through your AgentFlow agents.

## Overview

AgentFlow supports multimodal content across all major providers (OpenAI, Google GenAI).
Content is modeled as **ContentBlock** types within messages — `TextBlock`, `ImageBlock`,
`AudioBlock`, `VideoBlock`, and `DocumentBlock` — plus a universal `MediaRef` to reference
binary data by URL, base64, or file ID.

## Quick Start

### Python SDK — Image Analysis

```python
import base64
from agentflow.state.message import Message
from agentflow.state.message_block import ImageBlock, MediaRef, TextBlock

# Create a message with an image URL
msg = Message(
    role="user",
    content=[
        TextBlock(text="What is in this image?"),
        ImageBlock(
            media=MediaRef(kind="url", url="https://example.com/photo.jpg", mime_type="image/jpeg")
        ),
    ],
)

# Or with base64-encoded data
with open("photo.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

msg = Message(
    role="user",
    content=[
        TextBlock(text="Describe this image"),
        ImageBlock(
            media=MediaRef(kind="data", data_base64=b64, mime_type="image/jpeg")
        ),
    ],
)
```

### TypeScript SDK — Image & File Upload

```typescript
import { AgentFlowClient, Message } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

// Quick helper for image messages
const msg = Message.withImage('What is in this image?', 'https://example.com/photo.jpg');

// Upload a file first, then reference it
const result = await client.uploadFile(myImageFile, 'photo.jpg');
// result.file_id, result.url

// Auto-detect file type (image → ImageBlock, PDF → DocumentBlock, etc.)
const msg2 = Message.withFile('Summarize this document', {
  url: result.url,
  mime_type: result.mime_type,
  filename: result.filename,
});

// Arbitrary multimodal content
const msg3 = Message.multimodal([
  { type: 'text', text: 'Compare these two images:' },
  { type: 'image', media: { kind: 'url', url: 'https://example.com/a.jpg' } },
  { type: 'image', media: { kind: 'url', url: 'https://example.com/b.jpg' } },
]);
```

## Content Block Types

| Block Type | Python Class | Description |
|-----------|-------------|-------------|
| Text | `TextBlock` | Plain or formatted text |
| Image | `ImageBlock` | JPEG, PNG, WebP, GIF images |
| Audio | `AudioBlock` | WAV, MP3, OGG audio with optional transcript |
| Video | `VideoBlock` | MP4, WebM video (Google GenAI only) |
| Document | `DocumentBlock` | PDF, DOCX, etc. with optional extracted text |

### MediaRef

All media blocks reference their binary data through `MediaRef`:

```python
class MediaRef(BaseModel):
    kind: str          # "url", "data", or "file_id"
    url: str | None    # External or agentflow:// URL
    data_base64: str | None  # Inline base64 data
    file_id: str | None      # Provider-specific file ID
    mime_type: str | None
    size_bytes: int | None
    filename: str | None
```

## File Upload API

### Upload a file

```
POST /v1/files/upload
Content-Type: multipart/form-data

file: <binary>
```

Response:
```json
{
  "file_id": "abc123",
  "mime_type": "image/jpeg",
  "size_bytes": 102400,
  "filename": "photo.jpg",
  "url": "agentflow://media/abc123",
  "extracted_text": null
}
```

### Retrieve a file

```
GET /v1/files/{file_id}
→ binary response with Content-Type header
```

### Get file info

```
GET /v1/files/{file_id}/info
→ FileInfoResponse JSON
```

### Multimodal configuration

```
GET /v1/config/multimodal
PUT /v1/config/multimodal
```

## Image Processing

Use `MediaProcessor` for image validation, resizing, optimisation, and EXIF handling:

```python
from agentflow.media import MediaProcessor, MultimodalConfig

proc = MediaProcessor(MultimodalConfig(
    max_image_size_mb=10.0,
    max_image_dimension=2048,
))

# Validate + resize
processed_block = proc.process(image_block)

# Full pipeline: fix EXIF orientation → validate → resize
processed_block = proc.full_process(image_block)

# Generate a thumbnail (default 256px max dimension)
thumbnail = proc.generate_thumbnail(image_block, max_dim=256)

# Optimize to JPEG
optimized = proc.optimize_image(image_block, target_format="JPEG", quality=85)
```

## Media Storage

Binary files should be stored externally (not in the database). AgentFlow provides
several `BaseMediaStore` backends:

| Backend | Class | Use Case |
|---------|-------|----------|
| In-memory | `InMemoryMediaStore` | Testing, development |
| Local filesystem | `LocalFileMediaStore` | Single-server deployments |
| Cloud (S3/GCS) | `CloudMediaStore` | Production, multi-server |

```python
from agentflow.media import LocalFileMediaStore

store = LocalFileMediaStore(base_path="./uploads")
key = await store.store(image_bytes, "image/jpeg")
data, mime = await store.retrieve(key)
```

### Offloading

Use `ensure_media_offloaded()` to automatically strip inline base64 data from
messages and store it externally before checkpointing:

```python
from agentflow.media import ensure_media_offloaded, LocalFileMediaStore

store = LocalFileMediaStore(base_path="./uploads")
message = ensure_media_offloaded(message, store)
# ImageBlock.media now has kind="url", url="agentflow://media/abc123"
# instead of kind="data", data_base64="..." 
```

## Security

### Magic Bytes Validation

Verify file content matches its claimed MIME type:

```python
from agentflow.media import validate_magic_bytes

is_valid = validate_magic_bytes(file_bytes, "image/jpeg")
```

### Filename Sanitization

```python
from agentflow.media import sanitize_filename

safe_name = sanitize_filename("../../../etc/passwd")  # → "etcpasswd"
```

### File Size Enforcement

```python
from agentflow.media import enforce_file_size

enforce_file_size(file_bytes, max_mb=25.0)  # raises ValueError if too large
```

## Configuration

### Agent-Level (Python)

```python
from agentflow.media import MultimodalConfig, ImageHandling, DocumentHandling

config = MultimodalConfig(
    image_handling=ImageHandling.BASE64,
    document_handling=DocumentHandling.EXTRACT_TEXT,
    max_image_size_mb=10.0,
    max_image_dimension=2048,
)
```

### API-Level (Environment Variables)

```bash
MEDIA_STORAGE_TYPE=local        # memory | local | s3 | gcs
MEDIA_STORAGE_PATH=./uploads    # For local storage
MEDIA_MAX_SIZE_MB=25            # Max upload size
MEDIA_DOCUMENT_HANDLING=extract_text  # extract_text | pass_raw | skip
```

## Provider Optimizations

### Google File API (Large Files)

Files over 20 MB are too large for inline base64. Use the Google File API:

```python
from agentflow.media import should_use_google_file_api
from agentflow.media.provider_media import upload_to_google_file_api, ProviderMediaCache

cache = ProviderMediaCache()

if should_use_google_file_api(len(data)):
    part = await upload_to_google_file_api(data, "image/jpeg", cache=cache)
```

### OpenAI File Search (PDFs)

For PDF analysis, use OpenAI's file_search tool:

```python
from agentflow.media.provider_media import create_openai_file_attachment

attachment = create_openai_file_attachment("file-abc123", tools=["file_search"])
```

### Content Caching

`ProviderMediaCache` prevents re-uploading the same file:

```python
from agentflow.media import ProviderMediaCache

cache = ProviderMediaCache(max_entries=1000)
key = cache.content_key(file_bytes)

if cached_ref := cache.get("google", key):
    # Reuse existing upload
    pass
else:
    ref = upload(file_bytes)
    cache.put("google", key, ref)
```

## Examples

### Image Analysis Agent

```python
from agentflow import Agent
from agentflow.state.message import Message
from agentflow.state.message_block import ImageBlock, MediaRef, TextBlock

agent = Agent(
    name="image-analyst",
    model="gpt-4o",
    instructions="You are an image analysis expert.",
)

msg = Message(
    role="user",
    content=[
        TextBlock(text="What objects can you see?"),
        ImageBlock(media=MediaRef(kind="url", url="https://example.com/scene.jpg")),
    ],
)

response = await agent.run(messages=[msg])
```

### Document Q&A Agent

```python
import base64

agent = Agent(
    name="doc-qa",
    model="gpt-4o",
    instructions="Answer questions about the provided documents.",
)

with open("report.pdf", "rb") as f:
    pdf_b64 = base64.b64encode(f.read()).decode()

msg = Message(
    role="user",
    content=[
        TextBlock(text="What are the key findings?"),
        DocumentBlock(
            media=MediaRef(kind="data", data_base64=pdf_b64, mime_type="application/pdf"),
        ),
    ],
)
```

### Multi-Agent with Media Stripping

Text-only sub-agents automatically receive stripped versions of multimodal
messages (images replaced with `[Image: filename]` placeholders):

```python
from agentflow import Agent, Graph

vision_agent = Agent(name="vision", model="gpt-4o")
text_agent = Agent(name="summarizer", model="gpt-4o-mini")

graph = Graph(agents=[vision_agent, text_agent])
# text_agent receives text-only messages even if the user sent images
```
