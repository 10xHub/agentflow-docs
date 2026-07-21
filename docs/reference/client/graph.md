---
title: "Graph control — AgentFlow Python AI Agent Framework"
sidebar_label: "Graph control"
description: Reference for the graph-control methods on AgentFlowClient — ping, graph, graphTools, observability, graphStateSchema, stopGraph, fixGraph, and setup — plus the AgentState shape.
keywords:
  - typescript client reference
  - agent client api
  - agentflow client sdk
  - agentflow
  - python ai agent framework
  - graph control
sidebar_position: 2.5
---


# Graph control

Eight methods on `AgentFlowClient` describe or control the graph itself rather than a single conversation: what the graph is, what tools it has, what its state looks like, what a run did, and how to stop or repair one.

**Source:** `src/client.ts`, `src/endpoints/`

| Method | Endpoint | Returns |
|---|---|---|
| `ping()` | `GET /ping` | `Promise<PingResponse>` |
| `graph()` | `GET /v1/graph` | `Promise<GraphResponse>` |
| `graphTools()` | `GET /v1/graph/tools` | `Promise<GraphToolsResponse>` |
| `observability(threadId, runId?)` | `GET /v1/observability/{thread_id}` | `Promise<ObservabilityResponse>` |
| `graphStateSchema()` | `GET /v1/graph:StateSchema` | `Promise<StateSchemaResponse>` |
| `stopGraph(threadId, config?)` | `POST /v1/graph/stop` | `Promise<StopGraphResponse>` |
| `fixGraph(threadId, config?)` | `POST /v1/graph/fix` | `Promise<FixGraphResponse>` |
| `setup()` | `POST /v1/graph/setup` | `Promise<SetupGraphResponse>` |

Every response follows the same envelope: the payload under `data`, and `{ request_id, timestamp, message }` under `metadata`.

---

## `ping()`

```ts
ping(): Promise<PingResponse>
```

Liveness check. Use it to fail fast at startup instead of discovering a bad `baseUrl` on the first `invoke()`.

```ts
interface PingResponse {
  data: string;                 // the server's pong payload
  metadata: ResponseMetadata;
}
```

```ts
try {
  await client.ping();
} catch {
  throw new Error(`AgentFlow API not reachable at ${baseUrl}`);
}
```

`ping()` does not require the graph to be healthy — it only proves the HTTP server is answering. Use `graph()` when you need to know the graph itself loaded.

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
| `remote` | Registered by a client via `registerTool()` and `setup()`, executed back on that client. |

A graph with no tool nodes returns `nodes: []` and `tool_count: 0`. That is a valid graph, not an error.

See [how-to/client/graph-utilities](../../how-to/client/graph-utilities.md) for worked examples, including verifying that your remote tools registered.

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

It is a request, not a guarantee: the currently executing node runs to completion, so one more message may still arrive. Thread state is preserved, so the next call on the same `thread_id` resumes from where the flag was checked. Stopping a thread that is not running is not an error — `success` can still be `true`.

Breaking out of a `for await` loop over `stream()` closes your end of the connection but does not stop the graph. Call `stopGraph()` as well.

---

## `fixGraph(threadId, config?)`

```ts
fixGraph(threadId: string, config?: Record<string, any>): Promise<FixGraphResponse>
```

Repairs a thread whose history contains tool calls with no matching results, which happens when a run is cut off mid-tool-call. The LLM sees the orphaned calls and believes it is still waiting, so the thread appears stuck.

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

`removed_count: 0` means the thread was already valid.

---

## `setup()`

```ts
setup(): Promise<SetupGraphResponse>
```

Sends every tool registered with `registerTool()` to the server, so the graph knows those tools exist and can ask this client to execute them.

```ts
interface RemoteTool {
  node_name: string;                 // from registration.node
  name: string;
  description: string;               // '' when the registration omitted it
  parameters: Record<string, any>;   // {} when the registration omitted it
}

interface SetupGraphResponse {
  data: {
    success: boolean;
    message: string;
    registered_tools?: number;
  };
  metadata: ResponseMetadata;
}
```

Call `setup()` after all `registerTool()` calls and before the first `invoke()`, `stream()`, or `wsStream()`. Registration is per connection, so a new client instance must call it again. `setup()` sends only the schema — the handler function stays in your process, which is the point.

`setup()` does not use `toolExecutor.all_tools()`; see [`reference/client/tools`](tools.md).

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
const result = await client.invoke([userMessage], {
  config: { thread_id: 'approval-1' },
});

const interrupt = result.state?.execution_meta.interrupt;

if (interrupt) {
  // Show the approval UI. `data` carries whatever the node attached.
  const approved = await askUser(interrupt.reason, interrupt.data);

  // Resume by invoking the same thread again.
  await client.invoke([Message.text_message(approved ? 'approved' : 'rejected')], {
    config: { thread_id: 'approval-1' },
  });
}
```

`graph().data.info.interrupt_before` and `interrupt_after` tell you up front which nodes can pause, so a UI can be built for them before the first pause happens.

---

## What you learned

- `ping()` proves the server answers; `graph()` proves the graph loaded and reports what the deployment supports.
- `graphTools()` shows what the model can actually call, tagged `local`, `mcp`, or `remote`.
- `observability()` returns one run at a time as a span tree plus token usage; `run_ids` lists the rest.
- `stopGraph()` is cooperative and `fixGraph()` repairs orphaned tool calls.
- `setup()` transmits the schemas of your client-side tools; handlers never leave your process.
- `AgentState.execution_meta.interrupt` is how a client detects that the graph is waiting on a human.

## Next step

See [how-to/client/graph-utilities](../../how-to/client/graph-utilities.md) for task-oriented recipes, or [`reference/client/tools`](tools.md) for registering the client-side tools that `setup()` transmits.
