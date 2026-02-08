# The Three Layers of Memory in  Agentflow

 Agentflow implements a sophisticated three-tier memory architecture that mirrors how humans process and retain information. Understanding this layered approach is crucial for building effective agents that can maintain context, learn from interactions, and provide personalized experiences.

## The Memory Hierarchy: A Conceptual Foundation

Think of an intelligent agent as having three different types of memory, each serving distinct purposes:

**1. Working Memory (Short-term Context)**
Like holding a conversation in your mind, this is the immediate context that drives current interactions. It's fast, temporary, and directly influences what the agent says next.

**2. Session Memory (Conversation History)**
Similar to remembering what happened in a meeting, this preserves the flow and history of interactions for reference, debugging, and user interface purposes.

**3. Knowledge Memory (Long-term Storage)**
Like accumulated wisdom and learned facts, this stores insights, preferences, and knowledge that span multiple conversations and enhance future interactions.

## Why This Architecture Matters

This separation isn't just about technical organization—it reflects different **temporal needs** and **access patterns** in agent behavior:

- **Working memory** needs to be fast and contextually relevant for real-time decision making
- **Session memory** serves persistence and auditability without overwhelming the agent's thinking process
- **Knowledge memory** enables learning and personalization across conversation boundaries

Let's explore how each layer works in practice.

## Layer 1: Working Memory - The Agent's Active Thoughts

Working memory in  Agentflow is embodied by the `AgentState`, which holds the current conversation context as a living, breathing entity.

```python
from agentflow.state import AgentState
from agentflow.utils import Message

# The agent's working memory
state = AgentState()
state.context = [
    Message.text_message("What's the weather like?", role="user"),
    Message.text_message("Let me check that for you.", role="assistant")
]
```

### The Dynamic Nature of Working Memory

What makes working memory special is its **dynamic, evolving nature**. Unlike static data storage, the agent's context:

- **Grows** with each interaction (user messages, assistant responses, tool calls)
- **Transforms** through processing (the agent reasons about and responds to context)
- **Adapts** through trimming (older context gets summarized or removed when limits are reached)

```python
# Context evolves through the conversation
state.context.append(tool_call_message)
state.context.append(tool_result_message)
state.context.append(final_response_message)
```

### The Context Management Challenge

A critical challenge emerges: **context windows have limits**. As conversations grow, you need strategies to maintain relevance without losing important information. This is where **context management** becomes crucial:

```python
# Context managers handle the "forgetting" process
from agentflow.state import BaseContextManager


class SummaryContextManager(BaseContextManager):
    async def atrim_context(self, state):
        if len(state.context) > 50:
            # Summarize older messages, keep recent ones
            summary = await summarize_messages(state.context[:30])
            state.context_summary = summary
            state.context = state.context[30:]  # Keep recent context
        return state
```

The beauty of this approach is that **context management is pluggable**—you can implement different strategies (summarization, token-based trimming, importance scoring) without changing your core agent logic.

## Layer 2: Session Memory - The Conversation Chronicle

While working memory focuses on what the agent is thinking *right now*, session memory preserves the **complete interaction history** for different purposes entirely.

### Why Separate Session Memory?

Think about the difference between:
- What you need to remember to continue a conversation effectively (working memory)
- What you might want to review later, debug, or show in a user interface (session memory)

Session memory serves **persistence, auditability, and user experience** rather than immediate decision-making.

```python
from agentflow.checkpointer import PgCheckpointer

# Session memory persists the full interaction history
checkpointer = PgCheckpointer(postgres_dsn="postgresql://...")

# This stores every message, state transition, and execution detail
await checkpointer.aput_messages(config, messages)
await checkpointer.aput_state(config, final_state)
```

### The Dual Storage Strategy

Here's a key insight:  Agentflow uses a **two-tier persistence strategy** within session memory itself:

1. **Fast Cache (Redis)** - For active conversations and immediate retrieval
2. **Durable Storage (PostgreSQL)** - For permanent record-keeping

```python
# Fast retrieval from cache during active conversation
cached_state = await checkpointer.aget_state_cache(config)

# Durable persistence for long-term storage
await checkpointer.aput_state(config, state)  # Writes to both cache and DB
```

