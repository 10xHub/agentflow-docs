---
title: How to use publishers
sidebar_label: Publishers
description: Guide to emitting structured events during graph execution with ConsolePublisher, RedisPublisher, KafkaPublisher, RabbitMQPublisher, CompositePublisher, and OtelPublisher.
keywords:
  - agentflow publishers
  - kafka publisher
  - redis pub sub
  - rabbitmq publisher
  - event streaming
  - opentelemetry
  - agentflow
sidebar_position: 10
---

# How to use publishers

Publishers emit structured `EventModel` events during graph execution — node starts and ends, tool calls, streaming tokens, state updates, and errors. They are optional: graphs run without them. Add a publisher when you need to observe, audit, or forward execution events to external systems.

---

## Publisher overview

| Class | Transport | Install extra |
|---|---|---|
| `ConsolePublisher` | `print()` to stdout | none (built-in) |
| `RedisPublisher` | Redis Pub/Sub or Redis Streams | `pip install 10xscale-agentflow[redis]` |
| `KafkaPublisher` | Kafka topic via `aiokafka` | `pip install 10xscale-agentflow[kafka]` |
| `RabbitMQPublisher` | RabbitMQ exchange via `aio-pika` | `pip install 10xscale-agentflow[rabbitmq]` |
| `CompositePublisher` | Fan-out to multiple publishers | none (built-in) |
| `OtelPublisher` | OpenTelemetry traces | install `opentelemetry-*` packages |

All publishers extend `BasePublisher`. Pass a publisher to `StateGraph(publisher=...)`.

---

## ConsolePublisher

Prints every event to stdout. Good for debugging locally. This publisher is opt-in and writes to stdout by default. In a server context where stdout output is not desirable, pass `{"use_logger": True}` to route events through the `agentflow.publisher` logger at `INFO` level instead:

```python
from agentflow.runtime.publisher import ConsolePublisher
from agentflow.core.graph import StateGraph

# Default — writes to stdout
publisher = ConsolePublisher()

# Route through the logging system
publisher = ConsolePublisher(config={"use_logger": True})

graph = StateGraph(publisher=publisher)
# ... add nodes, edges, compile, invoke
```

Do not use `ConsolePublisher` in production. Use a real transport (`RedisPublisher`, `KafkaPublisher`, `RabbitMQPublisher`) for any deployed environment.

---

## RedisPublisher

Publishes events as JSON to a Redis channel or stream. Requires `pip install 10xscale-agentflow[redis]`.

### Pub/Sub mode (default)

```python
from agentflow.runtime.publisher import RedisPublisher
from agentflow.core.graph import StateGraph

publisher = RedisPublisher({
    "url": "redis://localhost:6379/0",
    "mode": "pubsub",
    "channel": "agentflow.events",
    "max_connections": 10,
})

graph = StateGraph(publisher=publisher)
```

A subscriber on the same channel receives every event JSON:

```python
import redis.asyncio as aioredis
import asyncio

async def listen():
    r = aioredis.from_url("redis://localhost:6379/0")
    pubsub = r.pubsub()
    await pubsub.subscribe("agentflow.events")
    async for msg in pubsub.listen():
        if msg["type"] == "message":
            print(msg["data"])

asyncio.run(listen())
```

### Redis Streams mode

```python
publisher = RedisPublisher({
    "url": "redis://localhost:6379/0",
    "mode": "stream",
    "stream": "agentflow.events",
    "maxlen": 10000,             # trim stream to last 10 000 entries
})
```

### RedisPublisher config reference

| Key | Default | Notes |
|---|---|---|
| `url` | `"redis://localhost:6379/0"` | Redis connection URL. |
| `mode` | `"pubsub"` | `"pubsub"` or `"stream"`. |
| `channel` | `"agentflow.events"` | Pub/Sub channel name. |
| `stream` | `"agentflow.events"` | Redis Stream name. |
| `maxlen` | `None` | Max length cap for streams. |
| `max_connections` | `10` | Connection pool size. |
| `socket_timeout` | `5.0` | Socket timeout in seconds. |
| `socket_connect_timeout` | `5.0` | Connection timeout in seconds. |
| `socket_keepalive` | `True` | TCP keepalive. |
| `health_check_interval` | `30` | Health-check interval in seconds. |

---

## KafkaPublisher

Publishes events to a Kafka topic. Requires `pip install 10xscale-agentflow[kafka]`.

```python
from agentflow.runtime.publisher import KafkaPublisher
from agentflow.core.graph import StateGraph

publisher = KafkaPublisher({
    "bootstrap_servers": "localhost:9092",
    "topic": "agentflow.events",
    "client_id": "my-agent-service",
    "compression_type": "gzip",
})

graph = StateGraph(publisher=publisher)
```

### KafkaPublisher config reference

| Key | Default | Notes |
|---|---|---|
| `bootstrap_servers` | `"localhost:9092"` | Comma-separated broker list. |
| `topic` | `"agentflow.events"` | Kafka topic to publish to. |
| `client_id` | `None` | Producer client ID. |
| `max_batch_size` | `16384` | Max batch size in bytes. |
| `linger_ms` | `0` | Time to wait for batching in ms. |
| `compression_type` | `None` | `"gzip"`, `"snappy"`, `"lz4"`, `"zstd"`, or `None`. |
| `request_timeout_ms` | `30000` | Request timeout in milliseconds. |

