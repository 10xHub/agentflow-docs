---
title: Production
description: Production guide for deploying, configuring, and securing the 10xGraph API server. Covers endpoints, config, auth, rate limiting, storage, and environment variables.
section: How-to guides
group: Production
order: 740
label: Overview
updated: "2026-09-29"
---

The `agentflow api` command starts a FastAPI + Uvicorn server that exposes your compiled graph as a fully-featured REST + WebSocket API. This section is the single source of truth for everything you need to run 10xGraph in production.

## What the server exposes

| Group | Prefix | What it does |
| --- | --- | --- |
| **Health** | `/ping` | Unauthenticated health check |
| **Graph** | `/v1/graph/...` | Invoke, stream, stop, fix, inspect the graph |
| **Threads** | `/v1/threads/...` | CRUD for thread state and messages (requires checkpointer) |
| **Store** | `/v1/store/...` | Semantic memory CRUD and search (requires store backend) |
| **Files** | `/v1/files/...` | Multimodal file upload and retrieval |
| **Config** | `/v1/config/...` | Read server configuration (e.g. multimodal settings) |
| **Observability** | `/v1/observability/...` | Reconstructed run traces. Development only; returns an empty payload in production. |
| **Evals** | `/v1/evals/...` | Eval report viewer. **Unauthenticated**, so it is not mounted when `MODE=production`. |

Full endpoint reference: [REST API reference](/docs/reference/rest-api/conventions), starting with the shared conventions, auth model, and permission table.

Sending images and documents to an agent: [Multimodal and vision](/docs/how-to/production/multimodal-and-vision)

## Configuration

All server behavior is controlled by two inputs:

1. **`agentflow.json`** — which graph to load, which auth backend, which checkpointer, rate limiting, etc. Production guidance: [agentflow.json in production](/docs/how-to/production/agentflow-json). Complete field reference: [configuration reference](/docs/reference/api-cli/configuration)
2. **Environment variables** — secrets and runtime tunables (`JWT_SECRET_KEY`, `ORIGINS`, `MODE`, `LOG_LEVEL`, etc.). Complete reference: [Environment variables](/docs/how-to/production/environment-variables)

## Authentication and authorization

All endpoints except `/ping` pass through an auth + authorization layer:

- **No auth** (`"auth": null`) — all requests are allowed without credentials. Safe for internal networks or local dev.
- **JWT** (`"auth": "jwt"`) — Bearer token checked against `JWT_SECRET_KEY`. Standard stateless auth.
- **Custom** (`"auth": {"method": "custom", "path": "..."}`) — subclass `BaseAuth` for any identity provider.
- **Authorization** (`"authorization": "module:Class"`) — subclass `AuthorizationBackend` for per-resource RBAC.

Guide: [Auth and Authorization](/docs/how-to/production/auth-and-authorization)

## Rate limiting

Configured under the `rate_limit` key in `agentflow.json`. Three backends: `memory` (dev), `redis` (production), `custom`.

Guide: [Rate limiting](/docs/how-to/production/agentflow-json)

## Checkpointing

Thread state persistence. Without a checkpointer, every request is stateless. With `PgCheckpointer`, state survives across restarts and can be shared across multiple server instances.

Guide: [Checkpointing](/docs/how-to/production/checkpointing)

## Deployment

For Dockerfile generation run `agentflow build`. For multi-worker, Kubernetes, and reverse-proxy deployments see the [Deployment guide](/docs/how-to/production/deployment).

## Quick start

```bash
pip install 10xscale-agentflow-cli
agentflow init          # scaffold a project
cp .env.example .env    # fill in API keys
agentflow api           # start the server
```

Access:
- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redocs`
- Health: `http://127.0.0.1:8000/ping`
