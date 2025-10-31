# AgentFlow ecosystem: build, deploy, and consume multi‑agent systems

![PyPI](https://img.shields.io/pypi/v/10xscale-agentflow?color=blue)
![License](https://img.shields.io/github/license/10xhub/agentflow)
![Python](https://img.shields.io/pypi/pyversions/10xscale-agentflow)

AgentFlow is a comprehensive, production-ready stack designed for orchestrating multi-agent systems. Whether you're building intelligent workflows, deploying scalable APIs, or integrating agents into web applications, AgentFlow provides the tools you need. It consists of three interconnected components that work seamlessly together:

- **AgentFlow (Python library)** — The core framework for constructing agent graphs, managing state, and orchestrating complex workflows.
- **AgentFlow CLI** — A command-line tool for scaffolding projects, running local development servers, and deploying to production environments like Docker and Kubernetes.
- **AgentFlow TypeScript Client** — A fully typed client library for consuming AgentFlow APIs in web and Node.js applications.

Built with LLM-agnostic principles, AgentFlow supports a wide range of language models, including OpenAI, Anthropic Claude, Google Gemini, local models via Ollama or LM Studio, and any provider through LiteLLM or native SDKs. This flexibility ensures you can choose the best model for your use case without being locked into a single ecosystem.

---

## 🚀 The three building blocks

AgentFlow's ecosystem is structured around three key components, each addressing a specific aspect of the agent development lifecycle:

### Python library: [Agentflow](./Agentflow/index.md)

The foundational library for building and orchestrating multi-agent systems. It features StateGraph-based orchestration for defining nodes, edges, and conditional control flows. Supports advanced tool integration with MCP, Composio, and LangChain adapters, enabling parallel tool execution. Includes streaming capabilities for real-time responses, human-in-the-loop workflows for approval and debugging, and robust state management with pluggable checkpointers (in-memory, PostgreSQL+Redis).

### CLI: [agentflow CLI](./cli/index.md)

A powerful command-line interface that streamlines the development and deployment process. Provides project scaffolding to quickly set up new agent projects, local development servers for testing, and comprehensive deployment options including Docker containers and Kubernetes manifests. Handles authentication, configuration management, and environment-specific settings to ensure smooth transitions from development to production.

### TypeScript client: [@10xscale/agentflow-client](./client/index.md)

A batteries-included client library for TypeScript and JavaScript applications. Offers fully typed APIs for invoking agents, streaming responses, managing threads, and interacting with memory systems. Designed for seamless integration into web frontends, Node.js backends, and mobile applications, with built-in error handling, retry logic, and comprehensive documentation.

---

## 🔥 Why teams choose AgentFlow

AgentFlow stands out in the multi-agent orchestration space by combining production-grade reliability with developer-friendly flexibility. Here are the key differentiators that make it the preferred choice for teams building intelligent systems:

### Resilient checkpointing by design

AgentFlow's checkpointing system is engineered for high-performance persistence. Redis-assisted checkpointing ensures that hot paths remain fast by offloading frequent state updates to Redis, while keeping your primary database lean and focused on long-term storage. The framework implements a purposeful 3-layer memory model:

- **Working memory** — Active computations and temporary state during execution
- **Session memory** — Conversation context and thread-specific data
- **Knowledge memory** — Long-term learning and cross-thread insights

This architecture ensures that only necessary data is persisted. You maintain full control over what gets stored and when, preventing database bloat and optimizing for both performance and cost.

### You're the driver — full control knobs

Unlike frameworks that abstract away too much, AgentFlow puts you in the driver's seat:

- **Pluggable ID generation** — Customize how execution IDs are generated to fit your tracking and logging systems
- **Thread-name generation** — Control conversation naming conventions for better organization
- **Callbacks and event hooks** — Integrate deeply with monitoring systems at every stage of the execution lifecycle
- **Prompt-injection verification** — Add security hooks that run before tools execute, providing an additional layer of protection

This level of control enables deep integration with existing infrastructure while maintaining the flexibility to adapt as your needs evolve.

### Tools that scale from local to distributed

AgentFlow's tool ecosystem is designed to grow with your needs:

- **Native Python functions** — Start simple with regular functions enhanced by dependency injection for clean, testable code
- **MCP servers as first-class tools** — Integrate Model Context Protocol servers for standardized external integrations
- **Parallel tool calls** — Leverage built-in parallelization to improve performance on I/O-bound operations
- **Remote tool calls** — Enable true micro-orchestration across services, allowing agents to coordinate complex workflows spanning multiple systems

This progression path means you can start simple and scale to distributed architectures without rewriting your agent logic.

### Production signals from day one

AgentFlow is built with observability and real-time interaction in mind:

- **Streaming responses** — Delta updates enable real-time user experiences with immediate feedback
- **Comprehensive metrics** — Track token consumption, latency, and performance across all agent operations
- **Usage tracking** — Monitor costs and resource utilization to optimize your deployments
- **Multiple publishers** — Route events to Console (development), Redis, Kafka, or RabbitMQ (production) for flexible monitoring

These capabilities ensure you have full visibility into agent behavior and system health from development through production.

### LLM freedom

AgentFlow's LLM-agnostic architecture gives you unparalleled flexibility:

- Use **LiteLLM** for unified access to over 100 models across multiple providers
- Integrate directly with **native SDKs** from OpenAI, Anthropic, Google, or any other provider
- Switch providers without changing agent logic, eliminating vendor lock-in
- Optimize for cost, performance, or capabilities as your needs evolve

This approach ensures you're never trapped by a single LLM provider's limitations or pricing changes.

### The complete package

In addition to these unique strengths, AgentFlow includes all the standard features you'd expect from a leading orchestration framework:

- **Prebuilt patterns** — React agents, RAG systems, routing agents, swarms, supervisor teams, MapReduce workflows, and Plan-Act-Reflect loops
- **Clean dependency injection** — Maintainable, testable code with clear separation of concerns
- **Leaner persistence** — Purposeful storage strategies that avoid database bloat
- **Stronger operator controls** — Fine-grained control over every aspect of agent behavior

AgentFlow distinguishes itself by giving you both power and precision, making it ideal for teams that need production-ready reliability without sacrificing flexibility.

---

## 🧭 Pick your path

Depending on your role and goals, here's how to get started with AgentFlow:

- **New to AgentFlow?** Begin with the [Python library overview](./Agentflow/index.md) to understand the core concepts and build your first agent graph.
- **Shipping APIs?** Dive into the [CLI](./cli/index.md) for project scaffolding, local development, and deployment strategies.
- **Building frontends?** Explore the [TypeScript client](./client/index.md) for typed APIs and seamless web integration.
- **Prefer hands-on learning?** Follow the step-by-step [Tutorials](./Tutorial/index.md) covering React patterns, RAG implementation, memory management, and validation.

Each component is designed to work independently or in concert, so you can adopt AgentFlow incrementally as your needs grow.

---

## 📦 Install at a glance

Getting started with AgentFlow is straightforward:

**Python library (uv recommended):**

```bash
uv pip install 10xscale-agentflow
```

**Python library (pip):**

```bash
pip install 10xscale-agentflow
```

The Python library supports optional extras for specific functionality. For MCP, Composio, and LangChain tool integrations, Redis, Kafka, or RabbitMQ publishers, and PostgreSQL+Redis checkpointing, install the relevant extras as detailed in the [library documentation](./Agentflow/index.md).

---

## 🔗 Useful links

- **Python library**: https://pypi.org/project/10xscale-agentflow/
- **GitHub repository**: https://github.com/10xhub/agentflow
- **Runnable examples**: https://github.com/10xhub/agentflow/tree/main/examples
