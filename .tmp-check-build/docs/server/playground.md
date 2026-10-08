# Playground

> Test your agent with the 10xGraph playground, a hosted UI for interactive development and debugging.

Source: https://10xgraph.com/docs/server/playground
Last updated: 2026-10-08

The 10xGraph playground is a hosted web application that lets you test your agent interactively during development. Run `10xgraph play` to start your API and open the playground in one command. The playground connects to your local API over the network, so you can see messages, trace execution, inspect state, and debug tools in real time without writing any client code.

## Prerequisites

- A `10xgraph.json` file in your project with a valid `agent` field pointing to your compiled graph
- A compiled graph module ready to run (see [Build a graph](/docs/guides/build-a-graph))
- A local API server not already running on your chosen port (default 8000)

## Start the playground

From the directory containing your `10xgraph.json`, run:

```bash
10xgraph play --host 127.0.0.1 --port 8000
```

The playground will start your API server and open a browser tab automatically. You should see output like:

```
[INFO] Starting API server...
[INFO] API server running on http://127.0.0.1:8000
[INFO] Opening playground at: https://playground-463bd.web.app?backendUrl=http://127.0.0.1:8000
```

If the browser tab does not open automatically, copy the URL from the terminal output and paste it into your browser's address bar.

## Verify the playground works

Once your browser opens the playground, you should land on the **Connect** page. The playground has already received your local API URL from the `backendUrl` query parameter, so the connection is usually pre-filled.

Confirm that the playground is connected by checking the status on the Connect page:

1. The **backend URL** field should show your local API address (e.g., `http://127.0.0.1:8000`)
2. Pick the auth mode that matches your server's `10xgraph.json`:
   - **None** for local dev with auth disabled (the default)
   - **Bearer token / JWT** for `"auth": "jwt"` or a token-reading `BaseAuth`
   - **Basic** for custom `BaseAuth` that decodes `Authorization: Basic`
   - **Custom header** for custom auth reading a custom header (like `X-API-Key`)
3. Click Connect (or the button to confirm if it auto-filled)
4. Wait for the capability chips to appear: `stream`, `ws`, `live`, `store`, `checkpointer`, `mcp`. These show what your graph supports.

Once connected, navigate to the **Chat** page (`/chat`), send a test message, and watch your agent's reply appear in real time. If your graph is working correctly in the terminal, it should work in the playground.

## The playground pages

The playground is organized into pages in a left navigation rail:

| Group | Page | Route | What it does |
|---|---|---|---|
| - | Connect | `/` | Add and test backend connections (required before using other pages) |
| Interact | Chat | `/chat` | Send messages and receive replies; choose between streaming, invoke, or WebSocket transport |
| Interact | Live | `/live` | Voice-to-voice sessions for realtime agents (Gemini live, Claude realtime, etc.) |
| Inspect | Thread Inspector | `/threads` | Browse saved threads, messages, and checkpointed state |
| Inspect | Observability | `/observability` | Trace spans, event timelines, and token cost for a run |
| Inspect | Evals | `/evals` | View evaluation runs and drill into individual cases |
| Inspect | Memory Inspector | `/memory` | Search and browse the memory store |
| Build | Graph | `/graph` | Render the compiled graph as a node-and-edge canvas with live node highlighting during runs |
| Build | Tools & MCP | `/tools` | List all tools the graph exposes, with sources and client-side tool authoring |
| Build | Files | `/files` | File upload (marked "Soon"; use the API or TypeScript client instead) |
| - | Settings | `/settings` | Saved connections and appearance preferences |

### Chat: turn-based testing

Send a message and watch the reply arrive. Use the transport selector to choose:

| Mode | Endpoint | When to use |
|---|---|---|
| `stream` (default) | `POST /v1/graph/stream` | See partial responses as they arrive; faster perceived feedback |
| `invoke` | `POST /v1/graph/invoke` | See the complete final response all at once |
| `ws` | `WS /v1/graph/ws` | Test the WebSocket transport |

Open the **Inspector** toggle in the connection bar to see the exact request (as a cURL command you can copy to a terminal), run details, and options like `initial_state` and `thread_id` for the next message.

Chat is turn-based, so it blocks realtime agents: if you connect a live graph, Chat shows a notice to use the Live page instead. Tool calls and their results appear inline in the message list.

### Live: voice sessions for realtime agents

A voice-to-voice session over `WS /v1/graph/live`, for agents rooted at a realtime model (Gemini live, Claude realtime, etc.). Press Start, then tap the mic to speak and tap again to stop your turn. The agent's reply plays back and both sides stream in as text.

Live requires two conditions to work:

1. An active connection (connect first from the Connect page)
2. A graph that reports `is_realtime: true` (from `GET /v1/graph`)

If either is missing, the page explains why rather than opening a socket the server would immediately close. For the same connection, Chat and Live are exclusive: connect a live agent and Chat shows a notice to use Live instead.

Build a realtime agent with [Use realtime audio](/docs/guides/use-realtime-audio).

### Inspect: thread, observability, evals, and memory

**Thread Inspector** lists all saved threads (if your graph has a checkpointer). Select one to see its messages, state, and checkpoint data in three tabs: Messages, State & checkpoint, and Raw JSON. Threads can be deleted from here.

**Observability** shows a span timeline (root → node → llm | tool), an event list, and token cost. Click any span or event to see details. Observability reads the active thread, so send a message in Chat first; with no runs recorded, it shows a placeholder.

