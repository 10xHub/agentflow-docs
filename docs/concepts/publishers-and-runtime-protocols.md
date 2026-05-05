---
title: Publishers and Runtime Protocols
description: Structured execution events, external event buses, and AgentFlow runtime protocol integrations.
sidebar_position: 16
---

# Publishers and runtime protocols

Publishers and runtime protocols let AgentFlow communicate with systems outside the immediate graph run.

- Publishers emit structured execution events for observability and event buses.
- Runtime protocols expose or call agents through protocols such as A2A and ACP.

## Publishers

Publishers receive structured `EventModel` payloads from graph execution.

```python
from agentflow.runtime.publisher import ConsolePublisher

publisher = ConsolePublisher(config={"format": "json"})
app = graph.compile(publisher=publisher)
```

Available publisher implementations include:

| Publisher | Use case |
|---|---|
| `ConsolePublisher` | Local debugging. |
| `RedisPublisher` | Pub/Sub or stream-backed event distribution. |
| `KafkaPublisher` | Kafka event pipelines. |
| `RabbitMQPublisher` | RabbitMQ messaging. |

Events carry source, phase, content type, node name, thread ID, run ID, payload, timestamp, and metadata.

## Runtime adapters

Runtime adapters normalize provider-native or third-party formats into AgentFlow messages, tool schemas, and results.

| Adapter area | Examples |
|---|---|
| LLM converters | `GoogleGenAIConverter`, `OpenAIConverter`, `OpenAIResponsesConverter` |
| Tool adapters | `LangChainAdapter`, `ComposioAdapter` |

## A2A and ACP

A2A helpers live under `agentflow.runtime.protocols.a2a`.

| Helper | Purpose |
|---|---|
| `build_a2a_app`, `create_a2a_server` | Serve an AgentFlow graph as an A2A-compatible app. |
| `delegate_to_a2a_agent` | Call a remote A2A agent once. |
| `create_a2a_client_node` | Use a remote A2A agent as a graph node. |
| `AgentFlowExecutor` | Bridge AgentFlow graph execution into A2A. |

A2A support requires optional dependencies. Keep imports lazy or guarded when the protocol package may not be installed.

ACP support is available under `agentflow.runtime.protocols.acp`. Check source and reference docs before extending it because the public docs are thinner than the core graph docs.

## Rules

| Rule | Why it matters |
|---|---|
| Prefer publishers over ad hoc print statements | Events stay structured and backend-agnostic. |
| Close network publishers on shutdown | Redis, Kafka, and RabbitMQ publishers own resources. |
| Keep optional protocol dependencies optional | Core graph imports should stay lightweight. |
| Distinguish serving from delegating | Serving a graph as A2A differs from calling a remote A2A agent. |

## Related docs

- [Publishers reference](/docs/reference/python/publishers)
- [Production runtime](./production-runtime.md)
- [Graceful shutdown tutorial](/docs/tutorials/from-examples/graceful-shutdown)
