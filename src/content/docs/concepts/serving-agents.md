---
title: Serving Agents
seoTitle: "Serving agents with 10xgraph.json"
description: How 10xgraph.json wires a compiled graph to the API server, plus authentication, authorization, and publisher configuration for production.
section: Concepts
group: "Serving"
order: 160
updated: "2026-10-08"
---

The 10xGraph API server transforms a compiled graph into a production-ready HTTP service. This page explains how the server loads and runs your agent, how authentication and authorization protect it, how publishers stream execution events to external systems, and what configuration controls each piece.

## How the server loads and runs your graph

```mermaid
flowchart TB
  subgraph "10xgraph api process"
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

The API server is a Uvicorn ASGI process that loads your compiled graph **once at startup** and reuses it for every request. This avoids module-loading overhead. The graph itself is stateless; per-request isolation comes from the `thread_id` in the request. In development, `10xgraph api --reload` auto-restarts on file changes. In production, run multiple workers behind a load balancer and use `PgCheckpointer` to share state across them.

## Configuration: `10xgraph.json`

`10xgraph.json` is the single file that wires everything together. The CLI and API server read it at startup to determine which graph to load, which auth to use, and how to configure every service.

Import paths are **dotted module paths** (`module:attribute`), resolved with `importlib`, not file paths.

**Minimal example:**

```json
{
  "agent": "graph.agent:get_compiled_graph",
  "auth": "jwt",
  "rate_limit": {
    "backend": "memory",
    "requests": 100,
    "window": 60
  }
}
```

**Full example with all extensible pieces:**

```json
{
  "agent": "graph.agent:get_compiled_graph",
  "env": ".env",
  "auth": "jwt",
  "authorization": "auth.agent_auth:MyAuthorizationBackend",
  "checkpointer": "services.checkpointer:my_pg_checkpointer",
  "injectq": "graph.agent:container",
  "store": "services.store:my_store",
  "redis": "redis://localhost:6379",
  "thread_name_generator": "services.naming:MyNameGenerator",
  "rate_limit": {
    "backend": "redis",
    "requests": 1000,
    "window": 60,
    "by": "ip",
    "trusted_proxy_headers": true,
    "exclude_paths": ["/ping", "/docs"]
  }
}
```

| Key | Type | Purpose |
|---|---|---|
| `agent` | module:callable | Returns a `CompiledGraph`. Required. |
| `env` | file path | Path to a `.env` file, loaded at startup. |
| `auth` | `"jwt"` \| module:path | `"jwt"` enables built-in JWT auth; a module path loads your `BaseAuth` subclass. |
| `authorization` | module:path | Loads your `AuthorizationBackend` for per-tool / per-thread access control. |
| `checkpointer` | module:path | Loads your `BaseCheckpointer`. Default is in-memory. |
| `injectq` | module:path | Points to an `InjectQ` container instance. |
| `store` | module:path | Loads your `BaseStore` for long-term memory. |
| `redis` | URL string | Redis connection for `PgCheckpointer` cache and pub/sub. |
| `thread_name_generator` | module:path | Loads your `ThreadNameGenerator`. Default generates adjective-noun pairs (e.g., `thoughtful-dialogue`). |
| `rate_limit` | object | Rate limiting config (see below). |

**Starting the server:**

```bash
10xgraph api                                    # development, auto-reload
10xgraph api --config custom.json              # explicit config path
10xgraph api --host 0.0.0.0 --port 8000        # bind address
10xgraph play                                   # API + playground in browser
```

## REST endpoints and request flow

The API exposes these routers under `/v1`:

| Router | Endpoints | Purpose |
|---|---|---|
| Graph | `POST /invoke`, `POST /stream`, `WebSocket /ws`, `POST /stop`, `POST /fix`, `GET /` | Invoke or stream the agent, stop a run, fix interrupted state, get graph info. |
| Threads | `GET /threads`, `POST /threads`, `GET /threads/{id}/state`, `GET /threads/{id}/messages` | Manage thread state and message history. |
| Store | `POST /store/memories`, `GET /store/memories/{id}`, `POST /store/search` | Long-term memory operations. |
| Files | `POST /files/upload`, `GET /files/{id}`, `GET /files/{id}/info`, `GET /files/{id}/url` | Upload, retrieve, and get signed URLs for media. |
| Config | `GET /config/multimodal` | Get multimodal settings. |
| Ping | `/ping` | Health check. |

Every routable request (except `/ping`) passes through authentication (`BaseAuth.authenticate`), then authorization (`AuthorizationBackend.authorize`), then rate limiting, before reaching the route handler.

## Authentication

Authentication is pluggable via `BaseAuth`. The framework ships with `JwtAuth`; you can subclass `BaseAuth` to add any other backend.

**Built-in: JWT**

Point `10xgraph.json` to the built-in class by setting `auth` to `"jwt"`:

```json
{
  "auth": "jwt"
}
```

Then set the required environment variables:

```bash
export JWT_SECRET_KEY="your-secret"        # required; use at least 32 random chars
export JWT_ALGORITHM="HS256"               # optional; default is HS256
```

Clients send credentials as `Authorization: Bearer <token>`.

**Custom authentication**

Subclass `BaseAuth` and point `10xgraph.json` to your class:

```python
# auth/firebase_auth.py
from typing import Any
from fastapi import Request, Response
from fastapi.security import HTTPAuthorizationCredentials
from tenxgraph_api import BaseAuth

