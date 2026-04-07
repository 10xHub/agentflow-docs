# Embedding System: Semantic Search Foundation

The embedding system in Agentflow provides a clean abstraction for converting text into vector representations, enabling semantic search and similarity-based retrieval across your agent's knowledge memory. This abstraction layer decouples your application logic from specific embedding providers, giving you the flexibility to switch between different models and services without changing your code.

## The Embedding Abstraction

### Why Embeddings Matter

At the heart of modern AI memory systems lies a fundamental challenge: **how do we find semantically related information in vast knowledge repositories?** Traditional keyword search falls short because it can't understand meaning, context, or intent. This is where embeddings shine.

**Embeddings** are dense vector representations of text that capture semantic meaning in a numerical form. Similar concepts cluster together in this vector space, enabling:

- **Semantic similarity search**: Find related memories even with different wording
- **Context-aware retrieval**: Understand intent and nuance beyond keywords  
- **Multimodal understanding**: Bridge different types of content (text, code, etc.)
- **Efficient comparison**: Use mathematical distance metrics for fast lookups

```python
# Keyword search misses this connection
query = "debugging techniques"
memory = "I used print statements to trace the issue"  # No keyword match!

# Embedding-based search understands the semantic relationship
query_vector = embedding.embed(query)
memory_vector = embedding.embed(memory)
similarity = cosine_similarity(query_vector, memory_vector)  # High score!
```

### The BaseEmbedding Interface

Agentflow defines a simple but powerful interface that all embedding implementations must follow:

```python
from agentflow.store.embedding import BaseEmbedding

class BaseEmbedding(ABC):
    async def aembed(self, text: str) -> list[float]:
        """Generate embedding vector for a single text."""
        
    async def aembed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embedding vectors for multiple texts efficiently."""
    
    @property
    def dimension(self) -> int:
        """Return the dimensionality of embedding vectors."""
```

This abstraction provides several key benefits:

**1. Provider Agnosticism**

Switch between OpenAI, Cohere, Hugging Face, or custom models without changing application code:

```python
# Development: Use OpenAI
embedding = OpenAIEmbedding(model="text-embedding-3-small")

# Production: Switch to custom model
embedding = CustomEmbedding(model_path="./fine-tuned-model")

# Store works with any implementation
store = QdrantStore(embedding=embedding, path="./data")
```

**2. Performance Optimization**

The batch interface enables efficient processing of multiple texts:

```python
# Inefficient: One API call per text
embeddings = [await embedding.aembed(text) for text in texts]

# Efficient: Single batched API call
embeddings = await embedding.aembed_batch(texts)
```

**3. Type Safety and Consistency**

The `dimension` property ensures vector compatibility:

```python
# Vector store can validate dimensions at setup time
assert embedding.dimension == expected_dimension
```

## Architecture Philosophy

### Separation of Concerns

The embedding system follows a clear separation of responsibilities:

```
┌─────────────────────────────────────────────────┐
│           Application Layer                     │
│  (Agents, Nodes, Business Logic)               │
└─────────────────┬───────────────────────────────┘
                  │
                  ├── Uses
                  ↓
┌─────────────────────────────────────────────────┐
│           Storage Layer (BaseStore)             │
│  (QdrantStore, Mem0Store)                      │
└─────────────────┬───────────────────────────────┘
                  │
                  ├── Delegates to
                  ↓
┌─────────────────────────────────────────────────┐
│        Embedding Layer (BaseEmbedding)          │
│  (OpenAIEmbedding, CustomEmbedding)            │
└─────────────────────────────────────────────────┘
```

**Benefits of this architecture:**

- **Single Responsibility**: Each layer has a focused purpose
- **Testability**: Mock embedding services for unit tests
- **Flexibility**: Swap implementations without coupling
- **Optimization**: Cache and batch at the right layer

### Async-First Design

All embedding operations are asynchronous by default, with synchronous wrappers for compatibility:

```python
# Async interface (preferred for performance)
vector = await embedding.aembed("Some text")
vectors = await embedding.aembed_batch(["Text 1", "Text 2"])

# Sync wrappers (for compatibility)
vector = embedding.embed("Some text")
vectors = embedding.embed_batch(["Text 1", "Text 2"])
```

This design choice enables:

- **Non-blocking operations**: Multiple embedding requests can run concurrently
- **Better throughput**: Batch operations utilize network efficiently
- **Resource efficiency**: Don't block threads waiting for API responses

## Embedding Strategies

Different use cases benefit from different embedding models and strategies:

### Model Selection

**Small Models: Fast and Efficient**

```python
# OpenAI's small model: 1536 dimensions
embedding = OpenAIEmbedding(model="text-embedding-3-small")

# Best for:
# - High-throughput applications
# - Cost-sensitive deployments
# - Real-time search requirements
# - General-purpose semantic search
```

