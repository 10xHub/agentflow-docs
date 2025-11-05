# BaseStore: The Store Abstraction Layer

The `BaseStore` is the foundational abstraction that defines the contract for all long-term memory implementations in Agentflow. It provides a clean, async-first interface that enables different storage backends—from vector databases to managed memory services—to work seamlessly within the framework.

## Architecture Philosophy

### The Abstraction Principle

Rather than locking you into a specific storage solution, Agentflow adopts a **provider-agnostic approach** to long-term memory. The `BaseStore` abstract base class defines a consistent API that different backends implement, allowing you to:

- **Switch storage providers** without changing agent code
- **Experiment with different backends** to find what works best
- **Mix multiple stores** for different use cases within the same application
- **Build custom implementations** tailored to specific requirements

```python
from agentflow.store import BaseStore, QdrantStore, Mem0Store

# All implementations share the same interface
store_a: BaseStore = QdrantStore(embedding=embedding_service, path="./data")
store_b: BaseStore = Mem0Store(config=mem0_config)

# Same API works with any backend
memory_id = await store_a.astore(config, content, memory_type=MemoryType.EPISODIC)
results = await store_b.asearch(config, query="previous conversation")
```

### Design Principles

The `BaseStore` interface is built on several key principles that guide its architecture:

**1. Async-First for Performance**

All core operations are asynchronous by default, with synchronous wrappers provided for compatibility:

```python
# Async-first design (preferred)
memory_id = await store.astore(config, content)

# Sync wrapper available when needed
memory_id = store.store(config, content)
```

**2. Configuration-Driven Context**

Every operation accepts a `config` dictionary that provides context about the user, thread, and application scope:

```python
config = {
    "user_id": "alice",
    "thread_id": "conversation_123", 
    "app_id": "customer_support"
}

# Config flows through all operations
await store.astore(config, content)
await store.asearch(config, query)
```

**3. Content Flexibility**

Store accepts both raw strings and structured `Message` objects, allowing seamless integration with agent workflows:

```python
# Store string content
await store.astore(config, "User prefers technical documentation")

# Store Message objects directly
message = Message.from_text("Hello!", role="user")
await store.astore(config, message)
```

**4. Rich Metadata Support**

Every memory can be enriched with metadata, memory types, categories, and custom attributes:

```python
await store.astore(
    config=config,
    content="User solved bug using debugger",
    memory_type=MemoryType.EPISODIC,
    category="problem_solving",
    metadata={
        "difficulty": "medium",
        "tools_used": ["debugger", "logs"],
        "time_to_solve": "15_minutes"
    }
)
```

## Core Operations

The `BaseStore` defines a comprehensive set of operations that cover the entire memory lifecycle:

### Storage Operations

**Store Individual Memories**

```python
async def astore(
    self,
    config: dict[str, Any],
    content: str | Message,
    memory_type: MemoryType = MemoryType.EPISODIC,
    category: str = "general",
    metadata: dict[str, Any] | None = None,
    **kwargs,
) -> str:
    """Store a single memory and return its ID."""
```

The `astore` method is the primary way to persist knowledge. It returns a memory ID that can be used for future updates or deletions.

### Retrieval Operations

**Search by Similarity**

```python
async def asearch(
    self,
    config: dict[str, Any],
    query: str,
    memory_type: MemoryType | None = None,
    category: str | None = None,
    limit: int = 10,
    score_threshold: float | None = None,
    filters: dict[str, Any] | None = None,
    retrieval_strategy: RetrievalStrategy = RetrievalStrategy.SIMILARITY,
    distance_metric: DistanceMetric = DistanceMetric.COSINE,
    max_tokens: int = 4000,
    **kwargs,
) -> list[MemorySearchResult]:
    """Search for relevant memories based on semantic similarity."""
```

The `asearch` method supports multiple retrieval strategies (similarity, temporal, hybrid) and flexible filtering.

**Retrieve Specific Memories**

```python
async def aget(
    self,
    config: dict[str, Any],
    memory_id: str,
    **kwargs,
) -> MemorySearchResult | None:
    """Get a specific memory by its ID."""

async def aget_all(
    self,
    config: dict[str, Any],
    limit: int = 100,
    **kwargs,
) -> list[MemorySearchResult]:
    """Get all memories for a given user/thread context."""
```

### Update and Delete Operations

**Update Existing Memories**

```python
async def aupdate(
    self,
    config: dict[str, Any],
    memory_id: str,
    content: str | Message,
    metadata: dict[str, Any] | None = None,
    **kwargs,
) -> Any:
    """Update content or metadata of an existing memory."""
```

**Delete Memories**

```python
async def adelete(
    self,
    config: dict[str, Any],
    memory_id: str,
    **kwargs,
) -> Any:
    """Delete a specific memory by ID."""

async def aforget_memory(
    self,
    config: dict[str, Any],
    **kwargs,
) -> Any:
    """Delete all memories for a user or thread context."""
```

### Resource Management

**Setup and Cleanup**

```python
async def asetup(self) -> Any:
    """Initialize the store (create collections, connections, etc.)."""

async def arelease(self) -> None:
    """Clean up resources (close connections, release handles)."""
```

## Memory Types and Schemas

The `BaseStore` works with well-defined data structures that provide type safety and consistency:

### MemoryType Enumeration

```python
class MemoryType(str, Enum):
    EPISODIC = "episodic"          # Specific experiences and events
    SEMANTIC = "semantic"          # Factual knowledge and insights
    PROCEDURAL = "procedural"      # Process and workflow knowledge
    ENTITY = "entity"              # Entity-specific information
    RELATIONSHIP = "relationship"  # Entity relationships
    DECLARATIVE = "declarative"    # Explicit facts and declarations
    CUSTOM = "custom"              # Custom memory types
```

