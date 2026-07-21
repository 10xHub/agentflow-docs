---
title: Open the Playground — AgentFlow Python AI Agent Framework
sidebar_label: Open the Playground
description: How to use agentflow play to start the API and open the hosted playground. Part of the AgentFlow agentflow api guide for production-ready Python AI agents.
keywords:
  - agentflow api
  - agentflow cli
  - agent rest api
  - agentflow
  - python ai agent framework
  - open the playground
---


# Open the playground

`agentflow play` is a convenient shortcut that starts the API server and automatically opens the hosted playground in your default browser in a single command. This is the fastest way to interactively test your agent during development.

## Important: The playground is hosted externally

AgentFlow playground is a web app hosted by 10xScale. `agentflow play` does NOT start a separate frontend server on your machine. Instead:

1. It starts the API server locally (same as `agentflow api`)
2. It opens your browser to the hosted playground URL, with your local API URL as a query parameter
3. The playground runs in your browser and sends requests to your local API

**This means:**
- Your graph code runs locally on your machine
- The playground UI is from 10xScale's servers
- Network requests travel from your browser to your local API

## Start the playground

From the folder that contains `agentflow.json`:

```bash
agentflow play --host 127.0.0.1 --port 8000
```

You should see output like:

```
[INFO] Starting API server...
[INFO] API server running on http://127.0.0.1:8000
[INFO] Opening playground at: https://playground.agentflow.dev?backendUrl=http://127.0.0.1:8000
```

A browser window opens automatically showing the playground UI connected to your local API. If the browser does not open, copy the URL from the terminal log and open it manually.

## The playground UI

The playground is a left nav rail plus a working area. There is no thread sidebar and no "New Thread" button; threads live on their own page.

| Group | Page | Route | What it is for |
|---|---|---|---|
| — | Connect | `/` | Add, pick, and test backend connections. This is where you land first. |
| Interact | Chat | `/chat` | Turn-based conversation with the agent. |
| Interact | Live | `/live` | Voice-to-voice session for realtime (live) agents. |
| Inspect | Thread Inspector | `/threads` | Browse saved threads, their messages, and their checkpointed state. |
| Inspect | Observability | `/observability` | Span timeline, event list, and token cost for a run. |
| Inspect | Evals | `/evals` | Eval runs and per-case drilldown. |
| Inspect | Memory Inspector | `/memory` | Browse and search the memory store. |
| Build | Graph | `/graph` | Node and edge canvas of the compiled graph, with live highlighting. |
| Build | Tools & MCP | `/tools` | Every tool the graph exposes, plus client-side tool authoring. |
| Build | Files | `/files` | Marked "Soon" in the rail. The page is a placeholder. |
| — | Settings | `/settings` | Saved connections and appearance. Stored in your browser only. |

### Connect first

Every other page needs an active connection, so the playground opens on the Connect page. `agentflow play` passes your local API URL through, so the connection is usually pre-filled and you only have to confirm it.

Pick an auth mode to match your server's `agentflow.json`:

| Mode | Use when |
|---|---|
| None | Local dev with auth disabled. This is the default. |
| Bearer token / JWT | `"auth": "jwt"`, or any `BaseAuth` that reads a bearer token. |
| Basic | A custom `BaseAuth` that decodes an `Authorization: Basic` header. |
| Custom header | A custom `BaseAuth` that reads its own header, such as `X-API-Key`. |

On connect, the playground calls `GET /v1/graph` and derives a row of capability chips from the response: `stream`, `ws`, `live`, `store`, `checkpointer`, `mcp`. These chips are what gate the rest of the UI — `live` in particular decides whether the Live page runs a session or shows an explanation.

Connections are saved in browser storage, so you can keep several backends and switch between them from Settings.

### Chat

Send a message and watch the reply arrive. A mode selector picks the transport, and the status line names the endpoint in use:

| Mode | Endpoint |
|---|---|
| `stream` (default) | `POST /v1/graph/stream` |
| `invoke` | `POST /v1/graph/invoke` |
| `ws` | `WS /v1/graph/ws` |

The Inspector toggle in the connection bar opens a side panel with the run's details, including the exact request as a cURL command you can paste into a terminal. The composer also lets you set `initial_state` and other run options for the next message.

Chat is turn-based, so it refuses a realtime agent: connect a live graph and the Chat page shows a notice pointing you at Live instead. Tool calls and their results appear inline in the message list.

### Live

A voice-to-voice session over `WS /v1/graph/live`, for graphs rooted at a live agent. Press Start, then tap the mic to talk and tap again to end your turn; the agent's reply plays back and both sides of the conversation stream in as text.

Live is gated twice. Without a connection it asks you to connect. Connected to a graph that is not live-capable it explains that this agent is not a realtime agent rather than opening a socket that would immediately close. See [how-to/client/realtime-audio](../client/realtime-audio.md) to build the same thing in your own app.

### Thread Inspector

Lists saved threads with their id, user, message count, and last-updated time. Selecting one opens three tabs: **Messages**, **State & checkpoint**, and **Raw JSON**. This is where you confirm that a `thread_id` really persisted and see exactly what the checkpointer stored. Threads can also be deleted from here.

Everything on this page needs a checkpointer configured in `agentflow.json`. Without one there is nothing to list.

### Observability

The trace for a run: a span timeline (`root → node → llm | tool`), an event list, and a cost pane with token usage. Click a span or event to open its detail. It reads the active thread, so send a message in Chat first — with no runs recorded it says so rather than showing an empty chart.

### Evals

