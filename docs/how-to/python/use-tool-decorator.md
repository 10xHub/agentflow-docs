---
title: How to use the @tool decorator
sidebar_label: "@tool decorator"
description: Guide to marking Python functions as tools with name, description, tags, provider, capabilities, and metadata using the @tool decorator.
keywords:
  - agentflow tool decorator
  - python tool function
  - agent tools
  - tool tags
  - agentflow
sidebar_position: 3
---

# How to use the @tool decorator

The `@tool` decorator marks a Python function as an agent tool. It attaches metadata (name, description, tags, provider, capabilities) that `ToolNode` uses when building the function-calling schema sent to the LLM.

Without `@tool`, AgentFlow still registers the function — it falls back to `__name__` and the docstring. Use `@tool` when you need to override defaults or add tags for filtering.

---

## Basic usage

```python
from agentflow.utils.decorators import tool

@tool
def get_weather(city: str, units: str = "celsius") -> str:
    """Get the current weather for a city."""
    return f"Weather in {city}: 22°C"
```

The function behaves exactly as before. The decorator attaches private attributes that `ToolNode` reads at schema-generation time.

---

## Override name and description

```python
@tool(
    name="weather_lookup",
    description="Fetch live weather data for any city worldwide.",
)
def get_weather(city: str) -> str:
    return f"22°C in {city}"
```

The LLM sees `weather_lookup` as the tool name, not `get_weather`.

---

## Add tags for filtering

Tags let you expose different tool subsets to different agents without creating multiple `ToolNode` instances.

```python
@tool(tags=["search", "web"])
def web_search(query: str) -> str:
    """Search the internet."""
    return f"Results for {query}"

@tool(tags=["database", "admin"])
def run_query(sql: str) -> str:
    """Execute a SQL query."""
    return "..."

@tool(tags=["search"])
def local_search(query: str) -> str:
    """Search local files."""
    return f"Local results for {query}"
```

Pass `tools_tags` to `Agent` to restrict which tools are visible:

```python
from agentflow.core.graph import Agent, ToolNode

tool_node = ToolNode([web_search, run_query, local_search])

# This agent only sees tools tagged "search"
search_agent = Agent(
    model="gpt-4o",
    tool_node=tool_node,
    tools_tags={"search"},  # web_search and local_search only
)

# This agent sees all tools
full_agent = Agent(
    model="gpt-4o",
    tool_node=tool_node,
)
```

Tags are an `OR` filter: a tool is included if it has **any** of the requested tags.

---

## Mark capabilities

`capabilities` is an informational field. AgentFlow does not enforce them at runtime — they are stored as metadata for your own auditing or policy checks.

```python
@tool(
    name="send_email",
    capabilities=["network_access", "external_communication"],
)
async def send_email(to: str, subject: str, body: str) -> str:
    """Send an email."""
    return "Email sent."
```

---

## Add arbitrary metadata

`metadata` is a free-form dict for any application-specific fields.

```python
@tool(
    name="process_payment",
    tags=["payments"],
    metadata={"rate_limit": 10, "timeout_seconds": 30, "audit_required": True},
)
async def process_payment(amount: float, currency: str) -> dict:
    """Process a payment transaction."""
    return {"status": "ok", "transaction_id": "txn_123"}
```

---

## Async tools

`@tool` works the same on async functions. `ToolNode` handles both sync and async execution.

```python
import httpx

@tool(
    name="fetch_page",
    description="Fetch the text content of a web page.",
    tags=["web", "network"],
    capabilities=["network_access"],
)
async def fetch_page(url: str) -> str:
    """Fetch web page content."""
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=10)
        return response.text[:5000]
```

---

## Inspect tool metadata programmatically

```python
from agentflow.utils.decorators import get_tool_metadata, has_tool_decorator

print(has_tool_decorator(get_weather))  # True

meta = get_tool_metadata(get_weather)
print(meta["name"])          # "weather_lookup"
print(meta["tags"])          # {"search", "web"} or set()
print(meta["capabilities"])  # list or None
print(meta["metadata"])      # dict or None
```

---

## Private attributes on the function

The decorator sets these private attributes directly on the function object:

| Attribute | Source |
|---|---|
| `_py_tool_name` | `name` arg, fallback `__name__` |
| `_py_tool_description` | `description` arg, fallback `__doc__` |
| `_py_tool_tags` | `tags` arg (converted to `set`), fallback `set()` |
| `_py_tool_provider` | `provider` arg |
| `_py_tool_capabilities` | `capabilities` arg |
| `_py_tool_metadata` | `metadata` arg |

`ToolNode` reads these when building the JSON schema it sends to the LLM.

---

## Complete example

```python
from agentflow.utils.decorators import tool
from agentflow.core.graph import Agent, StateGraph, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.utils import END

@tool(
    name="search_knowledge_base",
    description="Search the internal knowledge base for product documentation.",
    tags=["search", "internal"],
)
async def search_kb(query: str, limit: int = 5) -> str:
    """Search the knowledge base."""
    return f"Found {limit} results for: {query}"

@tool(
    name="create_ticket",
    description="Create a support ticket for the user's issue.",
    tags=["support"],
    capabilities=["write_database"],
)
async def create_ticket(title: str, description: str, priority: str = "medium") -> dict:
    """Create a support ticket."""
    return {"ticket_id": "TICKET-001", "status": "created"}

tool_node = ToolNode([search_kb, create_ticket])

# Support agent: can search and create tickets
support_agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a support agent."}],
    tool_node=tool_node,
    # No tools_tags = all tools visible
)

# Read-only agent: can only search
readonly_agent = Agent(
    model="gpt-4o",
    tool_node=tool_node,
    tools_tags={"search"},  # only search_knowledge_base is visible
)
```

---

## What you learned

- `@tool` without arguments uses the function's `__name__` and docstring.
- `@tool(name=..., description=..., tags=..., capabilities=..., metadata=...)` overrides defaults.
- `tags` on tools + `tools_tags` on `Agent` provide fine-grained tool visibility control.
- `get_tool_metadata()` and `has_tool_decorator()` let you inspect metadata at runtime.

## Next steps

- [Build a graph](build-a-graph.md) to see how tools wire into the full workflow.
- [Use prebuilt tools](use-prebuilt-tools.md) for ready-made web, file, and search tools.