### MemorySearchResult Model

```python
class MemorySearchResult(BaseModel):
    id: str                        # Unique memory identifier
    content: str                   # Memory content
    score: float                   # Relevance/similarity score
    memory_type: MemoryType        # Type classification
    metadata: dict[str, Any]       # Additional metadata
    vector: list[float] | None     # Optional embedding vector
    user_id: str | None            # User context
    thread_id: str | None          # Thread context
    timestamp: datetime | None     # Creation/update time
```

### RetrievalStrategy Options

```python
class RetrievalStrategy(str, Enum):
    SIMILARITY = "similarity"           # Vector similarity search
    TEMPORAL = "temporal"              # Time-based retrieval
    RELEVANCE = "relevance"            # Relevance scoring
    HYBRID = "hybrid"                  # Combined approaches
    GRAPH_TRAVERSAL = "graph_traversal" # Knowledge graph navigation
```

## Implementation Guidelines

When implementing your own `BaseStore` subclass, follow these guidelines:

### Required Method Implementations

All abstract methods must be implemented:

```python
from agentflow.store import BaseStore

class MyCustomStore(BaseStore):
    async def asetup(self) -> Any:
        """Initialize your storage backend."""
        # Connect to database, create schemas, etc.
        pass
    
    async def astore(self, config, content, memory_type, category, metadata, **kwargs) -> str:
        """Store memory and return ID."""
        # Your storage logic here
        return generated_memory_id
    
    async def asearch(self, config, query, **kwargs) -> list[MemorySearchResult]:
        """Search for relevant memories."""
        # Your search logic here
        return results
    
    # ... implement all other abstract methods
```

### Configuration Handling

Parse and use the configuration dictionary consistently:

```python
async def astore(self, config, content, **kwargs):
    user_id = config.get("user_id")
    thread_id = config.get("thread_id")
    app_id = config.get("app_id")
    
    # Use these for scoping and filtering
    # Store them with the memory for future retrieval
```

### Error Handling

Provide clear error messages and handle edge cases gracefully:

```python
async def aget(self, config, memory_id, **kwargs):
    if not memory_id:
        raise ValueError("memory_id cannot be empty")
    
    try:
        result = await self._fetch_from_backend(memory_id)
        if result is None:
            return None  # Memory not found
        return self._convert_to_search_result(result)
    except ConnectionError as e:
        raise RuntimeError(f"Failed to connect to storage backend: {e}")
```

### Resource Management

Always implement proper cleanup:

```python
async def arelease(self):
    """Clean up all resources."""
    if self.client:
        await self.client.close()
    if self.connection_pool:
        await self.connection_pool.shutdown()
```

## Backend Implementations

Agentflow provides two production-ready implementations of `BaseStore`:

### Vector Database: QdrantStore

Best for semantic search and similarity-based retrieval:

```python
from agentflow.store import QdrantStore
from agentflow.store.embedding import OpenAIEmbedding

store = QdrantStore(
    embedding=OpenAIEmbedding(),
    path="./qdrant_data"
)
```

**Key Features:**
- Local or cloud deployment
- Multiple distance metrics
- Rich filtering capabilities
- Efficient vector search

### Managed Service: Mem0Store

Best for managed memory with built-in intelligence:

```python
from agentflow.store import Mem0Store

store = Mem0Store(
    config=mem0_config,
    app_id="my_app"
)
```

**Key Features:**
- Managed infrastructure
- Built-in memory optimization
- Automatic deduplication
- Enterprise features

## Integration Patterns

### Dependency Injection

The recommended way to use stores in agent nodes:

```python
from injectq import Inject
from agentflow.store import BaseStore

async def knowledge_agent(
    state: AgentState,
    config: dict,
    store: BaseStore = Inject[BaseStore]
) -> AgentState:
    """Agent with injected store dependency."""
    
    # Store is automatically injected
    relevant = await store.asearch(config, query=state.context[-1].text())
    
    # Use retrieved knowledge
    return enhanced_state
```

### Graph Configuration

Register your store during graph compilation:

```python
from agentflow.graph import StateGraph
from injectq import InjectQ

# Create store instance
store = QdrantStore(embedding=embedding_service, path="./data")
await store.asetup()

# Create DI container
di = InjectQ()
di.register(BaseStore, store)

# Compile graph with DI
graph = workflow.compile(injector=di)

# Store is now available to all nodes
result = await graph.ainvoke(initial_state, config)
```

## Performance Considerations

### Batch Operations

While `BaseStore` doesn't mandate batch operations, implementations should support them for efficiency:

```python
# Some implementations provide batch methods
if hasattr(store, 'abatch_store'):
    batch_id = await store.abatch_store(
        config=config,
        content=["memory 1", "memory 2", "memory 3"]
    )
```

### Caching and Optimization

Consider implementing caching layers for frequently accessed memories:

```python
class CachedStore(BaseStore):
    def __init__(self, backend: BaseStore, cache_ttl: int = 300):
        self.backend = backend
        self.cache = {}  # In-memory cache
        self.cache_ttl = cache_ttl
    
    async def asearch(self, config, query, **kwargs):
        cache_key = f"{query}:{config.get('user_id')}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        results = await self.backend.asearch(config, query, **kwargs)
        self.cache[cache_key] = results
        return results
```

## Conclusion

The `BaseStore` abstraction is designed to provide maximum flexibility while maintaining a consistent, intuitive API. By separating the interface from implementation, it allows:

- **Freedom of choice** in storage backends
- **Easy testing** through mock implementations  
- **Gradual migration** between storage solutions
- **Custom implementations** for specialized needs

Whether you're using the built-in QdrantStore and Mem0Store implementations or building your own, the `BaseStore` contract ensures your agent code remains clean, testable, and portable across different storage backends.
