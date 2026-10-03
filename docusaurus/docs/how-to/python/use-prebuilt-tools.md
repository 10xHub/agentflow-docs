---
title: How to use prebuilt tools
sidebar_label: Prebuilt tools
description: Guide to fetch_url, file_read/write/search, safe_calculator, google_web_search, vertex_ai_search, memory tools, and create_handoff_tool from agentflow.prebuilt.tools.
keywords:
  - agentflow prebuilt tools
  - fetch url tool
  - file read write
  - web search tool
  - memory tool
  - handoff tool
  - agentflow
sidebar_position: 9
---

# How to use prebuilt tools

AgentFlow ships a set of production-ready tools in `agentflow.prebuilt.tools`. Drop them into any `ToolNode` or pass them directly to a prebuilt agent's `tools` list.

```python
from agentflow.prebuilt.tools import (
    fetch_url,
    file_read,
    file_write,
    file_search,
    safe_calculator,
    google_web_search,
    vertex_ai_search,
    memory_tool,
    make_user_memory_tool,
    make_agent_memory_tool,
    create_handoff_tool,
)
```

---

## fetch_url

Fetches the text content of any public HTTP/HTTPS URL. Blocks private/loopback IP addresses, enforces a configurable timeout, and truncates long responses.

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.prebuilt.tools import fetch_url

tool_node = ToolNode([fetch_url])

agent = Agent(
    model="gpt-4o",
    tool_node=tool_node,
    system_prompt=[{"role": "system", "content": "You are a research assistant."}],
)
```

**Tool schema** (what the LLM sees):

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | `str` | required | Public HTTP/HTTPS URL to fetch. |
| `timeout` | `float` | `10.0` | Request timeout in seconds (max 30). |
| `max_chars` | `int` | `20000` | Maximum characters to return. |

The tool returns a JSON string:

```json
{
  "url": "https://example.com",
  "status_code": 200,
  "content_type": "text/html",
  "content": "...",
  "truncated": false
}
```

**Tags:** `["web", "fetch", "network"]`

---

## safe_calculator

Evaluates arithmetic expressions without exposing `__builtins__`. Safe for production.

```python
from agentflow.prebuilt.tools import safe_calculator

tool_node = ToolNode([safe_calculator])
```

**Tool schema:**

| Parameter | Type | Description |
|---|---|---|
| `expression` | `str` | Arithmetic expression to evaluate, e.g. `"123 * 456 + 789"`. |

Returns the result as a string, or an error message if evaluation fails.

---

## file_read, file_write, file_search

Local filesystem tools. All three enforce that the path is within the current working directory or an explicit allowed root.

```python
from agentflow.prebuilt.tools import file_read, file_write, file_search

tool_node = ToolNode([file_read, file_write, file_search])
```

### file_read

| Parameter | Type | Description |
|---|---|---|
| `path` | `str` | Relative or absolute path to the file. |
| `encoding` | `str` | File encoding (default `"utf-8"`). |

Returns file content as a string.

### file_write

| Parameter | Type | Description |
|---|---|---|
| `path` | `str` | Path to write to. |
| `content` | `str` | Text content to write. |
| `mode` | `str` | `"w"` (overwrite, default) or `"a"` (append). |

Returns a success or error message.

### file_search

| Parameter | Type | Description |
|---|---|---|
| `pattern` | `str` | Glob pattern, e.g. `"*.py"` or `"**/*.md"`. |
| `root` | `str` | Root directory to search from (default: current working directory). |

Returns a JSON list of matching file paths.

---

## google_web_search

Calls the Google Custom Search API. Requires `GOOGLE_API_KEY` and `GOOGLE_CSE_ID` environment variables.

```bash
export GOOGLE_API_KEY=your-google-api-key
export GOOGLE_CSE_ID=your-custom-search-engine-id
```

```python
from agentflow.prebuilt.tools import google_web_search

tool_node = ToolNode([google_web_search])
```

**Tool schema:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | required | Search query string. |
| `num_results` | `int` | `5` | Number of results to return (max 10). |

Returns a JSON list of `{"title": ..., "url": ..., "snippet": ...}` objects.

---

## vertex_ai_search

Calls Google Vertex AI Search. Requires Google Cloud credentials and a Vertex AI data store ID.

```python
from agentflow.prebuilt.tools import vertex_ai_search

