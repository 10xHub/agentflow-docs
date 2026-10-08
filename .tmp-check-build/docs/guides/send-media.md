# Send media to models

> Send images, audio, and documents to your models from Python using content blocks, MediaRef, and storage backends.

Source: https://10xgraph.com/docs/guides/send-media
Last updated: 2026-10-08

10xGraph supports multimodal input natively: send images, audio, video, and documents directly alongside text in messages. Each content type is a typed block, and media is referenced via `MediaRef`, which decouples message structure from where bytes actually live. You choose the transport: external URLs, inline base64, or deduplicated references through a storage backend.

---

## Content blocks and MediaRef

Any message is a list of **content blocks**. 10xGraph provides typed blocks for each medium:

```python
from tenxgraph.core.state import (
    TextBlock,
    ImageBlock,
    AudioBlock,
    VideoBlock,
    DocumentBlock,
    DataBlock,
    Message,
    MediaRef,
)
```

Each block except `TextBlock` holds a `MediaRef` that tells 10xGraph where the bytes are. `MediaRef` has three `kind` values:

| Kind | Use case |
|---|---|
| `url` | External URL or `graph://media/{key}` from a media store |
| `data` | Inline base64 for small payloads only |
| `file_id` | Reference to a file uploaded via the REST API or pre-stored in your media store |

---

## Example 1: Image from a public URL

Send an image directly from the web:

```python
from tenxgraph.core.graph import Agent
from tenxgraph.core.state import Message, TextBlock, ImageBlock, MediaRef

agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
)

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

result = agent.invoke({"messages": messages})
print(result["messages"][-1].content[0].text)
```

This is the simplest approach: the agent fetches the image and sends it to the model.

---

## Example 2: Inline base64 for small media

Embed bytes directly in the message for small payloads:

```python
import base64
from tenxgraph.core.state import Message, TextBlock, ImageBlock, MediaRef

# Read a local image
with open("photo.jpg", "rb") as f:
    image_bytes = f.read()

b64 = base64.b64encode(image_bytes).decode()

messages = [
    Message(
        role="user",
        content=[
            TextBlock(text="Describe this photo in one sentence."),
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

result = agent.invoke({"messages": messages})
```

This works well for development and testing. For production or repeated references, use a media store instead.

---

## Example 3: Media store for reusable references

Store media once, reference it many times:

```python
import asyncio
from tenxgraph.core.state import Message, TextBlock, ImageBlock, MediaRef
from tenxgraph.storage.media import InMemoryMediaStore

media_store = InMemoryMediaStore()

# Upload and get a storage key
async def setup():
    with open("chart.png", "rb") as f:
        key = await media_store.store(data=f.read(), mime_type="image/png")
    return key

key = asyncio.run(setup())

# Reference by key in a message
messages = [
    Message(
        role="user",
        content=[
            TextBlock(text="Analyze this chart and extract the numbers."),
            ImageBlock(
                media=MediaRef(
                    kind="file_id",
                    file_id=key,
                    mime_type="image/png",
                )
            ),
        ],
    )
]

result = agent.invoke({"messages": messages})
```

The store returns an opaque key. You can reference that key in unlimited messages without re-uploading the file. This is recommended for production.

---

## Audio and documents

Audio blocks work the same way as images:

```python
from tenxgraph.core.state import AudioBlock

messages = [
    Message(
        role="user",
        content=[
            TextBlock(text="Transcribe this audio."),
            AudioBlock(
                media=MediaRef(
                    kind="data",
                    data_base64=base64.b64encode(audio_bytes).decode(),
                    mime_type="audio/wav",
                ),
                sample_rate=16000,
                channels=1,
            ),
        ],
    )
]
```

Document blocks can include both extracted text and the raw file. Most models take text, so provide the text when you have it:

```python
from tenxgraph.core.state import DocumentBlock

messages = [
    Message(
        role="user",
        content=[
            TextBlock(text="Summarize this contract."),
            DocumentBlock(
                text="Optional: pre-extracted text if you have it already.",
                media=MediaRef(
                    kind="file_id",
                    file_id="my-doc-key",
                    mime_type="application/pdf",
                ),
            ),
        ],
    )
]
```

---

## Control media handling with MultimodalConfig

Pass `MultimodalConfig` to `Agent` to control how media is delivered to the LLM provider. Different providers support different transport modes; `MultimodalConfig` lets you specify preferences and size limits:

```python
from tenxgraph.core.graph import Agent
from tenxgraph.storage.media import (
    ImageHandling,
    DocumentHandling,
    MultimodalConfig,
)

agent = Agent(
    model="gpt-4-vision",
    provider="openai",
    multimodal_config=MultimodalConfig(
        image_handling=ImageHandling.BASE64,          # "base64" | "url" | "file_id"
        document_handling=DocumentHandling.EXTRACT_TEXT,  # "extract_text" | "pass_raw" | "skip"
        max_image_size_mb=10.0,
        max_image_dimension=2048,
        supported_image_types={"image/jpeg", "image/png", "image/webp"},
        supported_doc_types={"application/pdf"},
    ),
)
```

- **Image handling**: `BASE64` embeds inline, `URL` sends a URL reference, `FILE_ID` uses provider-native file upload APIs.
- **Document handling**: `EXTRACT_TEXT` converts PDFs to text (if extraction is available), `FORWARD_RAW` sends the raw file, `SKIP` ignores documents.

The resolver attempts transport modes in preference order based on your strategy and the provider's capabilities. You do not need to manage fallbacks.

---

## Complete graph with media store

Here is a production-ready example that combines a graph, checkpointer, and media store:

```python
import asyncio
from tenxgraph.core.graph import Agent, StateGraph
from tenxgraph.core.state import (
    ImageBlock,
    MediaRef,
    Message,
    TextBlock,
)
from tenxgraph.storage.checkpointer import InMemoryCheckpointer
from tenxgraph.storage.media import (
    ImageHandling,
    InMemoryMediaStore,
    MultimodalConfig,
)
from tenxgraph.utils import END

async def main():
    checkpointer = InMemoryCheckpointer()
    media_store = InMemoryMediaStore()

    agent = Agent(
        model="gemini-2.5-flash",
        provider="google",
        system_prompt="You are a helpful image analyst.",
        multimodal_config=MultimodalConfig(
            image_handling=ImageHandling.BASE64,
        ),
    )

    graph = StateGraph()
    graph.add_node("agent", agent)
    graph.set_entry_point("agent")
    graph.add_edge("agent", END)

    app = graph.compile(checkpointer=checkpointer)

    # Upload an image
    with open("sample.jpg", "rb") as f:
        image_key = await media_store.store(
            data=f.read(),
            mime_type="image/jpeg",
        )

    # Create a message referencing the stored image
    messages = [
        Message(
            role="user",
            content=[
                TextBlock(text="What objects do you see?"),
                ImageBlock(
                    media=MediaRef(
                        kind="file_id",
                        file_id=image_key,
                        mime_type="image/jpeg",
                    )
                ),
            ],
        )
    ]

    # Invoke
    result = app.invoke(
        {"messages": messages},
        config={"thread_id": "image-analysis-1"},
    )

    # Print the response
    for block in result["messages"][-1].content:
        if hasattr(block, "text"):
            print(block.text)

asyncio.run(main())
```

---

## Media store backends

10xGraph provides three storage backends. Choose based on your deployment model:

**InMemoryMediaStore**, Development and testing. Data is lost on process restart.

```python
from tenxgraph.storage.media import InMemoryMediaStore

store = InMemoryMediaStore()
key = await store.store(data=image_bytes, mime_type="image/png")
bytes_back, mime = await store.retrieve(key)
```

**LocalFileMediaStore**, Single-server deployments. Stores files on disk with sharding.

```python
from tenxgraph.storage.media.storage import LocalFileMediaStore

store = LocalFileMediaStore(base_dir="./media")
key = await store.store(data=pdf_bytes, mime_type="application/pdf")
```

Files are sharded as `{base_dir}/{key[:2]}/{key[2:4]}/{key}.{ext}` with a `.meta.json` sidecar for metadata.

**CloudMediaStore**, Multi-worker and cloud deployments. Stores in S3 or GCS.

```bash
pip install "10xgraph[cloud-storage]"
```

```python
from cloud_storage_manager import CloudStorageFactory, StorageProvider, StorageConfig, AwsConfig
from tenxgraph.storage.media import CloudMediaStore

config = StorageConfig(
    aws=AwsConfig(bucket_name="my-bucket", access_key_id="...", secret_access_key="...")
)
storage = CloudStorageFactory.get_storage(StorageProvider.AWS, config)
store = CloudMediaStore(storage, prefix="10xgraph-media")
```

All stores expose the same async interface: `store()`, `retrieve()`, `delete()`, `exists()`, and `get_metadata()`.

---

## Common patterns and pitfalls

**Don't re-encode for every message.** If you send the same image multiple times, store it once and reference the key. This saves bandwidth and encoding overhead.

**Provide MIME types.** Always include `mime_type` in `MediaRef`. The provider needs it to interpret the bytes correctly.

**Size limits are configurable.** When running behind the API server, check `MEDIA_MAX_SIZE_MB` and `MEDIA_ALLOWED_CONTENT_TYPES` environment variables. For Python graphs, `MultimodalConfig.max_image_size_mb` applies locally.

**Pre-extract text when possible.** Document blocks can carry both raw bytes and pre-extracted text. If you have text extracted already (e.g. from a PDF parser), include it via the `text` parameter so the model has text to work with even if it cannot process the raw file.

**Video is supported.** You can send video via `VideoBlock` the same way you send images and audio. Whether the model processes it depends on provider capabilities.

---

## What you learned

- Message content is a list of typed blocks: `TextBlock`, `ImageBlock`, `AudioBlock`, `DocumentBlock`, etc.
- `MediaRef` decouples message structure from media transport: `kind="url"` for public URLs, `kind="data"` for inline base64, `kind="file_id"` for storage references.
- Use `InMemoryMediaStore` for development, `LocalFileMediaStore` for single servers, `CloudMediaStore` for multi-worker setups.
- `MultimodalConfig` on the `Agent` controls how media is sent to each provider (base64, URLs, or native file APIs).
- Always provide MIME types and respect size limits.

---

## Related pages

- [Concepts: Media and files](/docs/concepts/media-and-files): The reference concept for media types and provider capabilities.
- [Concepts: State and messages](/docs/concepts/state-and-messages): Content block details and message structure.
- [Server: Files and multimodal](/docs/server/files-and-multimodal): File upload via the REST API and media configuration.
- [Reference: Media](/docs/reference/python/media): Full API for media stores and configuration classes.

## Frequently asked questions

### When should I use each MediaRef kind?

Use `url` for public or CDN-hosted media. Use `data` for small payloads embedded directly in the message. Use `file_id` for repeated references or production workflows with a media store.

### Do I need a media store for production?

For single-server setups, LocalFileMediaStore works. For multi-worker or cloud deployments, use CloudMediaStore (S3/GCS) so all workers can access the same files.

### Can I send media over the REST API?

Yes. Upload via POST /v1/files/upload, get a file_id, and reference it in your message. That flow is separate from Python; see /docs/server/files-and-multimodal.