**Large Models: Maximum Accuracy**

```python
# OpenAI's large model: 3072 dimensions  
embedding = OpenAIEmbedding(model="text-embedding-3-large")

# Best for:
# - Precise semantic matching
# - Domain-specific applications
# - Quality over speed scenarios
# - Complex query understanding
```

**Custom Models: Domain Specialization**

```python
# Fine-tuned model for specific domain
class DomainEmbedding(BaseEmbedding):
    def __init__(self, model_path: str):
        self.model = load_custom_model(model_path)
        self._dimension = 768  # Depends on your model
    
    async def aembed(self, text: str) -> list[float]:
        return await self.model.encode_async(text)

# Best for:
# - Specialized vocabularies (medical, legal, etc.)
# - Language-specific optimization
# - On-premise deployment requirements
# - Cost reduction through self-hosting
```

### Distance Metrics

Different distance metrics suit different embedding spaces:

**Cosine Similarity (Most Common)**

```python
# Measures angle between vectors, normalized
store = QdrantStore(
    embedding=embedding,
    distance_metric=DistanceMetric.COSINE
)

# Best for:
# - Most embedding models (default choice)
# - Normalized vectors
# - Semantic similarity
```

**Euclidean Distance**

```python
# Measures straight-line distance in vector space
store = QdrantStore(
    embedding=embedding,
    distance_metric=DistanceMetric.EUCLIDEAN
)

# Best for:
# - Unnormalized vectors
# - Magnitude-aware comparisons
# - Spatial relationships
```

**Dot Product**

```python
# Measures vector alignment and magnitude
store = QdrantStore(
    embedding=embedding,
    distance_metric=DistanceMetric.DOT_PRODUCT
)

# Best for:
# - Performance-critical scenarios
# - Pre-normalized vectors
# - Maximum similarity scoring
```

## Integration Patterns

### Store Integration

The most common pattern is to inject embeddings into your store:

```python
from agentflow.store import QdrantStore
from agentflow.store.embedding import OpenAIEmbedding

# Create embedding service
embedding = OpenAIEmbedding(
    model="text-embedding-3-small",
    api_key=os.getenv("OPENAI_API_KEY")
)

# Store handles all embedding operations automatically
store = QdrantStore(
    embedding=embedding,
    path="./qdrant_data",
    distance_metric=DistanceMetric.COSINE
)

# Embeddings are generated transparently
await store.astore(config, "User loves technical documentation")
# ^ Text is automatically embedded before storage

results = await store.asearch(config, "documentation preferences")
# ^ Query is automatically embedded for similarity search
```

### Custom Embedding Pipeline

For advanced use cases, you can control the embedding process:

```python
from agentflow.store.embedding import BaseEmbedding

class PreprocessedEmbedding(BaseEmbedding):
    """Custom embedding with preprocessing pipeline."""
    
    def __init__(self, base_embedding: BaseEmbedding):
        self.base = base_embedding
        self._dimension = base_embedding.dimension
    
    async def aembed(self, text: str) -> list[float]:
        # Custom preprocessing
        cleaned = self._clean_text(text)
        chunked = self._chunk_if_needed(cleaned)
        
        # Generate embedding
        vector = await self.base.aembed(chunked)
        
        # Optional post-processing
        return self._normalize(vector)
    
    def _clean_text(self, text: str) -> str:
        """Remove special characters, normalize whitespace, etc."""
        return text.strip().lower()
    
    def _chunk_if_needed(self, text: str) -> str:
        """Handle texts exceeding model context length."""
        if len(text) > 8000:  # Model limit
            return text[:8000]
        return text
    
    def _normalize(self, vector: list[float]) -> list[float]:
        """L2 normalization for cosine similarity."""
        magnitude = sum(x**2 for x in vector) ** 0.5
        return [x / magnitude for x in vector]
    
    @property
    def dimension(self) -> int:
        return self._dimension

# Use the custom pipeline
custom_embedding = PreprocessedEmbedding(OpenAIEmbedding())
store = QdrantStore(embedding=custom_embedding, path="./data")
```

### Caching for Performance

Add caching to reduce API calls and costs:

```python
from functools import lru_cache
import hashlib

class CachedEmbedding(BaseEmbedding):
    """Embedding service with LRU cache."""
    
    def __init__(self, base_embedding: BaseEmbedding, cache_size: int = 1000):
        self.base = base_embedding
        self._dimension = base_embedding.dimension
        self._cache = {}
        self._cache_size = cache_size
    
    async def aembed(self, text: str) -> list[float]:
        # Use hash as cache key
        cache_key = hashlib.md5(text.encode()).hexdigest()
        
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        # Generate and cache
        vector = await self.base.aembed(text)
        
        # Simple LRU: remove oldest if over size
        if len(self._cache) >= self._cache_size:
            oldest = next(iter(self._cache))
            del self._cache[oldest]
        
        self._cache[cache_key] = vector
        return vector
    
    @property
    def dimension(self) -> int:
        return self._dimension
```

