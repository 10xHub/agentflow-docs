---
title: How to use graph utilities — AgentFlow TypeScript Client
sidebar_label: Graph utilities
description: Guide to graph(), graphTools(), graphStateSchema(), observability(), stopGraph(), and fixGraph() — utility methods on AgentFlowClient for inspecting and controlling graph execution.
keywords:
  - agentflow typescript client
  - stop graph execution
  - fix graph state
  - state schema
  - graph utilities
  - agentflow
sidebar_position: 8
---


# How to use graph utilities

`AgentFlowClient` exposes six utility methods for inspecting and controlling the graph:

| Method | What it does |
|---|---|
| `graph()` | Fetch graph topology, node list, and server capabilities |
| `graphTools()` | List the tools each tool node exposes, tagged by source |
| `graphStateSchema()` | Fetch the JSON Schema of `AgentState` (the graph's state type) |
| `observability(threadId, runId?)` | Fetch the reconstructed trace for a run: spans, events, and token usage |
| `stopGraph(threadId)` | Signal a running graph to stop after the current node |
| `fixGraph(threadId)` | Remove broken tool-call messages from a thread's history |

## Prerequisites

- A configured `AgentFlowClient`. See [how-to/client/create-client](create-client.md).
- The AgentFlow API server running.

---

## graph()

Fetches the graph topology and server capabilities from `GET /v1/graph`. Use this to verify the server started correctly and to read metadata about the loaded graph.

```ts
const info = await client.graph();

const g = info.data;

// Topology
console.log('Nodes:', g.nodes.map(n => n.name));
console.log('Edges:', g.edges.length);

// Server capabilities
console.log('Checkpointer enabled:', g.info.checkpointer);
console.log('Checkpointer type:', g.info.checkpointer_type);
console.log('Memory store enabled:', g.info.store);
console.log('Publisher enabled:', g.info.publisher);

// State
console.log('State type:', g.info.state_type);
console.log('State fields:', g.info.state_fields);

// ID generation
console.log('ID type:', g.info.id_type);
console.log('ID generator:', g.info.id_generator);

// Interrupt configuration
console.log('Interrupt before:', g.info.interrupt_before);
console.log('Interrupt after:', g.info.interrupt_after);
```

### GraphResponse shape

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
  metadata: { request_id: string; timestamp: string; message: string };
}
```

### Common use: health check at startup

```ts
try {
  const info = await client.graph();
  console.log(`Graph ready: ${info.data.info.node_count} node(s), checkpointer=${info.data.info.checkpointer}`);
} catch (err) {
  console.error('Graph not reachable:', err);
  process.exit(1);
}
```

---

## graphTools()

Fetches every tool the graph's tool nodes expose from `GET /v1/graph/tools`, grouped by node. Each tool carries a `source` tag, so you can tell a locally defined Python tool from one discovered on an MCP server or one registered by a client via `setup()`.

```ts
const result = await client.graphTools();

console.log(`${result.data.tool_count} tool(s) across ${result.data.node_count} node(s)`);

for (const node of result.data.nodes) {
  console.log(`\n${node.node_name} (${node.tool_count})`);
  for (const tool of node.tools) {
    console.log(`  [${tool.source}] ${tool.name} — ${tool.description}`);
  }
}
```

### GraphToolsResponse shape

```ts
type ToolSource = 'local' | 'mcp' | 'remote';

