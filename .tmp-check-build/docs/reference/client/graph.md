# Graph control

> Reference for graph-control methods on the TypeScript client: ping, graph, graphTools, observability, graphStateSchema, stopGraph, and fixGraph.

Source: https://10xgraph.com/docs/reference/client/graph
Last updated: 2026-10-08

Seven methods on `AgentFlowClient` inspect the graph and control its execution. They check server health, retrieve the graph's topology, list available tools, fetch observability data for a run, return the state schema, and stop or repair a thread. All are imported from `@10xgraph/client` and called on a client instance.

| Method | Endpoint | Purpose |
|---|---|---|
| `ping()` | `GET /ping` | Verify server connectivity |
| `graph()` | `GET /v1/graph` | Get graph topology and capabilities |
| `graphTools()` | `GET /v1/graph/tools` | List available tools |
| `observability(threadId, runId?)` | `GET /v1/observability/{thread_id}` | Retrieve traces and metrics for a run |
| `graphStateSchema()` | `GET /v1/graph:StateSchema` | Get the state schema as JSON Schema |
| `stopGraph(threadId, config?)` | `POST /v1/graph/stop` | Request graph to halt execution |
| `fixGraph(threadId, config?)` | `POST /v1/graph/fix` | Repair thread with orphaned tool calls |

Every response follows the same envelope: the payload under `data`, and `{ request_id, timestamp, message }` under `metadata`.

---

## `ping()`

```ts
ping(): Promise<PingResponse>
```

Liveness check. Use it to fail fast at startup instead of discovering a bad `baseUrl` on the first `invoke()`.

```ts
// Response type for ping()
interface PingResponse {
  data: string;                 // the server's pong payload
  metadata: ResponseMetadata;
}
```

```ts
import { AgentFlowClient } from '@10xgraph/client';

const baseUrl = 'http://127.0.0.1:8000';
const client = new AgentFlowClient({ baseUrl });

// Fail fast at startup if the server is unreachable.
try {
  await client.ping();
} catch {
  throw new Error(`10xGraph API not reachable at ${baseUrl}`);
}
```

`ping()` does not require the graph to be healthy. It only proves the HTTP server is answering. Use `graph()` when you need to know the graph itself loaded.

---

## `graph()`

```ts
graph(): Promise<GraphResponse>
```

Returns the graph's topology and the server capabilities attached to it.

```ts
interface GraphResponse {
  data: {
    info: {
      node_count: number;
      edge_count: number;
      checkpointer: boolean;
      checkpointer_type: string;
      publisher: boolean;
      store: boolean;
      interrupt_before: string[];
      interrupt_after: string[];
      context_type: string;
      id_generator: string;
      id_type: string;
      state_type: string;
      state_fields: string[];
    };
    nodes: Array<{ id: string; name: string }>;
    edges: Array<{ id: string; source: string; target: string }>;
  };
  metadata: ResponseMetadata;
}
```

`info` is the honest answer to "what can this deployment do":

| Field | Why it matters |
|---|---|
| `checkpointer` / `checkpointer_type` | `false` means `config.thread_id` will not persist anything between calls. |
| `store` | `false` means the memory methods have no backend. |
| `interrupt_before` / `interrupt_after` | Node names where the graph pauses for human input. See `AgentState.execution_meta.interrupt` below. |
| `id_type` / `id_generator` | How thread and message ids are minted on this server. |
| `state_fields` | The field names of the graph's state type; `graphStateSchema()` returns their full schema. |

The server also returns `info.is_realtime`, which is `true` when the graph is rooted at a live agent and therefore accepts `realtime()` over `WS /v1/graph/live` rather than `invoke`/`stream`/`wsStream`. It is not on the `GraphInfo` TypeScript interface yet, so read it with a cast:

```ts
const { info } = (await client.graph()).data;
const liveCapable = Boolean((info as { is_realtime?: boolean }).is_realtime);
```

---

## `graphTools()`

```ts
graphTools(): Promise<GraphToolsResponse>
```

Lists every tool exposed by the graph's tool nodes, grouped by node, each tagged with where it came from.

```ts
type ToolSource = 'local' | 'mcp' | 'remote';

interface GraphTool {
  name: string;
  description: string;
  source: ToolSource;
  parameters: Record<string, any>;   // JSON Schema, OpenAI function-calling shape
}

interface GraphToolNode {
  node_name: string;
  tool_count: number;
  tools: GraphTool[];
}

interface GraphToolsResponse {
  data: {
    node_count: number;
    tool_count: number;
    nodes: GraphToolNode[];
  };
  metadata: ResponseMetadata;
}
```

