---
title: Publishers
seoTitle: "Publishers API reference (Python)"
description: Reference for ConsolePublisher, RedisPublisher, KafkaPublisher, RabbitMQPublisher, OtelPublisher, LogfirePublisher, and LangsmithPublisher event publishers.
section: Reference
group: "Python library"
order: 190
label: Publishers
updated: "2026-07-21"
---

## When to use this

Use a publisher when you need to observe graph execution in real time — for monitoring dashboards, analytics pipelines, or external stream processors. Publishers receive structured `EventModel` objects at every node transition, tool call, and streaming chunk.

## Import paths

```python
from tenxgraph.core.graph import StateGraph
from tenxgraph.runtime.publisher import BasePublisher, ConsolePublisher
from tenxgraph.runtime.publisher.events import Event, EventType, ContentType, EventModel

# Optional backends
from tenxgraph.runtime.publisher import RedisPublisher    # pip install redis
from tenxgraph.runtime.publisher import KafkaPublisher    # pip install aiokafka
from tenxgraph.runtime.publisher import RabbitMQPublisher # pip install aio-pika

# Fan-out
from tenxgraph.runtime.publisher import CompositePublisher

# Tracing backends
from tenxgraph.runtime.publisher import (
    LangsmithPublisher,
    LogfirePublisher,
    ObservabilityLevel,
    OtelPublisher,
    setup_langsmith,
    setup_logfire,
    setup_observability,
    setup_tracing,
)
```

---

## `EventModel`

The unit of data published to a publisher. Every significant moment in graph execution emits one.

```python
from tenxgraph.runtime.publisher.events import EventModel
```

| Field | Type | Description |
|---|---|---|
| `event` | `Event` | Source of the event (graph, node, tool, streaming). |
| `event_type` | `EventType` | Phase of the event (`start`, `progress`, `result`, `end`, `update`, `error`...). |
| `content` | `str` | Streamed textual content. Default `""`. |
| `content_blocks` | `list[ContentBlock] \| None` | Structured content blocks for multimodal or structured streaming. |
| `data` | `dict` | Structured payload. Default `{}`. |
| `content_type` | `list[ContentType] \| None` | Semantic types of the payload (text, tool_call, state...). |
| `node_name` | `str` | Graph node that emitted the event. |
| `run_id` | `str` | Unique ID for this run. |
| `thread_id` | `str \| int` | Thread for this execution. |
| `user_id` | `str \| int \| None` | User associated with the execution. |
| `timestamp` | `float` | UNIX timestamp of when the event was created. |
| `is_error` | `bool` | `True` when the event represents an error state. |
| `metadata` | `dict` | Additional context for consumers. |

There is no `event_id` field. Use `run_id`, `thread_id` and `timestamp` to correlate events.

---

## `Event` — source enum

```python
from tenxgraph.runtime.publisher.events import Event
```

| Value | Description |
|---|---|
| `GRAPH_EXECUTION` | Emitted by the graph runner (start/end of full execution). |
| `NODE_EXECUTION` | Emitted at the start and end of each node. |
| `LLM_CALL` | Emitted for individual LLM API calls within a node. |
| `TOOL_EXECUTION` | Emitted before and after each tool call. |
| `STREAMING` | Emitted for each incremental streaming chunk from the LLM. |
| `REALTIME` | Emitted by realtime audio-to-audio sessions. |

---

## `EventType` — phase enum

```python
from tenxgraph.runtime.publisher.events import EventType
```

| Value | When emitted |
|---|---|
| `START` | Execution begins. |
| `PROGRESS` | Intermediate update during streaming. |
| `RESULT` | A result is ready (tool result, LLM completion). |
| `END` | Execution ends normally. |
| `UPDATE` | State or data updated. |
| `ERROR` | An error occurred. |
| `INTERRUPTED` | Execution paused at an interrupt point. |

---

## `ContentType` — payload type enum

```python
from tenxgraph.runtime.publisher.events import ContentType
```

