# QdrantStore Documentation

## Overview

`QdrantStore` is a modern, async-first vector store implementation for  Agentflow that uses [Qdrant](https://qdrant.tech/) as the backend vector database. It provides efficient vector similarity search, memory management, and supports both local and cloud Qdrant deployments.

## Features

- **Async-first design** for optimal performance
- **Configurable embedding services** (OpenAI, custom implementations)
- **Multiple deployment options** (local, remote, cloud)
- **Rich metadata filtering** and search capabilities
- **User and agent-scoped operations**
- **Batch operations** for high-throughput scenarios
- **Automatic collection management**
- **Multiple distance metrics** (cosine, euclidean, dot product, manhattan)

## Installation

Install  Agentflow with Qdrant support:

```bash
pip install 'agentflow[qdrant]'
```

For OpenAI embeddings, also install:

```bash
pip install openai
```

## Quick Start

### 1. Basic Setup with Local Qdrant

```python
import asyncio
from agentflow.store import QdrantStore
from agentflow.store.qdrant_store import OpenAIEmbeddingService

# Create embedding service
embedding_service = OpenAIEmbeddingService(api_key="your-openai-key")

# Create local Qdrant store
store = QdrantStore(
    embedding_service=embedding_service,
    path="./qdrant_data"  # Local file-based storage
)


async def main():
    # Initialize the store
    await store.asetup()

    # Configuration for operations
    config = {
        "user_id": "user123",
        "agent_id": "agent456"
    }

    # Store a memory
    memory_id = await store.astore(
        config=config,
        content="I love learning about AI and machine learning",
        memory_type=MemoryType.EPISODIC,
        category="interests"
    )

    # Search for memories
    results = await store.asearch(
        config=config,
        query="artificial intelligence",
        limit=5
    )

    # Clean up
    await store.arelease()


asyncio.run(main())
```

### 2. Remote Qdrant Server

```python
from agentflow.store.qdrant_store import create_remote_qdrant_store

store = create_remote_qdrant_store(
    host="localhost",  # or your Qdrant server IP
    port=6333,
    embedding_service=embedding_service
)
```

### 3. Qdrant Cloud

```python
from agentflow.store.qdrant_store import create_cloud_qdrant_store

store = create_cloud_qdrant_store(
    url="https://your-cluster.qdrant.io",
    api_key="your-qdrant-api-key",
    embedding_service=embedding_service
)
```

## Embedding Services

### OpenAI Embeddings

```python
from agentflow.store.qdrant_store import OpenAIEmbeddingService

# Small model (1536 dimensions, faster)
embedding_service = OpenAIEmbeddingService(
    model="text-embedding-3-small",
    api_key="your-openai-key"
)

# Large model (3072 dimensions, more accurate)
embedding_service = OpenAIEmbeddingService(
    model="text-embedding-3-large",
    api_key="your-openai-key"
)
```

### Custom Embedding Service

Implement the `EmbeddingService` protocol:

```python
from agentflow.store.qdrant_store import EmbeddingService


class MyCustomEmbeddingService:
    def __init__(self):
        self._dimension = 768

    async def embed(self, text: str) -> list[float]:
        # Your embedding logic here
        # Return a list of floats with length = self.dimension
        pass

    @property
    def dimension(self) -> int:
        return self._dimension


# Use your custom service
embedding_service = MyCustomEmbeddingService()
store = QdrantStore(embedding_service=embedding_service, path="./data")
```

## Memory Operations

### Storing Memories

```python
# Store string content
memory_id = await store.astore(
    config=config,
    content="Today I learned about vector databases",
    memory_type=MemoryType.EPISODIC,
    category="learning",
    metadata={"topic": "databases", "date": "2024-01-15"}
)

# Store Message objects
from agentflow.utils import Message

message = Message.from_text("Hello world", role="user")
memory_id = await store.astore(config=config, content=message)

# Batch storage
memories = ["Memory 1", "Memory 2", "Memory 3"]
batch_id = await store.abatch_store(
    config=config,
    content=memories,
    memory_type=MemoryType.EPISODIC
)
```

### Searching Memories

```python
# Basic search
results = await store.asearch(
    config=config,
    query="machine learning concepts",
    limit=10
)

# Search with filters
results = await store.asearch(
    config=config,
    query="learning experiences",
    memory_type=MemoryType.EPISODIC,
    category="education",
    score_threshold=0.7,
    filters={"topic": "AI"}
)
```

### Retrieving Specific Memories

```python
memory = await store.aget(config=config, memory_id="memory-uuid")
if memory:
    print(f"Content: {memory.content}")
    print(f"Score: {memory.score}")
    print(f"Metadata: {memory.metadata}")
```

### Updating Memories

```python
await store.aupdate(
    config=config,
    memory_id="memory-uuid",
    content="Updated content",
    metadata={"updated": True, "version": 2}
)
```

### Deleting Memories

```python
# Delete specific memory
await store.adelete(config=config, memory_id="memory-uuid")

# Delete all memories for a user/agent
await store.aforget_memory(config=config)
```

## Configuration Options

### Store Configuration

```python
store = QdrantStore(
    embedding_service=embedding_service,
    # Connection options (choose one)
    path="./local_data",              # Local file storage
    host="localhost", port=6333,      # Remote server
    url="https://...", api_key="...", # Qdrant Cloud

    # Store options
    default_collection="my_memories",
    distance_metric=DistanceMetric.COSINE,

    # Qdrant client options
    timeout=30,
    prefer_grpc=True,
    https_port=443
)
```

### Runtime Configuration

```python
config = {
    "user_id": "user123",        # Filter memories by user
    "agent_id": "agent456",      # Filter memories by agent
    "collection": "custom_name", # Use specific collection
}
```

## Memory Types and Categories

```python
from agentflow.store.store_schema import MemoryType

# Memory types
MemoryType.EPISODIC  # Personal experiences, events
MemoryType.SEMANTIC  # Facts and knowledge
MemoryType.PROCEDURAL  # How-to knowledge, procedures
MemoryType.ENTITY  # Entity-specific information
MemoryType.RELATIONSHIP  # Entity relationships
MemoryType.DECLARATIVE  # Explicit facts and events
MemoryType.CUSTOM  # Custom memory types

# Categories are free-form strings for organization
categories = ["work", "personal", "learning", "tasks", "conversations"]
```

## Distance Metrics

```python
from agentflow.store.store_schema import DistanceMetric

DistanceMetric.COSINE  # Cosine similarity (default)
DistanceMetric.EUCLIDEAN  # Euclidean distance
DistanceMetric.DOT_PRODUCT  # Dot product
DistanceMetric.MANHATTAN  # Manhattan distance
```

## Error Handling

```python
try:
    await store.astore(config=config, content="Memory content")
except ValueError as e:
    print(f"Invalid input: {e}")
except ConnectionError as e:
    print(f"Qdrant connection error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
finally:
    await store.arelease()
```

## Performance Tips

1. **Use batch operations** for storing multiple memories
2. **Set appropriate score thresholds** to limit search results
3. **Use specific filters** to narrow search scope
4. **Choose the right embedding model** (small vs large)
5. **Configure Qdrant appropriately** for your use case
6. **Reuse store instances** rather than creating new ones repeatedly

## Development and Testing

See `tests/store/test_qdrant_store.py` for comprehensive test examples and `examples/store/qdrant_usage_example.py` for detailed usage patterns.

## Dependencies

- `qdrant-client>=1.7.0` - Qdrant Python client
- `openai` (optional) - For OpenAI embeddings
- `agentflow` - Core  Agentflow framework

## Troubleshooting

### Common Issues

1. **Import Error**: Install qdrant-client with `pip install '-agenflow[qdrant]'`
2. **Connection Error**: Ensure Qdrant server is running and accessible
3. **Embedding Dimension Mismatch**: Ensure all embeddings use the same dimension
4. **API Key Issues**: Verify OpenAI API key is set correctly
5. **Permission Errors**: Check file system permissions for local storage

### Local Qdrant Setup

Using Docker:
```bash
docker run -p 6333:6333 -p 6334:6334 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
```

### Logging

Enable debug logging to troubleshoot issues:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("agentflow.store.qdrant_store")
```
