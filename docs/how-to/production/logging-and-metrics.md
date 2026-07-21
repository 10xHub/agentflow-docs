---
title: Logging and Metrics — Production how-to
sidebar_label: Logging and metrics
description: Enable structured JSON logging with run correlation and secret redaction, and export AgentFlow counters and timers to OpenTelemetry.
keywords:
  - production ai agents
  - agent observability
  - structured logging
  - agent metrics
  - agentflow
  - python ai agent framework
---

# Logging and metrics

AgentFlow ships three separate observability surfaces. This page covers two of them:

| Surface | What it gives you | Where |
|---|---|---|
| Logs | One JSON object per line, correlated to a run, thread, user, and node, with secrets redacted. | This page |
| Metrics | Counters and timers for node executions, tool calls, and checkpointer writes, exportable to OpenTelemetry. | This page |
| Traces | Spans for each run, node, and tool call, sent to an OTEL collector, Logfire, or LangSmith. | [Send traces to Logfire or LangSmith](/docs/how-to/python/send-traces-to-logfire-langsmith) |

Logs and metrics are independent of tracing. You can enable either without installing OpenTelemetry, and both keep working if the tracing backend is down.

---

## Structured logging

The library never configures logging by itself, so nothing changes until you opt in. Call `setup_structured_logging()` once at startup, before the graph handles its first request.

```python
import logging
from agentflow.utils.logging import setup_structured_logging

setup_structured_logging(
    level=logging.INFO,
    json_format=True,
    redact_secrets=True,
    logger_name="agentflow",
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `level` | `int` | `logging.INFO` | Level applied to both the logger and the installed handler. |
| `json_format` | `bool` | `True` | Emit one JSON object per line. When `False`, a plain-text format carrying the same correlation fields is used instead. |
| `redact_secrets` | `bool` | `True` | Attach the secret redaction filter to the handler. |
| `logger_name` | `str` | `"agentflow"` | Logger to configure. |

It returns the installed `logging.Handler` so you can attach your own filters or swap the stream.

### What a record looks like

```json
{
  "timestamp": "2026-07-21 10:14:02,881",
  "level": "INFO",
  "logger": "agentflow.agent",
  "message": "Node 'MAIN' completed",
  "run_id": "run_01H...",
  "thread_id": "thread-42",
  "user_id": "alice",
  "node": "MAIN"
}
```

The four correlation fields (`run_id`, `thread_id`, `user_id`, `node`) are what make logs queryable: "show me every ERROR for thread-42" is a filter rather than a grep. They are only present when they are in scope.

Anything you pass through `extra=` is merged into the same object, provided it is JSON-serialisable:

```python
logger.info("Charged customer", extra={"amount_cents": 4900, "invoice": "inv_123"})
```

Exceptions logged with `exc_info=True` land under an `exception` key.

### How correlation works

`CorrelationFilter` reads the fields from context variables and stamps them onto every record. It is a filter rather than a formatter on purpose: the fields end up on the `LogRecord` itself, so they are visible to any downstream formatter, handler, or APM agent, not only to AgentFlow's JSON formatter.

The execution loop binds these fields for you at the start of a run and again when entering a node. Bind them yourself when logging from outside a graph run:

```python
from agentflow.utils.logging import bind_log_context_from_config, get_log_context, set_log_context

bind_log_context_from_config(config)          # reads run_id, thread_id, user_id
set_log_context(node="my_background_worker")  # or set fields individually

get_log_context()  # -> {"run_id": ..., "thread_id": ..., "node": ...}
```

Because the fields live in context variables, they are per-async-context and do not leak between concurrent requests.

### Secret redaction

`SecretRedactionFilter` scrubs the formatted message before it is emitted. It masks OpenAI, Google, GitHub, Slack, and AWS key formats, `Bearer` tokens, `key=value` secrets, and credential query parameters in signed URLs.

Attach it to a **handler**, not a logger. Python applies logger-level filters only to records emitted directly on that logger, so a logger-level filter misses every child logger:

```python
from agentflow.utils.logging import SecretRedactionFilter, install_secret_redaction, mask_secrets

handler.addFilter(SecretRedactionFilter())   # preferred: covers all child loggers
install_secret_redaction("agentflow")        # convenience wrapper, returns the filter
mask_secrets(some_string)                    # redact an arbitrary string
```

`setup_structured_logging(redact_secrets=True)` already does the handler-level attachment.

This is a heuristic safety net. It will not catch every possible secret and can over-redact. Do not treat it as a substitute for keeping credentials out of log messages.

---

## Metrics

`agentflow.utils.metrics` is a zero-dependency, thread-safe in-process registry. It is always recording; the framework already instruments node executions, tool calls, background tasks, and checkpointer writes.

```python
from agentflow.utils.metrics import counter, timer, snapshot

counter("orders.processed").inc()
counter("orders.processed").inc(3, attributes={"channel": "web"})

