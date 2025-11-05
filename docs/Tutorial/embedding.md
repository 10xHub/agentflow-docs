# Embedding Services Tutorial

## Overview

Embedding services are essential components for semantic search and similarity-based retrieval in Agentflow. They convert text into dense vector representations (embeddings) that capture semantic meaning, enabling your agents to find relevant knowledge based on conceptual similarity rather than just keyword matching.

## What Are Embeddings?

Embeddings are numerical vectors that represent the semantic meaning of text. Similar concepts are positioned close together in this high-dimensional vector space:

```python
# Two semantically similar phrases will have similar embeddings
embedding1 = await embedding.aembed("debugging techniques")
embedding2 = await embedding.aembed("troubleshooting methods")
# These vectors will be close to each other

embedding3 = await embedding.aembed("cooking recipes")
# This vector will be far from the above two
```

## Available Embedding Services

Agentflow provides a base abstraction with OpenAI implementation, and you can easily create custom implementations.

### OpenAI Embeddings

The most common and easiest to use:

```python
from agentflow.store.embedding import OpenAIEmbedding

# Using default model (text-embedding-3-small)
embedding = OpenAIEmbedding(api_key="your-openai-key")

# Using a specific model
embedding = OpenAIEmbedding(
    model="text-embedding-3-large",
    api_key="your-openai-key"
)
```

### Custom Embeddings

Implement your own embedding service:

```python
from agentflow.store.embedding import BaseEmbedding

class CustomEmbedding(BaseEmbedding):
    async def aembed(self, text: str) -> list[float]:
        # Your embedding logic
        pass
    
    async def aembed_batch(self, texts: list[str]) -> list[list[float]]:
        # Batch embedding logic
        pass
    
    @property
    def dimension(self) -> int:
        return 768  # Your model's dimension
```

## Installation

### OpenAI Embeddings

```bash
pip install openai
```

Set your API key:

```bash
export OPENAI_API_KEY=sk-your-key-here
```

Or provide it in code:

```python
embedding = OpenAIEmbedding(api_key="sk-your-key-here")
```

## Quick Start

### 1. Basic Usage

```python
import asyncio
from agentflow.store.embedding import OpenAIEmbedding

async def main():
    # Create embedding service
    embedding = OpenAIEmbedding(
        model="text-embedding-3-small",
        api_key="your-openai-key"
    )
    
    # Embed a single text
    vector = await embedding.aembed("Hello, world!")
    print(f"Dimension: {len(vector)}")
    print(f"First 5 values: {vector[:5]}")
    
    # Embed multiple texts efficiently
    texts = [
        "Machine learning is fascinating",
        "I love artificial intelligence",
        "Cooking is my hobby"
    ]
    vectors = await embedding.aembed_batch(texts)
    print(f"Generated {len(vectors)} vectors")

asyncio.run(main())
```

### 2. Using with QdrantStore

The most common pattern - integrate with vector storage:

```python
from agentflow.store import QdrantStore
from agentflow.store.embedding import OpenAIEmbedding
from agentflow.store.store_schema import MemoryType

# Create embedding service
embedding = OpenAIEmbedding(
    model="text-embedding-3-small"
)

# Create store with embedding service
store = QdrantStore(
    embedding=embedding,
    path="./qdrant_data"
)

# Initialize store
await store.asetup()

# Store automatically embeds content
config = {"user_id": "alice", "thread_id": "session_1"}
await store.astore(
    config=config,
    content="User prefers dark mode",
    memory_type=MemoryType.SEMANTIC
)

# Search automatically embeds query
results = await store.asearch(
    config=config,
    query="UI preferences"
)
```

### 3. Direct Similarity Computation

Calculate similarity between texts:

```python
from agentflow.store.embedding import OpenAIEmbedding
import numpy as np

embedding = OpenAIEmbedding()

# Get embeddings
query_vector = await embedding.aembed("debugging techniques")
doc1_vector = await embedding.aembed("using print statements to trace bugs")
doc2_vector = await embedding.aembed("cooking pasta recipes")

# Compute cosine similarity
def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    v1_array = np.array(v1)
    v2_array = np.array(v2)
    return np.dot(v1_array, v2_array) / (
        np.linalg.norm(v1_array) * np.linalg.norm(v2_array)
    )

sim1 = cosine_similarity(query_vector, doc1_vector)
sim2 = cosine_similarity(query_vector, doc2_vector)

print(f"Similarity to debugging doc: {sim1:.3f}")  # High similarity
print(f"Similarity to cooking doc: {sim2:.3f}")     # Low similarity
```

