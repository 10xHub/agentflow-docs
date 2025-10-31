# Graph Architecture

Agentflow's graph system orchestrates agent reasoning, tool execution, and stateful message flow. It is intentionally
minimal, composable, and DI-friendly. This section is your conceptual map.

---

## Core Building Blocks

| Concept | File(s) | Role |
|---------|---------|------|
| `StateGraph` | `agentflow/graph/state_graph.py` | Declarative builder: register nodes, edges, tools, conditions |
| `Node` | `agentflow/graph/node.py` | Wrapper around user function (sync/async) with DI injection |
| `ToolNode` | `agentflow/graph/tool_node/` | Tool registry + dispatcher (local + external providers) |
| `Edge` | `agentflow/graph/edge.py` | Directional link; supports conditional routing |
| `CompiledGraph` | `agentflow/graph/compiled_graph.py` | Runtime engine: invoke, stream, checkpoint, publish |
| `Command` | `agentflow/utils/command.py` | Inline control object for dynamic goto / updates |
| **Interrupts & HITL** | Compile options + runtime API | Pause/resume execution for human approval, debugging, external control |

Supporting utilities: converters (LLM output → `Message` blocks), id + thread generators, background task manager,
callback + publisher subsystems.

---

## Lifecycle at a Glance

1. **Build**: create `StateGraph`, add nodes & edges
2. **Configure**: set entry point, optionally conditional edges, tool nodes
3. **Compile**: dependency container frozen, checkpointer/publisher bound, internal handlers instantiated, interrupt points defined
4. **Execute**: `invoke()` (batch) or `stream()/astream()` (incremental)
5. **Persist / Publish**: events & state snapshots emitted, usage + tool calls recorded
6. **Human-in-the-Loop**: interrupted runs can pause for approval; stop flags honored mid-execution; resume with same thread_id

---

## Node Function Contract

A node function usually:

```python
async def my_node(state: AgentState, config: dict, ...injected_deps) -> State | list[Message] | Command | ModelResponseConverter:
    ...logic...
    return [...]
```

Return types supported:

- `list[Message]` – append messages to context
- `AgentState` (or subclass) – full state replacement/merge
- `Command` – state/message update + jump target
- `ModelResponseConverter` – deferred LLM response normalisation
- `None` – treated as no-op

Tool nodes share the same return semantics but are triggered by tool call entries in an assistant message.

---

## Design Principles

- **Explicit over magic** – You wire nodes and edges; runtime doesn't infer hidden transitions.
- **State-first** – All decisions emerge from `AgentState`. Determinism improves testing & resuming.
- **Pluggable IO** – Checkpointers, stores, publishers, ID generators, tools all injectable.
- **Provider-agnostic** – LLM specifics isolated in converters; tool registries abstract away host APIs.
- **Composable** – Future nested graphs and higher-order agents (routers, supervisors) build on same primitives.

---

## Quick Mental Model

Think of the graph as an event loop over a mutable state object:

```
while not done:
  node = current_node()
  output = run(node, state)
  apply(output)
  advance()
```

Where `apply()` merges messages, updates metadata, handles `Command` jumps, and triggers tool execution when tool call
blocks are present.

---

## Where to Next?

Dive deeper:

- Nodes & Return Types (`nodes.md`)
- Control Flow & Edges (`control_flow.md`)
- Human-in-the-Loop & Interrupts (`human-in-the-loop.md`) **← NEW: Approval workflows, debugging, pause/resume patterns**
- Tools: Local, MCP, Composio, LangChain (`tools.md`)
- Execution & Streaming Runtime (`execution.md`)
- Advanced Patterns & Performance (`advanced.md`)

Or jump back to higher-level tutorials once concepts click.
