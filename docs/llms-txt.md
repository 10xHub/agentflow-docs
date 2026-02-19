# llms.txt — AI Context File

This page describes the `llms.txt` file served at [`/llms.txt`](../llms.txt) for this documentation site.

---

## What is llms.txt?

`llms.txt` is a standard proposed by [llmstxt.org](https://llmstxt.org/) that allows websites to provide a **concise, structured summary** of their content for AI assistants and LLM tools.

When an AI assistant (like Claude, ChatGPT, or Cursor) needs to understand what AgentFlow is and how to use it, it can read `llms.txt` to get a clean, link-rich overview — without parsing the full site HTML.

Think of it as a `robots.txt` for AI assistants: a machine-readable sitemap that helps LLMs navigate your documentation efficiently.

---

## How to Use It

You can reference the file directly in AI tools:

- **Cursor, Windsurf, or other AI editors** — Add `https://docs.agentflow.ai/llms.txt` as a context source
- **Claude Projects** — Paste the URL or file contents into your project context
- **LLM API calls** — Fetch and pass the file contents as system context when building agents that reason about AgentFlow

Direct URL: `https://docs.agentflow.ai/llms.txt`

---

## File Contents

```text
# AgentFlow

> AgentFlow is a Python framework for building, orchestrating, and managing multi-agent AI systems. Designed for flexibility and scalability, AgentFlow enables developers to create intelligent agents that collaborate, communicate, and solve complex tasks together using LLMs like Google Gemini, OpenAI GPT, Claude, and more.

AgentFlow simplifies AI agent development with an intuitive graph-based workflow system, built-in memory management, powerful tool integration, and comprehensive testing/evaluation utilities. Whether you're building a simple chatbot or a complex multi-agent system, AgentFlow provides the primitives and patterns you need.

## Getting Started

[What is AgentFlow?](getting-started/what-is-agentflow.md) - Introduction to AgentFlow's core philosophy and use cases

[Installation](getting-started/installation.md) - Install AgentFlow with Google Gemini, OpenAI, or other LLM providers

[Hello World](getting-started/hello-world.md) - Build your first agent in 5 minutes with working code examples

[Core Concepts](getting-started/core-concepts.md) - Understand StateGraph, Agents, Tools, Messages, and State management

## Tutorials

[Your First Agent](Tutorial/beginner/01-your-first-agent.md) - Create a weather assistant with tools (15 min tutorial)

[Adding Tools](Tutorial/beginner/02-adding-tools.md) - Integrate Python functions as agent tools (20 min tutorial)

[Chat with Memory](Tutorial/beginner/03-chat-with-memory.md) - Build persistent conversations with checkpointers (25 min tutorial)

[Agent Class Pattern](Tutorial/agent-class.md) - Simplified agent creation with the Agent class

[ReAct Pattern](Tutorial/react/README.md) - Build reasoning and acting agents with tool integration

[Multi-Agent Handoff](Tutorial/handoff.md) - Create collaborative multi-agent systems with agent handoff

[RAG (Retrieval-Augmented Generation)](Tutorial/rag.md) - Implement RAG patterns with embedding stores

[Plan-Act-Reflect Pattern](Tutorial/plan_act_reflect.md) - Build agents that plan, execute, and reflect on outcomes

## Core Library Reference

[Graph & Workflow Overview](reference/library/graph/index.md) - StateGraph, nodes, edges, and workflow execution

[Agent Class](reference/library/graph/agent-class.md) - Simplified Agent class for quick agent creation

[Tools](reference/library/graph/tools.md) - Tool integration, ToolNode, and tool calling patterns

[State Management](reference/library/context/state.md) - AgentState, messages, and state handling

[Messages](reference/library/context/message.md) - Message format, roles, and message utilities

[Checkpointer](reference/library/context/checkpointer.md) - Memory persistence with InMemoryCheckpointer and PostgresCheckpointer

[Store](reference/library/context/store.md) - Long-term memory storage and retrieval

## Testing & Evaluation

[Testing Overview](reference/library/testing/index.md) - TestAgent, QuickTest, and mock utilities for fast unit testing

[Testing Quickstart](reference/library/testing/quickstart.md) - Write your first test in 3 lines without LLM API calls

[Evaluation Overview](reference/library/evaluation/index.md) - Agent quality testing with trajectory analysis and LLM-as-judge

[Evaluation Getting Started](reference/library/evaluation/getting-started.md) - QuickEval for 1-line evaluations and quality benchmarking

[Evaluation Criteria](reference/library/evaluation/criteria.md) - Response quality, tool usage, and custom evaluation criteria

[Pytest Integration](reference/library/evaluation/pytest-integration.md) - Integrate evaluations into pytest test suites

## How-To Guides

[Create Simple Agent](how-to/agents/create-simple-agent.md) - Quick recipe for creating basic agents

[Create Python Tool](how-to/tools/create-python-tool.md) - Define and integrate Python function tools

## Advanced Topics

[Dependency Injection](reference/library/dependency-injection.md) - Inject services and configuration into agents

[Background Tasks](reference/library/background-task-manager.md) - Run async background tasks in agent workflows

[Handoff Mechanism](reference/library/handoff.md) - Agent-to-agent handoff and collaboration patterns

[Human-in-the-Loop](reference/library/graph/human-in-the-loop.md) - Build interactive agents requiring human input

[Error Handling](reference/library/ERROR_HANDLING_GUIDELINES.md) - Best practices for error handling in agent workflows

[Callbacks](reference/library/Callbacks.md) - Event-driven callbacks for monitoring and debugging

## CLI & Client

[CLI Tool Overview](reference/cli/index.md) - Command-line interface for AgentFlow deployment

[TypeScript Client Overview](reference/client/index.md) - TypeScript/JavaScript client for calling AgentFlow agents

[Client API Reference](reference/client/api-reference.md) - Complete API reference for TypeScript client

[Streaming Usage](reference/client/stream-usage.md) - Real-time streaming responses from agents

[React Integration](reference/client/react-integration.md) - Use AgentFlow in React applications

## FAQ

[Frequently Asked Questions](faq.md) - Common questions about installation, concepts, and troubleshooting
```

---

## Related

- [llmstxt.org](https://llmstxt.org/) — The specification and proposal
- [AgentFlow GitHub](https://github.com/10xscale/agentflow) — Source code
- [PyPI package](https://pypi.org/project/10xscale-agentflow/) — Latest release
