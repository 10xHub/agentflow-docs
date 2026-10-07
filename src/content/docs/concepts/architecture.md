---
title: Architecture
seoTitle: "10xGraph architecture overview"
description: An overview of how 10xGraph packages fit together and how requests flow from client to graph.
section: Concepts
order: 140
group: Graphs and agents
label: Architecture
updated: "2026-07-21"
---

10xGraph is a set of layered packages. Each layer has a single responsibility. You can use just the core Python library, or add the API and client layers when you need to serve agents over HTTP.

## Package layers

```mermaid
flowchart TB
  subgraph Client["@10xscale/agentflow-client (TypeScript)"]
    TS[AgentFlowClient]
  end

  subgraph Server["10xgraph-api (Python)"]
    CLI[agentflow CLI]
    API[FastAPI server]
    Auth[Auth middleware]
    Routers[REST routers]
  end

  subgraph Core["10xgraph (Python)"]
    Graph[StateGraph / Agent / ToolNode]
    State[AgentState / Message]
    Prebuilt[ReactAgent / SupervisorTeamAgent / SwarmAgent / prebuilt tools]
    Checkpointer[Checkpointer]
    Store[Memory store]
    Media[Media store]
    Runtime[Runtime / Publisher]
    QA[QA / testing utilities]
  end

  TS -->|HTTP| API
  CLI -->|starts| API
  API --> Auth
  Auth --> Routers
  Routers --> Graph
  Graph --> State
  Graph --> Checkpointer
  Graph --> Store
  Graph --> Media
  Graph --> Runtime
```

---

### `10xgraph` — core Python library

| Sub-package | Key exports |
|---|---|
| `tenxgraph.core` | `StateGraph`, `Agent`, `ToolNode`, `AgentState`, `Message`, `StreamChunk` |
| `tenxgraph.prebuilt.agent` | `ReactAgent`, `RAGAgent`, `PlanActReflectAgent`, `StructuredOutputAgent`, `SupervisorTeamAgent`, `SwarmAgent`, `AudioAgent` |
| `tenxgraph.prebuilt.tools` | `safe_calculator`, `fetch_url`, `google_web_search`, `file_read`, `file_write`, `memory_tool`, `create_handoff_tool` |
| `tenxgraph.storage.checkpointer` | `InMemoryCheckpointer`, `PgCheckpointer` |
| `tenxgraph.storage.store` | `QdrantStore`, `Mem0Store` |
| `tenxgraph.storage.media` | `InMemoryMediaStore`, `LocalFileMediaStore`, `CloudMediaStore` |
| `tenxgraph.runtime` | Publishers (`ConsolePublisher`, `RedisPublisher`, `KafkaPublisher`, `RabbitMQPublisher`, `OtelPublisher`) and LLM SDK converters |
| `tenxgraph.utils` | `ResponseGranularity`, `CallbackManager`, `tool` decorator |
| `tenxgraph.qa` | Testing helpers and evaluation tools |

### `10xgraph-api` — API and CLI

- **`10xgraph api`** — starts a FastAPI server that serves a compiled graph
- **`10xgraph play`** — same as `api`, plus opens the hosted playground
- **`10xgraph init`** — scaffolds `10xgraph.json` and `graph/react.py`
- **`10xgraph build`** — generates a Dockerfile and docker-compose
- REST routers for graph invoke, streaming, threads, memory store, and file uploads

### `@10xscale/agentflow-client` — TypeScript HTTP client

Wraps the REST API with typed methods for invoke, stream, threads, and memory.

---

## Request flow: invoke

```mermaid
sequenceDiagram
  participant Client as TypeScript client
  participant API as FastAPI /v1/graph/invoke
  participant Auth as Auth middleware
  participant Service as GraphService
  participant Graph as Compiled graph
  participant Checkpointer

  Client->>API: POST messages + thread_id
  API->>Auth: verify token
  Auth-->>API: user context
  API->>Service: invoke_graph(input, user)
  Service->>Checkpointer: load state for thread_id
  Checkpointer-->>Service: AgentState
  Service->>Graph: app.invoke(state)
  Graph-->>Service: updated AgentState
  Service->>Checkpointer: save state for thread_id
  Service-->>API: messages
  API-->>Client: JSON response
```

## Request flow: stream

The stream flow is identical through authentication and state loading. The difference is the graph sends `StreamChunk` events incrementally using server-sent events (SSE), and the response is a `StreamingResponse`. Each `StreamChunk` carries an `event` field (`"message"`, `"state"`, `"error"`, or `"updates"`).

---

## Key design decisions

| Decision | Rationale |
|---|---|
| Graph compiled once at startup | Avoids repeated module loading per request |
| `thread_id` in every request | Allows stateless servers to restore conversation history |
| Checkpointer is injected, not hardcoded | Graph code does not depend on the storage backend |
| Auth is middleware, not in the graph | Business logic stays separate from access control |
| `injectq` for service wiring | Nodes and tools declare dependencies declaratively; the runtime resolves them |

---

## Next step

Read about [StateGraph and nodes](/docs/concepts/state-graph) to understand how the core workflow engine works.