| `source` | Origin |
|---|---|
| `local` | A Python function registered on the tool node. |
| `mcp` | Discovered from an MCP server attached to the node. |
| `remote` | Declared in server `10xgraph.json`, executed by a matching client handler. |

A graph with no tool nodes returns `nodes: []` and `tool_count: 0`. That is a valid graph, not an error.

See [graph-utilities](/docs/client/graph-utilities) for worked examples, including verifying that your remote tools registered.

---

## `observability(threadId, runId?)`

```ts
observability(threadId: string, runId?: string): Promise<ObservabilityResponse>
```

Returns the reconstructed trace for one run of a thread: a span tree, an event list, and aggregated token usage. Omitting `runId` returns the most recent run.

```ts
interface ObservabilityResponse {
  data: {
    thread_id: string;
    run_count: number;
    run_ids: string[];     // oldest first
    run: ObsRun | null;    // null when nothing has been recorded
  };
  metadata: ResponseMetadata;
}

interface ObsRun {
  run_id: string;
  thread_id: string;
  status: string;
  started_at: number | null;   // UNIX seconds
  finished_at: number | null;
  duration_ms: number;
  spans: ObsSpan[];
  events: ObsEvent[];
  usage: ObsTokenUsage;
  llm_calls: number;
  tool_calls: number;
  iterations: number;
}

interface ObsSpan {
  id: string;
  name: string;
  kind: 'root' | 'node' | 'llm' | 'tool';
  parent: string | null;       // span id; null for the root
  start_ms: number;            // offset from the run start
  duration_ms: number;
  model?: string | null;       // set on 'llm' spans
  input_tokens?: number | null;
  output_tokens?: number | null;
}

interface ObsEvent {
  id: string;
  type: string;
  node: string;
  offset_ms: number;           // offset from the run start
  summary: string;
}

interface ObsTokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
}
```

`threadId` is typed `string` here, unlike most thread methods which accept `string | number`.

Spans nest `root → node → llm | tool` via `parent`. `start_ms` and `offset_ms` are relative to the start of the run, so add `started_at * 1000` to place them on a wall clock.

A server with telemetry recording disabled returns `run_count: 0` and `run: null` instead of raising.

---

## `graphStateSchema()`

```ts
graphStateSchema(): Promise<StateSchemaResponse>
```

Returns the JSON Schema of the graph's state type. Use it to build dynamic forms, validate an `initial_state` before invoking, or generate types.

```ts
interface StateSchemaResponse {
  data: {
    title?: string;
    description?: string;
    type?: string;
    properties: Record<string, FieldSchema>;
    required?: string[];
    $defs?: Record<string, any>;
    [key: string]: any;
  };
  metadata: ResponseMetadata;
}

interface FieldSchema {
  type?: string | string[];
  description?: string;
  default?: any;
  items?: any;
  properties?: Record<string, FieldSchema>;
  required?: string[];
  enum?: any[];
  $ref?: string;
  $defs?: Record<string, any>;
  anyOf?: any[];
  allOf?: any[];
  oneOf?: any[];
  [key: string]: any;
}
```

This is the schema of the state type the graph is compiled with, which may be a subclass of `AgentState` carrying your own fields.

---

## `stopGraph(threadId, config?)`

```ts
stopGraph(threadId: string, config?: Record<string, any>): Promise<StopGraphResponse>
```

Sets a stop flag on the thread. The graph checks it between nodes and halts before starting the next one.

```ts
// Declared TypeScript type
interface StopGraphResponse {
  data: {
    success: boolean;
    message: string;
    thread_id: string;
    stopped_at?: string;   // ISO timestamp
  };
  metadata: ResponseMetadata;
}
```

The server currently fills `data` with the result of the core stop call instead: `{ ok: boolean, running?: boolean, reason?: string }`. `reason` is `"not-running"` when the thread exists but is idle, `"no-state"` when the thread has no state, and `"no-checkpointer"` when the graph has no checkpointer (stop needs one). Do not rely on `success`, `message` or `stopped_at`; check `data.ok` and `data.running` with a cast if you need the outcome.

