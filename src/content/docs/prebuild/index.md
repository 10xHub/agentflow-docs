---
title: Prebuilt agents and tools
seoTitle: "Prebuilt agents and tools in 10xGraph"
description: "Prebuilt 10xGraph agents (ReAct, RAG, supervisor, swarm, plan-act-reflect, structured output, audio) and tools you can use as they are or extend."
section: Prebuilt
order: 370
label: Overview
updated: "2026-10-06"
---

Prebuilt agents are ready-made `StateGraph` patterns in `agentflow.prebuilt.agent`. Prebuilt tools are plain functions in `agentflow.prebuilt.tools` that you pass to an agent. Both are ordinary 10xGraph code, so they compile, checkpoint and serve through the API server like a graph you wrote yourself. Use them to skip the boilerplate for common shapes, and move to a custom `StateGraph` when your routing stops fitting.

## Prebuilt agents

| Agent | Use it when |
|---|---|
| [ReactAgent](/docs/prebuild/agents/react-agent) | One model calls tools in a loop until it has an answer. The default starting point |
| [PlanActReflectAgent](/docs/prebuild/agents/plan-act-reflect-agent) | Tasks need a plan and a critic that decides whether to iterate again |
| [RAGAgent](/docs/prebuild/agents/rag-agent) | Answers must come from your documents, with optional reranking by `CohereReranker` or `CrossEncoderReranker` |
| [StructuredOutputAgent](/docs/prebuild/agents/structured-output-agent) | Output must match a Pydantic schema, with automatic repair of invalid JSON |
| [SupervisorTeamAgent](/docs/prebuild/agents/supervisor-team-agent) | One coordinator routes work to specialist workers defined with `WorkerConfig` |
| [SwarmAgent](/docs/prebuild/agents/swarm-agent) | Peer agents hand control to each other through `transfer_to_X` tools, with no central supervisor |
| [AudioAgent](/docs/prebuild/agents/audio-agent) | Realtime audio-to-audio sessions through Gemini Live |

## Prebuilt tools

- [Web tools](/docs/prebuild/tools/web-tools): `fetch_url`, `google_web_search` and `vertex_ai_search`. `fetch_url` blocks private and loopback addresses.
- [File tools](/docs/prebuild/tools/file-tools): `file_read`, `file_write` and `file_search`, confined to a workspace root.
- [Memory tools](/docs/prebuild/tools/memory-tools): `memory_tool` plus user and agent memory tools. They need a configured store.
- [Calculator](/docs/prebuild/tools/calculator): `safe_calculator`, which evaluates arithmetic without running code.
- [Handoff tools](/docs/prebuild/tools/handoff): `create_handoff_tool` and `is_handoff_tool`, used to route between agents.

## How to extend one

Pass your own functions next to the prebuilt ones. A support agent can combine `safe_calculator` with `lookup_order(order_id: str)` and `refund_order(order_id: str, amount: float)`:

```python
from agentflow.prebuilt.agent import ReactAgent
from agentflow.prebuilt.tools import safe_calculator

agent = ReactAgent(
    model="gpt-4o-mini",
    tools=[lookup_order, refund_order, safe_calculator],
)
app = agent.compile(checkpointer=checkpointer)
```

Constructor options such as `system_prompt`, `memory` and `fallback_models` tune behavior without code changes. When an agent no longer fits, read its page for the graph it builds and recreate it as a `StateGraph`. The [concepts section](/docs/concepts) explains tools and graphs, and [Add a tool](/docs/beginner/add-a-tool) walks through writing one.
