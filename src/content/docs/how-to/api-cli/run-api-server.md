---
title: Run the API Server
seoTitle: "Run the 10xGraph API server"
description: "Start the 10xGraph API server with 10xgraph api for local development and for production, including the host, port, and agentflow.json settings."
section: How-to guides
group: CLI
order: 870
label: Run the API Server
updated: "2026-07-21"
---

The `10xgraph api` command starts a FastAPI-based REST server that loads your compiled graph and exposes it over HTTP. This guide covers common scenarios from quick local testing to production deployment.

## Prerequisites

You must have `agentflow.json` and a valid graph module in your project:

```bash
# Verify the config file exists and is valid
cat agentflow.json

# Verify your graph module can be imported
python -c "from graph.react import app; print(app)"
```

Both commands should succeed without errors.

## Quick start (development)

From the folder that contains `agentflow.json`:

```bash
10xgraph api --host 127.0.0.1 --port 8000
```

This starts the server on `http://127.0.0.1:8000`. Auto-reload is enabled by default. The server restarts automatically when you edit any Python file, which is useful during development.

### What the flags mean:

- `--host 127.0.0.1`, Bind only to localhost (only accessible from your machine). This is the default, so the flag is optional here. Pass `--host 0.0.0.0` to accept all network interfaces, which is what a container needs.
- `--port 8000`, Listen on port 8000. Change to any available port (8001, 8080, etc.).

## Verify it is running

From another terminal, ping the server to confirm it is reachable:

```bash
curl http://127.0.0.1:8000/ping
```

Expected successful response:

```json
{"success": true, "data": "pong"}
```

This endpoint requires no authentication and is commonly used for load balancer health checks.

## Interactive API documentation

When running locally, the server exposes interactive API docs:

- **Swagger UI** (recommended): `http://127.0.0.1:8000/docs`
- **ReDoc** (alternative): `http://127.0.0.1:8000/redocs`

You can test endpoints directly from these interfaces without writing curl commands. This is the fastest way to understand the API surface.

### Example: Invoking the graph

1. Open `http://127.0.0.1:8000/docs`
2. Find the `POST /v1/graph/invoke` endpoint
3. Click "Try it out"
4. Provide sample input: `{"messages": [{"role": "user", "content": "Hello"}], "config": {"thread_id": "test"}}`
5. Click "Execute" and see the response

## Port already in use

If you get `Address already in use`, choose a different port:

```bash
10xgraph api --port 8001
```

Or find and kill the process holding the port:

```bash
lsof -ti :8000 | xargs kill -9
```

## Environment variables

Your graph may need environment variables (API keys, database URLs, etc.). Load them from a `.env` file via `agentflow.json`:

```json
{
  "env": ".env"
}
```

Or pass them directly to the server:

```bash
export GOOGLE_API_KEY=your_key
export REDIS_URL=redis://localhost:6379
10xgraph api
```

## Use a different config file

For multiple environments (dev, staging, prod), keep separate config files:

```
config/
  dev.json
  staging.json
  prod.json
```

Start the server with a specific config:

```bash
10xgraph api --config config/staging.json
```

Each config can point to different checkpointers, stores, and authentication backends.

## Development mode with auto-reload

Auto-reload (the default) is enabled for development:

```bash
10xgraph api --host 127.0.0.1 --port 8000 --reload
```

This is useful when iterating on your graph. Every time you save a Python file, the server restarts. Disable auto-reload with:

```bash
10xgraph api --host 127.0.0.1 --port 8000 --no-reload
```

**Warning:** Auto-reload in containers or over network file systems is unreliable. Always use `--no-reload` in production and in Docker.

## Production mode

`10xgraph api` is a **development server**. It uses Uvicorn single-worker, file-watching mode and is not designed for production traffic.

For production, use Docker. Generate the container files with:

```bash
10xgraph build --docker-compose
```

Then build and run:

```bash
docker compose up --build
```

See [Generate Docker Files](/docs/how-to/api-cli/generate-docker-files) for the full guide.

## Verbose logging

For debugging, enable verbose output:

```bash
10xgraph api --verbose
```

This prints:
- Request details (path, method, headers)
- Graph node execution times
- Checkpointer read/write operations
- State transitions

Useful for troubleshooting slow requests or state issues.

## Quiet mode

Suppress all output except errors:

```bash
10xgraph api --quiet
```

Useful in Docker containers where reducing log volume is important.

## Disable API documentation in production

The interactive API docs expose your endpoint structure. With `MODE=production`, `DOCS_PATH` and `REDOCS_PATH` default to empty unless you set them explicitly. To disable them in another mode, set both to empty:

```bash
export DOCS_PATH=""
export REDOCS_PATH=""
10xgraph api --no-reload
```

With both paths empty, `/docs` and `/redocs` are not served.

## Monitoring and metrics

The `/ping` endpoint is always available (without authentication). Use it for health checks:

```bash
# Liveness check (is the server responding?)
curl -f http://127.0.0.1:8000/ping || exit 1
```

Incorporate this into your monitoring (Prometheus, Datadog, etc.).

## Performance tuning

**Connection pooling:** If your graph connects to databases or external APIs, configure connection pools in your graph initialization. Look for settings like `pool_size`, `max_overflow`, `pool_timeout`.

**Step and time limits:** two run-config keys bound a graph run. `recursion_limit` caps the number of steps (default 25) and is also a field on the invoke and stream request bodies. `node_timeout` bounds a single node (default 900 seconds) and `tool_timeout` bounds a single tool call (default 300 seconds). Neither is a `compile()` argument. Pass them in the run config:

```python
result = app.invoke(
    {"messages": [Message.text_message("Refund order A-1042")]},
    config={"thread_id": "t1", "recursion_limit": 100, "node_timeout": 120},
)
```

**Hardware:** More CPU cores help if your graph does heavy computation. More memory helps if you store large objects in state.

## Graceful shutdown

The server handles `SIGTERM` gracefully:

```bash
# In one terminal
10xgraph api

# In another terminal, after a delay
kill -TERM <pid>
```

The server will:
1. Stop accepting new requests
2. Wait for in-flight requests to complete (up to a timeout)
3. Close connections and exit

## Common issues

**Graph import fails: "ModuleNotFoundError"**
- Verify the import path in `agentflow.json` is correct.
- Verify the module is installed or on the Python path.
- Try importing manually: `python -c "from graph.react import app"`

**Port 8000 is already in use**
- Use a different port: `10xgraph api --port 8001`
- Or find and kill the process: `lsof -ti :8000 | xargs kill -9`

**"GOOGLE_API_KEY" environment variable not set**
- Set it before starting the server: `export GOOGLE_API_KEY=...`
- Or add it to your `.env` file and ensure `agentflow.json` references it: `"env": ".env"`

**Requests are very slow**
- Check server logs with `--verbose`
- Verify your graph logic (does a tool call take a long time?)
- Check database/network connections if your graph connects externally

**"Connection refused" when trying to reach the server**
- Is the server running? Check the terminal where you started it.
- Is the host/port correct? Try `curl http://127.0.0.1:8000/ping`
- If using a VM or container, verify networking is properly configured.
