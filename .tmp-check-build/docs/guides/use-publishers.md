# Emit events from your graph

> Forward structured events to observability systems using Redis, Kafka, RabbitMQ and more.

Source: https://10xgraph.com/docs/guides/use-publishers
Last updated: 2026-10-08

Publishers allow you to observe and audit agent execution by forwarding structured events to external systems. Every time your graph runs, publishers emit events for graph starts and ends, node execution, tool calls, LLM requests, state updates, errors, and streaming tokens. You can subscribe to these events in real-time to monitor your agent, log audits, trigger alerts, or analyze behavior. Publishers are optional: your graph works without them, but adding one is essential for production deployments.

## Why publishers matter

In development, you might test your agent locally and call it once. In production, you're serving many requests concurrently, and something goes wrong. Without visibility into what the agent was doing, debugging becomes expensive. Publishers create an event stream that records the exact sequence of execution, including what the agent decided and why. You can stream these events to monitoring platforms, log aggregators, or data warehouses for analysis.

10xGraph publishes structured `EventModel` events: not strings, but typed dictionaries with semantic fields. This lets downstream systems (monitoring, logging, or analytics) parse and act on them reliably, even as your agent evolves.

---

## Add a publisher to your graph

### Prerequisites

Import the publisher class and install the optional dependency if needed:

```bash
# Console: no install needed
# Redis: pip install "10xgraph[redis]"
# Kafka: pip install "10xgraph[kafka]"
# RabbitMQ: pip install "10xgraph[rabbitmq]"
```

### Step 1: Create a publisher instance

Pick a transport and instantiate the publisher with its configuration. Here is Redis as an example:

```python
from tenxgraph.runtime.publisher import RedisPublisher

publisher = RedisPublisher({
    "url": "redis://localhost:6379/0",
    "mode": "stream",
    "stream": "agent.events",
    "maxlen": 50000,
})
```

### Step 2: Pass it to StateGraph

When you instantiate your graph, pass the publisher:

```python
from tenxgraph.core.graph import StateGraph, Agent

graph = StateGraph(publisher=publisher)
graph.add_node("MAIN", Agent(model="gpt-4o"))
graph.set_entry_point("MAIN")

app = graph.compile()
```

### Step 3: Run your agent and verify

Invoke your agent normally. Events are emitted asynchronously in the background.

```python
import asyncio

async def main():
    result = await app.ainvoke(
        {"messages": [{"role": "user", "content": "Hello"}]},
        config={"thread_id": "test"},
    )
    print(result["messages"][-1].content)
    await publisher.close()  # flush pending events

asyncio.run(main())
```

For Redis Streams mode, you can read events in another terminal:

```python
import redis.asyncio as aioredis
import json

async def listen():
    r = aioredis.from_url("redis://localhost:6379/0")
    # Start from the earliest event
    async for msg_id, msg_data in r.xread({"agent.events": "0"}, count=10):
        event = json.loads(msg_data[b"data"])
        print(f"Event: {event['event']} / {event['event_type']}")

asyncio.run(listen())
```

You should see output like `Event: node_execution / start`, `Event: llm_call / start`, `Event: node_execution / end`, etc.

---

## Publisher types

### ConsolePublisher

Prints events to stdout or the `tenxgraph.publisher` logger. Good for debugging locally in development.

```python
from tenxgraph.runtime.publisher import ConsolePublisher

# Default: print to stdout
publisher = ConsolePublisher()

# Or route through the logger (better for servers)
publisher = ConsolePublisher(config={"use_logger": True})
```

**Use only in development.** Stdout is noisy and not suitable for production. Switch to a real transport (Redis, Kafka, RabbitMQ) before deploying.

---

### RedisPublisher

Publishes events to a Redis channel or stream. Choose Pub/Sub for real-time subscribers or Streams for durable retention.

#### Pub/Sub mode

