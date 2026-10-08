---
title: Errors and limits
description: "Exception taxonomy, execution limits, retry behavior, and error recovery in graph execution."
updated: "2026-10-08"
order: 150
group: "Memory and reliability"
section: Concepts
faq:
  - q: How do I retry a failed node?
    a: Set retry_config on your Agent. Transient errors (429, 500, 502, 503, 529) and specific storage errors automatically retry with exponential back-off; fatal errors surface immediately.
  - q: What causes a GraphRecursionError?
    a: The default recursion limit is 25 steps. Each node execution counts as one step. Increase it when invoking, or redesign your graph to use fewer steps per run.
  - q: What should I do about StaleStateError?
    a: This is a write conflict when two runs update the same thread simultaneously. The API returns HTTP 409. Reload the latest state and retry, or serialize access to the thread.
---

## The error model

Graph execution raises structured exceptions when nodes fail, storage operations conflict, or limits are exceeded. Rather than crash the system, 10xGraph distinguishes retryable errors (which the runtime can recover from automatically) from fatal errors (which are surfaced immediately for the caller to handle).

This allows you to build resilient agents: brief network glitches are invisible, but genuine problems surface quickly with enough context to diagnose and fix them.

## Exception taxonomy

All exceptions in the core graph engine inherit from `tenxgraph.core.exceptions.GraphError`, a base class that includes an error code, human-readable message, and structured context dictionary.

### Graph and node errors

**GraphError** is the base exception for graph-related failures. It includes:
- `message`: Human-readable description
- `error_code`: Unique code (e.g., `GRAPH_000`)
- `context`: Dictionary with extra details (node name, input size, etc.)

**NodeError** is raised when a node fails to execute. This includes tool errors, user code exceptions inside a custom node, and LLM call failures that cannot be retried. The exception includes the node name in context so you can see which step failed.

**GraphRecursionError** occurs when the graph exceeds its recursion limit (default 25 steps). This is a safety mechanism to prevent infinite loops. Each node execution, tool call, and routing decision counts as one step.

### Timeout errors

**NodeTimeoutError** is raised when a node or tool execution exceeds its timeout. Without a bound, a hanging tool (a half-open socket in an MCP server, a custom tool that never returns, a database query with no read timeout) blocks the entire graph forever. The recursion limit never trips because no step completes, and stop signals are only checked between nodes, never within them.

Timing out the node execution converts that indefinite hang into a reportable error that the execution loop can persist, emit in logs, and recover from through retries or fallback models.

### Storage and concurrency errors

**StorageError** is the base for persistence layer failures. These include database errors, serialization problems, schema version mismatches, and conflicts.

**TransientStorageError** is a retryable storage error: a connection drop, timeout, or transient database unavailability. The runtime automatically retries these. Appears when Redis, Postgres, or other external storage is temporarily unreachable.

**SerializationError** indicates that state or messages could not be serialized to or deserialized from the checkpointer. This is usually fatal (your state structure is corrupted or incompatible), so it does not retry.

**SchemaVersionError** occurs when the checkpointer detects a schema version mismatch, usually after a code upgrade changes the state structure. May require migration; the exact recovery depends on your checkpointer.

**StaleStateError** is raised during an optimistic-concurrency check: two graph runs tried to update the same thread simultaneously, and one write succeeded before the other. The losing write is rejected to prevent a lost update. HTTP API returns 409 Conflict. Reload the latest state and retry.

**ResourceNotFoundError** indicates a resource (thread, file, stored message) does not exist. Non-retryable.

### Other errors

**GraphStopRequested** is raised when a stop signal (from the API or client) is received while a node is running. This is control flow, not a failure: the execution loop catches it, marks the run stopped, and returns cleanly. It lets the stop check reach the caller even if a node is mid-execution.

**MetricsError** occurs when metrics emission fails (e.g., OTEL export unavailable). Logged as a warning and swallowed so a metrics failure does not crash your agent. Should not be caught by user code.

**UnsupportedMediaInputError** is raised before the provider call when a model cannot accept the given media type. For example, trying to send an image to a text-only model, or a document to a model that does not support documents. Includes a suggestion to switch models or change input format.

## Limits

### Recursion limit

The default recursion limit is 25 steps. Each of the following counts as one step:
- A node execution (including an Agent node calling an LLM)
- A tool execution
- A routing decision

This prevents accidental infinite loops. Legitimate multi-turn flows (e.g., a 10-step ReflectAgent or a SwarmAgent with internal delegation) exceed this without tuning. Increase it when invoking:

```python
result = graph.invoke(
    {"messages": [...]},
    config={"recursion_limit": 50}
)
```

Or if you build your own node that calls `ainvoke` recursively, increase it there too. There is no hard upper limit, but each step requires memory for state snapshots and logs, so excessively high values (10,000+) may cause resource exhaustion.

### Node timeout

Node execution (user code and tool calls) has no timeout by default. Set one in your graph compilation if you have long-running or flaky tools:

```python
graph = state_graph.compile(
    checkpointer=checkpointer,
    # TimeoutError raised after 300 seconds per node
)
```

Individual tools can set their own timeouts if they use libraries that support them (e.g., HTTP clients with read timeouts). Custom tools that call async/await should use `asyncio.timeout()` in Python 3.11+.

### State and message size

There is no enforced maximum state size, but each state snapshot is persisted to the checkpointer. Storing very large state (gigabytes of uncompressed text) will stress your database. Trim context regularly with `MessageContextManager` or `SummaryContextManager` to keep state size reasonable.

Media files (images, documents) are stored separately, not in the state. Use `MediaRef` to reference them.

## Retry and fallback behavior