| Value | When used |
|---|---|
| `TEXT` | Plain text output. |
| `MESSAGE` | Full message object. |
| `REASONING` | Extended thinking trace. |
| `TOOL_CALL` | Tool invocation request. |
| `TOOL_RESULT` | Tool execution result. |
| `IMAGE` | Image content. |
| `AUDIO` | Audio content. |
| `TRANSCRIPT` | Text transcript of audio content (realtime sessions). |
| `VIDEO` | Video content. |
| `DOCUMENT` | Document content. |
| `DATA` | Binary/structured data. |
| `STATE` | Graph state snapshot. |
| `UPDATE` | Incremental update. |
| `ERROR` | Error payload. |

---

## `BasePublisher`

Abstract class. All publishers implement this interface.

```python
from tenxgraph.runtime.publisher import BasePublisher
```

### Abstract methods

| Method | Signature | Description |
|---|---|---|
| `publish` | `async (event: EventModel) -> Any` | Publish one event. Raises `RuntimeError` if the publisher is closed. |
| `close` | `async () -> None` | Release connections and resources. Idempotent. |
| `sync_close` | `() -> None` | Synchronous close for use in non-async shutdown handlers. |

### Context manager

```python
async with ConsolePublisher() as publisher:
    graph = StateGraph(publisher=publisher)
    # ... add nodes and edges
    app = graph.compile()
    await app.ainvoke(...)
# publisher is automatically closed
```

---

## `ConsolePublisher`

A development and debugging publisher. It is opt-in and not wired up by default. For production, use a real transport such as `RedisPublisher`, `KafkaPublisher`, or `RabbitMQPublisher`.

By default events are written to stdout via `print`. In server contexts where stdout output is undesirable, set `use_logger=True` to route events through the `tenxgraph.publisher` logger at `INFO` level instead.

```python
from tenxgraph.runtime.publisher import ConsolePublisher

# Default — writes to stdout
publisher = ConsolePublisher()

# Route through the logging system instead of stdout
publisher = ConsolePublisher(config={"use_logger": True})

# Pass the publisher to the graph constructor, not compile()
graph = StateGraph(publisher=publisher)
app = graph.compile()
```

| Config key | Default | Description |
|---|---|---|
| `format` | `"json"` | Output format. |
| `include_timestamp` | `True` | Include timestamp in output. |
| `indent` | `2` | JSON indentation. |
| `use_logger` | `False` | When `True`, emit via the `tenxgraph.publisher` logger at `INFO` level instead of `print`. |

---

## `RedisPublisher`

Publishes events to a Redis Pub/Sub channel or Redis Stream.

<aside class="callout callout-note" role="note"><p class="callout-title">Optional dependency</p>

```
pip install 10xgraph[redis]
# or: pip install redis>=4.2
```

</aside>

```python
from tenxgraph.runtime.publisher import RedisPublisher

publisher = RedisPublisher(config={
    "url": "redis://localhost:6379/0",
    "mode": "pubsub",       # or "stream"
    "channel": "tenxgraph.events",
    "stream": "tenxgraph.events",
    "maxlen": 10000,        # max stream length (stream mode only)
    "max_connections": 10,
    "socket_timeout": 5.0,
    "health_check_interval": 30,
})

# Pass the publisher to the graph constructor, not compile()
graph = StateGraph(publisher=publisher)
app = graph.compile()
```

| Config key | Default | Description |
|---|---|---|
| `url` | `redis://localhost:6379/0` | Redis connection URL. |
| `mode` | `pubsub` | `"pubsub"` for Pub/Sub or `"stream"` for Redis Streams. |
| `channel` | `tenxgraph.events` | Pub/Sub channel name. |
| `stream` | `tenxgraph.events` | Stream name for `"stream"` mode. |
| `maxlen` | `None` | Maximum stream entries (stream mode). Set for bounded streams. |
| `max_connections` | `10` | Connection pool size. |
| `socket_timeout` | `5.0` | Socket timeout in seconds. |
| `socket_connect_timeout` | `5.0` | Connection timeout in seconds. |
| `socket_keepalive` | `True` | TCP keepalive. |
| `health_check_interval` | `30` | Seconds between pool health checks. |

