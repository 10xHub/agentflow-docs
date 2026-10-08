---
title: Eval endpoints
seoTitle: "Eval endpoints REST API reference"
description: Reference for the eval run listing and detail endpoints that serve 10xgraph eval reports over HTTP, including their public, unauthenticated status.
section: Reference
group: "REST API"
order: 390
label: Evals
updated: "2026-10-08"
---

The eval endpoints serve the JSON reports written by [`10xgraph eval`](/docs/reference/api-cli/commands#eval) over HTTP, so the playground's Evals inspector can browse them. They read `eval_reports/*.json` from the server's working directory; they do not run evaluations.

Base path: `/v1/evals`

<aside class="callout callout-danger" role="note"><p class="callout-title">These endpoints are public</p>

`/v1/evals/runs` and `/v1/evals/runs/{run_id}` are on the server's public allowlist. They carry **no authentication and no authorization guard**, even when `auth` is configured in `10xgraph.json`. Anyone who can reach the server can read every file in `eval_reports/`, including the prompts, model outputs, and criteria recorded in each run.

They exist as a local report viewer. Before exposing a server to a network you do not control, either keep `eval_reports/` out of the deployed image and working directory, or block `/v1/evals/*` at your ingress or reverse proxy. Treat anything you put in an eval case as publicly readable otherwise.

</aside>

---

## GET /v1/evals/runs

List every run found under `eval_reports/`, newest first.

**Response:**

```json
{
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
  },
  "metadata": {"request_id": "...", "timestamp": "...", "message": "OK"}
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
        "expected": "\u2014",
        "actual": "The weather in Paris is 24 degrees and sunny.",
        "rubric": [
          {"key": "accuracy", "value": 0.96, "tone": "accent"},
          {"key": "weighted score", "value": 0.96, "tone": "accent"}
        ],
        "conversation": null
      }
    ],
    "regression": null
  },
  "metadata": {"request_id": "...", "timestamp": "...", "message": "OK"}
}
```

| Field | Type | Description |
| --- | --- | --- |
| `title` | string | Eval set label plus run number |
| `sub` | string | Eval set id, model (when recorded), run timestamp in UTC, and total duration, joined with `·` |
| `rate` | number | Pass rate as a percentage |
| `status` | string | `pass` or `fail` |
| `threshold` | integer | Mean of the distinct criterion thresholds recorded in the report, as a rounded percentage. Defaults to `80` when no thresholds are recorded. |
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
| `input` | string | First user message in the case, or a single em dash placeholder character when there is none |
| `expected` | string | Always a single em dash placeholder character; the report schema records no per-case expected value |
| `actual` | string | The agent's response, or the em dash placeholder when empty |
| `rubric` | array or `null` | One row per criterion plus a `weighted score` row. `null` when the case has no criteria. |
| `conversation` | array or `null` | Parsed turns for `sim` cases, each `{role, text}` with role `sim` or `agent`. `null` for `eval` cases. |

### Regression

Present only when an earlier run of the same eval set exists. It compares case-by-case against the immediately preceding run.

| Field | Type | Description |
| --- | --- | --- |
| `note` | object | Which two runs are being compared, as `current`, `prev` and `suite` strings |
| `summary` | array | Pass-rate drift in percentage points, newly failing count, newly passing count, average score drift |
| `rows` | array | One row per case: `name`, `delta` (previous and current score with an arrow), `dir` (`up`, `down`, `flat`), `flip` (for example `pass → fail`), and `stay` (true when pass/fail did not change) |

Cases that exist in only one of the two runs are omitted from `rows`.

---

## See also

- [`10xgraph eval`](/docs/reference/api-cli/commands#eval)
- [Run evals](/docs/testing/run-evals)
