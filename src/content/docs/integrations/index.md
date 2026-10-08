---
title: "10xGraph Integrations: FastAPI, Next.js, Postgres"
seoTitle: "10xGraph integrations: FastAPI, Next.js, Postgres"
description: Guides for using 10xGraph with FastAPI, Next.js, CopilotKit and Postgres, plus the storage, messaging and tracing backends the core library supports.
section: Integrations
order: 10
label: Overview
updated: "2026-10-06"
---

10xGraph integrations are the guides for connecting an agent graph to the stack you already run: a FastAPI service, a Next.js or CopilotKit frontend, and a Postgres database for durable threads. The core library also ships optional backends for caching, messaging, memory and tracing. This section is for Python teams who already have a service or a frontend and want the agent to fit into it instead of replacing it.

## Start here

If you have an existing Python service, read [10xGraph with FastAPI](/docs/integrations/fastapi) first. It compares two approaches: running `10xgraph api` as a sidecar, or embedding the compiled graph directly in your own routes, with auth patterns and streaming gotchas for each.

If the caller is a browser, read [10xGraph with Next.js](/docs/client/nextjs-and-react) to stream tokens from the agent API into a React frontend. If you already use CopilotKit, [10xGraph with CopilotKit](/docs/integrations/copilotkit) shows how the API server's AG-UI endpoint feeds a CopilotKit chat, including frontend tools and shared state.

For anything that must survive a restart, read [10xGraph with Postgres](/docs/integrations/postgres-and-redis). It covers `PgCheckpointer`, which is also what the replay-safe tool ledger needs: see [Replay-safe tools](/docs/concepts/replay-safe-tools) for why a checkpointer matters when a run crashes mid-node.

## What the library supports

These are the optional extras declared in the core package's `pyproject.toml`. Install only the ones you use.

| Area | Supported | Extra |
|---|---|---|
| Durable checkpointing | PostgreSQL (with Redis as the hot cache) | `pg_checkpoint` |
| Local checkpointing | SQLite, in-memory | `sqlite_checkpoint` |
| Long-term memory | Qdrant, Mem0 | `qdrant`, `mem0` |
| Tools | Model Context Protocol servers and clients | `mcp` |
| Event publishing | Redis Pub/Sub, Kafka, RabbitMQ | `redis`, `kafka`, `rabbitmq` |
| Tracing | OpenTelemetry, Logfire, LangSmith | `otel`, `logfire`, `langsmith` |
| Agent-to-agent | A2A SDK | `a2a_sdk` |
| Files and images | Pillow, cloud storage manager | `images`, `cloud-storage` |

Model providers are covered separately in [Providers](/docs/integrations/models). For how to wire up publishers and traces, see [Use publishers](/docs/guides/use-publishers) and [Send traces to Logfire and LangSmith](/docs/guides/send-traces-to-logfire-langsmith).

## Pick an integration

- [**10xGraph with FastAPI**](/docs/integrations/fastapi). Embed a 10xGraph graph in your existing FastAPI service
- [**10xGraph with Next.js**](/docs/client/nextjs-and-react). Call your agent from a Next.js frontend with streaming
- [**10xGraph with CopilotKit**](/docs/integrations/copilotkit). Serve your graph over the AG-UI protocol to a CopilotKit frontend
- [**10xGraph with Postgres**](/docs/integrations/postgres-and-redis). Durable threads with `PgCheckpointer`
