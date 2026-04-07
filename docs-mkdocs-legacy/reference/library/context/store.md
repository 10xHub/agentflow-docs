# Store: The Agent's Knowledge Memory

The Store system in Agentflow represents the highest level of your agent's memory architecture—the **knowledge memory** that accumulates wisdom, learns patterns, and provides contextual intelligence across conversation boundaries. While working memory handles immediate thinking and session memory preserves interaction history, the Store enables agents to develop **persistent understanding** and **evolving intelligence**.

> **Related Documentation:**
> - [BaseStore Architecture](basestore.md) - Understanding the store abstraction layer
> - [Embedding System](embedding.md) - How semantic search works under the hood
> - [QdrantStore Tutorial](../../Tutorial/qdrant_store.md) - Self-hosted vector database implementation
> - [Mem0Store Tutorial](../../Tutorial/mem0_store.md) - Managed memory service implementation

## The Knowledge Memory Paradigm

Think of the Store as your agent's **accumulated wisdom**—the repository where insights, user preferences, learned patterns, and contextual knowledge persist beyond individual conversations. This is where agents transition from being reactive responders to proactive, intelligent assistants that improve over time.

```python
from agentflow.store import QdrantStore
from agentflow.store.store_schema import MemoryType, RetrievalStrategy

# Knowledge that transcends individual conversations
store = QdrantStore(collection_name="agent_knowledge")

# Store learned insights
await store.astore(
    config={"user_id": "alice", "thread_id": "session_123"},
    content="Alice prefers concise explanations with technical details",
    memory_type=MemoryType.SEMANTIC,
    category="communication_preferences"
)
```

### Beyond Conversation Boundaries

What distinguishes knowledge memory is its **cross-temporal and cross-conversational** nature:

- **Temporal Persistence**: Knowledge outlives individual sessions
- **Pattern Recognition**: Learning from interaction patterns over time
- **Contextual Intelligence**: Enriching responses with relevant background knowledge
- **Personalization**: Building user-specific understanding and preferences

The Store doesn't just save data—it creates **intelligent retrieval** mechanisms that help agents access the right knowledge at the right time.

## Memory Types: Organizing Knowledge by Purpose

 Agentflow's Store system organizes knowledge using a sophisticated **memory type taxonomy** that mirrors cognitive science research:

### **Episodic Memory**: Experience-Based Knowledge

```python
# Store specific interaction experiences
await store.astore(
    config={"user_id": "alice", "thread_id": "tech_support_001"},
    content="User successfully resolved authentication issue using 2FA reset",
    memory_type=MemoryType.EPISODIC,
    category="problem_resolution",
    metadata={
        "resolution_time": "15_minutes",
        "complexity": "medium",
        "satisfaction": "high"
    }
)
```

**Episodic memories** capture specific experiences, events, and interactions that can inform future similar situations.

### **Semantic Memory**: Factual Knowledge

```python
# Store factual information and learned insights
await store.astore(
    config={"domain": "technical_support"},
    content="Authentication failures spike during daylight saving time transitions",
    memory_type=MemoryType.SEMANTIC,
    category="system_patterns",
    metadata={
        "confidence": 0.85,
        "sample_size": 1247,
        "last_verified": "2024-03-15"
    }
)
```

**Semantic memories** hold factual knowledge, patterns, and insights that apply broadly across contexts.

### **Procedural Memory**: Process Knowledge

```python
# Store process and workflow knowledge
await store.astore(
    config={"domain": "customer_service"},
    content="For billing disputes: 1) Verify account, 2) Review transaction history, 3) Check for known issues, 4) Escalate if amount > $500",
    memory_type=MemoryType.PROCEDURAL,
    category="workflows",
    metadata={
        "success_rate": 0.92,
        "average_resolution_time": "8_minutes"
    }
)
```

**Procedural memories** capture processes, workflows, and "how-to" knowledge that guide agent behavior.

### **Entity and Relationship Memory**: Structured Knowledge

```python
# Store entity information
await store.astore(
    config={"user_id": "alice"},
    content="Senior Software Engineer at TechCorp, specializes in backend systems, prefers Python",
    memory_type=MemoryType.ENTITY,
    category="user_profile"
)

# Store relationship knowledge
await store.astore(
    config={"context": "organizational"},
    content="Alice reports to Bob (Engineering Manager), collaborates frequently with Charlie (DevOps Lead)",
    memory_type=MemoryType.RELATIONSHIP,
    category="org_structure"
)
```

**Entity and relationship memories** build structured understanding of people, organizations, and their interconnections.

## Retrieval Strategies: Finding the Right Knowledge

The power of knowledge memory lies not just in storage but in **intelligent retrieval**—finding the most relevant information at precisely the right moment.  Agentflow provides multiple retrieval strategies:

### **Similarity Search**: Semantic Relevance

```python
# Find semantically similar knowledge
relevant_memories = await store.asearch(
    config={"user_id": "alice"},
    query="user is frustrated with slow response time",
    retrieval_strategy=RetrievalStrategy.SIMILARITY,
    memory_type=MemoryType.EPISODIC,
    limit=3
)

# Returns memories about previous frustration incidents,
# successful resolution strategies, and user preference patterns
```

**Similarity search** uses vector embeddings to find knowledge that is semantically related to the current context.

### **Temporal Retrieval**: Time-Aware Knowledge