## OpenAI Embedding Models

### Available Models

```python
# Small model (1536 dimensions) - faster, lower cost
embedding = OpenAIEmbedding(model="text-embedding-3-small")

# Large model (3072 dimensions) - more accurate
embedding = OpenAIEmbedding(model="text-embedding-3-large")

# Check the dimension
print(f"Vector dimension: {embedding.dimension}")
```

### Model Selection Guide

| Model | Dimensions | Use Case | Performance | Cost |
|-------|-----------|----------|-------------|------|
| text-embedding-3-small | 1536 | General purpose, high throughput | Fast | Low |
| text-embedding-3-large | 3072 | High accuracy requirements | Slower | Higher |

**Choose text-embedding-3-small when:**
- Building general-purpose applications
- Cost optimization is important
- Speed is a priority
- Working with large volumes of text

**Choose text-embedding-3-large when:**
- Precision is critical
- Working with specialized domains
- Query quality matters more than speed
- Budget allows for higher accuracy

## Custom Embedding Implementations

### Example: Hugging Face Embeddings

```python
from agentflow.store.embedding import BaseEmbedding
from sentence_transformers import SentenceTransformer
import asyncio

class HuggingFaceEmbedding(BaseEmbedding):
    """Custom embedding using Hugging Face models."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self._dimension = self.model.get_sentence_embedding_dimension()
    
    async def aembed(self, text: str) -> list[float]:
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        embedding = await loop.run_in_executor(
            None,
            lambda: self.model.encode(text, convert_to_numpy=True)
        )
        return embedding.tolist()
    
    async def aembed_batch(self, texts: list[str]) -> list[list[float]]:
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            None,
            lambda: self.model.encode(texts, convert_to_numpy=True)
        )
        return [emb.tolist() for emb in embeddings]
    
    @property
    def dimension(self) -> int:
        return self._dimension

# Use custom embedding
embedding = HuggingFaceEmbedding(model_name="all-MiniLM-L6-v2")
store = QdrantStore(embedding=embedding, path="./data")
```

### Example: Cached Embedding Service

Add caching to reduce API calls:

```python
from agentflow.store.embedding import BaseEmbedding, OpenAIEmbedding
import hashlib

class CachedEmbedding(BaseEmbedding):
    """Embedding service with LRU cache."""
    
    def __init__(
        self,
        base_embedding: BaseEmbedding,
        cache_size: int = 1000
    ):
        self.base = base_embedding
        self._cache = {}
        self._cache_size = cache_size
        self._dimension = base_embedding.dimension
    
    def _get_cache_key(self, text: str) -> str:
        return hashlib.md5(text.encode()).hexdigest()
    
    async def aembed(self, text: str) -> list[float]:
        cache_key = self._get_cache_key(text)
        
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        # Generate embedding
        vector = await self.base.aembed(text)
        
        # Store in cache (simple LRU)
        if len(self._cache) >= self._cache_size:
            # Remove oldest entry
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
        
        self._cache[cache_key] = vector
        return vector
    
    async def aembed_batch(self, texts: list[str]) -> list[list[float]]:
        results = []
        uncached_texts = []
        uncached_indices = []
        
        # Check cache first
        for i, text in enumerate(texts):
            cache_key = self._get_cache_key(text)
            if cache_key in self._cache:
                results.append(self._cache[cache_key])
            else:
                uncached_texts.append(text)
                uncached_indices.append(i)
                results.append(None)  # Placeholder
        
        # Batch process uncached texts
        if uncached_texts:
            new_vectors = await self.base.aembed_batch(uncached_texts)
            
            # Update cache and results
            for text, vector, idx in zip(
                uncached_texts, new_vectors, uncached_indices
            ):
                cache_key = self._get_cache_key(text)
                self._cache[cache_key] = vector
                results[idx] = vector
        
        return results
    
    @property
    def dimension(self) -> int:
        return self._dimension

# Use cached embedding
base = OpenAIEmbedding()
cached_embedding = CachedEmbedding(base, cache_size=1000)
store = QdrantStore(embedding=cached_embedding, path="./data")
```

