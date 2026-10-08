---
title: API reference
seoTitle: "10xGraph API reference: Python, REST, CLI, TS"
description: "Reference for 10xGraph: the Python library, the REST and WebSocket API, the CLI and 10xgraph.json configuration, and the typed TypeScript client."
section: Reference
order: 1400
label: Overview
updated: "2026-10-06"
---

The 10xGraph reference documents four surfaces of one system: the Python library, the REST and WebSocket API that the server generates from your graph, the CLI with its `10xgraph.json` configuration, and the TypeScript client. It is for developers who already know what they want to call and need exact signatures, options and error conditions. Pick the surface you are calling from.

## Start here

Python developers should open [Graph](/docs/reference/python/graph) and [Agent](/docs/reference/python/agent) first: they define `StateGraph`, `CompiledGraph`, `invoke`, `stream` and how a model is wired into a node. [Checkpointers](/docs/reference/python/checkpointers) matters for production, because durable threads and replay-safe tool calls depend on one.

If you run the server, the [CLI commands](/docs/reference/api-cli/commands) and [configuration](/docs/reference/api-cli/configuration) pages cover every `10xgraph.json` key, with [auth](/docs/reference/api-cli/auth) and [rate limiting](/docs/reference/api-cli/rate-limiting) for the production settings. Frontend developers should start with [AgentFlowClient](/docs/reference/client/agentflow-client) and [Stream](/docs/reference/client/stream). The REST contract starts at [conventions](/docs/reference/rest-api/conventions) and the [graph endpoints](/docs/reference/rest-api/graph).

If you do not yet know which call you need, the [how-to guides](/docs/how-to) are organized by task.

## Python library

The graph engine, agents, tools, state, storage, and the evaluation harness.
Everything importable from `tenxgraph.*`.

| Start with | For |
| --- | --- |
| [Graph](/docs/reference/python/graph) | `StateGraph`, `CompiledGraph`, `START`, `END`, `invoke`, `stream` |
| [Agent](/docs/reference/python/agent) | `Agent`, `ToolNode`, and how a model is wired into a node |
| [State](/docs/reference/python/state) and [Messages](/docs/reference/python/messages) | `AgentState`, `Message`, content blocks |
| [Tools](/docs/reference/python/tools) | The `@tool` decorator and tool signatures |
| [Checkpointers](/docs/reference/python/checkpointers) | `InMemoryCheckpointer`, `PgCheckpointer`, durability |
| [Memory stores](/docs/reference/python/memory-stores) | Cross-thread memory and vector backends |
| [Evaluation](/docs/reference/python/evaluation) | `EvalSet`, `EvalCase`, and how a run is scored |

## REST and WebSocket API

What the API server exposes once you run `10xgraph api`.

The server generates its own OpenAPI schema, so the authoritative contract for
*your* build is always available locally:

| Surface | Default path | Setting |
| --- | --- | --- |
| Swagger UI | `http://127.0.0.1:8000/docs` | `DOCS_PATH` |
| ReDoc | `http://127.0.0.1:8000/redocs` | `REDOCS_PATH` |
| OpenAPI JSON | `http://127.0.0.1:8000/openapi.json` | FastAPI default, always on |

Set `DOCS_PATH` and `REDOCS_PATH` to empty values in production to turn the
interactive docs off; the server warns if they are left on. Note that the raw
schema at `/openapi.json` stays available regardless, so block it at the proxy
if you do not want it public.

| Group | Covers |
| --- | --- |
| [Graph](/docs/reference/rest-api/graph) | Invoke and stream a compiled graph |
| [Live WebSocket](/docs/reference/rest-api/live) | Bidirectional runs and realtime audio |
| [AG-UI](/docs/reference/rest-api/ag-ui) | Run the graph over the AG-UI protocol, for CopilotKit |
| [Threads](/docs/reference/rest-api/threads) | Conversation history and thread management |
| [Memory store](/docs/reference/rest-api/memory-store) | Store, search, list, forget |
| [Files](/docs/reference/rest-api/files) | Upload and retrieval |
| [Observability](/docs/reference/rest-api/observability) | Run inspection |
| [Evals](/docs/reference/rest-api/evals) | Running evaluations over HTTP |
| [Ping](/docs/reference/rest-api/ping) | Health check used by probes |

## CLI and configuration

| Page | Covers |
| --- | --- |
| [Commands](/docs/reference/api-cli/commands) | `init`, `api`, `play`, `build`, `eval`, `test`, `skills`, `version` |
| [Configuration](/docs/reference/api-cli/configuration) | Every `10xgraph.json` key |
| [Environment](/docs/reference/api-cli/environment) | Every environment variable |
| [Auth](/docs/reference/api-cli/auth) | JWT and custom `BaseAuth` |
| [Rate limiting](/docs/reference/api-cli/rate-limiting) | Backends and limits |

## TypeScript client

`@10xscale/agentflow-client`, framework-agnostic and fully typed.

| Page | Covers |
| --- | --- |
| [AgentFlowClient](/docs/reference/client/agentflow-client) | Construction and shared options |
| [Invoke](/docs/reference/client/invoke) and [Stream](/docs/reference/client/stream) | Running an agent |
| [Realtime](/docs/reference/client/realtime) | Audio sessions |
| [Threads](/docs/reference/client/threads), [Memory](/docs/reference/client/memory), [Files](/docs/reference/client/files) | Everything else the server exposes |

---

## Conventions used here

- Signatures are the real ones. If a page and the source disagree, the source is
  right and the page is a bug: please [report it](/docs/project/support).
- Async methods are marked. Most Python entry points have both an `async`
  version and a sync wrapper, and the reference names both.
- Defaults are stated explicitly, including when the default is `None`.
- Error codes are listed with the condition that raises them. The full index is
  in [error codes](/docs/troubleshooting/error-codes).

Reference pages describe what things *are*. For task-shaped questions, start from
the [how-to guides](/docs/how-to/python/build-a-graph).
