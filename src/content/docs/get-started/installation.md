---
title: Installation
description: Install 10xGraph and its API server on Python 3.12 or newer, scaffold a production project, and serve your first agent on port 8000.
section: Get started
order: 20
updated: 2026-10-03T00:00:00.000Z
---

10xGraph needs Python 3.12 or newer.

## Install the packages

```bash
pip install 10xgraph 10xgraph-api
```

`10xgraph` is the core framework. `10xgraph-api` adds the API server and the command-line tool.

## Scaffold a production project

```bash
10xgraph init --yes --template production --auth jwt --rate-limit redis
```

The production template creates your graph, a prompt-injection validator, evals, tests and an `agentflow.json` config with JWT auth and owner-only threads turned on. Use `--auth custom` instead to also get an `auth/` module with a `BaseAuth` subclass to fill in.

## Serve it

```bash
10xgraph api
```

The server listens on `http://localhost:8000` and exposes:

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/graph/invoke` | Run the graph and return the result |
| POST | `/v1/graph/stream` | Stream results over SSE |
| WS | `/v1/graph/ws` | Stream over WebSocket |
| WS | `/v1/graph/live` | Realtime audio |