### Example: Text Preprocessing Pipeline

Add preprocessing before embedding:

```python
from agentflow.store.embedding import BaseEmbedding, OpenAIEmbedding
import re

class PreprocessedEmbedding(BaseEmbedding):
    """Embedding with text preprocessing."""
    
    def __init__(self, base_embedding: BaseEmbedding):
        self.base = base_embedding
        self._dimension = base_embedding.dimension
    
    def _preprocess(self, text: str) -> str:
        """Clean and normalize text."""
        # Convert to lowercase
        text = text.lower()
        
        # Remove special characters
        text = re.sub(r'[^\w\s]', '', text)
        
        # Normalize whitespace
        text = ' '.join(text.split())
        
        # Truncate if too long (model-specific limit)
        max_chars = 8000
        if len(text) > max_chars:
            text = text[:max_chars]
        
        return text
    
    async def aembed(self, text: str) -> list[float]:
        cleaned = self._preprocess(text)
        return await self.base.aembed(cleaned)
    
    async def aembed_batch(self, texts: list[str]) -> list[list[float]]:
        cleaned_texts = [self._preprocess(t) for t in texts]
        return await self.base.aembed_batch(cleaned_texts)
    
    @property
    def dimension(self) -> int:
        return self._dimension

# Use preprocessed embedding
base = OpenAIEmbedding()
embedding = PreprocessedEmbedding(base)
store = QdrantStore(embedding=embedding, path="./data")
```

## Performance Optimization

### 1. Use Batch Operations

```python
# ❌ Slow: Individual API calls
vectors = []
for text in texts:
    vector = await embedding.aembed(text)
    vectors.append(vector)

# ✅ Fast: Single batch call
vectors = await embedding.aembed_batch(texts)
```

### 2. Parallelize Independent Operations

```python
import asyncio

# ✅ Process multiple batches concurrently
async def embed_all(text_batches: list[list[str]]):
    tasks = [
        embedding.aembed_batch(batch)
        for batch in text_batches
    ]
    results = await asyncio.gather(*tasks)
    return [vec for batch in results for vec in batch]

# Split into chunks and process in parallel
chunk_size = 100
chunks = [texts[i:i+chunk_size] for i in range(0, len(texts), chunk_size)]
all_vectors = await embed_all(chunks)
```

### 3. Cache Frequently Used Embeddings

```python
# Use CachedEmbedding from examples above
cached = CachedEmbedding(OpenAIEmbedding(), cache_size=5000)

# Repeated queries benefit from cache
vector1 = await cached.aembed("common query")  # API call
vector2 = await cached.aembed("common query")  # From cache
```

## Testing with Mock Embeddings

For unit tests, create deterministic mock embeddings:

```python
from agentflow.store.embedding import BaseEmbedding
import hashlib

class MockEmbedding(BaseEmbedding):
    """Deterministic embedding for testing."""
    
    def __init__(self, dimension: int = 128):
        self._dimension = dimension
    
    async def aembed(self, text: str) -> list[float]:
        # Generate deterministic vector from text hash
        hash_val = int(hashlib.md5(text.encode()).hexdigest(), 16)
        
        # Create vector with deterministic values
        vector = []
        for i in range(self.dimension):
            bit = (hash_val >> i) % 2
            vector.append(float(bit))
        
        # Normalize
        magnitude = sum(x**2 for x in vector) ** 0.5
        return [x / magnitude for x in vector]
    
    async def aembed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.aembed(text) for text in texts]
    
    @property
    def dimension(self) -> int:
        return self._dimension

# Use in tests
import pytest

@pytest.fixture
def mock_embedding():
    return MockEmbedding(dimension=128)

async def test_store_search(mock_embedding):
    store = QdrantStore(embedding=mock_embedding, path=":memory:")
    await store.asetup()
    
    config = {"user_id": "test", "thread_id": "test"}
    
    # Store and search work without real API calls
    await store.astore(config, "test content")
    results = await store.asearch(config, "test query")
    
    assert len(results) > 0
```