tool_node = ToolNode([vertex_ai_search])
```

Configure via environment variables:

```bash
export GOOGLE_CLOUD_PROJECT=your-gcp-project
export VERTEX_AI_DATA_STORE_ID=your-data-store-id
```

---

## Memory tools

Memory tools let the LLM search and write long-term user or agent memories. They are designed to be used with `MemoryConfig`.

### memory_tool

A general-purpose memory search and write tool for use without `MemoryConfig`.

```python
from agentflow.prebuilt.tools import memory_tool
from agentflow.storage.store import create_local_qdrant_store, OpenAIEmbedding

store = create_local_qdrant_store("./qdrant_data", OpenAIEmbedding())
tool = memory_tool(store)

tool_node = ToolNode([tool])
```

### make_user_memory_tool and make_agent_memory_tool

These are used internally by `MemoryConfig`; you can also call them directly if you need more control.

```python
from agentflow.prebuilt.tools import make_user_memory_tool, make_agent_memory_tool
from agentflow.storage.store import MemoryConfig, UserMemoryConfig

config = MemoryConfig(store=store)
user_tool = make_user_memory_tool(config)
agent_tool = make_agent_memory_tool(config)

tool_node = ToolNode([user_tool, agent_tool])
```

The typical pattern is to let `Agent(..., memory=MemoryConfig(...))` inject these tools automatically rather than registering them manually.

---

## create_handoff_tool

Creates a handoff tool that transfers control from one agent to another in multi-agent graphs (swarm or supervisor patterns). See [how-to/python/handoff-between-agents](handoff-between-agents.md) for the full handoff guide.

```python
from agentflow.prebuilt.tools import create_handoff_tool

handoff_to_billing = create_handoff_tool(
    agent_name="billing",
    description="Transfer the user to the billing agent for payment questions.",
)

tool_node = ToolNode([handoff_to_billing])
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `agent_name` | `str` | Name of the target agent node in the graph. |
| `description` | `str` | Description shown to the LLM to help it decide when to hand off. |

---

## Composing tools

All prebuilt tools can be mixed with custom tools in a single `ToolNode`:

```python
from agentflow.core.graph import Agent, StateGraph, ToolNode
from agentflow.prebuilt.tools import fetch_url, safe_calculator
from agentflow.utils.decorators import tool

@tool(name="get_exchange_rate", tags=["finance"])
async def get_exchange_rate(from_currency: str, to_currency: str) -> str:
    """Get the current exchange rate between two currencies."""
    return f"1 {from_currency} = 1.08 {to_currency}"

tool_node = ToolNode([fetch_url, safe_calculator, get_exchange_rate])

agent = Agent(
    model="gpt-4o",
    tool_node=tool_node,
)
```

---

## Prebuilt tool tags reference

| Tool | Tags |
|---|---|
| `fetch_url` | `["web", "fetch", "network"]` |
| `safe_calculator` | `["math", "calculator"]` |
| `file_read` | `["file", "read"]` |
| `file_write` | `["file", "write"]` |
| `file_search` | `["file", "search"]` |
| `google_web_search` | `["search", "web", "google"]` |
| `vertex_ai_search` | `["search", "vertex", "google"]` |

Use `Agent(..., tools_tags={"search"})` to expose only search-tagged tools to a particular agent.

---

## What you learned

- `fetch_url` fetches public URLs safely with timeout and size limits.
- `safe_calculator` evaluates arithmetic without exposing Python builtins.
- `file_read`, `file_write`, `file_search` provide controlled filesystem access.
- `google_web_search` and `vertex_ai_search` enable live web search capabilities.
- Memory tools are best used via `Agent(..., memory=MemoryConfig(...))` rather than added manually.
- `create_handoff_tool` enables agent-to-agent handoffs in multi-agent workflows.

## Next steps

- [Use prebuilt agents](use-prebuilt-agents.md) for ready-made agent wrappers.
- [Use the @tool decorator](use-tool-decorator.md) to build your own tools.
