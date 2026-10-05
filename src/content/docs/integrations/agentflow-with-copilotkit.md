---
title: "10xGraph with CopilotKit: Serve Your Agent over AG-UI"
seoTitle: "10xGraph with CopilotKit over AG-UI"
description: "Turn on the AG-UI endpoint in the 10xGraph API server and connect a CopilotKit frontend, with streaming chat, tool calls, frontend tools, and shared state."
section: Learn more
group: Integrations
order: 2060
label: with CopilotKit (AG-UI)
updated: "2026-09-29"
---

[AG-UI](https://docs.ag-ui.com) is an open event protocol between an agent backend and a
frontend. `agentflow-api` can serve your graph over AG-UI, so any AG-UI client, including
[CopilotKit](https://docs.copilotkit.ai), can use it through CopilotKit's generic `HttpAgent`.
No CopilotKit-specific integration is involved: the translation happens in your 10xGraph server.

The endpoint is off by default.

## Architecture

```
[ Browser: CopilotKit React ]
          │
          ▼
[ Next.js: CopilotRuntime + HttpAgent ]   (/api/copilotkit)
          │  POST RunAgentInput, SSE of AG-UI events
          ▼
[ agentflow-api ]  POST /v1/ag-ui
          │
          ▼
[ Your StateGraph + checkpointer ]
```

## 1. Turn the endpoint on

Install the extra:

```bash
pip install "10xscale-agentflow-cli[ag-ui]"
```

Enable it in `agentflow.json`:

```json
{
  "agent": "graph.agent:app",
  "ag_ui": { "enabled": true }
}
```

Start the server as usual (`agentflow api`). `POST /v1/ag-ui` is now mounted. With the key absent
or `"enabled": false` the route does not exist. See [`ag_ui`](/docs/reference/api-cli/configuration#websocket-ag_ui-and-observability).

Check it with curl:

```bash
curl -N http://127.0.0.1:8000/v1/ag-ui \
  -H 'content-type: application/json' \
  -d '{"threadId": "t1", "runId": "r1",
       "messages": [{"id": "u1", "role": "user", "content": "hello"}]}'
```

The response is a stream of `data: {...}` lines, starting with `RUN_STARTED` and ending with
`RUN_FINISHED` (or `RUN_ERROR`).

## 2. Connect CopilotKit

Tested with CopilotKit `1.75.0` and Next.js `16`.

```bash
npm install @copilotkit/react-core @copilotkit/runtime @ag-ui/client zod
```

Route handler, pointing an `HttpAgent` at the 10xGraph endpoint:

```ts
// app/api/copilotkit/[[...slug]]/route.ts
import { HttpAgent } from "@ag-ui/client";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";

const runtime = new CopilotRuntime({
  agents: {
    agentflow: new HttpAgent({ url: "http://127.0.0.1:8000/v1/ag-ui" }),
  },
  runner: new InMemoryAgentRunner(),
});

const handler = createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit" });

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
```

Page:

```tsx
// app/page.tsx
"use client";

import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

export default function Page() {
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" agentId="agentflow">
      <CopilotChat agentId="agentflow" />
    </CopilotKitProvider>
  );
}
```

If your API uses auth, pass the token from the route handler with `HttpAgent`'s `headers`
option, so it never reaches the browser.

## What maps to what

| 10xGraph | AG-UI |
| --- | --- |
| Run start / end | `RUN_STARTED` / `RUN_FINISHED` |
| Node start / end | `STEP_STARTED` / `STEP_FINISHED` (node name) |
| Assistant text (streamed deltas or a whole message) | `TEXT_MESSAGE_START` / `CONTENT` / `END` |
| Reasoning blocks | `REASONING_START` ... `REASONING_END` |
| Tool calls from the model | `TOOL_CALL_START` / `ARGS` / `END` |
| Server tool results | `TOOL_CALL_RESULT` |
| A failed tool | `TOOL_CALL_RESULT` with the error, and the run continues |
| A browser tool call | `TOOL_CALL_*`, then `RUN_FINISHED` with the call unanswered |
| `interrupt()` | `RUN_FINISHED` with `outcome: {type: "interrupt", interrupts: [...]}` |
| Application state fields | `STATE_SNAPSHOT` (only fields you add to `AgentState`, not messages) |
| Graph error | `RUN_ERROR` |

## Threads and history

AG-UI's `threadId` is the 10xGraph thread. CopilotKit sends the whole conversation on every run,
but the checkpointer already holds it, so 10xGraph only passes the graph what is new: the
latest user message, or the tool results that answer a pending frontend tool call. Messages the
client says came from the assistant, system, or developer are ignored; the checkpoint is the
record of what the model said and was told.

Use a persistent checkpointer (Postgres, SQLite) if threads must survive a server restart.

## Frontend tools

Register a tool in the browser with `useFrontendTool`. Nothing is needed on the server:
CopilotKit sends its tools with every run, and 10xGraph offers them to the model for that run.

```tsx
import { useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

useFrontendTool({
  name: "change_background",
  description: "Change the page background color.",
  parameters: z.object({ color: z.string() }),
  handler: async ({ color }) => {
    document.body.style.background = color;
    return `background is now ${color}`;
  },
});
```

The graph needs a `ToolNode` (the one your `Agent` uses): browser tools are added to its tool
list for the run, and a call to one is handed back to the browser instead of running on the
server. When the model calls it, the run ends with the tool call unanswered. CopilotKit runs the
handler and starts a new run on the same thread with the result, and the graph continues after
the tool node. Server tools called in the same step still run and are kept.

A browser tool never replaces a server tool: if the `ToolNode` already has a tool with that name,
the browser's is ignored (and logged). Tools declared under
[`remote_tools`](/docs/reference/api-cli/configuration#remote_tools) in `agentflow.json` keep
working as before.

## Approvals with interrupt()

Call [`interrupt()`](/docs/how-to/python/add-human-approval) in a node or tool to ask the user
something. The run ends with an AG-UI `interrupt` outcome, and CopilotKit's `useInterrupt`
renders the question:

```python
from agentflow.utils import interrupt

async def refund(amount: int) -> str:
    """Refund an order, after a human approves it."""
    decision = interrupt(
        {"amount": amount},
        message=f"Approve a refund of ${amount}?",
        reason="tool_approval",
    )
    if decision and decision.get("approved"):
        return f"refunded ${amount}"
    return "refund declined"
```

```tsx
import { useInterrupt } from "@copilotkit/react-core/v2";

useInterrupt({
  render: ({ interrupt, resolve, cancel }) => (
    <div>
      <p>{interrupt?.message}</p>
      <button onClick={() => resolve({ approved: true })}>Approve</button>
      <button onClick={() => resolve({ approved: false })}>Reject</button>
      <button onClick={() => cancel()}>Dismiss</button>
    </div>
  ),
});
```

How the pieces map:

| 10xGraph `interrupt()` | AG-UI `Interrupt` |
| --- | --- |
| generated id | `id` (echoed back as `resume[].interruptId`) |
| `reason` | `reason` |
| `message` | `message` |
| `response_schema` | `responseSchema` |
| tool call it ran in | `toolCallId` |
| `value` and node name | `metadata.value`, `metadata.node` |

`resolve(payload)` resumes the graph and `interrupt()` returns `payload`; `cancel()` resumes it
with `None`. While a thread is paused, a run that does not answer the interrupt (for example a
new chat message) reports the same interrupt again without running the graph. A `resume` for a
different interrupt id ends the run with `RUN_ERROR`.

## Shared state

Fields you add to your state class are sent as `STATE_SNAPSHOT` whenever they change, and read on
the frontend with `useAgent`:

```python
class AppState(AgentState):
    city: str = ""
```

```tsx
const { agent } = useAgent({ agentId: "agentflow" });
const city = (agent.state as { city?: string }).city;
```

State the client sends in `RunAgentInput.state` becomes the run's initial state. The
`context`, `context_summary`, and `execution_meta` keys are ignored.

## Frontend context

`RunAgentInput.context`, `tools`, and `forwardedProps` are available to your nodes and tools as
`config["ag_ui"]`:

```python
async def main_node(state: AgentState, config: dict):
    frontend_context = config.get("ag_ui", {}).get("context", [])
```

## Not supported yet

- **`MESSAGES_SNAPSHOT`.** The endpoint does not send the checkpoint's messages back, so
  reloading an old thread in the browser depends on the client's own storage.
