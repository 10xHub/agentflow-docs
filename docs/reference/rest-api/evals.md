---
title: REST API — Evals — REST API reference
sidebar_label: REST API
description: Reference for the eval run listing and detail endpoints that serve agentflow eval reports over HTTP, including their public, unauthenticated status.
keywords:
  - rest api reference
  - agent http api
  - agentflow rest endpoints
  - agentflow
  - python ai agent framework
  - rest api — evals
---


# REST API: Evals

The eval endpoints serve the JSON reports written by [`agentflow eval`](../api-cli/commands.md#agentflow-eval) over HTTP, so the playground's Evals inspector can browse them. They read `eval_reports/*.json` from the server's working directory; they do not run evaluations.

Base path: `/v1/evals`

:::danger These endpoints are public
`/v1/evals/runs` and `/v1/evals/runs/{run_id}` are on the server's public allowlist. They carry **no authentication and no authorization guard**, even when `auth` is configured in `agentflow.json`. Anyone who can reach the server can read every file in `eval_reports/`, including the prompts, model outputs, and criteria recorded in each run.

They exist as a local report viewer. Before exposing a server to a network you do not control, either keep `eval_reports/` out of the deployed image and working directory, or block `/v1/evals/*` at your ingress or reverse proxy. Treat anything you put in an eval case as publicly readable otherwise.
:::

---

## GET /v1/evals/runs

List every run found under `eval_reports/`, newest first.

**Response:**

```json
{
  "success": true,
  "data": {
    "runs": [
      {
        "id": "eval_20260721_101500",
        "name": "Weather agent suite",
        "run": "#3",
        "rate": 91.7,
        "status": "fail",
        "cases": 12,
        "ago": "14m ago"
      }
    ]
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Run id. This is the report filename without its `.json` extension, and is what you pass to the detail endpoint. |
| `name` | string | Eval set name (falls back to the eval set id) |
| `run` | string | Run number within this eval set, as `#N`, counted chronologically per eval set |
| `rate` | number | Pass rate as a percentage, one decimal place |
| `status` | string | `pass` only when the pass rate is 100 percent, otherwise `fail` |
| `cases` | integer | Total cases in the run |
| `ago` | string | Relative age, for example `just now`, `14m ago`, `3h ago`, `2d ago` |

Reports that are missing, unreadable, or not valid JSON are skipped silently. When `eval_reports/` does not exist the list is empty.

---

## GET /v1/evals/runs/`{run_id}`

Full drilldown for one run.

**Path parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `run_id` | string | Run id from the listing. An unknown id returns `404`. |

**Response:**

```json
{
  "success": true,
  "data": {
    "title": "Weather agent suite · run #3",
    "sub": "weather-suite · gpt-4o-mini · 2026-07-21 10:15 · 42.3s",
    "rate": 91.7,
    "status": "fail",
    "threshold": 80,
    "stats": [
      {"label": "cases", "value": "12"},
      {"label": "passed", "value": "11", "tone": "ok"},
      {"label": "failed", "value": "1", "tone": "bad"},
      {"label": "avg score", "value": "0.93"},
      {"label": "avg latency", "value": "3.5s"},
      {"label": "total tokens", "value": "18.4k tok"}
    ],
    "cases": [
      {
        "id": "case-paris",
        "name": "Weather in Paris",
        "type": "eval",
        "score": 0.96,
        "status": "pass",
        "lat": "3.1s",
        "cost": "1.4k tok",
        "input": "What is the weather in Paris?",
        "expected": "—",
        "actual": "The weather in Paris is 24 degrees and sunny.",
        "rubric": [
          {"key": "accuracy", "value": 0.96, "tone": "accent"},
          {"key": "weighted score", "value": 0.96, "tone": "accent"}
        ],
        "conversation": null
      }
    ],
    "regression": null
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `title` | string | Eval set label plus run number |
| `sub` | string | Eval set id, model (when recorded), run timestamp in UTC, and total duration, joined with `·` |
| `rate` | number | Pass rate as a percentage |
| `status` | string | `pass` or `fail` |
| `threshold` | integer | Average criterion threshold across the run, as a percentage. Defaults to `80` when the report records no thresholds. |
| `stats` | array | Summary tiles: cases, passed, failed (failures plus errors), average score, average latency, total tokens |
| `cases` | array | One entry per case, see below |
| `regression` | object or `null` | Comparison against the previous run of the same eval set, or `null` when this is the first run of that set |

### Case

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Eval case id |
| `name` | string | Case name (falls back to the id) |
| `type` | string | `sim` for a user-simulation case (the case carries `turns` metadata), otherwise `eval` |
| `score` | number | Mean criterion score, rounded to two decimals. Falls back to `1.0`/`0.0` from the pass flag when the case has no criteria. |
| `status` | string | `pass` or `fail` |
| `lat` | string | Case duration, for example `3.1s` |
| `cost` | string | Token total, for example `1.4k tok`. Token counts only; the report records no dollar cost. |
| `input` | string | First user message in the case, or `—` |
| `expected` | string | Always `—`; the report schema records no per-case expected value |
| `actual` | string | The agent's response |
| `rubric` | array or `null` | One row per criterion plus a `weighted score` row. `null` when the case has no criteria. |
| `conversation` | array or `null` | Parsed turns for `sim` cases, each `{role, text}` with role `sim` or `agent`. `null` for `eval` cases. |

### Regression

Present only when an earlier run of the same eval set exists. It compares case-by-case against the immediately preceding run.

| Field | Type | Description |
| --- | --- | --- |
| `note` | object | Which two runs are being compared |
| `summary` | array | Pass-rate drift in percentage points, newly failing count, newly passing count, average score drift |
| `rows` | array | Per-case rows with the score delta, direction (`up`, `down`, `flat`), and the pass/fail flip |

Cases that exist in only one of the two runs are omitted from `rows`.

---

## See also

- [`agentflow eval`](../api-cli/commands.md#agentflow-eval)
- [Run evals](../../how-to/api-cli/run-evals.md)
