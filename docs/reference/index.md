---
title: API reference
sidebar_label: Overview
description: "Entry point for the AgentFlow reference: the Python library, the REST and WebSocket API, the CLI and agentflow.json, and the TypeScript client."
keywords:
  - agentflow api reference
  - python agent api
  - agentflow rest api
  - agentflow cli reference
  - typescript agent client
slug: /reference
---

# API reference

Four surfaces, one system. Pick the one you are calling from.

## Python library

The graph engine, agents, tools, state, storage, and the evaluation harness.
Everything importable from `agentflow.*`.

| Start with | For |
| --- | --- |
| [Graph](python/graph.md) | `StateGraph`, `CompiledGraph`, `START`, `END`, `invoke`, `stream` |
| [Agent](python/agent.md) | `Agent`, `ToolNode`, and how a model is wired into a node |
| [State](python/state.md) and [Messages](python/messages.md) | `AgentState`, `Message`, content blocks |
| [Tools](python/tools.md) | The `@tool` decorator and tool signatures |
| [Checkpointers](python/checkpointers.md) | `InMemoryCheckpointer`, `PgCheckpointer`, durability |
| [Memory stores](python/memory-stores.md) | Cross-thread memory and vector backends |
| [Evaluation](python/evaluation.md) | `EvalSet`, `EvalCase`, and how a run is scored |

## REST and WebSocket API

What the API server exposes once you run `agentflow api`.

The server generates its own OpenAPI schema, so the authoritative contract for
*your* build is always available locally:

| Surface | Default path | Setting |
| --- | --- | --- |
| Swagger UI | `http://127.0.0.1:8000/docs` | `DOCS_PATH` |
| ReDoc | `http://127.0.0.1:8000/redocs` | `REDOCS_PATH` |
| OpenAPI JSON | `http://127.0.0.1:8000/openapi.json` | derived from `DOCS_PATH` |

Set `DOCS_PATH` and `REDOCS_PATH` to empty values in production to turn the
interactive docs off; the server warns if they are left on.

| Group | Covers |
| --- | --- |
| [Graph](rest-api/graph.md) | Invoke and stream a compiled graph |
| [Live WebSocket](rest-api/live.md) | Bidirectional runs and realtime audio |
| [Threads](rest-api/threads.md) | Conversation history and thread management |
| [Memory store](rest-api/memory-store.md) | Store, search, list, forget |
| [Files](rest-api/files.md) | Upload and retrieval |
| [Observability](rest-api/observability.md) | Run inspection |
| [Evals](rest-api/evals.md) | Running evaluations over HTTP |
| [Ping](rest-api/ping.md) | Health check used by probes |

## CLI and configuration

| Page | Covers |
| --- | --- |
| [Commands](api-cli/commands.md) | `init`, `api`, `play`, `build`, `eval`, `test`, `skills`, `version` |
| [Configuration](api-cli/configuration.md) | Every `agentflow.json` key |
| [Environment](api-cli/environment.md) | Every environment variable |
| [Auth](api-cli/auth.md) | JWT and custom `BaseAuth` |
| [Rate limiting](api-cli/rate-limiting.md) | Backends and limits |

## TypeScript client

`@10xscale/agentflow-client`, framework-agnostic and fully typed.

| Page | Covers |
| --- | --- |
| [AgentFlowClient](client/agentflow-client.md) | Construction and shared options |
| [Invoke](client/invoke.md) and [Stream](client/stream.md) | Running an agent |
| [Realtime](client/realtime.md) | Audio sessions |
| [Threads](client/threads.md), [Memory](client/memory.md), [Files](client/files.md) | Everything else the server exposes |

---

## Conventions used here

- Signatures are the real ones. If a page and the source disagree, the source is
  right and the page is a bug: please [report it](../project/support.md).
- Async methods are marked. Most Python entry points have both an `async`
  version and a sync wrapper, and the reference names both.
- Defaults are stated explicitly, including when the default is `None`.
- Error codes are listed with the condition that raises them. The full index is
  in [error codes](../troubleshooting/error-codes.md).

Reference pages describe what things *are*. For task-shaped questions, start from
the [how-to guides](../how-to/python/build-a-graph.md).