It is a request, not a guarantee: the currently executing node runs to completion, so one more message may still arrive. Stopping a thread that is not running is not an error.

Breaking out of a `for await` loop over `stream()` closes your end of the connection but does not stop the graph. Call `stopGraph()` as well.

---

## `fixGraph(threadId, config?)`

```ts
fixGraph(threadId: string, config?: Record<string, any>): Promise<FixGraphResponse>
```

Repairs a thread by removing every message in its saved state that has a tool call with empty `content`, which can be left behind when a run is cut off mid-tool-call. Those leftovers can leave the thread stuck.

```ts
interface FixGraphResponse {
  data: {
    success: boolean;
    message: string;
    removed_count: number;
    state?: Record<string, any>;   // state after the repair, when available
  };
  metadata: ResponseMetadata;
}
```

`removed_count: 0` means no such messages were found. If the thread has no saved state, the server returns `success: false` with `removed_count: 0`.

---

## `AgentState`

`AgentState` is the state container the graph carries between nodes. It is returned by `invoke()` (as `result.state`), by `stream()` on `state` chunks, and by `threadState()`.

```ts
class AgentState {
  context: Message[];
  context_summary: string | null;
  execution_meta: ExecutionMeta;
}

interface ExecutionMeta {
  current_node: string;
  step: number;
  interrupt?: {
    node: string;
    reason: string;
    status: string;
    data?: Record<string, any>;
  };
  is_running: boolean;
  is_interrupted: boolean;
  is_stopped_requested: boolean;
}
```

| Field | Description |
|---|---|
| `context` | The conversation as the graph sees it: every `Message` currently in the working window. |
| `context_summary` | A rolling summary of messages trimmed out of `context`, or `null` when nothing has been summarized. |
| `execution_meta.current_node` | Node the graph is at. Starts at `'START'`. |
| `execution_meta.step` | Steps executed in this run. Compare against `recursion_limit`. |
| `execution_meta.interrupt` | Present only when the graph paused. This is how a client detects a human-in-the-loop pause. |
| `execution_meta.is_running` | `true` while the run is in flight. |
| `execution_meta.is_interrupted` | `true` when the graph is paused at an interrupt point. |
| `execution_meta.is_stopped_requested` | `true` after `stopGraph()` has been accepted but before the graph has halted. |

The constructor takes a partial object and `Object.assign`s it, so a graph compiled with a custom state type carries its extra fields through at runtime even though they are not on the TypeScript class. Read `graphStateSchema()` for the authoritative field list of a given deployment.

### Detecting a human-in-the-loop pause

An interrupt is not an error. The run ends normally and the state comes back paused:

```ts
import { AgentFlowClient, Message } from '@10xgraph/client';

const client = new AgentFlowClient({ baseUrl: 'http://127.0.0.1:8000' });

// Placeholder: replace with your own approval UI.
async function askUser(reason: string, data?: Record<string, any>): Promise<boolean> {
  console.log('Approval needed:', reason, data);
  return true;
}

const userMessage = Message.text_message('Delete the old reports', 'user');

const result = await client.invoke([userMessage], {
  config: { thread_id: 'approval-1' },
});

const interrupt = result.state?.execution_meta.interrupt;

if (interrupt) {
  // Show the approval UI. `data` carries whatever the node attached.
  const approved = await askUser(interrupt.reason, interrupt.data);

  // Resume by invoking the same thread again.
  await client.invoke([Message.text_message(approved ? 'approved' : 'rejected', 'user')], {
    config: { thread_id: 'approval-1' },
  });
}
```

`graph().data.info.interrupt_before` and `interrupt_after` tell you up front which nodes can pause, so a UI can be built for them before the first pause happens.

---

## What you learned

- `ping()` and `graph()` give you early feedback on server health and what the deployment supports.
- `graphTools()` shows what the model can actually call, tagged `local`, `mcp`, or `remote`.
- `observability()` reconstructs a run as spans and events with token usage, and `run_ids` lists all runs.
- `stopGraph()` halts execution cooperatively; `fixGraph()` removes messages with empty tool calls from a thread.
- `AgentState.execution_meta.interrupt` tells you when the graph is paused waiting for human input.

## Next step

See [graph-utilities](/docs/client/graph-utilities) for task-oriented recipes, or [remote-tools](/docs/client/remote-tools) for registering client-side tools that the server can invoke.