**Evals** lists evaluation runs from the server with per-case drilldown, mirroring the output of `10xgraph eval` in the CLI.

**Memory Inspector** searches and browses the memory store (if configured on the server). Narrow results by memory type (episodic, semantic, procedural, entity, relationship, declarative, custom), pick a retrieval strategy and similarity metric, and open any memory record to see its full content.

### Build: graph, tools, and files

**Graph** renders the compiled graph from `GET /v1/graph` as a node-and-edge canvas. Select a node to see its details. An info pane shows graph-level facts (node count, edge count, checkpointer type, interrupt points, state type). While Chat is streaming a run, the currently executing node is highlighted, which makes routing and state machine bugs obvious.

**Tools & MCP** lists every tool the graph exposes, grouped by source: Python functions, MCP tools, or client-registered remote tools. You can also author a client-side tool here and register it against the backend to test the remote-tool loop without building a full app.

**Files** is a placeholder marked "Soon" in the rail; file upload is not wired up in the playground yet. Upload files over the API endpoint `POST /v1/files/upload` or with the TypeScript client (see [Files and multimodal](/docs/client/files-and-multimodal)).

## Customizing the playground command

### Use a different config file

If you have multiple `10xgraph.json` files (e.g., for dev vs staging), specify which one:

```bash
10xgraph play --config ./config/staging.json --port 8001
```

### Use a different host or port

By default, the playground listens on `127.0.0.1:8000`. To listen on a different address:

```bash
10xgraph play --host 0.0.0.0 --port 9000
```

Be aware that `0.0.0.0` exposes the server to your entire network and beyond if port-forwarded.

## Environment variables and secrets

The playground runs in your browser and does not have access to your local environment variables. All secrets (API keys, database URLs, etc.) must be available to your graph module when the server starts.

Configure secrets one of two ways:

**Option 1: set env vars before starting the server**

```bash
export GOOGLE_API_KEY=sk_...
export DATABASE_URL=postgresql://...
10xgraph play
```

Your graph module reads them at import time:

```python
# graph.py
import os
from tenxgraph import StateGraph, Agent

api_key = os.environ["GOOGLE_API_KEY"]
if not api_key:
    raise ValueError("GOOGLE_API_KEY not set")

agent = Agent(model="gemini-2.0-flash", api_key=api_key)
graph = StateGraph(...)
# ...
app = graph.compile()
```

**Option 2: pass secrets via dependency injection**

If your graph accepts a container from `InjectQ`, you can bind secrets in `10xgraph.json`:

```json
{
  "agent": "graph:app",
  "injectq": "auth:container"
}
```

Then your tools and nodes can inject them as needed.

## Stopping the playground

Press `Ctrl+C` in the terminal where `10xgraph play` is running to stop both the API server and the playground. The browser tab remains open but shows "Connection failed" since the API is no longer available.

## Comparing play, dev, and api commands

The `10xgraph play` command is one of three ways to run your API locally:

| Command | Starts API | Opens playground | Best for |
|---|---|---|---|
| `10xgraph play` | Yes | Yes, automatically | Quick interactive testing during development |
| `10xgraph dev` | Yes | Yes, on request | Goal-oriented local dev (same as play, slightly different UX) |
| `10xgraph api` | Yes | No | Server-only mode (CI, production, programmatic clients) |

All three start the same FastAPI server. The difference is whether the browser is opened and how.

## Sharing your agent with others

If you want others to test your agent in the playground:

1. Deploy your API to a public HTTPS endpoint (e.g., on a cloud provider)
2. Share the playground URL with the `backendUrl` query parameter:
   ```
   https://playground-463bd.web.app?backendUrl=https://your-api.example.com
   ```
3. Others can open this URL and test your agent in their browsers

The agent runs on your server, so make sure authentication is properly configured in your `10xgraph.json` `auth` field. See [Authentication](/docs/server/auth) for setup details.

## Troubleshooting

If the playground does not connect or load correctly, see [Playground Troubleshooting](/docs/troubleshooting/playground) for diagnosis steps. That page covers connection errors, browser security issues, feature availability gates, and verification checklists.

## Next steps

- **Test with tools**: Add tools to your graph and invoke them from the Chat page to confirm they work correctly
- **Check persistence**: Enable a checkpointer (`compile(checkpointer=...)`) and verify threads persist across server restarts in Thread Inspector
- **Trace execution**: Send a message, then open the Observability page to see the span timeline and token usage
- **Deploy**: Use `10xgraph build --docker-compose` to generate a Dockerfile and deploy to production

## Related pages

- [Run the API server](/docs/server/run-the-server)
- [Configure the server](/docs/server/configure)
- [Playground troubleshooting](/docs/troubleshooting/playground)
- [Create a client](/docs/client/create-client)

## Frequently asked questions

### Is the playground hosted locally or on the web?

The playground UI is hosted by 10xScale on the web. Your agent runs locally, and the browser communicates with your local API server via the backendUrl parameter. The playground never has access to your code or data; only network requests travel between your browser and your API.

### Can I use the playground in production?

No. The playground is designed for interactive development and testing. For production, expose your API directly or build a custom UI with the TypeScript client and your own frontend.

### How do I troubleshoot playground connection errors?

See the Playground Troubleshooting page for detailed diagnosis steps, including how to verify your API is running, check the backendUrl, and inspect browser and API logs.