with timer("db_write_latency_ms"):
    await write()
```

| Callable | Signature | Description |
|---|---|---|
| `counter` | `(name: str) -> Counter` | Get or create a named counter. |
| `timer` | `(name: str, attributes: dict \| None = None)` | Context manager that records the elapsed milliseconds of a block. |
| `snapshot` | `() -> dict` | Thread-safe point-in-time copy of every counter and timer. |
| `enable_metrics` | `(value: bool) -> None` | Global on/off switch. When off, `inc` and `observe` return immediately. |
| `setup_otel_metrics` | `(meter: Any = None) -> bool` | Bridge the registry to OpenTelemetry. |

`Counter` exposes `inc(amount=1, attributes=None)` and a `value` attribute. `TimerMetric` exposes `observe(duration_ms, attributes=None)` plus `count`, `total_ms`, `max_ms`, and an `avg_ms` property.

`timer` tags each observation with an `outcome` attribute of `"ok"` or `"error"`, so success and failure latencies can be separated. A p99 that mixes them is not actionable. It does not suppress exceptions.

### Reading metrics without an exporter

```python
from agentflow.utils.metrics import snapshot

snapshot()
# {
#   "counters": {"agentflow.node.executions": 128, "agentflow.tool.errors": 2},
#   "timers": {"agentflow.node.duration": {"count": 128, "avg_ms": 412.7, "max_ms": 2891.0}},
# }
```

This is enough for a `/metrics`-style debug endpoint or a health check. It is process-local: the numbers die with the process and are not aggregated across replicas.

### Exporting to OpenTelemetry

```bash
pip install "10xscale-agentflow[otel]"
```

```python
from agentflow.utils.metrics import setup_otel_metrics

setup_otel_metrics()  # once, at startup
```

Call it once at startup, after your application has configured a `MeterProvider` with its exporter. From then on every existing `counter(...)` and `timer(...)` call site exports automatically, with no change at the call site: counters become OTEL counters, timers become histograms with unit `ms`, and `attributes` become dimensions.

Pass an explicit `meter` to use a specific one; otherwise a meter named `agentflow` is taken from the global `MeterProvider`.

`setup_otel_metrics()` returns `False` and logs at info level when OpenTelemetry is not installed. The in-process registry keeps working, so this is safe to call unconditionally.

### Instrumented metrics

| Metric | Type | Attributes |
|---|---|---|
| `agentflow.node.executions` | counter | `node` |
| `agentflow.node.errors` | counter | `node` |
| `agentflow.node.timeouts` | counter | `node` |
| `agentflow.node.stopped` | counter | `node` |
| `agentflow.node.duration` | timer | `node`, `outcome` |
| `agentflow.tool.calls` | counter | `node`, `tool` |
| `agentflow.tool.errors` | counter | `node`, `tool` |
| `agentflow.tool.timeouts` | counter | `node`, `tool` |
| `agentflow.tool.duration` | timer | `node`, `tool`, `outcome` |
| `background_task_manager.tasks_created` | counter | — |
| `background_task_manager.tasks_completed` | counter | — |
| `background_task_manager.tasks_failed` | counter | — |
| `background_task_manager.tasks_dropped` | counter | — |
| `background_task_manager.tasks_cancelled` | counter | — |
| `background_task_manager.tasks_timed_out` | counter | — |
| `pg_checkpointer.save_state.attempts` / `.success` / `.error` / `.conflict` | counter | — |
| `pg_checkpointer.save_state.duration` | timer | — |
| `pg_checkpointer.save_checkpoint.attempts` / `.success` / `.error` / `.conflict` | counter | — |
| `pg_checkpointer.save_checkpoint.duration` | timer | — |

`pg_checkpointer.save_state.conflict` counts optimistic-concurrency rejections, and `background_task_manager.tasks_dropped` counts events shed under backpressure. Both are good alert candidates: a rising rate means concurrent writers are contending, or a publisher is not keeping up.

Telemetry failures are swallowed and logged at debug level. A broken exporter never breaks the caller.

---

## Putting it together

```python
import logging

from agentflow.utils.logging import setup_structured_logging
from agentflow.utils.metrics import setup_otel_metrics


def configure_observability() -> None:
    setup_structured_logging(level=logging.INFO, json_format=True, redact_secrets=True)
    setup_otel_metrics()


configure_observability()
# ... build and compile the graph
```

Add tracing on top when you want per-node spans: see [Send traces to Logfire or LangSmith](/docs/how-to/python/send-traces-to-logfire-langsmith) and the [publishers reference](/docs/reference/python/publishers#tracing-publishers).

---

## Related docs

- [Deployment](./deployment.md)
- [Environment variables](./environment-variables.md)
- [Background tasks reference](/docs/reference/python/background-tasks)
- [Publishers reference](/docs/reference/python/publishers)
