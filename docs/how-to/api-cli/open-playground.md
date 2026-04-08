---
title: Open the Playground
description: How to use agentflow play to start the API and open the hosted playground.
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

## Browser UI overview

Once the playground loads, you see:

- **Thread list** (left sidebar) — All conversations for this agent. Start a new conversation by clicking "New Thread".
- **Messages panel** (center) — Send a message and see the full exchange, including tool calls and system messages.
- **Details panel** (right) — View the agent's internal state, node execution details, and response metadata.

### Sending a test message

1. Ensure the playground is connected (the connection indicator should show green)
2. Type a message in the text field
3. Press Enter or click Send
4. Watch the agent respond in real-time (or see a streaming response if your graph uses streaming)

### Viewing tool calls

If your agent uses tools, you see them in the message history:

- **User message** — Your input
- **Assistant message** — Agent reasoning (if included in your response)
- **Tool message(s)** — Tool calls and their results, displayed as a sequence
- **Final assistant response** — The agent's conclusion

Expand each tool call to see:
- Tool name
- Arguments passed
- Output/result
- Execution time

### Starting new conversations

Click "New Thread" in the left sidebar to start a separate conversation with a new `thread_id`. Each thread:
- Has its own message history
- Can be named (editable in the UI)
- Is persisted if a checkpointer is configured in `agentflow.json`

## Advanced playground features

### Streaming responses

If your graph supports streaming via `POST /v1/graph/stream`, the playground shows streaming chunks in real-time as they arrive. You see partial responses building up, which is useful for long-running agent tasks.

### State inspection

Click the "State" tab in the details panel to see the full Python state dict at each checkpoint. This is invaluable for debugging state transitions.

### Response granularity

You can adjust the response granularity (how much detail you get back) if your graph supports it. See [reference](../../reference/rest-api/graph.md) for details.

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
| **Default host** | 127.0.0.1 (localhost) | 0.0.0.0 (all interfaces) |

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
