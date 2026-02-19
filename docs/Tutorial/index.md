# Tutorials

Step-by-step guides for building real agents with AgentFlow. Start with **Beginner** if you're new, or jump into **Advanced Topics** once you have the basics.

---

## Prerequisites

Before starting tutorials, make sure you've completed [Getting Started](../getting-started/index.md):

- AgentFlow installed (`pip install 10xscale-agentflow`)
- An LLM provider library installed (`google-genai`, `openai`, or `anthropic`)
- API key configured in `.env`

---

## Beginner Path

Work through these in order for the smoothest learning curve:

| Tutorial | What You Build | Key Skills |
|----------|---------------|------------|
| [1. Your First Agent](beginner/01-your-first-agent.md) | Weather assistant with personality | System prompts, Agent class, workflow basics |
| [2. Adding Tools](beginner/02-adding-tools.md) | Agent that calls Python functions | ToolNode, tool routing, conditional edges |
| [3. Chat with Memory](beginner/03-chat-with-memory.md) | Persistent multi-turn chatbot | Checkpointers, thread IDs, conversation state |

---

## Advanced Topics

Once you're comfortable with the basics, explore these patterns:

### Agent Patterns

- **[Agent Class](agent-class.md)** — Deep dive into the Agent class: configuration, tool filtering, context trimming
- **[Tool Decorator](tool-decorator.md)** — Organize tools with metadata, tags, and descriptions for fine-grained control
- **[Multi-Agent Handoff](handoff.md)** — Delegate tasks between specialized agents in a pipeline

### ReAct Pattern (Reasoning + Acting)

The ReAct pattern is the foundation of most production agents:

| Tutorial | Focus |
|----------|-------|
| [0. ReAct with Agent Class](react/00-agent-class-react.md) | Simplest ReAct setup using the Agent class |
| [1. Basic ReAct](react/01-basic-react.md) | Build ReAct from scratch with custom functions |
| [2. Dependency Injection](react/02-dependency-injection.md) | Inject services and config into tool nodes |
| [3. MCP Integration](react/03-mcp-integration.md) | Connect to Model Context Protocol servers |
| [4. Streaming](react/04-streaming.md) | Stream tokens in real-time to clients |
| [5. Unit Testing](react/05-unit-testing.md) | Test agents without real LLM API calls |

### Memory & Storage

- **[Long-Term Memory](long_term_memory.md)** — Persist agent memories across sessions using the Store API
- **[Mem0 Store Integration](mem0_store.md)** — Use Mem0 for semantic memory management
- **[Qdrant Store Integration](qdrant_store.md)** — Vector database integration for similarity search
- **[Embedding Store](embedding.md)** — Work with vector embeddings in agent workflows

### Data & Retrieval

- **[RAG (Retrieval-Augmented Generation)](rag.md)** — Ground agents in external documents with semantic search
- **[Input Validation](input_validation.md)** — Sanitize and validate user inputs before processing

### Complex Reasoning

- **[Plan-Act-Reflect Pattern](plan_act_reflect.md)** — Agents that plan a sequence of actions, execute them, and self-evaluate

---

## Reference Docs

For API details on any class or method, see the [Reference section](../reference/library/index.md):

- [StateGraph, nodes, edges](../reference/library/graph/index.md)
- [Agent class API](../reference/library/graph/agent-class.md)
- [ToolNode and tools](../reference/library/graph/tools.md)
- [AgentState and messages](../reference/library/context/state.md)
- [Checkpointers](../reference/library/context/checkpointer.md)
- [Dependency injection](../reference/library/dependency-injection.md)

---

**Start here:** [Tutorial 1 — Your First Agent →](beginner/01-your-first-agent.md)