interface GraphToolsResponse {
  data: {
    node_count: number;
    tool_count: number;
    nodes: Array<{
      node_name: string;
      tool_count: number;
      tools: Array<{
        name: string;
        description: string;
        source: ToolSource;
        parameters: Record<string, any>;   // JSON Schema, OpenAI function-calling shape
      }>;
    }>;
  };
  metadata: { request_id: string; timestamp: string; message: string };
}
```

| `source` | Meaning |
|---|---|
| `local` | A Python function registered on the tool node in your graph. |
| `mcp` | Discovered at runtime from an MCP server attached to the node. |
| `remote` | Registered by a client through `registerTool()` + `setup()`, and executed back on that client. |

### Use case: confirm your remote tools actually landed

`setup()` reports how many tools it registered, but `graphTools()` is what the graph will really offer the model. Check the two agree before you rely on a browser-side tool:

```ts
client.registerTool({
  node: 'TOOL',
  name: 'get_location',
  description: 'Read the browser geolocation',
  parameters: { type: 'object', properties: {}, required: [] },
  handler: async () => readGeolocation(),
});

await client.setup();

const { data } = await client.graphTools();
const remote = data.nodes
  .flatMap(n => n.tools)
  .filter(t => t.source === 'remote')
  .map(t => t.name);

if (!remote.includes('get_location')) {
  throw new Error('get_location did not register — did setup() run against this server?');
}
```

### Use case: render a capability list in a UI

```ts
const { data } = await client.graphTools();

const bySource = data.nodes
  .flatMap(n => n.tools)
  .reduce<Record<string, string[]>>((acc, t) => {
    (acc[t.source] ??= []).push(t.name);
    return acc;
  }, {});

// { local: ['search_docs'], mcp: ['create_issue', 'list_repos'], remote: ['get_location'] }
```

`graphTools()` returns an empty `nodes` array for a graph with no tool nodes. That is a valid graph, not an error.

---

## graphStateSchema()

Fetches the full JSON Schema of `AgentState` from `GET /v1/graph:StateSchema`. The schema describes every field in the graph's state type — useful for building dynamic forms, writing client-side validators, or understanding what data the graph tracks.

```ts
const result = await client.graphStateSchema();
const schema = result.data;

console.log('State title:', schema.title);

for (const [field, def] of Object.entries(schema.properties)) {
  console.log(`  ${field}: ${def.type} — ${def.description ?? '(no description)'}`);
}
```

### StateSchemaResponse shape

```ts
interface StateSchemaResponse {
  data: {
    title?: string;
    description?: string;
    type?: string;
    properties: Record<string, FieldSchema>;
    required?: string[];
    $defs?: Record<string, any>;
  };
  metadata: { request_id: string; timestamp: string; message: string };
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
  anyOf?: any[];
  [key: string]: any;
}
```

### Use case: generate a TypeScript interface at runtime

```ts
const result = await client.graphStateSchema();

for (const [field, def] of Object.entries(result.data.properties)) {
  const tsType = def.type === 'array'
    ? `${(def.items as any)?.type ?? 'any'}[]`
    : (def.type as string) ?? 'any';
  console.log(`  ${field}: ${tsType};`);
}
```

### Use case: validate initial_state before invoking

```ts
const schema = (await client.graphStateSchema()).data;
const required = schema.required ?? [];

const initialState = { user_id: 'abc' };
const missing = required.filter(f => !(f in initialState));

if (missing.length > 0) {
  throw new Error(`Missing required state fields: ${missing.join(', ')}`);
}

await client.invoke([Message.text_message('Hello')], { initial_state: initialState });
```

---

## observability()

Fetches the reconstructed execution trace for a thread from `GET /v1/observability/{thread_id}`. The server returns the most recent run by default; pass a `runId` to fetch a specific one. Use it to show a timeline, attribute latency to a node, or report token usage per run.

```ts
const result = await client.observability('thread-abc123');

const run = result.data.run;
if (!run) {
  console.log('No runs recorded for this thread yet.');
} else {
  console.log(`run ${run.run_id} — ${run.status} in ${run.duration_ms}ms`);
  console.log(`${run.llm_calls} LLM call(s), ${run.tool_calls} tool call(s), ${run.iterations} iteration(s)`);
  console.log('Tokens:', run.usage.total_tokens);

  for (const span of run.spans) {
    console.log(`  ${'  '.repeat(span.parent ? 1 : 0)}[${span.kind}] ${span.name} +${span.start_ms}ms (${span.duration_ms}ms)`);
  }
}
```

### ObservabilityResponse shape

```ts
interface ObservabilityResponse {
  data: {
    thread_id: string;
    run_count: number;
    run_ids: string[];
    run: ObsRun | null;     // the requested run, or the latest; null when nothing is recorded
  };
  metadata: { request_id: string; timestamp: string; message: string };
}

