---
title: Web Tools — Prebuilt tools
sidebar_label: Web Tools
description: fetch_url, google_web_search, and vertex_ai_search — prebuilt tools for fetching web pages and running grounded searches.
keywords:
  - web tools agentflow
  - fetch_url
  - google_web_search
  - vertex_ai_search
  - grounded search tool
---

# Web Tools

Prebuilt tools for fetching content from the public web and running Google-powered searches.

**Import path:** `agentflow.prebuilt.tools`

---

## `fetch_url`

Fetches a public HTTP/HTTPS URL and returns the page content as plain text.

### What it does

- Resolves the hostname and blocks private/loopback/reserved IP addresses (SSRF protection)
- Strips HTML tags and script/style content, returning clean readable text
- Truncates long responses to `max_chars` (default 20 000)
- Returns a JSON object with `url`, `status_code`, `content_type`, `content`, and `truncated`

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | `str` | required | Public HTTP or HTTPS URL to fetch |
| `timeout` | `float` | `10.0` | Request timeout in seconds (clamped 1–30 s) |
| `max_chars` | `int` | `20000` | Maximum characters to return |

### Example response

```json
{
  "url": "https://example.com/",
  "status_code": 200,
  "content_type": "text/html; charset=UTF-8",
  "content": "Example Domain This domain is for use in...",
  "truncated": false
}
```

### Usage

```python
from agentflow.prebuilt.tools import fetch_url
from agentflow.core.graph import Agent, ToolNode

agent = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([fetch_url]),
)
```

---

## `google_web_search`

Searches the public web using **Gemini Google Search grounding** and returns the grounded answer plus source metadata.

### What it does

- Calls the Google GenAI API with the `google_search` tool enabled
- Returns the grounded text answer and `grounding_metadata` (source links, web chunks)
- Truncates responses to `max_chars`

### Requirements

```bash
pip install "10xscale-agentflow[google-genai]"
```

The `GOOGLE_API_KEY` (or Application Default Credentials) environment variable must be set.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | required | Search query |
| `model` | `str` | `"gemini-2.5-flash"` | Gemini model to use |
| `max_chars` | `int` | `20000` | Maximum characters in the content field |

### Example response

```json
{
  "content": "The Eiffel Tower is 330 metres tall...",
  "grounding_metadata": {
    "web_search_queries": ["eiffel tower height"],
    "grounding_chunks": [...]
  },
  "truncated": false
}
```

### Usage

```python
from agentflow.prebuilt.tools import google_web_search
from agentflow.core.graph import Agent, ToolNode

agent = Agent(
    model="gemini-2.5-flash",
    tool_node=ToolNode([google_web_search]),
)
```

---

## `vertex_ai_search`

Searches a **Vertex AI Search datastore** with Gemini grounding. Suitable for enterprise search over private document collections.

### What it does

- Calls the Google GenAI API (v1) with a `vertex_ai_search` retrieval tool
- The `datastore` must be a full Vertex AI Search resource path
- Returns the same `content` / `grounding_metadata` / `truncated` envelope as `google_web_search`

### Requirements

```bash
pip install "10xscale-agentflow[google-genai]"
```

Vertex AI credentials and a provisioned datastore are required.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | required | Search query |
| `datastore` | `str` | required | Full Vertex AI Search datastore resource path |
| `model` | `str` | `"gemini-2.5-flash"` | Gemini model to use |
| `max_chars` | `int` | `20000` | Maximum characters in the content field |

### Usage

```python
from agentflow.prebuilt.tools import vertex_ai_search
from agentflow.core.graph import Agent, ToolNode

DATASTORE = "projects/my-project/locations/global/collections/default_collection/dataStores/my-store"

agent = Agent(
    model="gemini-2.5-flash",
    tool_node=ToolNode([vertex_ai_search]),
    system_prompt=[{
        "role": "system",
        "content": f"Always search using datastore: {DATASTORE}",
    }],
)
```

---

## Using multiple web tools together

```python
from agentflow.prebuilt.tools import fetch_url, google_web_search
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.agent import ReactAgent

agent = ReactAgent(
    model="gemini-2.5-flash",
    tools=[fetch_url, google_web_search],
    system_prompt=[{
        "role": "system",
        "content": "You are a research assistant. Use google_web_search to find information, "
                   "then fetch_url to read specific pages in full.",
    }],
)
app = agent.compile()
```
