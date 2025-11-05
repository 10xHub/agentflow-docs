# Mem0Store Tutorial

## Overview

`Mem0Store` is a managed memory implementation for Agentflow that integrates with the [Mem0](https://mem0.ai) platform. Unlike vector database implementations that require you to manage infrastructure, Mem0 provides a fully managed service with built-in intelligence for memory optimization, deduplication, and retrieval.

## Features

- **Managed Infrastructure** - No vector database setup or maintenance required
- **Intelligent Memory Management** - Automatic memory optimization and deduplication
- **Semantic Search** - Built-in semantic understanding and retrieval
- **Multi-Backend Support** - Works with Qdrant, Pinecone, or other vector stores under the hood
- **Async-first Design** - Optimal performance with native async support
- **User and Thread Scoping** - Automatic memory isolation by user and conversation

## Installation

Install Agentflow with Mem0 support:

```bash
pip install mem0ai
```

For production use with Qdrant backing:

```bash
pip install mem0ai qdrant-client
```

## Quick Start

### 1. Basic Setup with Default Configuration

The simplest way to get started with Mem0Store:

```python
import asyncio
from agentflow.store import Mem0Store
from agentflow.store.store_schema import MemoryType

# Create Mem0 store with default configuration
store = Mem0Store(
    config={},  # Uses Mem0 defaults
    app_id="my_app"
)

async def main():
    # Configuration for operations
    config = {
        "user_id": "alice",
        "thread_id": "conversation_123"
    }
    
    # Store a memory
    result = await store.astore(
        config=config,
        content="I love learning about artificial intelligence",
        memory_type=MemoryType.EPISODIC,
        category="interests"
    )
    print(f"Stored memory: {result}")
    
    # Search for memories
    results = await store.asearch(
        config=config,
        query="AI interests",
        limit=5
    )
    
    for memory in results:
        print(f"Found: {memory.content} (score: {memory.score})")
    
    # Clean up
    await store.arelease()

asyncio.run(main())
```

### 2. Setup with Custom Qdrant Backend

For production deployments with control over your vector database:

```python
from agentflow.store.mem0_store import create_mem0_store_with_qdrant

# Configure Mem0 with Qdrant backing
store = create_mem0_store_with_qdrant(
    qdrant_url="https://your-cluster.qdrant.io",
    qdrant_api_key="your-qdrant-api-key",
    collection_name="my_app_memories",
    embedding_model="text-embedding-3-small",
    llm_model="gpt-4o-mini",
    app_id="my_app"
)
```

### 3. Manual Configuration

For complete control over Mem0's configuration:

```python
# Full configuration control
mem0_config = {
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "collection_name": "memories",
            "url": "http://localhost:6333",
        }
    },
    "embedder": {
        "provider": "openai",
        "config": {
            "model": "text-embedding-3-small",
            "api_key": "your-openai-key"
        }
    },
    "llm": {
        "provider": "openai",
        "config": {
            "model": "gpt-4o-mini",
            "api_key": "your-openai-key"
        }
    }
}

store = Mem0Store(config=mem0_config, app_id="my_app")
```

## Memory Operations

### Storing Memories

```python
# Store string content
result = await store.astore(
    config={
        "user_id": "alice",
        "thread_id": "session_001"
    },
    content="User prefers dark mode in applications",
    memory_type=MemoryType.SEMANTIC,
    category="preferences",
    metadata={
        "preference_type": "ui",
        "confidence": 0.95
    }
)

# Store Message objects
from agentflow.utils import Message

message = Message.from_text(
    "I always use dark mode on my devices",
    role="user"
)

result = await store.astore(
    config={
        "user_id": "alice",
        "thread_id": "session_001"
    },
    content=message,
    memory_type=MemoryType.EPISODIC
)
```

### Searching Memories

```python
# Basic semantic search
results = await store.asearch(
    config={
        "user_id": "alice",
        "thread_id": "session_001"
    },
    query="what are alice's preferences?",
    limit=10
)

# Search with score threshold
results = await store.asearch(
    config={
        "user_id": "alice",
        "thread_id": "session_001"
    },
    query="UI preferences",
    score_threshold=0.7,  # Only return results with score >= 0.7
    limit=5
)

# Search with filters
results = await store.asearch(
    config={
        "user_id": "alice",
        "thread_id": "session_001"
    },
    query="preferences",
    filters={"category": "ui_settings"},
    limit=10
)

# Process results
for memory in results:
    print(f"Content: {memory.content}")
    print(f"Score: {memory.score}")
    print(f"Type: {memory.memory_type}")
    print(f"Metadata: {memory.metadata}")
    print("---")
```

### Retrieving Specific Memories

```python
# Get a specific memory by ID
memory = await store.aget(
    config={
        "user_id": "alice",
        "thread_id": "session_001"
    },
    memory_id="memory_abc123"
)

if memory:
    print(f"Found: {memory.content}")
else:
    print("Memory not found")

# Get all memories for a user
all_memories = await store.aget_all(
    config={
        "user_id": "alice",
        "thread_id": "session_001"
    },
    limit=100
)

print(f"Total memories: {len(all_memories)}")
```

### Updating Memories

```python
# Update memory content
result = await store.aupdate(
    config={
        "user_id": "alice",
        "thread_id": "session_001"
    },
    memory_id="memory_abc123",
    content="User strongly prefers dark mode and high contrast",
    metadata={
        "confidence": 0.98,
        "updated_reason": "additional_confirmation"
    }
)
```

### Deleting Memories

```python
# Delete a specific memory
result = await store.adelete(
    config={
        "user_id": "alice",
        "thread_id": "session_001"
    },
    memory_id="memory_abc123"
)

# Delete all memories for a user (forget everything)
result = await store.aforget_memory(
    config={
        "user_id": "alice",
        "thread_id": "session_001"
    }
)
```

## Integration with Agents

### Using Dependency Injection

The recommended pattern for using Mem0Store in agent nodes:

```python
from injectq import Inject, InjectQ
from agentflow.store import BaseStore
from agentflow.state import AgentState
from agentflow.graph import StateGraph

async def knowledge_agent(
    state: AgentState,
    config: dict,
    store: BaseStore = Inject[BaseStore]
) -> AgentState:
    """Agent with access to long-term memory."""
    
    # Search for relevant knowledge
    current_query = state.context[-1].text() if state.context else ""
    relevant_memories = await store.asearch(
        config=config,
        query=current_query,
        limit=3,
        score_threshold=0.6
    )
    
    # Use memories to enhance response
    knowledge_context = "\n".join([
        f"- {m.content}" for m in relevant_memories
    ])
    
    # Your agent logic here...
    return state

# Setup graph with DI
store = Mem0Store(config={}, app_id="my_app")
di = InjectQ()
di.register(BaseStore, store)

graph = StateGraph()
graph.add_node("agent", knowledge_agent)
graph.set_entry_point("agent")
graph.add_edge("agent", END)

compiled = graph.compile(injector=di)

# Use the graph
config = {
    "user_id": "alice",
    "thread_id": "session_123"
}
result = await compiled.ainvoke(initial_state, config)
```

### Storing Learning from Interactions

```python
async def learning_agent(
    state: AgentState,
    config: dict,
    store: BaseStore = Inject[BaseStore]
) -> AgentState:
    """Agent that learns from interactions."""
    
    # Generate response
    response = await generate_llm_response(state)
    state.context.append(response)
    
    # Extract and store learnings
    if should_extract_knowledge(state):
        insights = extract_insights(state.context)
        
        for insight in insights:
            await store.astore(
                config=config,
                content=insight.content,
                memory_type=insight.memory_type,
                category=insight.category,
                metadata=insight.metadata
            )
    
    return state
```

## Configuration Patterns

### Development Configuration

For local development and testing:

```python
store = Mem0Store(
    config={
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": "dev_memories",
                "path": "./qdrant_dev"  # Local file-based storage
            }
        }
    },
    app_id="dev_app"
)
```

### Production Configuration

For production deployments with cloud services:

```python
import os

store = create_mem0_store_with_qdrant(
    qdrant_url=os.getenv("QDRANT_URL"),
    qdrant_api_key=os.getenv("QDRANT_API_KEY"),
    collection_name=os.getenv("COLLECTION_NAME", "prod_memories"),
    embedding_model="text-embedding-3-small",
    llm_model="gpt-4o-mini",
    app_id=os.getenv("APP_ID", "prod_app")
)
```

### Multi-Tenant Configuration

For applications serving multiple organizations:

```python
def create_tenant_store(tenant_id: str) -> Mem0Store:
    """Create a store scoped to a specific tenant."""
    return Mem0Store(
        config={
            "vector_store": {
                "provider": "qdrant",
                "config": {
                    "collection_name": f"tenant_{tenant_id}_memories",
                    "url": os.getenv("QDRANT_URL")
                }
            }
        },
        app_id=f"tenant_{tenant_id}"
    )

# Use tenant-specific stores
store_acme = create_tenant_store("acme_corp")
store_techco = create_tenant_store("techco_inc")
```

## Memory Types and Categories

### Organizing Memories by Type

```python
# Episodic: Specific experiences
await store.astore(
    config=config,
    content="User called support about login issue on Jan 15",
    memory_type=MemoryType.EPISODIC,
    category="support_interactions"
)

# Semantic: Factual knowledge
await store.astore(
    config=config,
    content="User's account was created in March 2023",
    memory_type=MemoryType.SEMANTIC,
    category="account_info"
)

# Procedural: Process knowledge
await store.astore(
    config=config,
    content="User prefers step-by-step troubleshooting guides",
    memory_type=MemoryType.PROCEDURAL,
    category="communication_style"
)

# Entity: User profile data
await store.astore(
    config=config,
    content="Alice Johnson, Senior Engineer at TechCorp",
    memory_type=MemoryType.ENTITY,
    category="user_profile"
)
```

### Category-Based Organization

```python
# Store memories in logical categories
categories = {
    "preferences": ["UI settings", "notification preferences"],
    "technical_skills": ["Python expert", "familiar with Docker"],
    "project_context": ["Working on API refactoring"],
    "communication": ["Prefers concise responses"]
}

for category, items in categories.items():
    for item in items:
        await store.astore(
            config=config,
            content=item,
            memory_type=MemoryType.SEMANTIC,
            category=category
        )

# Search within specific category
tech_memories = await store.asearch(
    config=config,
    query="technical capabilities",
    category="technical_skills"
)
```

## Best Practices

### 1. Always Provide Context

```python
# ✅ Good: Complete context
config = {
    "user_id": "alice_123",
    "thread_id": "conversation_456",
    "app_id": "customer_support"
}

# ❌ Bad: Missing required context
config = {}  # Will raise ValueError
```

### 2. Use Meaningful Metadata

```python
# ✅ Good: Rich, searchable metadata
await store.astore(
    config=config,
    content="User solved authentication bug",
    memory_type=MemoryType.EPISODIC,
    metadata={
        "problem_type": "authentication",
        "solution_used": "2fa_reset",
        "difficulty": "medium",
        "time_to_solve": 15,
        "timestamp": datetime.now().isoformat(),
        "tags": ["bug_fix", "authentication", "successful"]
    }
)

# ❌ Bad: No metadata
await store.astore(config=config, content="User did something")
```

### 3. Implement Score Thresholds

```python
# ✅ Good: Filter low-quality matches
results = await store.asearch(
    config=config,
    query="user preferences",
    score_threshold=0.7,  # Only confident matches
    limit=5
)

# ❌ Bad: Accept all results regardless of relevance
results = await store.asearch(config=config, query="preferences", limit=20)
```

### 4. Handle Errors Gracefully

```python
# ✅ Good: Error handling
try:
    result = await store.astore(config=config, content=user_input)
except ValueError as e:
    logger.error(f"Invalid input: {e}")
    # Handle validation errors
except Exception as e:
    logger.error(f"Storage failed: {e}")
    # Handle system errors

# Check existence before delete
memory = await store.aget(config=config, memory_id=memory_id)
if memory:
    await store.adelete(config=config, memory_id=memory_id)
```

### 5. Clean Up Resources

```python
# ✅ Good: Proper cleanup
try:
    store = Mem0Store(config=config)
    # Use store...
finally:
    await store.arelease()

# Or use context manager pattern if available
async with Mem0Store(config=config) as store:
    # Use store...
    pass  # Automatically cleaned up
```

## Troubleshooting

### Common Issues

**Problem: "user_id must be provided in config"**

```python
# Solution: Always include user_id in config
config = {
    "user_id": "alice",
    "thread_id": "session_123"
}
```

**Problem: "thread_id must be provided in config"**

```python
# Solution: Include thread_id for conversation scoping
config = {
    "user_id": "alice",
    "thread_id": "conversation_001"
}
```

**Problem: No results from search**

```python
# Check if memories exist
all_memories = await store.aget_all(config=config, limit=10)
print(f"Total memories: {len(all_memories)}")

# Lower score threshold
results = await store.asearch(
    config=config,
    query="...",
    score_threshold=0.5  # More lenient
)
```

**Problem: Slow performance**

```python
# Reduce result limit
results = await store.asearch(
    config=config,
    query="...",
    limit=5  # Fewer results = faster
)

# Use score threshold to reduce processing
results = await store.asearch(
    config=config,
    query="...",
    score_threshold=0.8  # Only high-quality matches
)
```

## Comparison with QdrantStore

| Feature | Mem0Store | QdrantStore |
|---------|-----------|-------------|
| **Infrastructure** | Managed service | Self-hosted or cloud |
| **Setup Complexity** | Minimal | Requires Qdrant setup |
| **Memory Optimization** | Automatic | Manual |
| **Embedding Management** | Built-in | External embedding service required |
| **Cost** | Usage-based pricing | Infrastructure costs |
| **Control** | Less control | Full control |
| **Best For** | Quick start, managed solution | Custom requirements, self-hosted |

## Next Steps

- Learn about [QdrantStore](qdrant_store.md) for self-hosted alternatives
- Explore [Embedding Services](embedding.md) for custom embeddings
- Read the [Store Concept](../Concept/context/store.md) for architectural understanding
- Check [BaseStore](../Concept/context/basestore.md) for implementing custom stores

## Additional Resources

- [Mem0 Documentation](https://docs.mem0.ai/)
- [Mem0 GitHub Repository](https://github.com/mem0ai/mem0)
- [Example: Using Mem0Store in RAG](../../examples/rag/)
- [Example: Multi-Agent with Memory](../../examples/multiagent/)
