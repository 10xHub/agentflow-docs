# AgentFlow ecosystem: build, deploy, and consume multi‑agent systems

![PyPI](https://img.shields.io/pypi/v/10xscale-agentflow?color=blue)
![License](https://img.shields.io/github/license/10xhub/agentflow)
![Python](https://img.shields.io/pypi/pyversions/10xscale-agentflow)

AgentFlow is a lightweight, production‑ready stack for multi‑agent orchestration. It includes:

- AgentFlow (Python library) — build agent graphs and workflows
- AgentFlow CLI — scaffold, run, and deploy agent APIs
- AgentFlow TypeScript Client — consume AgentFlow APIs from web and Node apps

LLM‑agnostic by design: bring OpenAI, Anthropic, Gemini, local models (Ollama/LM Studio), or anything via LiteLLM or native SDKs.

---

## 🚀 The three building blocks

- Python library: [Agentflow](./Agentflow/index.md)
    - StateGraph orchestration, tools (MCP/Composio/LangChain), streaming, human‑in‑the‑loop
- CLI: [agentflow CLI](./cli/index.md)
    - Project scaffolding, local dev, Docker/K8s deployment, auth & config
- TypeScript client: [@10xscale/agentflow-client](./client/index.md)
    - Typed APIs for invoke, stream, threads, and memory — batteries included

---

## � Why teams choose AgentFlow

- Resilient checkpointing by design
    - Redis‑assisted checkpointing keeps hot paths fast while your primary DB stays lean
    - Purposeful persistence with a 3‑layer memory model (working, session, knowledge)
    - No unnecessary data saved — you control what’s stored and when

- You’re the driver — full control knobs
    - Pluggable ID generation and thread‑name generation
    - Callbacks and event hooks everywhere
    - Prompt‑injection verification hook before tools run

- Tools that scale from local to distributed
    - Native Python functions with DI
    - MCP servers as first‑class tools
    - Parallel tool calls out of the box
    - Remote tool calls across services for true micro‑orchestration

- Production signals from day one
    - Streaming (delta updates), metrics, usage, and observability
    - Publishers: Console, Redis, Kafka, RabbitMQ

- LLM freedom
    - Use LiteLLM for 100+ models or any native SDK — no lock‑in

Like other top frameworks, you also get prebuilt patterns (React, RAG, Router, Swarm, SupervisorTeam, MapReduce, Plan‑Act‑Reflect) and a clean DI model — but with leaner persistence and stronger operator controls.

---

## 🧭 Pick your path

- New to AgentFlow? Start with the [Python library overview](./Agentflow/index.md)
- Shipping APIs? Jump to the [CLI](./cli/index.md)
- Building frontends? See the [TypeScript client](./client/index.md)
- Prefer hands‑on? Walk through the [Tutorials](./Tutorial/index.md)

---

## � Install at a glance

- Python library (uv):

```bash
uv pip install 10xscale-agentflow
```

- Python library (pip):

```bash
pip install 10xscale-agentflow
```

Explore extras for MCP, Composio, LangChain, Redis/Kafka/RabbitMQ publishers, and PostgreSQL+Redis checkpointing on the library page.

---

## � Useful links

- Python library: https://pypi.org/project/10xscale-agentflow/
- GitHub: https://github.com/10xhub/agentflow
- Examples: https://github.com/10xhub/agentflow/tree/main/examples
