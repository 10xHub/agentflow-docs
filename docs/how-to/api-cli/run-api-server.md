---
title: Run the API Server — AgentFlow Python AI Agent Framework
sidebar_label: Run the API Server
description: How to start the AgentFlow API server for development and production. Part of the AgentFlow agentflow api guide for production-ready Python AI agents.
keywords:
  - agentflow api
  - agentflow cli
  - agent rest api
  - agentflow
  - python ai agent framework
  - run the api server
---


# Run the API server

The `agentflow api` command starts a FastAPI-based REST server that loads your compiled graph and exposes it over HTTP. This guide covers common scenarios from quick local testing to production deployment.

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
agentflow api --host 127.0.0.1 --port 8000
```

This starts the server on `http://127.0.0.1:8000`. Auto-reload is enabled by default. The server restarts automatically when you edit any Python file, which is useful during development.

### What the flags mean:

- `--host 127.0.0.1` — Bind only to localhost (only accessible from your machine). Use instead `--host 0.0.0.0` to accept all network interfaces.
- `--port 8000` — Listen on port 8000. Change to any available port (8001, 8080, etc.).

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
- **ReDoc** (alternative): `http://127.0.0.1:8000/redoc`

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
agentflow api --port 8001
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
agentflow api
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
agentflow api --config config/staging.json
```

Each config can point to different checkpointers, stores, and authentication backends.

## Development mode with auto-reload

Auto-reload (the default) is enabled for development:

```bash
agentflow api --host 127.0.0.1 --port 8000 --reload
```

This is useful when iterating on your graph. Every time you save a Python file, the server restarts. Disable auto-reload with:

```bash
agentflow api --host 127.0.0.1 --port 8000 --no-reload
```

**Warning:** Auto-reload in containers or over network file systems is unreliable. Always use `--no-reload` in production and in Docker.

## Production mode

For a production deployment, disable auto-reload and use a process supervisor:

```bash
MODE=production agentflow api --no-reload --host 0.0.0.0 --port 8000
```

### What this does:

- `MODE=production` — Sets the environment to production mode (disables verbose output, enables certain optimizations).
- `--no-reload` — Disables file-watching, which is expensive and unreliable in production.
- `--host 0.0.0.0` — Binds to all network interfaces so the server is accessible from outside the host.

### Process management

Use one of:

**systemd:**

```ini
[Unit]
Description=AgentFlow API
After=network.target

[Service]
Type=simple
User=agentflow
WorkingDirectory=/opt/agentflow
ExecStart=/usr/bin/agentflow api --no-reload
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable agentflow
sudo systemctl start agentflow
sudo systemctl status agentflow
```

**Docker:** See [Generate Docker Files](./generate-docker-files.md).

**PM2** (Node process manager, works with Python via shell):

```bash
npm install -g pm2
pm2 start "agentflow api --no-reload" --name "agentflow-api"
pm2 save  # Save to auto-start on reboot
```

## Multi-worker deployment

For high throughput, run multiple API instances behind a load balancer:

```bash
# Terminal 1
agentflow api --port 8001 --no-reload

# Terminal 2
agentflow api --port 8002 --no-reload

# Terminal 3
agentflow api --port 8003 --no-reload
```

Use a reverse proxy (nginx, HAProxy) or Docker Compose to load-balance across these ports. **Important:** Ensure all instances use the same checkpointer (e.g., `PgCheckpointer` backed by a shared database) so state is consistent.

## Verbose logging

For debugging, enable verbose output:

```bash
agentflow api --verbose
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
agentflow api --quiet
```

Useful in Docker containers where reducing log volume is important.

## Disable API documentation in production

The interactive API docs expose your endpoint structure. Disable them in production:

```bash
export DOCS_PATH=""
export REDOC_PATH=""
agentflow api --no-reload
```

With these environment variables set, `/docs` and `/redoc` return 404.

## Monitoring and metrics

The `/ping` endpoint is always available (without authentication). Use it for health checks:

```bash
# Liveness check (is the server responding?)
curl -f http://127.0.0.1:8000/ping || exit 1
```

Incorporate this into your monitoring (Prometheus, Datadog, etc.).

## Performance tuning

**Connection pooling:** If your graph connects to databases or external APIs, configure connection pools in your graph initialization. Look for settings like `pool_size`, `max_overflow`, `pool_timeout`.

**Request timeout:** By default, graph invocations have a 30-second timeout. Increase if your graph does long-running tasks:

```python
# In your graph module
app = graph.compile(recursion_limit=100)  # Increase iteration limit if needed
```

**Hardware:** More CPU cores help if your graph does heavy computation. More memory helps if you store large objects in state.

## Graceful shutdown

The server handles `SIGTERM` gracefully:

```bash
# In one terminal
agentflow api

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
- Use a different port: `agentflow api --port 8001`
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
