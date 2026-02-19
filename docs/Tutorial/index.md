# Tutorials

Step-by-step guides for building real agents with AgentFlow. Start with **Beginner** if you're new, or jump into any section once you have the basics.

---

## Prerequisites

Before starting tutorials, make sure you've completed [Getting Started](../getting-started/index.md):

- AgentFlow installed (`pip install 10xscale-agentflow`)
- An LLM provider library installed (`google-genai` or `openai`)
- API key configured in `.env`

---

## Beginner Path

Work through these **in order** for the smoothest learning curve:

| Tutorial | What You Build | Key Skills |
|----------|---------------|------------|
| [1. Your First Agent](beginner/01-your-first-agent.md) | A weather assistant with personality | System prompts, Agent class, basic workflow |
| [2. Adding Tools](beginner/02-adding-tools.md) | An agent that calls Python functions | ToolNode, conditional routing, tool execution |
| [3. Chat with Memory](beginner/03-chat-with-memory.md) | A persistent multi-turn chatbot | Checkpointers, thread IDs, conversation state |

**Total time:** ~60 minutes

---

## Building Agents

Deepen your Agent class knowledge and learn production patterns:

| Tutorial | Focus |
|----------|-------|
| [Agent Class Deep Dive](agent-class.md) | Configuration, tool filtering, context trimming, streaming |
| [Tool Decorator & Filtering](tool-decorator.md) | Organize tools with metadata and tags |
| [Multi-Agent Handoff](handoff.md) | Delegate tasks between specialized agents |
| [Input Validation](input_validation.md) | Sanitize inputs and protect against prompt injection |

---

## ReAct Pattern (Reasoning + Acting)

The ReAct pattern powers most production agents — reason, act with tools, observe results, repeat:

| Tutorial | Focus |
|----------|-------|
| [ReAct with Agent Class](react/00-agent-class-react.md) | Simplest setup — ReAct in under 30 lines |
| [Custom ReAct (Advanced)](react/01-basic-react.md) | Build ReAct from scratch with custom async functions |
| [Dependency Injection](react/02-dependency-injection.md) | Inject services and config into nodes with InjectQ |
| [MCP Integration](react/03-mcp-integration.md) | Connect to Model Context Protocol servers |
| [Streaming](react/04-streaming.md) | Stream tokens in real-time to clients |
| [Unit Testing](react/05-unit-testing.md) | Test agents without real LLM API calls |

---

## Memory & Storage

Persist agent state and enable long-term memory:

| Tutorial | Focus |
|----------|-------|
| [Long-Term Memory](long_term_memory.md) | Persist memories across sessions using the Store API |
| [Mem0 Store](mem0_store.md) | Managed semantic memory with Mem0 |
| [Qdrant Vector Store](qdrant_store.md) | Vector database integration for similarity search |
| [Embedding Store](embedding.md) | Work with vector embeddings in agent workflows |

---

## Retrieval & Reasoning

Ground agents in external knowledge and complex multi-step reasoning:

| Tutorial | Focus |
|----------|-------|
| [RAG (Retrieval-Augmented Generation)](rag.md) | Ground agents in external documents with semantic search |
| [Plan-Act-Reflect Pattern](plan_act_reflect.md) | Agents that plan, execute, and self-evaluate their work |

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
