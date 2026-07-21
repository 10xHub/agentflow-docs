---
title: Publishers and Runtime Adapters
description: Structured execution events, external event buses, and AgentFlow runtime adapters.
sidebar_position: 16
---

# Publishers and runtime adapters

Publishers and runtime adapters let AgentFlow communicate with systems outside the immediate graph run.

- Publishers emit structured execution events for observability and event buses.
- Runtime adapters normalize provider-native SDK payloads into AgentFlow messages and tool results.

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
| `CompositePublisher` | Fan an event out to several publishers at once. |
| `OtelPublisher` | OpenTelemetry spans for each run, node, and tool call. |
| `LogfirePublisher` | Logfire traces. |
| `LangsmithPublisher` | LangSmith traces over OTLP. |

Events carry source, phase, content type, node name, thread ID, run ID, payload, timestamp, and metadata.

## Runtime adapters

Runtime adapters normalize provider-native or third-party formats into AgentFlow messages, tool schemas, and results.

| Adapter area | Exports |
|---|---|
| LLM converters | `BaseConverter`, `ConverterType`, `GoogleGenAIConverter`, `OpenAIConverter`, `OpenAIResponsesConverter` |

Import them from `agentflow.runtime.adapters`.

## Rules

| Rule | Why it matters |
|---|---|
| Prefer publishers over ad hoc print statements | Events stay structured and backend-agnostic. |
| Close network publishers on shutdown | Redis, Kafka, and RabbitMQ publishers own resources. |
| Keep optional publisher dependencies optional | Core graph imports should stay lightweight. |

## Related docs

- [Publishers reference](/docs/reference/python/publishers)
- [Production runtime](./production-runtime.md)
- [Graceful shutdown tutorial](/docs/tutorials/from-examples/graceful-shutdown)
