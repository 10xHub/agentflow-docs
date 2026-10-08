---
title: Events and observability
description: How 10xGraph emits structured events, publishes them to external systems, and exposes metrics and tracing for production monitoring.
updated: "2026-10-08"
order: 180
group: "Serving"
section: Concepts
faq:
  - q: "How do I export events to LangSmith or Logfire?"
    a: "Use `setup_langsmith()` or `setup_logfire()` in your `10xgraph.json` observability config, or call the functions directly at startup from Python. These wrap the OTEL tracer and export spans to their backend."
  - q: "What is the difference between metrics and tracing?"
    a: "Metrics are aggregated counters and histograms (message count, latency percentiles), dimensioned, dashboarded data. Tracing captures individual request flows as spans with attributes and hierarchy, useful for debugging. 10xGraph emits both."
  - q: "Can I publish events to multiple backends at once?"
    a: "Yes. Use `CompositePublisher` to fan out to Console, Redis, Kafka, RabbitMQ, and OTEL simultaneously. Wire them together in `10xgraph.json` or Python."
---

When a 10xGraph agent executes, it emits a continuous stream of structured events: the graph starts, nodes run, tools call, LLMs respond, and the graph ends. Each event carries execution context (thread ID, run ID, user ID, timestamps) and semantic content type (text, tool call, error). This event stream is the foundation for observability in production: you can publish events to external systems for logging, distributed tracing, metrics, and real-time monitoring.

This page explains the event model, the publishers that deliver events to backends, the metrics system, and how tracing works end to end.

## The event model

Every execution event is an `EventModel`: a structured record with a source, phase, content, and metadata.

### Event sources and phases

Events come from four sources within the runtime:

- **Graph execution**: The overall graph lifecycle (start, progress, end).
- **Node execution**: A node in the graph running (a step of work).
- **LLM call**: An agent or LLM node making a request to a model.
- **Tool execution**: A tool being invoked.
- **Streaming**: Real-time output from a node (e.g., token-by-token LLM output).
- **Realtime**: Audio/streaming media from a realtime endpoint.

Each event is tagged with a phase that marks its place in the lifecycle:

- **START**: Execution is beginning.
- **PROGRESS**: Execution is in progress (e.g., partial LLM output).
- **RESULT**: A result is available (e.g., tool output).
- **END**: Execution is complete.
- **UPDATE**: State or metadata changed.
- **ERROR**: An error occurred.
- **INTERRUPTED**: Execution was paused for human approval.

### Event content and metadata

Every event carries:

- **Content**: Textual or structured content blocks (text, tool calls, reasoning, images, audio, documents).
- **Content type**: Semantic tag (`TEXT`, `MESSAGE`, `TOOL_CALL`, `TOOL_RESULT`, `ERROR`, etc.).
- **Execution context**: `thread_id` (which conversation), `run_id` (which execution), `user_id` (who ran it), `timestamp` (when), `node_name` (which node).
- **Structured data**: A dictionary of additional fields specific to the event (model name, tokens, tool name, error message, etc.).
- **Metadata**: Optional extra attributes for consumers (is it streaming, what was trimmed, etc.).

This structure lets you slice and filter events by any dimension: all events for a thread, all LLM calls for a user, all errors in the last hour.

## Publishers: routing events to external systems

The runtime publishes events to external systems via pluggable publishers. Each publisher implements a simple interface: `async def publish(event: EventModel)`. You can wire one or many publishers into your graph at compile time, and the runtime fans events out to all of them.

### Built-in publishers

**ConsolePublisher** is for development and debugging. It writes events to stdout (or to a logger) so you see them as your graph runs locally. It's opt-in and not used in production by default.

```python
from tenxgraph import StateGraph
from tenxgraph.runtime.publisher import ConsolePublisher

graph = StateGraph(AgentState)
# ... add nodes and edges ...

compiled = graph.compile(
    publisher=ConsolePublisher({"format": "json", "indent": 2})
)
```

**RedisPublisher** broadcasts each event to a Redis Pub/Sub channel. Subscribers on the server (or any external system listening to that channel) receive all events in real time. Useful for event-driven architectures and low-latency integrations.