## Best Practices

### 1. Choose the Right Model

```python
# ✅ Good: Match model to use case
# For general purpose
embedding = OpenAIEmbedding(model="text-embedding-3-small")

# For high precision
embedding = OpenAIEmbedding(model="text-embedding-3-large")

# For specific domain
embedding = HuggingFaceEmbedding(model="domain-specific-model")
```

### 2. Handle Errors Gracefully

```python
from openai import OpenAIError

async def safe_embed(embedding, text: str) -> list[float] | None:
    """Embed with error handling."""
    try:
        return await embedding.aembed(text)
    except OpenAIError as e:
        logger.error(f"Embedding failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return None

# Use in production
vector = await safe_embed(embedding, user_input)
if vector:
    # Process vector
    pass
else:
    # Handle failure
    pass
```

### 3. Validate Text Length

```python
async def embed_with_truncation(
    embedding: BaseEmbedding,
    text: str,
    max_chars: int = 8000
) -> list[float]:
    """Embed with automatic truncation."""
    if len(text) > max_chars:
        logger.warning(f"Text truncated from {len(text)} to {max_chars} chars")
        text = text[:max_chars]
    
    return await embedding.aembed(text)
```

### 4. Monitor Costs

```python
class CostTrackingEmbedding(BaseEmbedding):
    """Track embedding API costs."""
    
    def __init__(self, base: BaseEmbedding, cost_per_1k_tokens: float):
        self.base = base
        self.cost_per_1k_tokens = cost_per_1k_tokens
        self.total_tokens = 0
        self.call_count = 0
    
    async def aembed(self, text: str) -> list[float]:
        tokens = len(text.split())  # Rough estimate
        self.total_tokens += tokens
        self.call_count += 1
        return await self.base.aembed(text)
    
    @property
    def dimension(self) -> int:
        return self.base.dimension
    
    def get_cost_stats(self) -> dict:
        cost = (self.total_tokens / 1000) * self.cost_per_1k_tokens
        return {
            "total_calls": self.call_count,
            "total_tokens": self.total_tokens,
            "estimated_cost": f"${cost:.4f}",
            "avg_tokens_per_call": self.total_tokens / max(1, self.call_count)
        }

# Use with cost tracking
tracked = CostTrackingEmbedding(
    OpenAIEmbedding(),
    cost_per_1k_tokens=0.0001
)

# ... use the embedding ...

# Check costs periodically
print(tracked.get_cost_stats())
```

## Troubleshooting

### Common Issues

**Problem: "The 'openai' package is required"**

```bash
# Solution: Install OpenAI package
pip install openai
```

**Problem: "OpenAI API key must be provided"**

```python
# Solution: Provide API key explicitly
embedding = OpenAIEmbedding(api_key="sk-your-key-here")

# Or set environment variable
export OPENAI_API_KEY=sk-your-key-here
```

**Problem: Slow performance**

```python
# Solution: Use batch operations
# Instead of
for text in texts:
    await embedding.aembed(text)

# Use
await embedding.aembed_batch(texts)
```

**Problem: High costs**

```python
# Solution 1: Use smaller model
embedding = OpenAIEmbedding(model="text-embedding-3-small")

# Solution 2: Add caching
cached = CachedEmbedding(embedding, cache_size=5000)

# Solution 3: Use self-hosted model
embedding = HuggingFaceEmbedding()
```

## Next Steps

- Learn how to use embeddings with [QdrantStore](qdrant_store.md)
- Explore [Mem0Store](mem0_store.md) for managed embeddings
- Read the [Embedding Concept](../Concept/context/embedding.md) for deeper understanding
- Implement [custom stores](../Concept/context/basestore.md) with your embedding service

## Additional Resources

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Hugging Face Sentence Transformers](https://www.sbert.net/)
- [Qdrant Distance Metrics](https://qdrant.tech/documentation/concepts/search/)
- [Vector Search Explained](https://www.pinecone.io/learn/vector-search/)