class FirebaseAuth(BaseAuth):
    def authenticate(
        self, request: Request, response: Response,
        credential: HTTPAuthorizationCredentials | None,
    ) -> dict[str, Any] | None:
        if credential is None:
            return None  # → 401
        try:
            claims = firebase_admin.auth.verify_id_token(credential.credentials)
            return {"user_id": claims["uid"], **claims}
        except Exception:
            return None  # → 401
```

Important: `authenticate` is **synchronous**. Declaring it `async def` returns an un-awaited coroutine and breaks auth.

```json
{
  "auth": "auth.firebase_auth:FirebaseAuth"
}
```

## Authorization

Authorization is separate from authentication. After the user is identified, `AuthorizationBackend` decides whether they can perform a specific operation on a specific resource.

```python
# auth/multi_tenant.py
from typing import Any
from tenxgraph_api.src.app.core.auth.authorization import AuthorizationBackend

class TenantAuthorizationBackend(AuthorizationBackend):
    async def authorize(
        self, user: dict[str, Any], resource: str, action: str,
        resource_id: str | None = None, **context: Any,
    ) -> bool:
        # resource: "graph" | "checkpointer" | "store" | "files" | "config"
        # action: "invoke" | "stream" | "read" | "write" | "delete"
        # resource_id: thread_id or memory_id when applicable
        return user.get("tenant_id") == context.get("tenant_id")
```

```json
{
  "authorization": "auth.multi_tenant:TenantAuthorizationBackend"
}
```

If no `authorization` key is set, the default depends on `MODE`:
- **production**: `"ownership"` (each user owns their own threads, read-only)
- **development**: `"allow_all"` (all users can access all threads)

Override by setting `authorization` to a module path, a built-in name (`"ownership"`, `"allow_all"`, `"default"`), `null`, or an RBAC config object.

## Rate limiting

Rate limiting is pluggable via `BaseRateLimitBackend`. Two backends are built in; you can subclass for custom logic.

```json
{
  "rate_limit": {
    "backend": "memory",
    "requests": 100,
    "window": 60,
    "by": "ip",
    "trusted_proxy_headers": true,
    "fail_open": false,
    "exclude_paths": ["/ping"]
  }
}
```

| Config key | Default | Purpose |
|---|---|---|
| `backend` | `memory` | `memory` (single-worker dev), `redis` (multi-worker), or custom via InjectQ. |
| `requests` | 100 | Requests allowed per window. |
| `window` | 60 | Time window in seconds. |
| `by` | `global` | `global` (all users share one limit) or `ip` (per IP). |
| `trusted_proxy_headers` | false | Honor `X-Forwarded-For` when true. |
| `fail_open` | true | Allow requests if the backend is unreachable. |
| `exclude_paths` | `[]` | Paths exempt from rate limiting. |

For the `redis` backend, add a `redis` key with the connection URL:

```json
{
  "rate_limit": {
    "backend": "redis",
    "redis": {
      "url": "redis://localhost:6379",
      "prefix": "ratelimit:"
    }
  }
}
```

**Custom backend:**

```python
# services/rate_limit.py
from tenxgraph_api.src.app.core.middleware.rate_limit.base import BaseRateLimitBackend

class CustomRateLimitBackend(BaseRateLimitBackend):
    async def check(self, key: str, limit: int, window: int) -> bool:
        # return True to allow, False to rate-limit (→ 429)
        ...

    async def close(self) -> None:
        ...
```

Register in `10xgraph.json` via dependency injection:

```json
{
  "injectq": "graph.agent:container"
}
```

Then in your graph module:

```python
from injectq import InjectQ
from services.rate_limit import CustomRateLimitBackend

container = InjectQ.get_instance()
container.bind_instance(BaseRateLimitBackend, CustomRateLimitBackend())
```

## Publishers

Publishers emit `EventModel` on every execution event, node start/end, tool calls, state updates, errors. Wire them at `StateGraph` initialization, not at compile:

```python
from tenxgraph.runtime.publisher import CompositePublisher, RedisPublisher, KafkaPublisher
from tenxgraph.core.graph import StateGraph

publisher = CompositePublisher([
    RedisPublisher(url="redis://localhost:6379", channel="agent.events"),
    KafkaPublisher(bootstrap_servers="kafka:9092", topic="agent-events"),
])

graph = StateGraph(publisher=publisher)
# ... add nodes and edges ...
compiled = graph.compile()
```

| Publisher | Transport | Use case |
|---|---|---|
| `ConsolePublisher` | stdout | Development, debugging |
| `RedisPublisher` | Redis pub/sub | Real-time dashboards, fan-out |
| `KafkaPublisher` | Kafka topic | High-throughput event pipelines |
| `RabbitMQPublisher` | RabbitMQ exchange | Queue-based workflows, notifications |
| `OtelPublisher` | OpenTelemetry | Distributed tracing, observability |

**Custom publisher:**

```python
from tenxgraph.runtime.publisher.base_publisher import BasePublisher
from tenxgraph.runtime.publisher.events import EventModel