---

## `KafkaPublisher`

Publishes events to an Apache Kafka topic.

<aside class="callout callout-note" role="note"><p class="callout-title">Optional dependency</p>

```
pip install aiokafka
```

</aside>

```python
from tenxgraph.runtime.publisher import KafkaPublisher

publisher = KafkaPublisher(config={
    "bootstrap_servers": "localhost:9092",
    "topic": "agentflow-events",
    "compression_type": "gzip",
})

# Pass the publisher to the graph constructor, not compile()
graph = StateGraph(publisher=publisher)
app = graph.compile()
```

---

## `RabbitMQPublisher`

Publishes events to a RabbitMQ exchange.

<aside class="callout callout-note" role="note"><p class="callout-title">Optional dependency</p>

```
pip install aio-pika
```

</aside>

```python
from tenxgraph.runtime.publisher import RabbitMQPublisher

publisher = RabbitMQPublisher(config={
    "url": "amqp://guest:guest@localhost:5672/",
    "exchange": "agentflow",
    "routing_key": "events",
})

# Pass the publisher to the graph constructor, not compile()
graph = StateGraph(publisher=publisher)
app = graph.compile()
```

---

## `CompositePublisher`

Broadcasts every event to a list of publishers concurrently. A failure in one publisher is logged and does not stop the others.

```python
from tenxgraph.runtime.publisher import CompositePublisher, ConsolePublisher, RedisPublisher

publisher = CompositePublisher([ConsolePublisher(), RedisPublisher({"url": "redis://localhost:6379"})])
# Pass the publisher to the graph constructor, not compile()
graph = StateGraph(publisher=publisher)
app = graph.compile()
```

`add_publisher(publisher)` and `remove_publisher(publisher)` mutate the list after construction.

---

## Tracing publishers

These publishers map `EventModel` events onto OpenTelemetry spans instead of onto a message bus. Unlike the bus publishers they must be attached **before** `graph.compile()`, because the tracer has to be bound in the DI container at compile time.

### `ObservabilityLevel`

Controls how much data ends up on the spans.

| Value | Emits |
|---|---|
| `SPANS` | Timing and structure only. No I/O data. |
| `STANDARD` | Adds token counts, model name, and request parameters when available. Default. |
| `FULL` | Adds model input and output messages, tool I/O, and the system prompt. May contain PII; use only in controlled environments. |

### `OtelPublisher`

```python
from tenxgraph.runtime.publisher import ObservabilityLevel, OtelPublisher, setup_tracing

# Explicit
graph._publisher = OtelPublisher(tracer=my_tracer, level=ObservabilityLevel.STANDARD)

# Or via the helper, which builds and attaches one for you
setup_tracing(graph, level=ObservabilityLevel.STANDARD)

app = graph.compile()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `tracer` | `Tracer \| None` | `None` | Explicit OTEL tracer. Uses the global `TracerProvider` when omitted. |
| `level` | `ObservabilityLevel` | `STANDARD` | How much data lands on the spans. |

`setup_tracing(graph, tracer=None, level=STANDARD)` registers an `OtelPublisher` on the graph and returns it. It raises `ImportError` when `opentelemetry-api` is not installed (`pip install "10xgraph[otel]"`).

### `LogfirePublisher`

An `OtelPublisher` that calls `logfire.configure()` during construction, so the Logfire-managed `TracerProvider` is global before any span is created.

```python
from tenxgraph.runtime.publisher import setup_logfire

setup_logfire(graph, service_name="my-agent", send_to_logfire=True)
app = graph.compile()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `token` | `str \| None` | `None` | Logfire write token. Falls back to `LOGFIRE_TOKEN`. |
| `service_name` | `str \| None` | `None` | Service name shown in the Logfire UI. |
| `send_to_logfire` | `bool` | `True` | Whether to export spans to logfire.dev. |
| `console` | `Any` | `None` | `False` to suppress console output, or a `logfire.ConsoleOptions`. `None` uses env-var defaults. |
| `level` | `ObservabilityLevel` | `STANDARD` | Span detail level. |
| `additional_span_processors` | `list \| None` | `None` | Extra `SpanProcessor` instances to attach alongside the Logfire processor. |
| `**configure_kwargs` | any | — | Forwarded verbatim to `logfire.configure()`. |

