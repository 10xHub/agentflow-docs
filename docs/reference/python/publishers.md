---
title: Publishers
description: BasePublisher, ConsolePublisher, RedisPublisher, KafkaPublisher, RabbitMQPublisher — stream execution events from the graph.
sidebar_position: 10
---

# Publishers

## When to use this

Use a publisher when you need to observe graph execution in real time — for monitoring dashboards, analytics pipelines, or external stream processors. Publishers receive structured `EventModel` objects at every node transition, tool call, and streaming chunk.

## Import paths

```python
from agentflow.runtime.publisher import BasePublisher, ConsolePublisher
from agentflow.runtime.publisher.events import Event, EventType, ContentType, EventModel

# Optional backends
from agentflow.runtime.publisher import RedisPublisher    # pip install redis
from agentflow.runtime.publisher import KafkaPublisher    # pip install aiokafka
from agentflow.runtime.publisher import RabbitMQPublisher # pip install aio-pika
```

---

## `EventModel`

The unit of data published to a publisher. Every significant moment in graph execution emits one.

```python
from agentflow.runtime.publisher.events import EventModel
```

| Field | Type | Description |
|---|---|---|
| `event_id` | `str` | UUID identifying this event. |
| `event` | `Event` | Source of the event (graph, node, tool, streaming). |
| `event_type` | `EventType` | Phase of the event (start, progress, result, end, error…). |
| `content_type` | `ContentType` | Semantic type of the payload (text, tool_call, state…). |
| `node_name` | `str \| None` | Graph node that emitted the event. |
| `data` | `Any` | The event payload. |
| `content` | `ContentBlock \| None` | Content block if relevant. |
| `thread_id` | `str \| None` | Thread for this execution. |
| `run_id` | `str \| None` | Run for this execution. |
| `timestamp` | `datetime` | When the event was emitted. |
| `metadata` | `dict` | Additional context. |

---

## `Event` — source enum

```python
from agentflow.runtime.publisher.events import Event
```

| Value | Description |
|---|---|
| `GRAPH_EXECUTION` | Emitted by the graph runner (start/end of full execution). |
| `NODE_EXECUTION` | Emitted at the start and end of each node. |
| `TOOL_EXECUTION` | Emitted before and after each tool call. |
| `STREAMING` | Emitted for each incremental streaming chunk from the LLM. |

---

## `EventType` — phase enum

```python
from agentflow.runtime.publisher.events import EventType
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
from agentflow.runtime.publisher.events import ContentType
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
from agentflow.runtime.publisher import BasePublisher
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
    app = graph.compile(publisher=publisher)
    await app.ainvoke(...)
# publisher is automatically closed
```

---

## `ConsolePublisher`

Prints events to stdout. For development and debugging only.

```python
from agentflow.runtime.publisher import ConsolePublisher

publisher = ConsolePublisher(config={
    "format": "json",
    "include_timestamp": True,
    "indent": 2,
})

app = graph.compile(publisher=publisher)
```

| Config key | Default | Description |
|---|---|---|
| `format` | `"json"` | Output format. |
| `include_timestamp` | `True` | Include timestamp in output. |
| `indent` | `2` | JSON indentation. |

---

## `RedisPublisher`

Publishes events to a Redis Pub/Sub channel or Redis Stream.

:::note Optional dependency
```
pip install 10xscale-agentflow[redis]
# or: pip install redis>=4.2
```
:::

```python
from agentflow.runtime.publisher import RedisPublisher

publisher = RedisPublisher(config={
    "url": "redis://localhost:6379/0",
    "mode": "pubsub",       # or "stream"
    "channel": "agentflow.events",
    "stream": "agentflow.events",
    "maxlen": 10000,        # max stream length (stream mode only)
    "max_connections": 10,
    "socket_timeout": 5.0,
    "health_check_interval": 30,
})

app = graph.compile(publisher=publisher)
```

| Config key | Default | Description |
|---|---|---|
| `url` | `redis://localhost:6379/0` | Redis connection URL. |
| `mode` | `pubsub` | `"pubsub"` for Pub/Sub or `"stream"` for Redis Streams. |
| `channel` | `agentflow.events` | Pub/Sub channel name. |
| `stream` | `agentflow.events` | Stream name for `"stream"` mode. |
| `maxlen` | `None` | Maximum stream entries (stream mode). Set for bounded streams. |
| `max_connections` | `10` | Connection pool size. |
| `socket_timeout` | `5.0` | Socket timeout in seconds. |
| `socket_connect_timeout` | `5.0` | Connection timeout in seconds. |
| `socket_keepalive` | `True` | TCP keepalive. |
| `health_check_interval` | `30` | Seconds between pool health checks. |

---

## `KafkaPublisher`

Publishes events to an Apache Kafka topic.

:::note Optional dependency
```
pip install aiokafka
```
:::

```python
from agentflow.runtime.publisher import KafkaPublisher

publisher = KafkaPublisher(config={
    "bootstrap_servers": "localhost:9092",
    "topic": "agentflow-events",
    "compression_type": "gzip",
})

app = graph.compile(publisher=publisher)
```

---

## `RabbitMQPublisher`

Publishes events to a RabbitMQ exchange.

:::note Optional dependency
```
pip install aio-pika
```
:::

```python
from agentflow.runtime.publisher import RabbitMQPublisher

publisher = RabbitMQPublisher(config={
    "url": "amqp://guest:guest@localhost:5672/",
    "exchange": "agentflow",
    "routing_key": "events",
})

app = graph.compile(publisher=publisher)
```

---

## Writing a custom publisher

```python
from agentflow.runtime.publisher import BasePublisher
from agentflow.runtime.publisher.events import EventModel
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
