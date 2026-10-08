---
title: Serve your agent over AG-UI
seoTitle: "Serve a 10xGraph agent over AG-UI (CopilotKit)"
description: "Turn on the AG-UI endpoint in the 10xGraph API server, test it with curl, connect CopilotKit or another AG-UI client, and lock it down for production."
section: How-to guides
group: CLI
order: 915
label: Serve over AG-UI
updated: "2026-10-08"
faq:
  - q: Do I need AG-UI to build a frontend for 10xGraph?
    a: No. The TypeScript client talks to /v1/graph/stream directly. Use AG-UI when your frontend already speaks it, for example CopilotKit.
  - q: Why does POST /v1/ag-ui return 404?
    a: The endpoint is off by default. Set "ag_ui" to {"enabled" true} in 10xgraph.json, install the ag-ui extra, and restart the server.
---

The API server can speak [AG-UI](https://docs.ag-ui.com), an open event protocol between agent backends and chat frontends. Turn it on when your frontend is an AG-UI client, such as CopilotKit. If you are writing your own frontend, the [TypeScript client](/docs/concepts/connecting-clients) over `/v1/graph/stream` is the simpler path.

This guide covers the server side. For the CopilotKit React code, see [10xGraph with CopilotKit](/docs/integrations/agentflow-with-copilotkit). For every field and event, see the [AG-UI endpoint reference](/docs/reference/rest-api/ag-ui).

## 1. Install the extra

```bash
pip install "10xgraph-api[ag-ui]"
```

## 2. Enable the endpoint

Add `ag_ui` to `10xgraph.json`:

```json
{
  "agent": "graph.agent:app",
  "ag_ui": { "enabled": true }
}
```

Start the server:

```bash
10xgraph api
```

`POST /v1/ag-ui` is now mounted and appears in Swagger at `/docs` under the **AG-UI** tag. If you enabled it without installing the extra, the server stops at startup and prints the install command.

## 3. Test it with curl

```bash
curl -N http://127.0.0.1:8000/v1/ag-ui \
  -H 'content-type: application/json' \
  -d '{"threadId": "t1", "runId": "r1",
       "messages": [{"id": "u1", "role": "user", "content": "hello"}]}'
```

You should see `data: {...}` lines, starting with `RUN_STARTED` and ending with `RUN_FINISHED`. If auth is on, add `-H "authorization: Bearer $TOKEN"`.

| You see | Meaning |
| --- | --- |
| `RUN_STARTED` ... `RUN_FINISHED` | Working |
| `404` | `ag_ui.enabled` is not `true`, or the server was not restarted |
| `401` or `403` | Auth is on and the token is missing, invalid, or not allowed for this thread |
| `422` | The body is not a valid `RunAgentInput`. `threadId`, `runId` and `messages` are required |
| `RUN_ERROR` in the stream | The run started and then failed. Check the server log |

## 4. Connect the frontend

Point an AG-UI `HttpAgent` at the endpoint. With CopilotKit this lives in a Next.js route handler, so the browser talks to Next.js and Next.js talks to 10xGraph:

```ts
import { HttpAgent } from "@ag-ui/client";

const agent = new HttpAgent({
  url: process.env.TENXGRAPH_API_URL + "/v1/ag-ui",
  headers: { Authorization: `Bearer ${process.env.TENXGRAPH_API_TOKEN}` },
});
```

Because the call is made on the server, the token never reaches the browser and you do not need to open CORS for the frontend's origin. The full route handler and page are in [10xGraph with CopilotKit](/docs/integrations/agentflow-with-copilotkit).

## 5. Get it ready for production

The endpoint is mounted in every `MODE` once enabled, so treat it like `/v1/graph/stream`:

- **Compile the graph with a persistent checkpointer** (Postgres or SQLite). AG-UI's `threadId` is the 10xGraph thread, and the server reads the checkpoint to work out which messages are new. With an in-memory checkpointer, threads are lost on restart and are not shared between replicas. See [Checkpointing](/docs/how-to/production/checkpointing).
- **Turn on auth.** With `"auth": "jwt"` or a custom backend, every run needs a token, and the server checks that the caller may access the `threadId`. In production the authorization backend defaults to `ownership`, so one user cannot continue another user's thread. See [Auth and authorization](/docs/how-to/production/auth-and-authorization).
- **Decide on browser tools.** By default the model is offered the tools the client sends with each run. They run in the user's browser, cannot replace a server tool, and are size-checked. If you do not use them, set `"allow_client_tools": false` so only tools declared under `remote_tools` are offered:

  ```json
  "ag_ui": { "enabled": true, "allow_client_tools": false }
  ```

- **Rate limit it.** The route counts against [`rate_limit`](/docs/how-to/api-cli/configure-rate-limiting) like any other path. Use the `redis` backend when you run more than one replica.
- **Keep the stream unbuffered.** The response already sends `X-Accel-Buffering: no` for nginx. On other proxies and load balancers, turn off response buffering for `/v1/ag-ui` and set the idle timeout longer than your slowest run.

## Related

- [AG-UI endpoint reference](/docs/reference/rest-api/ag-ui): request fields, events, interrupts and error codes
- [10xGraph with CopilotKit](/docs/integrations/agentflow-with-copilotkit): frontend tools, approvals with `interrupt()`, shared state
- [`ag_ui` configuration keys](/docs/reference/api-cli/configuration#websocket-ag_ui-and-observability)
