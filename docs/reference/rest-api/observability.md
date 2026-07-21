---
title: Observability endpoints — REST API reference
sidebar_label: Observability
description: Reference for the GET /v1/observability/{thread_id} endpoint that reconstructs a run trace with spans, events, and token usage.
keywords:
  - rest api reference
  - agent http api
  - agentflow rest endpoints
  - agentflow
  - python ai agent framework
  - rest api — observability
---


# REST API: Observability

`GET /v1/observability/{thread_id}` reconstructs a run trace for a thread from the events its runs emitted: a span tree, a flat event list, aggregated token usage, and call counts. It is what the playground's trace view renders.

Base path: `/v1/observability`

Permission: `graph:read`.

---

## GET /v1/observability/`{thread_id}`

**Path parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `thread_id` | string | Thread whose runs to inspect |

**Query parameters:**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `run_id` | string | latest run | Return this specific run instead of the most recent one |

**Response:**

```json
{
  "success": true,
  "data": {
    "thread_id": "my-thread-1",
    "run_count": 2,
    "run_ids": ["run-a", "run-b"],
    "run": {
      "run_id": "run-b",
      "thread_id": "my-thread-1",
      "status": "done",
      "started_at": 1775000000.0,
      "finished_at": 1775000004.2,
      "duration_ms": 4200.0,
      "spans": [
        {
          "id": "root",
          "name": "graph",
          "kind": "root",
          "parent": null,
          "start_ms": 0.0,
          "duration_ms": 4200.0
        },
        {
          "id": "s1",
          "name": "node: MAIN",
          "kind": "node",
          "parent": "root",
          "start_ms": 5.0,
          "duration_ms": 1800.0
        },
        {
          "id": "s2",
          "name": "llm.generate",
          "kind": "llm",
          "parent": "s1",
          "start_ms": 10.0,
          "duration_ms": 0.0,
          "model": "gpt-4o-mini",
          "input_tokens": 812,
          "output_tokens": 143
        },
        {
          "id": "s3",
          "name": "tool: get_weather",
          "kind": "tool",
          "parent": "s1",
          "start_ms": 1750.0,
          "duration_ms": 0.0
        }
      ],
      "events": [
        {
          "id": "e1",
          "type": "message",
          "node": "MAIN",
          "offset_ms": 1710.0,
          "summary": "llm.generate · 955 tokens"
        }
      ],
      "usage": {
        "prompt_tokens": 812,
        "completion_tokens": 143,
        "reasoning_tokens": 0,
        "total_tokens": 955
      },
      "llm_calls": 1,
      "tool_calls": 1,
      "iterations": 2
    }
  }
}
```

### Top level

| Field | Type | Description |
| --- | --- | --- |
| `thread_id` | string | The thread that was queried |
| `run_count` | integer | Number of runs recorded for the thread |
| `run_ids` | string array | Every recorded run id, so a client can offer a run picker |
| `run` | object or `null` | The requested (or latest) run. `null` when the thread has no recorded runs. |

### Run

| Field | Type | Description |
| --- | --- | --- |
| `run_id` | string | Run identifier |
| `thread_id` | string | Owning thread |
| `status` | string | `running`, `done`, `error`, or `stopped` |
| `started_at` | number or `null` | Unix timestamp (seconds, fractional) |
| `finished_at` | number or `null` | Unix timestamp (seconds, fractional) |
| `duration_ms` | number | Wall-clock run duration in milliseconds |
| `spans` | array | The span tree, see below |
| `events` | array | Flat event list, see below |
| `usage` | object | Aggregated token usage |
| `llm_calls` | integer | Number of records that carried token usage |
| `tool_calls` | integer | Number of tool calls observed in the records |
| `iterations` | integer | Number of distinct nodes the run touched |

### Span

Spans form a tree rooted at a single `root` span covering the whole run. Node spans hang off the root; LLM and tool spans hang off the node span they occurred under, falling back to `root` when the node is unknown.

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Span id, stable within the run. The root span is always `root`; the rest are `s1`, `s2`, and so on in emission order. |
| `name` | string | `graph` for the root, `node: <node>` for node spans, `llm.generate` for LLM spans, `tool: <tool_name>` for tool spans |
| `kind` | string | `root`, `node`, `llm`, or `tool` |
| `parent` | string or `null` | Parent span id. `null` for the root span. |
| `start_ms` | number | Offset from the run start, in milliseconds |
| `duration_ms` | number | Span duration in milliseconds. LLM and tool spans are point-in-time markers and report `0.0`; only root and node spans carry a real duration. |
| `model` | string or `null` | Model name. Present on `llm` spans. |
| `input_tokens` | integer or `null` | Prompt tokens. Present on `llm` spans. |
| `output_tokens` | integer or `null` | Completion tokens. Present on `llm` spans. |

### Event

Events are returned **newest first**, so a UI can render the list without reversing it. Ids are assigned in chronological order (`e0` is the oldest), which means the ids count down through the array.

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Event id, `e<index>` in chronological order |
| `type` | string | `message`, `updates`, `state`, `error`, or `result` |
| `node` | string | Node the event is attributed to. Empty when not node-scoped. |
| `offset_ms` | number | Offset from the run start, in milliseconds |
| `summary` | string | One-line summary, for example `tool_call get_weather`, `llm.generate · 955 tokens`, `error`, or `delta` |

### Token usage

| Field | Type |
| --- | --- |
| `prompt_tokens` | integer |
| `completion_tokens` | integer |
| `reasoning_tokens` | integer |
| `total_tokens` | integer |

---

## Availability

Traces come from an in-process telemetry store that records chunks as runs execute. It is bound **only outside production**: when `MODE=production` the store is not created and this endpoint returns an empty payload (`run_count: 0`, `run: null`) rather than an error.

The store is in-memory and not durable. It is a development and playground aid, not a production observability system. For production tracing, configure OpenTelemetry (`OTEL_ENABLED`) or the `observability` block in `agentflow.json`.

Both `POST /v1/graph/invoke` and `POST /v1/graph/stream` record runs. Invoke has no chunk stream, so its trace is reconstructed from the final messages, which is enough for usage and cost but produces a coarser span tree than a streamed run.

---

## See also

- [REST API: Graph](./graph.md)
- [agentflow.json configuration](../api-cli/configuration.md)