---

## RabbitMQPublisher

Publishes events to a RabbitMQ exchange. Requires `pip install 10xscale-agentflow[rabbitmq]`.

```python
from agentflow.runtime.publisher import RabbitMQPublisher
from agentflow.core.graph import StateGraph

publisher = RabbitMQPublisher({
    "url": "amqp://guest:guest@localhost/",
    "exchange": "agentflow.events",
    "routing_key": "agent.executions",
    "exchange_type": "topic",
    "durable": True,
})

graph = StateGraph(publisher=publisher)
```

### RabbitMQPublisher config reference

| Key | Default | Notes |
|---|---|---|
| `url` | `"amqp://guest:guest@localhost/"` | AMQP connection URL. |
| `exchange` | `"agentflow.events"` | Exchange name. |
| `routing_key` | `"agentflow.events"` | Message routing key. |
| `exchange_type` | `"topic"` | `"topic"`, `"direct"`, `"fanout"`, `"headers"`. |
| `declare` | `True` | Declare the exchange if it doesn't exist. |
| `durable` | `True` | Exchange survives broker restarts. |
| `connection_timeout` | `10` | Connection timeout in seconds. |
| `heartbeat` | `60` | Heartbeat interval in seconds. |

---

## CompositePublisher

Fan-out to multiple publishers simultaneously.

```python
from agentflow.runtime.publisher import CompositePublisher, ConsolePublisher, RedisPublisher
from agentflow.core.graph import StateGraph

publisher = CompositePublisher([
    ConsolePublisher(),
    RedisPublisher({"url": "redis://localhost:6379/0"}),
])

graph = StateGraph(publisher=publisher)
```

Pass a list of publishers to `StateGraph(publisher=[...])` and it is automatically wrapped in a `CompositePublisher`:

```python
graph = StateGraph(
    publisher=[
        ConsolePublisher(),
        KafkaPublisher({"bootstrap_servers": "kafka:9092"}),
    ]
)
```

---

## OtelPublisher

Emits execution events as OpenTelemetry spans. Requires installing OpenTelemetry SDK packages manually.

```python
from agentflow.runtime.publisher import OtelPublisher, setup_tracing

# Configure OTLP exporter (e.g. to Jaeger, Tempo, Honeycomb)
setup_tracing(service_name="my-agent-service")

publisher = OtelPublisher()
graph = StateGraph(publisher=publisher)
```

---

## EventModel structure

Every event published carries an `EventModel` with these fields:

| Field | Type | Description |
|---|---|---|
| `event` | `Event` | Source: `GRAPH_EXECUTION`, `NODE_EXECUTION`, `LLM_CALL`, `TOOL_EXECUTION`, `STREAMING`, `REALTIME`. |
| `event_type` | `EventType` | Phase: `START`, `PROGRESS`, `RESULT`, `END`, `UPDATE`, `ERROR`, `INTERRUPTED`. |
| `content_type` | `list[ContentType]` | Content tags: `TEXT`, `MESSAGE`, `TOOL_CALL`, `TOOL_RESULT`, `IMAGE`, `AUDIO`, `TRANSCRIPT`, `STATE`, etc. |
| `node_name` | `str \| None` | Node that emitted the event. |
| `data` | `dict` | Event payload (args, results, error messages, etc.). |
| `content_blocks` | `list[ContentBlock]` | Structured message blocks (tool calls, tool results, etc.). |
| `metadata` | `dict` | `run_id`, `thread_id`, `user_id`, `timestamp`. |

```python
from agentflow.runtime.publisher import Event, EventType, ContentType
```

---

## Complete example: graph with Redis event streaming

```python
import asyncio
from agentflow.core.graph import StateGraph, Agent
from agentflow.core.state import AgentState, Message
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.runtime.publisher import RedisPublisher
from agentflow.utils import END

publisher = RedisPublisher({
    "url": "redis://localhost:6379/0",
    "mode": "stream",
    "stream": "my-agent.events",
    "maxlen": 50000,
})

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
)

graph = StateGraph(publisher=publisher)
graph.add_node("MAIN", agent)
graph.set_entry_point("MAIN")
graph.add_edge("MAIN", END)

app = graph.compile(checkpointer=InMemoryCheckpointer())

async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("Hello!")]},
        config={"thread_id": "demo", "user_id": "user-1"},
    )
    print(result["messages"][-1].content)
    await publisher.close()  # flush and close the connection

asyncio.run(main())
```

---

## What you learned

- Pass a publisher to `StateGraph(publisher=...)` to receive execution events.
- `ConsolePublisher` is zero-config and prints to stdout.
- `RedisPublisher` supports both Pub/Sub and Redis Streams; requires `[redis]` extra.
- `KafkaPublisher` publishes to a Kafka topic; requires `[kafka]` extra.
- `RabbitMQPublisher` publishes to a RabbitMQ exchange; requires `[rabbitmq]` extra.
- `CompositePublisher` (or passing a list) fans out to multiple publishers.
- Every event carries `EventModel` with source, phase, content type, node name, and metadata.
