---
title: How to send traces to Logfire and LangSmith
sidebar_label: Logfire & LangSmith tracing
description: Send Agentflow graph, node, LLM, and tool spans to Pydantic Logfire or LangSmith over OpenTelemetry, using the Python helpers, dedicated publishers, or the declarative observability block in agentflow.json.
keywords:
  - agentflow observability
  - logfire tracing
  - langsmith tracing
  - opentelemetry
  - otlp exporter
  - llm tracing
  - agentflow
sidebar_position: 11
---

# How to send traces to Logfire and LangSmith

[Pydantic Logfire](https://pydantic.dev/logfire) and [LangSmith](https://docs.langchain.com/langsmith/) are both OpenTelemetry backends. Agentflow already reconstructs a full span tree (graph → node → LLM → tool) with GenAI semantic-convention attributes (`gen_ai.usage.input_tokens`, `gen_ai.request.model`, `session.id`, …) through its `OtelPublisher`. So sending traces to either backend means configuring the right OpenTelemetry `TracerProvider`/exporter — there is no per-vendor event plumbing.

You have three ways to wire it up:

- **Python helpers** — `setup_logfire`, `setup_langsmith`, or the unified `setup_observability`.
- **Dedicated publishers** — `LogfirePublisher` / `LangsmithPublisher`, if you prefer a publisher object to assign or compose.
- **Declarative config** — an `observability` block in `agentflow.json` (auto-wired by the API server; see [below](#declarative-config-in-agentflowjson)).

---

## Install

```bash
pip install '10xscale-agentflow[logfire]'        # Logfire
pip install '10xscale-agentflow[langsmith]'      # LangSmith (OTLP HTTP exporter)
pip install '10xscale-agentflow[observability]'  # both + otel
```

The `langsmith` extra pulls only the OpenTelemetry OTLP HTTP exporter — not the LangSmith SDK — because spans are sent over OTLP, not RunTree.

---

## Secrets stay in the environment

Never put tokens in code or `agentflow.json`. Set them as environment variables:

```bash
# Logfire
export LOGFIRE_TOKEN="your-logfire-write-token"

# LangSmith
export LANGSMITH_API_KEY="your-langsmith-api-key"
```

Both helpers fall back to these variables when you do not pass `token=` / `api_key=` explicitly.

---

## Logfire

Call `setup_logfire(graph, ...)` **before** `graph.compile()`. It runs `logfire.configure(...)` to install the global `TracerProvider`, then attaches the `OtelPublisher`.

```python
from agentflow.core.graph import StateGraph, Agent
from agentflow.runtime.publisher import setup_logfire, ObservabilityLevel
from agentflow.utils import END

graph = StateGraph()
graph.add_node("MAIN", Agent(model="gpt-4o"))
graph.set_entry_point("MAIN")
graph.add_edge("MAIN", END)

# Configure Logfire and instrument the graph — before compile()
setup_logfire(
    graph,
    service_name="my-agent",
    level=ObservabilityLevel.STANDARD,
)

app = graph.compile()
```

`setup_logfire` accepts `token`, `service_name`, `send_to_logfire` (default `True`), `console` (pass `False` to silence local console output), `level`, and any extra keyword arguments forwarded verbatim to `logfire.configure()` (e.g. `environment="staging"`).

---

## LangSmith

Call `setup_langsmith(graph, ...)` **before** `graph.compile()`. It builds an OTLP HTTP exporter pointing at LangSmith, wraps it in a `BatchSpanProcessor`, and attaches the `OtelPublisher`.

```python
from agentflow.runtime.publisher import setup_langsmith, ObservabilityLevel

setup_langsmith(
    graph,
    project="my-agent",              # sent as the Langsmith-Project header
    level=ObservabilityLevel.STANDARD,
)

app = graph.compile()
```

For a regional deployment, pass the full base `endpoint` (Agentflow appends `/v1/traces`):

```python
setup_langsmith(graph, project="my-agent", endpoint="https://eu.api.smith.langchain.com/otel")
```

---

## Both at once

`setup_observability` reads a config dict and enables Logfire and/or LangSmith. When both are on, they share a single `TracerProvider` (the LangSmith processor is passed to Logfire via `additional_span_processors`):

```python
from agentflow.runtime.publisher import setup_observability

setup_observability(graph, {
    "level": "standard",
    "logfire":   {"enabled": True, "service_name": "my-agent"},
    "langsmith": {"enabled": True, "project": "my-agent"},
})

app = graph.compile()
```

---

## Dedicated publishers

If you prefer a publisher object — for example to fan out with `CompositePublisher` — use `LogfirePublisher` or `LangsmithPublisher`. They subclass `OtelPublisher` and configure the provider on construction, so assign them before `compile()`:

```python
from agentflow.runtime.publisher import LangsmithPublisher, ObservabilityLevel

publisher = LangsmithPublisher(project="my-agent", level=ObservabilityLevel.STANDARD)
graph = StateGraph(publisher=publisher)
# ... add nodes, edges
app = graph.compile()
```

`LogfirePublisher` takes the same options as `setup_logfire`; `LangsmithPublisher` takes the same options as `setup_langsmith`.

---

## Observability levels and PII

The `level` controls how much data lands on each span. It reuses `ObservabilityLevel`:

| Level | What it emits | PII risk |
|---|---|---|
| `SPANS` | Timing and structure only | None |
| `STANDARD` (default) | + token counts, model, request params. **No message content.** | Low |
| `FULL` | + prompt and completion content | High — opt in deliberately |

`FULL` puts prompt/response text on spans. The framework's log redaction (`install_secret_redaction()`) does **not** scrub span content, so treat `FULL` traces as sensitive and restrict who can view them in Logfire/LangSmith.

---

## Declarative config in agentflow.json

When you serve a graph with `agentflow api`, you do not call the helpers yourself. Add an `observability` block to [`agentflow.json`](../api-cli/configure-agentflow-json.md) and the server wires it up during startup:

```json
{
  "agent": "graph.react:app",
  "observability": {
    "level": "standard",
    "logfire":   { "enabled": true, "service_name": "my-agent", "send_to_logfire": true, "console": false },
    "langsmith": { "enabled": true, "project": "my-agent", "endpoint": null }
  }
}
```

Keep `LOGFIRE_TOKEN` / `LANGSMITH_API_KEY` in your `.env` — never in `agentflow.json`. If a backend is enabled but its package or key is missing, the server logs a warning and starts without that exporter rather than failing.

---

## Related

- [How to use publishers](./use-publishers.md) — the full publisher catalog, including the raw `OtelPublisher`.
- [Configure agentflow.json](../api-cli/configure-agentflow-json.md) — every top-level config key.
