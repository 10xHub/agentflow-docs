# Beginner Tutorials

Welcome to the AgentFlow beginner tutorials! These hands-on guides take you from your first agent to building real, stateful applications.

---

## Learning Path

Work through these tutorials in order:

### 1. [Your First Agent](01-your-first-agent.md) (~15 minutes)

**What you'll build:** A weather assistant with a custom personality

**You'll learn:**
- Creating agents with system prompts
- Switching between LLM providers (OpenAI, Google Gemini)
- Building and running a basic workflow

**Start here if:** You've completed the [Hello World](../../getting-started/hello-world.md) guide

---

### 2. [Adding Tools](02-adding-tools.md) (~20 minutes)

**What you'll build:** An agent that fetches real data and performs calculations

**You'll learn:**
- Creating Python function tools
- Connecting tools to agents with `ToolNode`
- Conditional routing (tool call → tool execution → final answer)

**Prerequisites:** Tutorial 1

---

### 3. [Chat with Memory](03-chat-with-memory.md) (~25 minutes)

**What you'll build:** A chatbot that remembers conversations across multiple turns

**You'll learn:**
- Using `InMemoryCheckpointer` for conversation memory
- Managing multiple conversations with `thread_id`
- Building an interactive chat loop

**Prerequisites:** Tutorial 2

---

## What You'll Accomplish

By completing all three tutorials, you'll be able to:

- Create agents with any LLM provider (OpenAI, Gemini, and more)
- Give agents tools to perform real actions
- Build chatbots with persistent conversation memory
- Understand the core AgentFlow patterns used in every agent

---

## Quick Setup Reminder

If you haven't set up AgentFlow yet:

1. [Installation](../../getting-started/installation.md) — install AgentFlow and an LLM SDK
2. [Hello World](../../getting-started/hello-world.md) — run your first agent
3. [Core Concepts](../../getting-started/core-concepts.md) — understand the building blocks

Then come back here and start with Tutorial 1!

---

## After Beginner Tutorials

Once you complete these, explore:

- **[Building Agents](../agent-class.md)** — Agent class deep dive, tool filtering, handoff
- **[ReAct Pattern](../react/README.md)** — Production agent patterns
- **[Memory & Storage](../long_term_memory.md)** — Long-term memory and vector stores
- **[Reference Docs](../../reference/library/index.md)** — Full API documentation

---

**Ready to start?** [Tutorial 1: Your First Agent →](01-your-first-agent.md)