This design optimizes for **both speed and durability**—active conversations stay fast while ensuring nothing is ever truly lost.

## Layer 3: Knowledge Memory - The Agent's Learned Wisdom

Knowledge memory transcends individual conversations. It's where agents develop **persistent understanding**, store **user preferences**, and build **contextual intelligence** that improves over time.

### Beyond Conversation Boundaries

Unlike working memory (single conversation) and session memory (conversation history), knowledge memory operates across **multiple conversations, users, and time periods**.

```python
from agentflow.store import QdrantStore

# Knowledge that persists across conversations
store = QdrantStore(collection_name="user_preferences")

# Store learned insights
await store.astore(
    config={"user_id": "alice"},
    content="Alice prefers concise technical explanations",
    memory_type=MemoryType.SEMANTIC,
    category="communication_style"
)

# Retrieve relevant knowledge in future conversations
relevant_memories = await store.asearch(
    config={"user_id": "alice"},
    query="how should I explain technical concepts?",
    limit=3
)
```

### Retrieval Strategies and Intelligence

Knowledge memory isn't just storage—it's **intelligent retrieval**. Different situations call for different memory access patterns:

- **Similarity Search**: Find semantically related information
- **Temporal Retrieval**: Access recent or time-relevant memories
- **Hybrid Approaches**: Combine multiple retrieval strategies

```python
# Flexible retrieval strategies
memories = await store.asearch(
    config=config,
    query="user interface preferences",
    retrieval_strategy=RetrievalStrategy.HYBRID,
    memory_type=MemoryType.SEMANTIC,
    limit=5
)
```

## The Integration Pattern: How the Layers Work Together

The real power emerges when these three memory layers work in **harmony**. Here's a typical interaction flow:

### 1. Context Assembly Phase
```python
# Start with current working memory
state = current_agent_state

# Optionally enrich with relevant knowledge
if should_use_knowledge:
    relevant_memories = await store.asearch(config, query=state.context[-1].text())
    # Inject relevant memories into system prompts
```

### 2. Processing Phase
```python
# Agent processes with full context awareness
response = await agent_function(state, config)
```

### 3. Persistence Phase
```python
# Update working memory
state.context.append(response)

# Persist to session memory
await checkpointer.aput_state(config, state)

# Extract insights for knowledge memory
if important_information_learned:
    await store.astore(config, insight, memory_type=MemoryType.SEMANTIC)
```

### 4. Context Management Phase
```python
# Trim working memory if needed
if context_manager:
    state = await context_manager.atrim_context(state)
```

## Design Principles and Implications

This three-tier architecture embodies several key design principles:

### **Separation of Concerns**
Each memory layer has a distinct purpose, preventing interference and enabling optimization

### **Performance Optimization**
Fast access patterns for immediate needs, efficient storage for long-term retention

### **Flexible Integration**
Layers can be used independently or together, supporting various application architectures

### **Scalability Boundaries**
Clear boundaries enable different scaling strategies for different memory types

### **Developer Experience**
The abstraction matches mental models of how intelligent systems should work

## When to Use Each Layer

Understanding **when and why** to engage each memory layer is crucial for effective agent design:

### Use Working Memory When:
- Making immediate responses and decisions
- Maintaining conversation flow and coherence
- Processing current context for LLM interactions
- Managing real-time state transitions

### Use Session Memory When:
- Building user interfaces that show conversation history
- Implementing conversation resume functionality
- Debugging agent behavior and decision paths
- Compliance and audit requirements need full interaction records

### Use Knowledge Memory When:
- Personalizing experiences across sessions
- Building agents that learn and improve over time
- Implementing recommendation systems
- Creating persistent user preferences and profiles

The key insight is that these layers serve **different stakeholders** and **use cases**—the agent itself, the application interface, and the overall system intelligence.

## Conclusion: Building Memory-Aware Agents

 Agentflow's three-tier memory architecture provides a foundation for building truly intelligent agents that can:

- **Think clearly** with focused working memory
- **Remember completely** with persistent session memory
- **Learn continuously** with accumulated knowledge memory

By understanding these layers and their interactions, you can design agents that not only respond intelligently in the moment but also grow wiser over time—much like human intelligence itself.