interface ObsRun {
  run_id: string;
  thread_id: string;
  status: string;             // e.g. 'done', 'error'
  started_at: number | null;  // UNIX seconds
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
  parent: string | null;      // span id, or null for the root
  start_ms: number;           // offset from the run start
  duration_ms: number;
  model?: string | null;      // set on 'llm' spans
  input_tokens?: number | null;
  output_tokens?: number | null;
}

interface ObsEvent {
  id: string;
  type: string;
  node: string;
  offset_ms: number;          // offset from the run start
  summary: string;
}

interface ObsTokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
}
```

A single run is returned per call, and omitting `runId` returns the **last** entry in `run_ids`. `run_ids` is ordered oldest first, so a run picker fetches the list once and then requests each run by id:

```ts
const { data } = await client.observability(threadId);

for (const runId of data.run_ids) {
  const detail = await client.observability(threadId, runId);
  console.log(runId, detail.data.run?.duration_ms, detail.data.run?.usage.total_tokens);
}
```

### Use case: find the slowest node in a run

```ts
const { data } = await client.observability(threadId);

const slowest = (data.run?.spans ?? [])
  .filter(s => s.kind === 'node')
  .sort((a, b) => b.duration_ms - a.duration_ms)[0];

if (slowest) {
  console.log(`Slowest node: ${slowest.name} (${slowest.duration_ms}ms)`);
}
```

### Notes

- Traces are reconstructed from what the server recorded during the run. A thread that has never been invoked, or a server with telemetry recording disabled, returns `run: null` and `run_count: 0` rather than an error.
- `start_ms` and `offset_ms` are offsets from the start of the run, not absolute timestamps. Add `started_at * 1000` to place them on a wall clock.
- Retention is bounded by the server's telemetry store, so old runs eventually drop out of `run_ids`.

---

## stopGraph()

Sends a stop signal to a running graph execution via `POST /v1/graph/stop`. The server sets a stop flag on the thread; the graph checks this flag after each node and halts before starting the next node.

```ts
const result = await client.stopGraph('thread-abc123');

console.log('Stop accepted:', result.data.success);
console.log('Message:', result.data.message);
console.log('Stopped at:', result.data.stopped_at);
```

### StopGraphResponse shape

```ts
interface StopGraphResponse {
  data: {
    success: boolean;
    message: string;
    thread_id: string;
    stopped_at?: string;  // ISO timestamp
  };
  metadata: ResponseMetadata;
}
```

### Stopping a stream in progress

The most common pattern: a user clicks a stop button while a stream is running.

```ts
let threadId: string | undefined;

const stream = client.stream(
  [Message.text_message('Write a very long essay about the universe.')],
  { config: { thread_id: 'long-thread' } }
);

let stopped = false;

document.getElementById('stop-btn')!.addEventListener('click', async () => {
  stopped = true;
  if (threadId) {
    await client.stopGraph(threadId);
  }
});

for await (const chunk of stream) {
  if (stopped) break;

  if (chunk.thread_id) {
    threadId = chunk.thread_id;
  }

  if (chunk.event === 'message' && chunk.message?.delta) {
    const text = chunk.message.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text as string)
      .join('');
    appendToUI(text);
  }
}
```

### Notes

- `stopGraph()` is a request, not a guarantee. The graph processes the flag between nodes, so it may produce one more response message before stopping.
- After stopping, the thread state is preserved. The next `invoke()` or `stream()` call on the same `thread_id` starts from where execution was when the stop flag was checked.
- If the thread is not running, `success` may still be `true` — the server accepted the request but there was nothing to stop.

---

## fixGraph()

Removes incomplete tool-call messages from a thread's history via `POST /v1/graph/fix`. This is a recovery operation for threads that ended up in a broken state due to an interrupted execution — typically when the server was restarted mid-tool-call or when a network error cut a streaming connection.

```ts
const result = await client.fixGraph('thread-abc123');