```python
from tenxgraph.runtime.publisher import RedisPublisher

publisher = RedisPublisher({
    "url": "redis://localhost:6379/0",
    "mode": "pubsub",
    "channel": "agent.events",
})

graph = StateGraph(publisher=publisher)
```

Subscribe in another process to receive live events:

```python
import redis.asyncio as aioredis
import asyncio

async def listen():
    r = aioredis.from_url("redis://localhost:6379/0")
    pubsub = r.pubsub()
    await pubsub.subscribe("agent.events")
    async for msg in pubsub.listen():
        if msg["type"] == "message":
            print(msg["data"].decode())  # raw JSON event

asyncio.run(listen())
```

#### Streams mode

```python
publisher = RedisPublisher({
    "url": "redis://localhost:6379/0",
    "mode": "stream",
    "stream": "agent.events",
    "maxlen": 50000,  # keep the last 50k events
})
```

Streams mode is preferred for audit logs because events are persisted and you can replay them. Use Pub/Sub if you only care about live subscribers.

#### Configuration reference

| Key | Default | Notes |
|---|---|---|
| `url` | `"redis://localhost:6379/0"` | Redis connection URL. |
| `mode` | `"pubsub"` | `"pubsub"` or `"stream"`. |
| `channel` | `"tenxgraph.events"` | Pub/Sub channel name. |
| `stream` | `"tenxgraph.events"` | Redis Stream name. |
| `maxlen` | `None` | Max length cap for streams. |
| `max_connections` | `10` | Connection pool size. |
| `socket_timeout` | `5.0` | Socket timeout in seconds. |
| `socket_connect_timeout` | `5.0` | Connection timeout in seconds. |
| `socket_keepalive` | `True` | TCP keepalive. |
| `health_check_interval` | `30` | Health-check interval in seconds. |

---

### KafkaPublisher

Publishes events to a Kafka topic. Use this if your organization already runs Kafka for event streaming.

```python
from tenxgraph.runtime.publisher import KafkaPublisher

publisher = KafkaPublisher({
    "bootstrap_servers": "localhost:9092",
    "topic": "agent-events",
    "client_id": "my-agent-service",
    "compression_type": "gzip",
})

graph = StateGraph(publisher=publisher)
```

Consumers on the same topic receive all events in order:

```python
from kafka import KafkaConsumer
import json

consumer = KafkaConsumer(
    "agent-events",
    bootstrap_servers=["localhost:9092"],
    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
)

for event in consumer:
    print(f"Event: {event['event']}")
```

#### Configuration reference

| Key | Default | Notes |
|---|---|---|
| `bootstrap_servers` | `"localhost:9092"` | Comma-separated broker list. |
| `topic` | `"tenxgraph.events"` | Kafka topic to publish to. |
| `client_id` | `None` | Producer client ID. |
| `max_batch_size` | `16384` | Max batch size in bytes. |
| `linger_ms` | `0` | Time to wait for batching in ms. |
| `compression_type` | `None` | `"gzip"`, `"snappy"`, `"lz4"`, `"zstd"`, or `None`. |
| `request_timeout_ms` | `30000` | Request timeout in milliseconds. |

---

### RabbitMQPublisher

Publishes events to a RabbitMQ exchange. Use if RabbitMQ is part of your infrastructure.

```python
from tenxgraph.runtime.publisher import RabbitMQPublisher

publisher = RabbitMQPublisher({
    "url": "amqp://guest:guest@localhost/",
    "exchange": "agent.events",
    "routing_key": "agent.executions",
    "exchange_type": "topic",
    "durable": True,
})

graph = StateGraph(publisher=publisher)
```

Bind a queue to the exchange and consume:

```python
from aio_pika import connect_robust

async def listen():
    connection = await connect_robust("amqp://guest:guest@localhost/")
    channel = await connection.channel()
    exchange = await channel.get_exchange("agent.events")
    queue = await channel.declare_queue(auto_delete=True)
    await queue.bind(exchange, "agent.*")
    
    async for message in queue.iterator():
        print(message.body.decode())

asyncio.run(listen())
```