## Implementation Guidelines

When implementing your own embedding service:

### 1. Handle API Errors Gracefully

```python
class RobustEmbedding(BaseEmbedding):
    async def aembed(self, text: str) -> list[float]:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                return await self._call_api(text)
            except RateLimitError:
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                else:
                    raise
            except APIError as e:
                logger.error(f"Embedding API error: {e}")
                raise
```

### 2. Optimize Batch Operations

```python
class OptimizedEmbedding(BaseEmbedding):
    async def aembed_batch(self, texts: list[str]) -> list[list[float]]:
        # Process in chunks to avoid API limits
        chunk_size = 100  # API limit
        results = []
        
        for i in range(0, len(texts), chunk_size):
            chunk = texts[i:i + chunk_size]
            chunk_vectors = await self._api_batch_call(chunk)
            results.extend(chunk_vectors)
        
        return results
```

### 3. Validate Inputs and Outputs

```python
class ValidatedEmbedding(BaseEmbedding):
    async def aembed(self, text: str) -> list[float]:
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        if len(text) > self.max_length:
            raise ValueError(f"Text exceeds max length of {self.max_length}")
        
        vector = await self._generate_embedding(text)
        
        # Validate output
        if len(vector) != self.dimension:
            raise RuntimeError(f"Expected {self.dimension} dimensions, got {len(vector)}")
        
        return vector
```

## Performance Considerations

### Batch Processing

Always use batch operations when processing multiple texts:

```python
# ❌ Slow: N API calls
for memory in memories:
    vector = await embedding.aembed(memory.content)
    # Store vector...

# ✅ Fast: 1 API call
contents = [m.content for m in memories]
vectors = await embedding.aembed_batch(contents)
for memory, vector in zip(memories, vectors):
    # Store vector...
```

### Async Concurrency

Leverage async for parallel processing:

```python
# ❌ Sequential processing
results = []
for query in queries:
    vector = await embedding.aembed(query)
    search_results = await store.asearch_by_vector(vector)
    results.append(search_results)

# ✅ Concurrent processing
async def process_query(query: str):
    vector = await embedding.aembed(query)
    return await store.asearch_by_vector(vector)

results = await asyncio.gather(*[process_query(q) for q in queries])
```

### Cost Optimization

Monitor and optimize embedding API costs:

```python
class CostTrackingEmbedding(BaseEmbedding):
    def __init__(self, base: BaseEmbedding, cost_per_token: float = 0.0001):
        self.base = base
        self.cost_per_token = cost_per_token
        self.total_tokens = 0
        self.total_cost = 0.0
    
    async def aembed(self, text: str) -> list[float]:
        tokens = len(text.split())  # Rough estimate
        self.total_tokens += tokens
        self.total_cost += tokens * self.cost_per_token
        
        return await self.base.aembed(text)
    
    def get_stats(self) -> dict:
        return {
            "total_tokens": self.total_tokens,
            "total_cost": self.total_cost,
            "average_tokens_per_call": self.total_tokens / max(1, self.call_count)
        }
```

## Testing Strategies

### Mock Embeddings for Tests

```python
class MockEmbedding(BaseEmbedding):
    """Deterministic embedding for testing."""
    
    def __init__(self, dimension: int = 128):
        self._dimension = dimension
    
    async def aembed(self, text: str) -> list[float]:
        # Generate deterministic vector from text
        import hashlib
        hash_value = int(hashlib.md5(text.encode()).hexdigest(), 16)
        return [(hash_value >> i) % 2 for i in range(self.dimension)]
    
    async def aembed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.aembed(text) for text in texts]
    
    @property
    def dimension(self) -> int:
        return self._dimension

# Use in tests
@pytest.fixture
def test_embedding():
    return MockEmbedding(dimension=128)

async def test_store_search(test_embedding):
    store = QdrantStore(embedding=test_embedding, path=":memory:")
    # Test without making real API calls
```

## Conclusion

The embedding system in Agentflow provides a clean, efficient abstraction for semantic search that:

- **Decouples** your application from specific embedding providers
- **Optimizes** performance through async operations and batching
- **Enables** flexible deployment strategies (cloud, self-hosted, hybrid)
- **Supports** testing and development through mockable interfaces

By treating embeddings as a pluggable component, Agentflow gives you the freedom to choose the best embedding solution for your use case while maintaining clean, maintainable code. Whether you're using OpenAI's hosted models, running custom fine-tuned models, or experimenting with new embedding techniques, the `BaseEmbedding` interface ensures your application remains flexible and future-proof.
