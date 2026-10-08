---
title: Graph utilities and human-in-the-loop
description: "Inspect graph topology and state, stop execution, repair broken threads, view execution traces, and handle interrupts for human approval workflows."
section: TypeScript client
group: Features
order: 90
label: Graph utilities
updated: "2026-10-08"
---

The `10xgraph-client` TypeScript client exposes utility methods for inspecting graph metadata, controlling execution, repairing state, and handling human-in-the-loop workflows. Use these methods to build observability dashboards, debugging tools, and approval interfaces.

| Method | Purpose |
|---|---|
| `graph()` | Fetch graph topology, nodes, edges, and server capabilities. |
| `graphTools()` | List all tools each tool node exposes, tagged by source (local, MCP, remote). |
| `graphStateSchema()` | Fetch the JSON Schema describing all fields in the graph's state. |
| `observability(threadId, runId?)` | Reconstruct and fetch the execution trace: spans, events, and token usage. |
| `stopGraph(threadId)` | Signal a running graph to stop after the current node. |
| `fixGraph(threadId)` | Remove incomplete tool-call messages that may have broken a thread. |

## Prerequisites

- A configured `TenxGraphClient`. See [how-to/client/create-client](/docs/client/create-client).
- The 10xGraph API server running.

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

Fetches every tool the graph's tool nodes expose from `GET /v1/graph/tools`, grouped by node. Each tool carries a `source` tag that identifies where it comes from: a Python tool in the graph, an MCP server, or a client-side remote tool.

```ts
const result = await client.graphTools();

console.log(`${result.data.tool_count} tool(s) across ${result.data.node_count} node(s)`);

for (const node of result.data.nodes) {
  console.log(`\n${node.node_name} (${node.tool_count})`);
  for (const tool of node.tools) {
    console.log(`  [${tool.source}] ${tool.name}, ${tool.description}`);
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
| `remote` | Declared in server `10xgraph.json` and executed by a matching client handler. |

### Use case: confirm configured remote tools loaded

`graphTools()` reports what the graph offers the model. Check it after server startup:

```ts
client.registerToolHandler('get_location', async () => readGeolocation());

const { data } = await client.graphTools();
const remote = data.nodes
  .flatMap(n => n.tools)
  .filter(t => t.source === 'remote')
  .map(t => t.name);