Requires `pip install "10xgraph[logfire]"`.

### `LangsmithPublisher`

An `OtelPublisher` that builds an OTLP HTTP span processor pointed at LangSmith and attaches it to a supplied or freshly created `TracerProvider`.

```python
from tenxgraph.runtime.publisher import setup_langsmith

setup_langsmith(graph, project="my-project")
app = graph.compile()
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `api_key` | `str \| None` | `None` | LangSmith API key. Falls back to `LANGSMITH_API_KEY`. Raises `ValueError` when neither is set. |
| `project` | `str \| None` | `None` | Sent as the `Langsmith-Project` request header. |
| `endpoint` | `str` | `https://api.smith.langchain.com/otel` | Base OTEL endpoint. `/v1/traces` is appended automatically. Override for regional deployments. |
| `level` | `ObservabilityLevel` | `STANDARD` | Span detail level. |
| `tracer_provider` | `Any` | `None` | Existing `TracerProvider` to attach to. A new global one is created when omitted. |

Requires `pip install "10xgraph[langsmith]"`.

### `setup_observability`

One entry point driven by the `observability` block of `10xgraph.json`. Enables Logfire and/or LangSmith and makes them share a single `TracerProvider` when both are active.

```python
from tenxgraph.runtime.publisher import setup_observability

setup_observability(graph, {
    "level": "standard",
    "logfire": {"enabled": True, "service_name": "my-agent", "console": False},
    "langsmith": {"enabled": True, "project": "my-project"},
})
```

Pass `graph=None` to configure providers and exporters only, without binding a publisher onto a graph. Secrets (`LOGFIRE_TOKEN`, `LANGSMITH_API_KEY`) must come from the environment, never from the config dict. An unrecognised `level` falls back to `STANDARD`.

See [Send traces to Logfire or LangSmith](/docs/guides/send-traces-to-logfire-langsmith) for the end-to-end setup.

---

## Writing a custom publisher

```python
from tenxgraph.runtime.publisher import BasePublisher
from tenxgraph.runtime.publisher.events import EventModel
import httpx

class WebhookPublisher(BasePublisher):

    def __init__(self, webhook_url: str, config: dict | None = None):
        super().__init__(config or {})
        self.webhook_url = webhook_url
        self._client: httpx.AsyncClient | None = None

    async def publish(self, event: EventModel) -> None:
        if self._is_closed:
            raise RuntimeError("Publisher is closed")
        if self._client is None:
            self._client = httpx.AsyncClient()
        await self._client.post(self.webhook_url, json=event.model_dump())

    async def close(self):
        if not self._is_closed:
            if self._client:
                await self._client.aclose()
            self._is_closed = True

    def sync_close(self):
        import asyncio
        asyncio.run(self.close())
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `RuntimeError: Cannot publish to closed publisher` | `publish()` called after `close()`. | Do not call `ainvoke` after `aclose()`. Use the async context manager. |
| `ImportError: redis` | `RedisPublisher` used without `redis` installed. | `pip install redis`. |
| `ImportError: aiokafka` | `KafkaPublisher` used without `aiokafka`. | `pip install aiokafka`. |
| `ImportError: aio-pika` | `RabbitMQPublisher` used without `aio-pika`. | `pip install aio-pika`. |
| Events missing from channel | Publisher not passed to `graph.compile()`. | Add `publisher=my_publisher` to `compile()`. |
| `ImportError: OpenTelemetry is required for tracing` | `OtelPublisher` / `setup_tracing` used without OTEL. | `pip install "10xgraph[otel]"`. |
| No spans from a tracing publisher | Attached after `graph.compile()`. | Call `setup_tracing` / `setup_logfire` / `setup_langsmith` before `compile()`. |