**KafkaPublisher** publishes events to a Kafka topic. Each event becomes a message in the stream, so multiple consumers can replay or process them independently. Kafka is durable and fault-tolerant, making it a good choice for high-volume production systems.

**RabbitMQPublisher** sends events to a RabbitMQ exchange and queue. You configure routing keys and exchanges to partition events by type, user, or any other dimension.

**OtelPublisher** reconstructs OTEL (OpenTelemetry) spans from events. Every graph execution becomes a span tree: the graph span has child spans for nodes, LLM calls, and tool calls. Attributes from the event data are attached to each span, and the span timing comes from the event timestamps. If you have an OTEL collector and exporter configured (e.g., Jaeger, Datadog, New Relic), spans are sent there automatically.

**LangsmithPublisher** sends traces to LangSmith, the observability platform from LangChain. Traces map to individual graph runs, with each span corresponding to a node or tool call. This is useful if your team already uses LangSmith for monitoring and debugging.

**LogfirePublisher** exports spans to Logfire, Pydantic's observability platform. Like LangSmith, it captures the full execution trace and makes it queryable in their UI.

**CompositePublisher** is a fan-out publisher: it holds a list of other publishers and sends each event to all of them concurrently. Failures in one publisher are logged but do not block the others. Use this to, for example, send events to both Redis and OTEL at the same time.

```python
from tenxgraph.runtime.publisher import CompositePublisher, ConsolePublisher, RedisPublisher

publishers = [
    ConsolePublisher(),
    RedisPublisher({"url": "redis://localhost:6379"}),
]
composite = CompositePublisher(publishers)

compiled = graph.compile(publisher=composite)
```

### Configuring publishers

In Python, pass a publisher to `compile()`:

```python
compiled = graph.compile(publisher=redis_publisher)
```

Or use the API server's `10xgraph.json` observability block:

```json
{
  "agent": "graph:app",
  "observability": {
    "publishers": [
      {"type": "console", "format": "json"},
      {"type": "redis", "url": "redis://localhost:6379"}
    ],
    "otel": {
      "enabled": true,
      "level": "STANDARD"
    }
  }
}
```

The API server wires up publishers from the config and binds them into the dependency injection container, so they are injected into the graph at runtime.

## Metrics: counters and latency timers

The `tenxgraph.utils.metrics` module provides a lightweight, zero-dependency metrics system. You can emit counters (counts of events) and timers (latency measurements) from anywhere in your code.

### Using the metrics API

```python
from tenxgraph.utils.metrics import counter, timer

# Increment a counter
counter("messages_sent_total").inc()

# Record latency
with timer("db_query_latency_ms"):
    result = await db.query()

# With attributes (dimensions for OTEL)
counter("node_executions").inc(attributes={"node": "agent", "outcome": "success"})
```

Metrics are stored in an in-process registry and are cheap to call (no I/O by default). You can take a snapshot at any time:

```python
from tenxgraph.utils.metrics import snapshot

snapshot_data = snapshot()
# {
#   "counters": {"messages_sent_total": 42},
#   "timers": {
#     "db_query_latency_ms": {
#       "count": 10,
#       "avg_ms": 15.2,
#       "max_ms": 42.1
#     }
#   }
# }
```

### Exporting metrics to OpenTelemetry

By default, metrics stay in-process. To export them to your observability backend (Prometheus, Datadog, etc.) via OTEL:

```python
from tenxgraph.utils.metrics import setup_otel_metrics

# Call once at startup
setup_otel_metrics()

# Every counter/timer now exports to your OTEL MeterProvider
```

If you do not have OpenTelemetry installed, `setup_otel_metrics()` returns False and logs a message; metrics keep working in-process.

The framework emits standard metrics:
- `tenxgraph.node.executions`: Counter for node runs, with attributes for node name and outcome.
- `tenxgraph.llm.calls`: Counter for LLM calls.
- `tenxgraph.tool.calls`: Counter for tool calls.
- `tenxgraph.execution.latency_ms`: Histogram of execution times.

You can add your own metrics in custom nodes or tools, and they will all export together if OTEL is configured.

## Tracing: spans and attributes

Tracing captures the shape and timing of a request as a tree of spans. The `OtelPublisher` reconstructs this tree from EventModel events.

### How tracing works

