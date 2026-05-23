---
title: Serving Agents
sidebar_label: Serving Agents
sidebar_position: 4
---

# Serving Agents

This page covers how the API/CLI layer exposes your compiled graph over HTTP, how authentication and authorization protect it, how publishers route execution events to external systems, and what a production deployment looks like.

---

## `agentflow.json` — the project config

`agentflow.json` is the single file that wires everything together. The CLI and API server read it at startup.

```json
{
  "agent": "graph/agent.py:get_compiled_graph",
  "auth": "auth/agent_auth.py:MyAuth",
  "injectq": "graph/agent.py:container",
  "evaluation": {
    "evals_dir": "evals/",
    "threshold": 0.8
  }
}
```

| Key | Purpose |
|---|---|
| `agent` | `module:callable` that returns a `CompiledGraph` |
| `auth` | Custom `BaseAuth` subclass (optional — omit to disable auth) |
| `injectq` | Services registered in the DI container |
| `evaluation` | Eval directory and pass threshold |

---

## Starting the server

```bash
agentflow api                                    # starts with auto-reload (development default)
agentflow api --host 0.0.0.0 --port 8000        # bind address
agentflow api --config agentflow.json            # explicit config path
agentflow play                                   # API + hosted playground in browser
```

The server loads the compiled graph once at startup and keeps it in memory. All requests share the same graph instance; per-request isolation comes from `thread_id`. In development `--reload` is on by default — any change to your source files restarts the server automatically. In production, run with multiple workers (see [Production deployment](#production-deployment)) and omit `--reload`.

---

## REST endpoints

```mermaid
flowchart TB
  subgraph "agentflow api process"
    UV[Uvicorn ASGI]
    FA[FastAPI]
    AUTH[BaseAuth middleware]
    AUTHZ[AuthorizationBackend]
    RATE[BaseRateLimitBackend]
    SVC[GraphService]
    GRAPH["Compiled Graph\n(loaded once at startup)"]
  end
  subgraph "Publishers  (BasePublisher)"
    PUB_C[ConsolePublisher]
    PUB_R[RedisPublisher]
    PUB_K[KafkaPublisher]
    PUB_Q[RabbitMQPublisher]
    PUB_O[OtelPublisher]
  end
  REQ[HTTP Request] --> UV --> FA --> AUTH --> AUTHZ --> RATE --> SVC --> GRAPH
  GRAPH -->|EventModel| PUB_C & PUB_R & PUB_K & PUB_Q & PUB_O
```

| Router | Prefix | Key endpoints |
|---|---|---|
| Graph | `/v1/graph` | `POST /invoke`, `POST /stream`, `WebSocket /ws`, `POST /stop`, `GET /` |
| Checkpointer | `/v1/threads` | Thread state CRUD, message CRUD |
| Store | `/v1/store` | Memory store, search, get, update, delete, list, forget |
| Media | `/v1/media` | File upload / download |
| A2A | `/a2a` | Agent-to-Agent protocol (Coming soon) |
| Health | `/ping` | Health check |

---

## Authentication

Authentication is pluggable via `BaseAuth`. The framework ships with `JwtAuth`; you can replace it with any backend.

```mermaid
flowchart LR
  REQ[HTTP Request] --> AUTH[BaseAuth\nauthenticate]
  AUTH -->|returns None| R401[401 Unauthorized]
  AUTH -->|returns user context| AUTHZ[AuthorizationBackend\ncheck permission]
  AUTHZ -->|denied| R403[403 Forbidden]
  AUTHZ -->|allowed| ROUTE[Route handler]
```

**Built-in: `JwtAuth`**

Point to the built-in class in `agentflow.json` using its importable path:

```json
{
  "auth": "agentflow_cli.src.app.core.auth.jwt_auth:JwtAuth"
}
```

Then set the required environment variables:

```bash
export JWT_SECRET_KEY="your-secret"
export JWT_ALGORITHM="HS256"      # default; optional
```

**Custom auth** — subclass `BaseAuth` and point `agentflow.json` to your class:

```python
# auth/agent_auth.py
from agentflow_cli.src.app.core.auth.base_auth import BaseAuth
from fastapi import Request

class FirebaseAuth(BaseAuth):
    async def authenticate(self, request: Request) -> dict | None:
        token = request.headers.get("Authorization", "").removeprefix("Bearer ")
        try:
            return firebase_admin.auth.verify_id_token(token)
        except Exception:
            return None   # returning None → 401
```

```json
{
  "auth": "auth/agent_auth.py:FirebaseAuth"
}
```

---

## Authorization

Authorization is a separate extension point from authentication. After a user is identified, `AuthorizationBackend` decides whether they can perform a specific operation on a specific resource.

```python
# auth/agent_auth.py
from agentflow_cli.src.app.core.auth.authorization import AuthorizationBackend

class TenantAuthorizationBackend(AuthorizationBackend):
    async def check(self, user: dict, operation: str, resource: str) -> bool:
        # operation: "invoke" | "read_thread" | "delete_thread" | "store_memory" | ...
        # resource:  thread_id, memory_id, etc.
        return user["tenant_id"] == extract_tenant(resource)
```

```json
{
  "authorization": "auth/agent_auth.py:TenantAuthorizationBackend"
}
```

The default `DefaultAuthorizationBackend` allows all authenticated users. Override it for RBAC, tenant scoping, or fine-grained permission checks.

---

## Rate limiting

Rate limiting is pluggable via `BaseRateLimitBackend`. Two backends are built in; swap or extend via dependency injection.

| Backend | When to use |
|---|---|
| In-memory | Single-process development |
| Redis | Multi-worker production — set `REDIS_URL` |
| Custom | Subclass `BaseRateLimitBackend` and register via `injectq` |

```python
# services/rate_limit.py
from agentflow_cli.src.app.core.middleware.rate_limit.base import BaseRateLimitBackend

class CustomRateLimitBackend(BaseRateLimitBackend):
    async def check(self, key: str, limit: int, window: int) -> bool:
        # return True to allow, False to rate-limit (→ 429)
        ...

    async def close(self) -> None:
        ...
```

```json
{
  "injectq": {
    "BaseRateLimitBackend": "services/rate_limit.py:CustomRateLimitBackend"
  }
}
```

---

## Publishers

`BasePublisher` emits an `EventModel` on every execution event — node start/end, tool calls, state updates, errors. Wire one or more publishers at `StateGraph` initialization; they compose automatically.

```python
from agentflow.runtime.publisher import RedisPublisher, KafkaPublisher, CompositePublisher
from agentflow.core.graph import StateGraph

publisher = CompositePublisher([
    RedisPublisher(url="redis://localhost:6379", channel="agentflow.events"),
    KafkaPublisher(bootstrap_servers="kafka:9092", topic="agentflow"),
])

graph = StateGraph(publisher=publisher)
# ... add nodes and edges ...
compiled = graph.compile()
```

| Publisher | Transport | Use case |
|---|---|---|
| `ConsolePublisher` | stdout | Development / debugging |
| `RedisPublisher` | Redis pub/sub | Real-time dashboards, fan-out |
| `KafkaPublisher` | Kafka topic | High-throughput event pipelines |
| `RabbitMQPublisher` | RabbitMQ exchange | Queue-based workflows, notifications |
| `OtelPublisher` | OpenTelemetry | Distributed tracing (Jaeger, Honeycomb, Langfuse) |

Custom publisher — subclass `BasePublisher`:

```python
from agentflow.runtime.publisher.base_publisher import BasePublisher
from agentflow.runtime.publisher.events import EventModel

class DatadogPublisher(BasePublisher):
    async def publish(self, event: EventModel) -> None:
        datadog.send_event(event.dict())

    async def close(self) -> None:
        pass
```

---

## Dependency injection

`InjectQ` is the DI container shipped with `10xscale-agentflow`. Register service instances into it once, pass it to `StateGraph`, and node functions receive their dependencies automatically.

### Registering services

```python
# graph/agent.py
from injectq import InjectQ
from services.db import DatabaseService

container = InjectQ.get_instance()
container.bind_instance(DatabaseService, DatabaseService())

# Named scalar values (retrieved by key, not by type)
container["api_version"] = "v2"
```

Pass the container to `StateGraph` at init time:

```python
graph = StateGraph(container=container)
```

### Consuming injected dependencies in nodes

Declare dependencies as default parameters using `Inject[T]`:

```python
from injectq import Inject
from services.db import DatabaseService

async def my_node(
    state: AgentState,
    config: dict,
    db: DatabaseService = Inject[DatabaseService],
) -> Message:
    result = await db.query("SELECT ...")
    return Message.text_message(str(result), role="assistant")
```

To read named scalar values inside a node:

```python
from injectq import InjectQ

async def my_node(state: AgentState, config: dict) -> Message:
    inq = InjectQ.get_instance()
    api_version = inq.get("api_version")                    # raises if missing
    request_id = inq.try_get("request_id", "default-id")   # returns default if missing
    ...
```

Always-injected parameters — no annotation needed:

| Parameter name | Value |
|---|---|
| `state` | Current `AgentState` |
| `config` | Run config dict (`thread_id`, `user_id`, etc.) |
| `tool_call_id` | ID of the tool call (inside `ToolNode` only) |

### Wiring the container via `agentflow.json`

When using `agentflow api`, point `injectq` to the exported `InjectQ` instance in your graph module. The server loads that object and activates it as the global singleton.

```json
{
  "injectq": "graph/agent.py:container"
}
```

The value is a `module:attribute` path that resolves to an `InjectQ` instance — not a class, not a dict.

---

## Thread name generator

By default the API generates an AI-powered name for each new thread. Override it by subclassing `ThreadNameGenerator` and registering it via `injectq`:

```python
# services/naming.py
from agentflow_cli.src.app.utils.thread_name_generator import ThreadNameGenerator

class SlugThreadNameGenerator(ThreadNameGenerator):
    async def generate_name(self, messages: list) -> str:
        return slugify(messages[0].text[:40])
```

```json
{
  "thread_name_generator": "graph.thread_name_generator:SlugThreadNameGenerator"
}
```

---

## Production deployment

```mermaid
flowchart LR
  LB[Load Balancer] --> W1[Worker 1]
  LB --> W2[Worker 2]
  LB --> W3[Worker 3]
  W1 & W2 & W3 --> REDIS[(Redis\nhot cache + event bus)]
  W1 & W2 & W3 --> PG[(Postgres\ndurable state)]
  W1 & W2 & W3 --> QD[(Qdrant\nlong-term memory)]
```

`agentflow build` generates a production-ready `Dockerfile` (and optional `docker-compose.yml`):

```bash
agentflow build                          # Dockerfile only
agentflow build --docker-compose         # + docker-compose.yml
agentflow build --python-version 3.13
```

Key environment variables — set them in a `.env` file, via `export`, or as Docker `ENV` / `--env-file`:

```bash
# .env  (or export VAR=value, or Docker ENV in Dockerfile)
MODE=production           # enables production guards (warns on ORIGINS=*, etc.)
REDIS_URL=redis://redis:6379
JWT_SECRET_KEY=your-secret-here
SENTRY_DSN=https://...@sentry.io/123
OTEL_ENABLED=true
OTEL_SERVICE_NAME=my-agent
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4317
OTEL_LEVEL=standard
```

| Variable | Default | Purpose |
|---|---|---|
| `MODE` | `development` | Set to `production` to enable security guards |
| `REDIS_URL` | `None` | Redis for state cache, rate limiter, pub/sub |
| `JWT_SECRET_KEY` | `None` | Required for `JwtAuth` |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `SENTRY_DSN` | `None` | Sentry error tracking |
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry tracing (see [OpenTelemetry](#opentelemetry)) |
| `OTEL_SERVICE_NAME` | `agentflow-api` | Service name reported in all traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `None` | OTLP collector URL — omit to print spans to console |
| `OTEL_LEVEL` | `standard` | Span detail level: `spans` \| `standard` \| `full` |
| `ORIGINS` | `*` | CORS allowed origins — restrict in production |

---

## OpenTelemetry

AgentFlow has first-class OpenTelemetry support at two independent layers. You can use either or both.

```mermaid
flowchart TB
  subgraph "API layer  (FastAPI + HTTP)"
    FI[FastAPIInstrumentor\nHTTP spans — latency, status, route]
  end
  subgraph "Graph layer  (OtelPublisher)"
    GS[agentflow.graph span]
    NS[agentflow.node span]
    LS[agentflow.llm span\ntoken counts, model, finish reason]
    TS[agentflow.tool span\ntool name, type]
    GS --> NS --> LS
    NS --> TS
  end
  FI -.->|parent| GS
```

### API layer — automatic when `OTEL_ENABLED=true`

Setting `OTEL_ENABLED=true` in your environment is all that's required. The API server automatically:

- Creates a `TracerProvider` with your `OTEL_SERVICE_NAME`
- Instruments the FastAPI app with `FastAPIInstrumentor` (HTTP-level spans)
- Wires `OtelPublisher` into the graph so every LLM call, tool call, and node transition becomes a child span
- Exports via OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; falls back to console output in non-production

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=my-agent
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4317   # omit to print spans to console
OTEL_LEVEL=standard                                  # spans | standard | full
```

No code changes are needed. The SDK does not need to be configured separately — the API configures `OtelPublisher` automatically and merges it with any existing publisher (such as `RedisPublisher`) without replacing it.

### Graph layer — `OtelPublisher` and `ObservabilityLevel`

When running the graph directly (without `agentflow api`), pass `OtelPublisher` to `StateGraph` at init time:

```python
from agentflow.core.graph import StateGraph
from agentflow.runtime.publisher import OtelPublisher
from agentflow.runtime.publisher.otel_publisher import ObservabilityLevel

graph = StateGraph(publisher=OtelPublisher(level=ObservabilityLevel.STANDARD))
# ... add nodes and edges ...
compiled = graph.compile()
```

`ObservabilityLevel` controls how much data is emitted as span attributes:

| Level | What it includes |
|---|---|
| `STANDARD` | Token counts, model name, request params, finish reason *(default)* |
| `FULL` | All of STANDARD + prompt messages, completions, tool I/O — may contain PII |

With an explicit `TracerProvider` (e.g. to export to Jaeger or Honeycomb):

```python
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry import trace

from agentflow.core.graph import StateGraph
from agentflow.runtime.publisher import OtelPublisher
from agentflow.runtime.publisher.otel_publisher import ObservabilityLevel

provider = TracerProvider()
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint="http://collector:4317")))
trace.set_tracer_provider(provider)

graph = StateGraph(publisher=OtelPublisher(level=ObservabilityLevel.FULL))
# ... add nodes and edges ...
compiled = graph.compile()
```

### Span hierarchy

Every graph run produces a consistent span tree:

```
agentflow.graph          ← one per ainvoke / astream call
  agentflow.node         ← one per node execution (e.g. "MAIN", "TOOL")
    agentflow.llm        ← one per LLM call (tokens, model, finish reason)
    agentflow.tool       ← one per tool call (name, type: local | mcp)
```

The `agentflow.graph` span carries `thread_id` as `session.id` so tools like Langfuse automatically group multi-turn conversations.

**Install:**

```bash
pip install "10xscale-agentflow[otel]"           # graph-level spans (OtelPublisher)
pip install "10xscale-agentflow-cli[otel]"       # API layer (FastAPIInstrumentor + OTLP exporter)
```

---

## What's next

| Page | What it covers |
|---|---|
| [Connecting Clients](./connecting-clients.md) | TypeScript SDK, streaming, remote tools |
| [Memory](./memory.md) | `PgCheckpointer`, Redis cache, long-term vector store |
| [Extensibility](./extensibility.md) | `BaseAuth`, `AuthorizationBackend`, `BasePublisher` and all other ABCs |
| [Quality & Observability](./qa.md) | `GraphLifecycleHook` with OpenTelemetry, evaluation, testing |