if (!remote.includes('get_location')) {
  throw new Error('get_location is missing from 10xgraph.json');
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

Fetches the full JSON Schema of `AgentState` from `GET /v1/graph:StateSchema`. The schema describes every field in the graph's state type, useful for building dynamic forms, writing client-side validators, or understanding what data the graph tracks.

```ts
const result = await client.graphStateSchema();
const schema = result.data;

console.log('State title:', schema.title);

for (const [field, def] of Object.entries(schema.properties)) {
  console.log(`  ${field}: ${def.type}, ${def.description ?? '(no description)'}`);
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
  console.log(`run ${run.run_id}, ${run.status} in ${run.duration_ms}ms`);
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
- If the thread is not running, `success` may still be `true`, the server accepted the request but there was nothing to stop.

---

## fixGraph()

Removes incomplete tool-call messages from a thread's history via `POST /v1/graph/fix`. This is a recovery operation for threads that ended up in a broken state due to an interrupted execution, typically when the server was restarted mid-tool-call or when a network error cut a streaming connection.

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
    if (err instanceof TenxGraphError && err.errorCode.startsWith('GRAPH')) {
      console.warn('Graph error, attempting state repair...');
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

`fixGraph()` scans the thread's message history and removes any assistant messages that contain `ToolCallBlock` entries with no corresponding `ToolResultBlock`. These orphaned tool calls are what cause the graph to be "stuck", the LLM sees them and believes it is still waiting for tool results.

---

## Human-in-the-loop: checking and resuming after interrupts

Graph execution can be paused at designated nodes for human review or approval. When an interrupt occurs, the graph stops and stores the pause reason and node in the execution state. The client detects this via `execution_meta.interrupt` returned in stream chunks or state queries.

### Detecting an interrupt in a stream

When you stream execution, each chunk's `state?.execution_meta` field contains interrupt data if the graph has paused:

```ts
const stream = client.stream(
  [Message.text_message('Proceed with the high-cost operation.')],
  { config: { thread_id: 'approval-thread' } }
);

for await (const chunk of stream) {
  // Check if execution was paused at a node
  if (chunk.state?.execution_meta?.interrupt) {
    const { node, reason, status } = chunk.state.execution_meta.interrupt;
    console.log(`Paused at "${node}": ${reason} (${status})`);
    console.log('No further action required; graph is waiting.');
    break;
  }

  // Process normal streaming responses...
  if (chunk.event === 'message' && chunk.message?.content) {
    console.log('Response:', chunk.message.content);
  }
}
```

### Resuming after human approval

To resume execution after an interrupt, invoke the same thread again with a new user message. The graph resumes from the paused node, preserving all prior state and context:

```ts
// User reviews the decision and approves
const approval = await client.invoke(
  [Message.text_message('Approved. Proceed.')],
  { config: { thread_id: 'approval-thread' } }
);

console.log('Final result:', approval.messages[approval.messages.length - 1]);
```

### Querying interrupt status outside of streaming

Use `threadState()` to check if a thread is currently paused:

```ts
const state = await client.threadState('approval-thread');

if (state.data.execution_meta?.interrupt) {
  const { node, reason } = state.data.execution_meta.interrupt;
  console.log(`Thread paused at "${node}": ${reason}`);
} else {
  console.log('Thread is not paused.');
}
```

### Notes

- Interrupts are only possible if the graph was compiled with `interrupt_before` or `interrupt_after` configuration. Check `graph().data.info.interrupt_before` and `.interrupt_after` to see which nodes support pausing.
- Interrupted state is preserved in the checkpointer, so resumption is safe across server restarts.
- The `interrupt` object contains `node` (the name of the paused node), `reason` (human-readable message), `status` (e.g., `waiting`), and optional `data` (caller-provided context).
- After a paused graph resumes, the next invoke or stream call continues from the paused node and executes the remainder of the graph.

---

## Complete example: observability and approval dashboard

This example brings together graph inspection, execution monitoring, and interrupt handling:

```ts
import { TenxGraphClient, Message } from '10xgraph-client';

const client = new TenxGraphClient({ baseUrl: 'http://localhost:8000' });

async function runWithApprovalGate(threadId: string, userMessage: string) {
  // 1. Inspect the graph capabilities
  const graphInfo = await client.graph();
  console.log(`Graph: ${graphInfo.data.nodes.length} nodes, ` +
    `checkpointer: ${graphInfo.data.info.checkpointer_type || 'none'}`);

  const supportsApproval = graphInfo.data.info.interrupt_before.length > 0;
  console.log(`Approval gates available: ${supportsApproval}`);

  // 2. Stream the execution
  console.log(`\nExecuting on thread: ${threadId}`);
  const stream = client.stream(
    [Message.text_message(userMessage)],
    { config: { thread_id: threadId } }
  );

  let executionMeta = null;
  let finalMessages = [];

  for await (const chunk of stream) {
    // Check for interrupt (approval gate paused execution)
    if (chunk.state?.execution_meta?.interrupt) {
      const { node, reason } = chunk.state.execution_meta.interrupt;
      console.log(`\nExecution paused at "${node}"`);
      console.log(`Reason: ${reason}`);
      executionMeta = chunk.state.execution_meta;
      break;
    }

    // Accumulate messages and state
    if (chunk.event === 'message' && chunk.message?.content) {
      finalMessages.push(chunk.message);
    }
    if (chunk.state) {
      executionMeta = chunk.state.execution_meta;
    }
  }

  // 3. If paused, show observability and resume
  if (executionMeta?.interrupt) {
    const threadState = await client.threadState(threadId);
    const obs = await client.observability(threadId);

    console.log(`\nObservability: ${obs.data.run?.llm_calls || 0} LLM calls, ` +
      `${obs.data.run?.tool_calls || 0} tool calls, ` +
      `${obs.data.run?.duration_ms || 0}ms total`);

    console.log('\nWaiting for approval...');
    // In a real app, this would be a user button click or external webhook
    // For now, we simulate a 2-second approval delay
    await new Promise(r => setTimeout(r, 2000));

    console.log('Approval granted. Resuming...');
    const resumed = await client.invoke(
      [Message.text_message('Approved. Continue.')],
      { config: { thread_id: threadId } }
    );
    finalMessages.push(...resumed.messages);
  }

  return finalMessages;
}

// Run the example
runWithApprovalGate('approval-demo-123', 'Process this high-cost operation.')
  .then(msgs => console.log(`\nFinal: ${msgs.length} messages in thread`))
  .catch(console.error);
```

---

## Common errors and debugging

| Symptom | Cause | Solution |
|---|---|---|
| `stopGraph` returns `404` | Thread ID not found on the server. | Verify the `threadId` matches an active thread. Use `threads()` to list threads. |
| `fixGraph` returns `404` | Thread not found or the graph has no checkpointer. | Ensure the graph is compiled with a checkpointer and the thread has been invoked at least once. |
| `403` error on `stopGraph` or `fixGraph` | Caller lacks permission to modify the thread. | Check the `AuthorizationBackend` configured on the server; the caller may have read-only access. |
| `observability` returns `run: null` | No runs have been recorded for the thread, or telemetry is disabled. | Invoke the thread at least once to generate a run. Check the server's telemetry configuration. |
| Stream does not trigger interrupt even though `interrupt_before` is set | Interrupt logic is not configured in the graph or the paused node is unreachable. | Verify that `graph().data.info.interrupt_before` includes the expected node name. Ensure the graph's control flow reaches that node. |
| `graphTools` returns empty `nodes` array | The graph has no `ToolNode`s. | Not an error if the agent doesn't need external tools. Add a `ToolNode` if you expect to see tools. |
| `fixGraph` returns `removed_count: 0` | No orphaned tool calls found; the thread is already valid. | No action needed. The thread can proceed with the next invoke. |