The `Agent` class (and `ReactAgent`, `RAGAgent`, and other prebuilt agents) accept a `retry_config` parameter to control LLM call retry and fallback logic.

### RetryConfig

The `RetryConfig` dataclass controls retry behavior:

```python
from tenxgraph.core.graph import Agent, RetryConfig

retry = RetryConfig(
    max_retries=3,               # 3 retry attempts for the primary model
    initial_delay=1.0,           # Start with 1 second delay
    max_delay=30.0,              # Cap delay at 30 seconds
    backoff_factor=2.0,          # Double delay after each retry (1s, 2s, 4s, 8s...)
    retryable_status_codes=frozenset({429, 500, 502, 503, 529}),  # Retryable HTTP codes
    circuit_breaker_enabled=False,   # Optional: track failures per model
    circuit_breaker_threshold=5,     # Open circuit after 5 consecutive failures
    circuit_breaker_reset_timeout=30.0,  # Try again after 30 seconds
)

agent = Agent(
    model="openai/gpt-4o",
    retry_config=retry
)
```

Default is `RetryConfig()` (3 retries, 1s initial, 2x backoff). Pass `retry_config=False` to disable retries.

### What gets retried

LLM calls retry on:
- HTTP status codes 429 (rate limit), 500 (server error), 502/503 (gateway/service unavailable), 529 (provider overloaded)
- Transient network errors (connection reset, timeout)
- Transient storage errors (database connection drop, Redis unavailable)

These are temporary; the same request often succeeds on the next attempt.

### What does not retry

Fatal errors surface immediately:
- 401/403 (authentication/authorization failure): Fix credentials or permissions, retry will fail again
- 404 (model not found): Use a valid model name
- Serialization/schema errors: State structure is broken, retry will fail again
- User code exceptions in a custom node: Fix the code
- GraphRecursionError: Design the graph to use fewer steps

### Fallback models

If retries are exhausted on the primary model, try fallbacks:

```python
agent = Agent(
    model="openai/gpt-4o",
    fallback_models=["openai/gpt-4-turbo", "anthropic/claude-opus-5"],
    retry_config=RetryConfig(max_retries=2)
)
```

Fallback occurs after max_retries on the current model. Each fallback gets its own retry budget. This lets you degrade gracefully: use your fast/cheap primary model, but fall back to a more capable model if rate-limited or if the primary is unavailable.

### Circuit breaker

The optional circuit breaker tracks consecutive failures per (provider, model) pair. After `circuit_breaker_threshold` failures (default 5), the circuit opens and that model is skipped for `circuit_breaker_reset_timeout` (default 30s). This avoids repeatedly hammering a known-dead provider:

```python
retry = RetryConfig(
    circuit_breaker_enabled=True,
    circuit_breaker_threshold=3,
    circuit_breaker_reset_timeout=60.0
)
```

Enable this if you have flaky providers or your quota is exhausted and retries fail fast anyway.

## Error recovery in streams

When you stream a run with `astream()`, errors are emitted as events in the stream. Your client code decides how to handle each type:

```python
async for event in graph.astream({"messages": [...]}):
    if event_type == "error":
        error = event["error"]
        if isinstance(error, StaleStateError):
            # Reload state and retry
            new_state = await graph.get_state(thread_id)
            # Re-invoke with new state
        elif isinstance(error, TransientStorageError):
            # Already retried; log and continue if acceptable
            logger.warning(f"Storage glitch: {error.message}")
        elif isinstance(error, NodeError):
            # A node failed; may indicate bad input or a real problem
            logger.error(f"Node failed: {error.message}")
            raise  # Fail fast
        else:
            raise  # Unknown error; rethrow
```

Errors in the checkpoint/store do not automatically stop the run; they are logged and context is lost. A NodeError or LLM failure stops the run and surfaces the exception.

## HTTP API error responses

The REST API returns error details in the response body. Common status codes:

- **400 Bad Request**: Invalid input shape or configuration
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Authenticated, but insufficient permissions (usually via authorization backends)
- **404 Not Found**: Thread or resource does not exist
- **409 Conflict**: StaleStateError; reload state and retry
- **429 Too Many Requests**: Rate limited; backoff and retry
- **500 Internal Server Error**: Server-side exception; check logs
- **503 Service Unavailable**: Server overloaded or shutting down; retry later

Example error response:

```json
{
  "error": {
    "error_type": "StaleStateError",
    "error_code": "STORAGE_CONFLICT_000",
    "message": "State version mismatch; another execution updated the thread",
    "context": {
      "thread_id": "abc123",
      "expected_version": 5,
      "current_version": 6
    }
  }
}
```

## Best practices

**Design for transience.** Assume any network-dependent operation (LLM call, database query, tool invocation) may fail once and succeed the next time. Set `retry_config` appropriately for your use case.

**Handle StaleStateError.** If your application has concurrent runs on the same thread, catch `StaleStateError` and reload state before retrying. Or serialize access to threads to avoid the conflict in the first place.

**Log and monitor.** Errors are logged with structured context; forward logs to your observability stack (Logfire, LangSmith, Datadog) to spot patterns.

**Validate input.** Catch errors early: validate user input before invoking the graph. Invalid input will fail all retries and delay error reporting.

**Test error paths.** Unit test your error handling: mock providers to return 429 or 503, inject `TransientStorageError` to verify backoff, and check that fallback models are tried when the primary fails.

## Related pages

- [Checkpointing and threads](/docs/concepts/checkpointing-and-threads): Thread isolation and durability
- [Durability and concurrency](/docs/guides/durability-and-concurrency): Handling conflicts and concurrent access
- [Memory](/docs/concepts/memory): How PgCheckpointer stores state
- [Interrupts](/docs/concepts/interrupts): Pausing and resuming execution