Lists eval runs from the server, with a per-case drilldown and a detail pane for the selected case. This is the UI counterpart to `agentflow eval`.

### Memory Inspector

Browse and search the memory store. Facets narrow by memory type (`episodic`, `semantic`, `procedural`, `entity`, `relationship`, `declarative`, `custom`), and you can switch between browse and search modes, pick a retrieval strategy and a similarity metric, and open any memory to see its full record. Needs a store configured on the server, which the `store` capability chip tells you.

### Graph

Renders the compiled graph as a node and edge canvas from `GET /v1/graph`. Selecting a node opens its details; an info pane shows the graph-level facts (node and edge counts, checkpointer type, interrupt points, state type). While a chat run is streaming, the currently executing node is highlighted, which makes routing bugs obvious.

### Tools & MCP

Lists every tool the graph exposes, grouped by tool node and tagged by source, so you can see at a glance which tools are local Python functions, which came from an MCP server, and which are client-registered. You can also author a client-side tool here and register it against the backend to try the remote-tool loop without writing an app.

### Files

Present in the rail with a "Soon" badge. The page is a placeholder; file upload is not wired up in the playground yet. Uploads work over the API and the TypeScript client — see [how-to/client/send-images-and-documents](../client/send-images-and-documents.md).

## Streaming responses

Chat defaults to `stream` mode, so partial responses build up in the UI as they arrive. Switch to `invoke` when you want to see the single final response instead, or to `ws` to exercise the WebSocket transport.

## Use a different config or port

```bash
agentflow play --config ./config/staging.json --port 8001
```

Useful when you have multiple `agentflow.json` files for different setups.

## Playground connection troubleshooting

### "Connection refused" or "Connection failed"

**Symptom:** Playground appears but shows "Cannot connect to backend API".

**Cause:** The playground cannot reach your local API. Common reasons:

1. The API server is not running
2. You are accessing the playground from a different machine (not localhost)
3. A firewall/proxy is blocking the connection
4. The port specified does not match what the server is listening on

**Fix:**
- Verify the API is running: In the terminal where you ran `agentflow play`, you should see running logs
- Verify the `backendUrl` query parameter in the browser URL matches your server address
- Manual test: Open a new terminal and run `curl http://127.0.0.1:8000/ping`. If this fails, the server is not reachable.

### "You are on an unsupported network"

**Cause:** The playground is trying to connect to `http://` (non-HTTPS) from an HTTPS page, and your browser blocks it.

**Fix:**

If running on a different machine, use a reverse proxy with HTTPS:

```bash
# Create a self-signed certificate and proxy
nginx -c /path/to/nginx-https.conf  # Details below
```

For local development, you may need to:
1. Enable "Insecure content" in your browser (not recommended for production)
2. Use a local HTTPS proxy
3. Access the playground from a local address if possible

### Playground loads but does not send requests

**Cause:** The playground is connected but requests are timing out or failing silently.

**Fix:**
1. Check browser console (F12 → Console tab) for errors
2. Check API logs (terminal running `agentflow play`) for errors
3. Verify your graph is not stuck in an infinite loop (look for CPU usage)
4. If requests timeout, increase the timeout by configuring `recursion_limit` in your graph module

## Environment variables and the playground

The playground does not have access to your local environment variables. All secrets (API keys, database URLs) must:

1. Be configured in your graph module before the server starts, OR
2. Be passed via the API (if your graph supports parameterized initialization)

Example:

```python
# graph/react.py
import os

api_key = os.environ.get("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY not set")

app = graph.compile()  # Use api_key in your graph logic
```

Start the server with:

```bash
export GOOGLE_API_KEY=your_key
agentflow play
```

## Stopping the playground

Press `Ctrl+C` in the terminal where `agentflow play` is running. This:
1. Stops the API server
2. Closes the playground connection
3. Returns control to the shell

The browser tab remains open but shows "Connection failed" since the API is no longer available.

## Sharing your agent with others

If you want others to test your agent:

1. Deploy the API server to a public URL (e.g., on a cloud provider)
2. Share the playground URL with the `backendUrl` query parameter:
   ```
   https://playground.agentflow.dev?backendUrl=https://your-api.example.com
   ```
3. Others can open this URL and test your agent in their browsers

The agent runs on your server, so make sure authentication is properly configured (`auth` field in `agentflow.json`).

## Difference: agentflow play vs agentflow api

| Aspect | `agentflow play` | `agentflow api` |
| --- | --- | --- |
| **Server** | Same FastAPI server | Same FastAPI server |
| **Browser** | Opens playground automatically | You open your own client |
| **Use case** | Quick interactive testing | Server-only (CI/CD, production, programmatic clients) |
| **Default host** | 127.0.0.1 (localhost) | 127.0.0.1 (localhost) |

Both start an identical server. The only difference is whether a browser is automatically opened to the playground UI.

## Next steps

- **Modify your agent** — Edit `graph/react.py` and test changes by sending new messages in the playground
- **Add tools** — Give your agent callable functions and see them invoked in the playground
- **Add persistence** — Configure a checkpointer so conversations persist when the server restarts
- **Deploy** — Use `agentflow build` to generate a Docker config and deploy to production

## Performance tips for the playground

- **Streaming is faster** — If your graph is slow, enable streaming responses so the UI shows partial results as they arrive
- **Reduce state size** — Keep your state dict lean to reduce network transfer time
- **Batch operations** — Avoid many small tool calls; combine them into fewer, larger calls
- **Monitor from a local machine** — For best UI responsiveness, run the playground from the same machine as the API, or at least on a low-latency network