class DatadogPublisher(BasePublisher):
    async def publish(self, event: EventModel) -> None:
        datadog.send_event(event.dict())

    async def close(self) -> None:
        pass
```

Composers (like `CompositePublisher`) automatically coordinate multiple publishers, so they work seamlessly with the API server.

## Dependency injection

`InjectQ` is the DI container shipped with 10xGraph. Create a container, register service instances, pass it to `StateGraph`, and node functions receive their dependencies automatically.

**Setting up a container:**

```python
# graph/agent.py
from injectq import InjectQ
from services.db import DatabaseService

container = InjectQ.get_instance()
container.bind_instance(DatabaseService, DatabaseService())
container["api_version"] = "v2"  # named scalar values

graph = StateGraph(container=container)
# ... add nodes and edges ...
```

**Using the container in the API:**

Point `injectq` in `10xgraph.json` to the exported container:

```json
{
  "injectq": "graph.agent:container"
}
```

The value is a dotted `module:attribute` path that resolves to an `InjectQ` instance, not a class, not a dict. The server loads that object and activates it as the global singleton at startup.

**Consuming in nodes:**

```python
from injectq import Inject
from services.db import DatabaseService

async def my_node(
    state: AgentState,
    config: dict,  # run config dict (thread_id, user_id, etc.)
    db: DatabaseService = Inject[DatabaseService],
) -> Message:
    result = await db.query("SELECT ...")
    return Message.text_message(str(result), role="assistant")
```

## Thread naming

By default, each new thread gets a random adjective-noun name (e.g., `"thoughtful-dialogue"`, `"creative-insight"`) generated by `AIThreadNameGenerator`. Override it by subclassing `ThreadNameGenerator`:

```python
# services/naming.py
from tenxgraph_api import ThreadNameGenerator

class SlugThreadNameGenerator(ThreadNameGenerator):
    async def generate_name(self, messages: list[str]) -> str:
        first = next((m for m in messages if m and m.strip()), "")
        first = " ".join(first.split())
        return (first[:50] + "…") if len(first) > 50 else first or "new-thread"
```

```json
{
  "thread_name_generator": "services.naming:SlugThreadNameGenerator"
}
```

## Production deployment

For production scale, run multiple worker processes behind a load balancer. Because state is stored in the checkpointer (and optionally in the memory store), any worker can handle any request as long as they share the same storage backend.

```bash
10xgraph build                          # Generate Dockerfile
10xgraph build --docker-compose         # + docker-compose.yml
```

Key environment variables (set in `.env`, as Docker `ENV`, or via `--env-file`):

```bash
MODE=production              # enables security guards
REDIS_URL=redis://redis:6379
JWT_SECRET_KEY=your-secret-32-chars
SENTRY_DSN=https://...@sentry.io/123
OTEL_ENABLED=true
OTEL_SERVICE_NAME=my-agent
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4317
ORIGINS=https://example.com,https://app.example.com
```

| Variable | Default | Purpose |
|---|---|---|
| `MODE` | `development` | Set to `production` to enable security checks |
| `REDIS_URL` | none | Redis connection for state cache and pub/sub |
| `JWT_SECRET_KEY` | none | Required for JWT auth; use 32+ random chars |
| `SENTRY_DSN` | none | Sentry error tracking |
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry tracing |
| `OTEL_SERVICE_NAME` | `10xgraph-api` | Service name in traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | none | OTLP collector URL; omit to log spans to console |
| `ORIGINS` | `*` | CORS allowed origins; restrict in production |

## OpenTelemetry

10xGraph has built-in OpenTelemetry support at two layers: the API (HTTP spans) and the graph (execution spans).

**Enable automatically:**

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=my-agent
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4317
OTEL_LEVEL=standard    # spans | standard | full
```

No code changes needed. The API server automatically:
- Instruments the FastAPI app (HTTP-level spans)
- Wires `OtelPublisher` into the graph
- Exports via OTLP when configured; falls back to console output in dev

The span tree is:

```
tenxgraph.graph      ← one per invoke/stream
  tenxgraph.node     ← one per node (e.g. MAIN, TOOL)
    tenxgraph.llm    ← one per LLM call (tokens, model, finish)
    tenxgraph.tool   ← one per tool call (name, type)
```

The `tenxgraph.graph` span carries `thread_id` as `session.id`, so tools like Langfuse group multi-turn conversations automatically.

**Install:**

```bash
pip install "10xgraph[otel]"        # graph-level spans
pip install "10xgraph-api[otel]"    # API layer spans + OTLP exporter
```

## What's next

Read the [API server guide](/docs/server) for tasks like configuring auth, setting up multi-worker deployments, and monitoring production systems. See the [Memory](/docs/concepts/memory) page to understand checkpointing and the long-term store. The [Extensibility](/docs/concepts/extensibility) page covers all extension points: `BaseAuth`, `AuthorizationBackend`, `BasePublisher`, `BaseCheckpointer`, and `BaseStore`.