#### Configuration reference

| Key | Default | Notes |
|---|---|---|
| `url` | `"amqp://guest:guest@localhost/"` | AMQP connection URL. |
| `exchange` | `"tenxgraph.events"` | Exchange name. |
| `routing_key` | `"tenxgraph.events"` | Message routing key. |
| `exchange_type` | `"topic"` | `"topic"`, `"direct"`, `"fanout"`, `"headers"`. |
| `declare` | `True` | Declare the exchange if it doesn't exist. |
| `durable` | `True` | Exchange survives broker restarts. |
| `connection_timeout` | `10` | Connection timeout in seconds. |
| `heartbeat` | `60` | Heartbeat interval in seconds. |

---

## Fan out to multiple publishers

Send events to multiple transports simultaneously using `CompositePublisher`. Common patterns include console for development, Redis for real-time monitoring, and a file sink for audit logs.

```python
from tenxgraph.runtime.publisher import CompositePublisher, ConsolePublisher, RedisPublisher

publisher = CompositePublisher([
    ConsolePublisher(config={"use_logger": True}),
    RedisPublisher({
        "url": "redis://localhost:6379/0",
        "mode": "stream",
        "stream": "audit.log",
    }),
])

graph = StateGraph(publisher=publisher)
```

You can also pass a list directly to `StateGraph`, and it wraps it automatically:

```python
graph = StateGraph(
    publisher=[
        ConsolePublisher(),
        RedisPublisher({"url": "redis://localhost:6379/0"}),
    ]
)
```

---

## Understand event structure

Every event published is an `EventModel` with these fields:

| Field | Type | Description |
|---|---|---|
| `event` | `Event` | Source: `GRAPH_EXECUTION`, `NODE_EXECUTION`, `LLM_CALL`, `TOOL_EXECUTION`, `STREAMING`, or `REALTIME`. |
| `event_type` | `EventType` | Phase: `START`, `PROGRESS`, `RESULT`, `END`, `UPDATE`, `ERROR`, or `INTERRUPTED`. |
| `content_type` | `list[ContentType]` | Content tags: `TEXT`, `MESSAGE`, `TOOL_CALL`, `TOOL_RESULT`, `IMAGE`, `AUDIO`, `TRANSCRIPT`, `STATE`, etc. |
| `node_name` | `str \| None` | Name of the node that emitted the event. |
| `data` | `dict` | Event payload: arguments, results, error messages, token counts, etc. |
| `content_blocks` | `list[ContentBlock]` | Structured message blocks (tool calls, tool results, etc.). |
| `metadata` | `dict` | Run metadata: `run_id`, `thread_id`, `user_id`, `timestamp`. |

To inspect the event structure, use `ConsolePublisher` locally:

```python
from tenxgraph.runtime.publisher import Event, EventType, ContentType

# Import to understand the enums
print([e for e in Event])  # all event sources
print([e for e in EventType])  # all event phases
```

---

## Send traces to a backend

For OpenTelemetry-based tracing to Logfire, LangSmith, or other backends, see [Send traces to Logfire and LangSmith](/docs/guides/send-traces-to-logfire-langsmith). That guide covers the `OtelPublisher` and helper functions to instrument your graph with full tracing.

---

## What you learned

- Publishers emit structured `EventModel` events from every stage of graph execution.
- Add a publisher by instantiating it and passing it to `StateGraph(publisher=...)`.
- `ConsolePublisher` is for development; use Redis, Kafka, or RabbitMQ in production.
- `RedisPublisher` supports Pub/Sub (live subscribers) and Streams (durable log).
- `CompositePublisher` sends events to multiple transports simultaneously.
- Every event has a source, phase, node name, and structured data for downstream processing.
