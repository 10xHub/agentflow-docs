# Advanced Patterns & Performance

This section explores higher-level compositions and tuning techniques once you grasp core graph mechanics.

---

## Multi-Agent Orchestration

While a single `StateGraph` can coordinate reasoning + tools, complex systems may compose multiple specialized graphs:

| Pattern | Description | Example |
|---------|-------------|---------|
| Router → Workers | Classifier graph delegates to domain-specific subgraphs | Customer support triaging billing vs tech |
| Supervisor + Tools | Supervisory graph decides next sub-task & spawns tool-rich worker | Research agent splitting search, summarise, synthesis |
| Map-Reduce | Parallel subgraphs process shards; aggregator combines | Summarizing many documents |
| Hierarchical Memory | One graph updates long-term store; another handles short-term dialog | Knowledge-grounded assistants |

Future first-class nested graph APIs will simplify this; today you can approximate by having nodes invoke other compiled
graphs explicitly.

---

## Dynamic Tool Injection

Inject tool availability based on state or user tier:

```python
def provide_tools(state):
    tool_list = base_tools.copy()
    if state.user_profile.get("tier") == "pro":
        tool_list += pro_tools
    return tool_list
```

Feed this into the LLM call just-in-time instead of statically instantiating a monolithic ToolNode.

---

## Background Enrichment

Long-running tasks (vector indexing, summarisation) can trail the main conversation:

1. User asks complex question
2. Node schedules retrieval expansion job via `BackgroundTaskManager`
3. Conversation proceeds with placeholder
4. When task completes, result appended to store; future turns benefit

Ensure idempotent jobs by hashing inputs (e.g. document chunk digest) to skip duplicates.

---

## State Minimisation Strategy

Memory grows; consider layering:

| Layer | Contents | Persistence |
|-------|----------|-------------|
| Active Context | Last N messages | Always in state.context |
| Summary | Rolling narrative | Stored in `context_summary` |
| External Store | Full history, embeddings | `BaseStore` / vector DB |

Periodically:

1. Summarise older messages → `context_summary`
2. Offload full transcripts to store
3. Truncate `context` to a sliding window

---

## Performance Tuning Cheatsheet

| Issue | Mitigation |
|-------|------------|
| Slow tool chain | Parallelize independent calls (future feature) or restructure into single batch tool |
| High token usage | Aggressive summarisation + retrieval instead of raw replay |
| Frequent identical tool calls | Memoize with cache layer keyed by args |
| Unstable latency | Warm LLM/model sessions; pre-create container-bound clients |
| Large message objects | Strip raw provider payloads after conversion (optional config) |

---

## Observability Enhancements

Add correlation identifiers:

- Use custom `BaseIDGenerator` with tenant prefix
- Include `thread_name` in every published event
- Attach semantic spans via callback hooks (`before_node`, `after_node`)

Expose metrics:

| Metric | Source |
|--------|--------|
| `agent_steps_total` | Increment after each node |
| `tool_invocations_total` | Count executed tool calls |
| `reasoning_tokens_total` | Sum from `Message.usages` |
| `latency_node_seconds` | Timestamp diff in callbacks |

---

## Fault Tolerance Patterns

| Failure | Strategy |
|---------|----------|
| Transient LLM errors | Retry with exponential backoff wrapper inside node |
| Tool timeout | Circuit-breaker: mark tool unavailable for cool-down window |
| Checkpointer outage | Fallback to in-memory & emit warning event |
| Partial stream drop | Buffer deltas locally until final message commit |

---

## Safe Execution Sandbox

For untrusted tool logic:

- Run tool execution in a restricted subprocess
- Validate JSON schema inputs strictly
- Enforce timeouts per tool and global budget per step

---

## Experimentation & A/B

Encode experiment variant in config:

```python
config = {"thread_id": tid, "variant": "tool-strategy-B"}
```

Branch in node:

```python
if config.get("variant") == "tool-strategy-B":
    tools = alt_toolset
```

Log variant with every published event for offline comparison (success rate, latency, token cost).

---

## Roadmap-Oriented Extensibility

Design choices enabling future features:

| Future Feature | Existing Hook |
|----------------|---------------|
| Nested graphs | `Command(graph=...)` placeholder |
| Parallel branches | Background tasks + future branch scheduler |
| Adaptive memory pruning | `BaseContextManager` injection |
| Multi-provider ensemble | Converter abstraction + dynamic provider selection node |

---

## Checklist Before Production

- [ ] Deterministic termination paths tested
- [ ] Recursion limit sized for longest scenario
- [ ] Tool idempotency validated
- [ ] State serialisation size acceptable under worst cases
- [ ] Observability events consumed by monitoring stack
- [ ] Security review of external tool surfaces
- [ ] Back-pressure strategy for streaming consumers

---

With these patterns you can evolve from a prototype assistant to a resilient agent platform incrementally.
