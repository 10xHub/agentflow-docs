---
title: Run the API Server
description: How to start the AgentFlow API server for development and production.
---

# Run the API server

The `agentflow api` command starts a FastAPI server that loads your compiled graph and exposes it over HTTP.

## Development

From the folder that contains `agentflow.json`:

```bash
agentflow api --host 127.0.0.1 --port 8000
```

Auto-reload is enabled by default. The server restarts when you change any Python file in the project. This is useful during development but should be disabled in production.

```bash
agentflow api --host 127.0.0.1 --port 8000 --reload
```

## Check it is running

```bash
curl http://127.0.0.1:8000/ping
```

Expected:

```json
{"success": true, "data": "pong"}
```

## Use a different config file

```bash
agentflow api --config ./config/staging.json
```

This is useful when you have different `agentflow.json` files for different environments.

## Production

Disable auto-reload and bind to all interfaces:

```bash
MODE=production agentflow api --no-reload
```

For reliable process management, run with a process supervisor (systemd, PM2, or Docker). The server handles `SIGTERM` gracefully.

## Multi-worker production

For higher throughput, run multiple workers behind a load balancer. Use `PgCheckpointer` so state is shared across workers:

```bash
# Run on different ports (or use a reverse proxy)
agentflow api --port 8001 --no-reload &
agentflow api --port 8002 --no-reload &
agentflow api --port 8003 --no-reload &
```

Or use Docker Compose with replicas (see [Generate Docker files](./generate-docker-files.md)).

## Verbose logging

```bash
agentflow api --verbose
```

Verbose mode prints request details, node execution times, and checkpointer operations. Useful for debugging.

## Quiet mode

```bash
agentflow api --quiet
```

Suppresses all output except errors. Useful in Docker containers where log volume matters.

## API docs

When running in development mode, the server exposes interactive API docs:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redocs`

Disable these in production by setting the environment variables:

```bash
DOCS_PATH=
REDOCS_PATH=
```
