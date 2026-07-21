---
title: "AI Agent Glossary — Key Terms and Concepts"
sidebar_label: Glossary
description: Definitions of core AI agent concepts — ReAct agents, state graphs, multi-agent orchestration, memory, MCP, RAG, and streaming. With Python code examples using AgentFlow.
keywords:
  - ai agent glossary
  - ai agent terminology
  - python ai agent concepts
  - agent framework terms
  - what is an ai agent
---

# AI Agent Glossary

Definitions for the concepts that appear most often when building Python AI agents — from the fundamental patterns to the production infrastructure.

Each page includes a precise definition, how the concept is used in practice, and runnable Python examples using [AgentFlow](/docs/get-started).

## Core concepts

| Term | Definition |
|------|-----------|
| [What is an AI agent?](/docs/glossary/what-is-an-ai-agent) | A program that uses an LLM to perceive inputs, reason, call tools, and take actions in a loop to complete multi-step tasks |
| [What is a ReAct agent?](/docs/glossary/what-is-a-react-agent) | An agent that alternates between Reasoning and Acting steps — calling tools, observing results, and reasoning again until it has an answer |
| [What is multi-agent orchestration?](/docs/glossary/what-is-multi-agent-orchestration) | Coordinating multiple specialized AI agents so they collaborate on a shared goal, with explicit handoffs and control flow |
| [What is a state graph?](/docs/glossary/what-is-a-state-graph) | A graph-based model for agent workflows where nodes are processing steps and edges define how state moves between them |
| [What is agent memory?](/docs/glossary/what-is-agent-memory) | The mechanisms by which an AI agent stores and retrieves information across turns, sessions, and restarts |
| [What is the Model Context Protocol (MCP)?](/docs/glossary/what-is-model-context-protocol) | An open standard that lets AI agents connect to external tools and data sources through a common interface |
| [What is RAG?](/docs/glossary/what-is-retrieval-augmented-generation) | Retrieval-Augmented Generation — a pattern where an agent retrieves relevant documents before generating a response |
| [What is agent streaming?](/docs/glossary/what-is-agent-streaming) | Sending AI agent responses token-by-token to a frontend instead of waiting for the full response to complete |

## Related

- [Compare frameworks](/docs/compare) — AgentFlow vs LangGraph, CrewAI, AutoGen, Google ADK
- [Get started with AgentFlow](/docs/get-started) — build your first agent in Python
- [Prebuilt agents](/docs/prebuild/agents/react-agent) — ReactAgent, RAGAgent, SwarmAgent, and more
