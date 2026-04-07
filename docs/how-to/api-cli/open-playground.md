---
title: Open the Playground
description: How to use agentflow play to start the API and open the hosted playground.
---

# Open the playground

`agentflow play` is a shortcut that starts the API server and opens the hosted playground in your browser in a single command.

## Start the playground

From the folder that contains `agentflow.json`:

```bash
agentflow play --host 127.0.0.1 --port 8000
```

The CLI:
1. Starts the same FastAPI server as `agentflow api`
2. Waits for the server to be reachable
3. Opens the hosted playground with a `backendUrl` query parameter pointing at your local API

Your graph runs locally. The hosted playground is a UI that sends requests to your local server.

## If the browser does not open

Copy the URL printed in the terminal and open it manually. It includes the `backendUrl` query parameter:

```
https://playground.agentflow.dev?backendUrl=http://127.0.0.1:8000
```

## Use a different config

```bash
agentflow play --config ./config/dev.json --port 8001
```

## What you can test in the playground

- Send messages and see the full response
- View which tools were called and what they returned
- Inspect raw message arrays including `tool` role messages
- Start new conversations (new `thread_id`) from the UI
- Test streaming vs non-streaming responses

## Stopping the playground

Press `Ctrl+C` in the terminal. This stops the API server. The hosted playground will lose its backend connection.

## Difference from agentflow api

`agentflow play` and `agentflow api` start identical servers. The only difference is that `agentflow play` opens the hosted playground automatically. Use `agentflow api` when you want the server without the browser.