Each execution event corresponds to a span. The event hierarchy maps to span parent-child relationships:

- Graph execution event → graph span (root).
- Node execution event → node span (child of graph).
- LLM call event → LLM span (child of node).
- Tool execution event → tool span (child of node).

Span timing is set from `EventModel.timestamp`. Attributes are derived from event data: model name, token counts, tool name, thread ID, user ID, etc. These attributes follow OTEL semantic conventions (the `gen_ai.*`, `server.*`, `db.*` namespaces).

### Observability levels

The `OtelPublisher` emits different amounts of data based on the `ObservabilityLevel`:

- **SPANS**: Structure and timing only. No input/output data on spans (fastest, smallest, safest).
- **STANDARD**: Adds token counts, model name, request parameters (default).
- **FULL**: Adds model input messages, output, tool I/O, system prompt (may contain PII; use only in dev/controlled environments).

Set the level when configuring OTEL:

```python
from tenxgraph.runtime.publisher import OtelPublisher, ObservabilityLevel

publisher = OtelPublisher(level=ObservabilityLevel.FULL)
compiled = graph.compile(publisher=publisher)
```

Or in `10xgraph.json`:

```json
{
  "observability": {
    "otel": {
      "enabled": true,
      "level": "STANDARD"
    }
  }
}
```

### Distributed tracing

When you integrate with an OTEL collector (e.g., Jaeger, Datadog, New Relic), spans are exported as they complete. You can then:

- View the full execution tree in the observability platform's UI.
- Search spans by attributes (find all runs by a user, all errors, etc.).
- Set alerts on error rates or latency percentiles.
- Sample traces for inspection (e.g., every 100th request, or all errors).

## Where each sink is configured

Here is a reference table of where each piece is configured:

| Feature | Config key / env var | Python API | 10xgraph.json | Details |
|---------|----------------------|------------|-------|----------|
| Console output | - | `ConsolePublisher()` | `observability.publishers[].type: "console"` | Dev/debug only |
| Redis Pub/Sub | `REDIS_URL` | `RedisPublisher(url)` | `observability.publishers[].type: "redis"` | Event stream |
| Kafka | - | `KafkaPublisher(brokers)` | `observability.publishers[].type: "kafka"` | High-volume events |
| RabbitMQ | - | `RabbitMQPublisher(url)` | `observability.publishers[].type: "rabbitmq"` | Durable queues |
| OTEL tracing | `OTEL_EXPORTER_OTLP_ENDPOINT` | `OtelPublisher(level)` | `observability.otel.enabled` | Spans tree |
| LangSmith | `LANGCHAIN_API_KEY` | `setup_langsmith()` | `observability.langsmith.enabled` | LangSmith traces |
| Logfire | `LOGFIRE_TOKEN` | `setup_logfire()` | `observability.logfire.enabled` | Logfire traces |
| Metrics | - | `setup_otel_metrics()` | - | Counters/histograms |

## Publishing events from custom nodes

If you write custom nodes or tools, you can emit your own events:

```python
from tenxgraph.runtime.publisher import EventModel, Event, EventType, ContentType, publish_event

async def my_custom_node(state, publish=Inject[publish_event]):
    # ... do work ...
    
    event = EventModel.default(
        base_config={
            "thread_id": state.thread_id,
            "run_id": state.run_id,
            "timestamp": time.time(),
        },
        data={"custom_metric": value},
        content_type=[ContentType.DATA],
        event=Event.NODE_EXECUTION,
        event_type=EventType.UPDATE,
        node_name="my_custom_node",
    )
    publish(event)
```

The publisher (if configured) will route your event to all sinks automatically.

## Summary

Events are the nerve system of production AI agents. 10xGraph emits them continuously, in a structured format that captures context and content. Publishers fan them out to backends for logging, tracing, metrics, and alerting. The framework provides publishers for Console (dev), Redis, Kafka, RabbitMQ, OTEL, LangSmith, and Logfire, and you can build your own by subclassing `BasePublisher`. Metrics and tracing work through OTEL, so your existing observability stack can integrate with minimal configuration.

For production, start with OTEL + one backend (Datadog, New Relic, Jaeger), add a metrics exporter, and layer in Redis or Kafka for event replay if needed.