```python
# Retrieve recent or time-relevant memories
recent_insights = await store.asearch(
    config={"domain": "product_feedback"},
    query="feature request patterns",
    retrieval_strategy=RetrievalStrategy.TEMPORAL,
    limit=10
)

# Prioritizes recent insights and time-sensitive patterns
```

**Temporal retrieval** weighs recency and time-relevance, perfect for evolving knowledge domains.

### **Hybrid Strategies**: Combined Intelligence

```python
# Combine multiple retrieval approaches
best_knowledge = await store.asearch(
    config={"user_id": "alice"},
    query="technical documentation preferences",
    retrieval_strategy=RetrievalStrategy.HYBRID,
    score_threshold=0.7,
    distance_metric=DistanceMetric.COSINE
)

# Balances semantic similarity, recency, and relevance scoring
```

**Hybrid strategies** combine multiple approaches for sophisticated knowledge retrieval that adapts to different contexts.

## Integration Patterns: Connecting Knowledge to Intelligence

The real magic happens when knowledge memory integrates seamlessly with agent decision-making. Here are key patterns for effective integration:

### **Pre-Processing Enhancement**: Context Enrichment

```python
from injectq import Inject

async def knowledge_enhanced_agent(
    state: AgentState,
    config: dict,
    store: BaseStore = Inject[BaseStore]
) -> AgentState:
    """Agent that leverages knowledge for enhanced responses."""

    # Extract key concepts from current context
    current_query = state.context[-1].text() if state.context else ""

    # Retrieve relevant knowledge
    relevant_memories = await store.asearch(
        config=config,
        query=current_query,
        memory_type=MemoryType.SEMANTIC,
        limit=3,
        score_threshold=0.6
    )

    # Enrich system prompts with relevant knowledge
    knowledge_context = "\n".join([
        f"Relevant insight: {memory.content}"
        for memory in relevant_memories
    ])

    # Agent now has access to accumulated knowledge
    enhanced_prompt = f"""
    You are an intelligent assistant with access to relevant background knowledge:

    {knowledge_context}

    Use this knowledge to provide more informed, personalized responses.
    """

    # Continue with enhanced context...
    return state
```

### **Post-Processing Learning**: Experience Extraction

```python
async def learning_agent(
    state: AgentState,
    config: dict,
    store: BaseStore = Inject[BaseStore]
) -> AgentState:
    """Agent that learns from interactions."""

    # Generate response first
    response = await generate_response(state, config)
    state.context.append(response)

    # Extract learnings from the interaction
    if should_extract_knowledge(state):
        # Analyze interaction for insights
        insights = await extract_insights(state.context[-10:])  # Last 10 messages

        # Store new knowledge
        for insight in insights:
            await store.astore(
                config=config,
                content=insight.content,
                memory_type=insight.type,
                category=insight.category,
                metadata=insight.metadata
            )

    return state
```

## Best Practices for Knowledge Memory

### **Design Principles**

1. **Purposeful Storage**: Only store knowledge that will be actively used
2. **Quality Control**: Implement filters to maintain knowledge quality
3. **Contextual Relevance**: Design retrieval strategies that match usage patterns
4. **Privacy by Design**: Implement appropriate data segregation and anonymization
5. **Continuous Learning**: Enable feedback loops for knowledge improvement

### **Implementation Guidelines**

```python
# Good: Focused, high-quality knowledge storage
await store.astore(
    config={"user_id": "alice", "domain": "technical_support"},
    content="User alice prefers step-by-step troubleshooting guides with screenshots",
    memory_type=MemoryType.SEMANTIC,
    category="communication_preferences",
    metadata={
        "confidence": 0.9,
        "observed_interactions": 15,
        "last_updated": datetime.now().isoformat()
    }
)

# Avoid: Generic, low-quality storage
await store.astore(
    config={},
    content="Some random interaction happened",  # Too vague
    memory_type=MemoryType.EPISODIC
    # Missing important metadata and context
)
```

## When to Use Knowledge Memory

### **Perfect Use Cases**

- **Personalization**: Building user-specific preferences and behaviors
- **Domain Expertise**: Accumulating specialized knowledge over time
- **Pattern Recognition**: Learning from interaction patterns and outcomes
- **Cross-Session Intelligence**: Maintaining context across conversation boundaries
- **Recommendation Systems**: Leveraging accumulated knowledge for suggestions

### **Consider Alternatives When**

- **Simple, Stateless Applications**: Where conversation-level context is sufficient
- **High Privacy Requirements**: Where data persistence raises concerns
- **Resource-Constrained Environments**: Where additional storage/compute is prohibitive
- **Short-Term Interactions**: Where knowledge accumulation doesn't provide value

## Conclusion: Building Learning Agents

The Store system in  Agentflow transforms agents from reactive responders into **proactive, learning intelligences** that grow wiser with each interaction. By providing:

- **Sophisticated memory organization** through memory types and categories
- **Intelligent retrieval strategies** for contextually relevant knowledge access
- **Flexible backend integration** supporting various storage and retrieval paradigms
- **Privacy-aware design** ensuring responsible knowledge management

The Store enables you to build agents that don't just respond to queries but develop **persistent understanding**, **contextual intelligence**, and **evolving wisdom** that enhances every future interaction.

The key insight is that knowledge memory is not just about storage—it's about **creating intelligence that compounds over time**, transforming each interaction from an isolated exchange into a step in the agent's continuous learning journey.