console.log('Fix successful:', result.data.success);
console.log('Messages removed:', result.data.removed_count);
```

### FixGraphResponse shape

```ts
interface FixGraphResponse {
  data: {
    success: boolean;
    message: string;
    removed_count: number;
    state?: Record<string, any>;  // Updated state after fix, if available
  };
  metadata: ResponseMetadata;
}
```

### When to call fixGraph()

Call `fixGraph()` when a thread gets stuck after an interrupted execution. The symptom is a `GRAPH_ERROR` or the graph refusing to accept new messages on a thread. The root cause is an assistant message with a `ToolCallBlock` that has no corresponding `ToolResultBlock`.

```ts
async function invokeWithRecovery(threadId: string, message: string) {
  try {
    return await client.invoke(
      [Message.text_message(message)],
      { config: { thread_id: threadId } }
    );
  } catch (err) {
    if (err instanceof AgentFlowError && err.errorCode.startsWith('GRAPH')) {
      console.warn('Graph error — attempting state repair...');
      const fix = await client.fixGraph(threadId);
      console.log(`Removed ${fix.data.removed_count} broken message(s). Retrying.`);

      // Retry once after the fix
      return await client.invoke(
        [Message.text_message(message)],
        { config: { thread_id: threadId } }
      );
    }
    throw err;
  }
}
```

### How it works

`fixGraph()` scans the thread's message history and removes any assistant messages that contain `ToolCallBlock` entries with no corresponding `ToolResultBlock`. These orphaned tool calls are what cause the graph to be "stuck" — the LLM sees them and believes it is still waiting for tool results.

---

## Complete example: graph health dashboard

```ts
import { AgentFlowClient, AgentFlowError } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

async function printGraphDashboard() {
  // 1. Topology
  const graphInfo = await client.graph();
  const g = graphInfo.data;
  console.log('=== Graph ===');
  console.log('Nodes:', g.nodes.map(n => n.name).join(', '));
  console.log('Checkpointer:', g.info.checkpointer ? g.info.checkpointer_type : 'none');
  console.log('Store:', g.info.store);

  // 2. State schema
  const schemaInfo = await client.graphStateSchema();
  const fields = Object.keys(schemaInfo.data.properties);
  console.log('\n=== State fields ===');
  console.log(fields.join(', '));

  // 3. Optional: repair a broken thread
  const brokenThread = process.env.BROKEN_THREAD;
  if (brokenThread) {
    console.log('\n=== Repairing thread:', brokenThread, '===');
    const fix = await client.fixGraph(brokenThread);
    console.log('Removed messages:', fix.data.removed_count);
    console.log('Success:', fix.data.success);
  }
}

printGraphDashboard().catch(console.error);
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AgentFlowError` status `404` on `stopGraph` | Thread not found. | Verify the `threadId`. |
| `AgentFlowError` status `404` on `fixGraph` | Thread not found or no checkpointer configured. | Check `agentflow.json` for a checkpointer. |
| `AgentFlowError` status `403` | Caller does not have permission to stop/fix this thread. | Check the `AuthorizationBackend` on the server. |
| `fixGraph` returns `removed_count: 0` | Thread was already in a valid state. | No action needed. |
| `graphTools` returns an empty `nodes` array | The graph has no tool nodes. | Not an error. Add a `ToolNode` if the agent is meant to call tools. |
| `observability` returns `run: null` | The thread has no recorded runs, or telemetry recording is off on the server. | Invoke the thread once, and check the server's telemetry configuration. |
