# Tool Decorator API Reference

Quick reference for the `@tool` decorator and tag filtering API.

---

## Decorator Syntax

```python
from agentflow.utils import tool

@tool(
    name: str | None = None,
    description: str | None = None,
    tags: list[str] | set[str] | None = None,
    provider: str | None = None,
    capabilities: list[str] | None = None,
    metadata: dict[str, Any] | None = None
)
def my_function(...):
    """Function implementation."""
    pass
```

---

## Tag Filtering API

### ❌ INCORRECT (Does Not Exist)

```python
# This method does NOT exist - will cause AttributeError
tool_node.filter_by_tags(["database"])  # ❌ ERROR
```

### ✅ CORRECT Usage

```python
from agentflow.graph import ToolNode

# Define tools with tags
@tool(tags=["database", "read"])
def read_db(id: int): pass

@tool(tags=["database", "write"])
def write_db(data: dict): pass

@tool(tags=["web", "search"])
def search_web(query: str): pass

# Create ToolNode
all_tools = [read_db, write_db, search_web]
tool_node = ToolNode(all_tools)

# CORRECT: Pass tags parameter to all_tools() or all_tools_sync()
db_tools = await tool_node.all_tools(tags={"database"})  # ✅ Returns read_db, write_db schemas
read_tools = await tool_node.all_tools(tags={"read"})    # ✅ Returns read_db schema
web_tools = tool_node.all_tools_sync(tags={"web"})       # ✅ Sync version

# Tags parameter accepts a set[str]
filtered = await tool_node.all_tools(tags={"database", "web"})
```

---

## How Tag Filtering Works

```python
# From schema.py implementation:
def get_local_tool(self, tags: set[str] | None = None) -> list[dict]:
    """Generate tool schemas for registered functions."""
    tools = []
    for name, fn in self._funcs.items():
        fun_tags = getattr(fn, "_py_tool_tags", None)
        
        # Skip tools that don't match the filter
        if tags and fun_tags and tags.isdisjoint(fun_tags):
            continue
        
        # Include this tool
        tools.append(...)
    return tools
```

**Key Points:**

1. **Intersection check**: Tools are included if they have ANY tag from the filter set
2. **`isdisjoint()` logic**: Tool is SKIPPED if filter tags and tool tags have NO overlap
3. **Empty filter**: If `tags=None`, all tools are returned
4. **No tags on tool**: Tools without tags are always included (unless filter is provided)

---

## Complete Examples

### Async Context

```python
from agentflow.graph import ToolNode, StateGraph
from agentflow.utils import tool
from litellm import acompletion

@tool(tags=["safe", "read"])
def read_data(id: int): pass

@tool(tags=["dangerous", "write"])
def delete_data(id: int): pass

tool_node = ToolNode([read_data, delete_data])

# In an async agent node
async def agent_node(state, config):
    # Get only safe tools for this agent
    safe_tools = await tool_node.all_tools(tags={"safe"})
    
    response = await acompletion(
        model="gpt-4o-mini",
        messages=[...],
        tools=safe_tools  # Only safe tools available
    )
    return response
```

### Sync Context

```python
from litellm import completion

# Sync version for non-async code
def agent_node_sync(state, config):
    safe_tools = tool_node.all_tools_sync(tags={"safe"})
    
    response = completion(
        model="gpt-4o-mini",
        messages=[...],
        tools=safe_tools
    )
    return response
```

### Multiple Tag Filters

```python
# Tools with multiple tags
@tool(tags=["database", "user", "read"])
def get_user(id: int): pass

@tool(tags=["database", "user", "write"])
def create_user(name: str): pass

@tool(tags=["database", "product", "read"])
def get_product(id: int): pass

tool_node = ToolNode([get_user, create_user, get_product])

# Filter by category
user_tools = await tool_node.all_tools(tags={"user"})      # get_user, create_user
product_tools = await tool_node.all_tools(tags={"product"}) # get_product
read_tools = await tool_node.all_tools(tags={"read"})      # get_user, get_product

# Multiple tags = OR logic (ANY match includes the tool)
db_or_user = await tool_node.all_tools(tags={"database", "user"})  # All three tools
```

---

## Utility Functions

```python
from agentflow.utils import get_tool_metadata, has_tool_decorator

@tool(name="example", description="Test", tags=["demo"])
def my_tool(x: int): return x * 2

# Check if decorated
if has_tool_decorator(my_tool):
    print("Tool has decorator")

# Get all metadata
metadata = get_tool_metadata(my_tool)
print(metadata)
# Output:
# {
#     'name': 'example',
#     'description': 'Test',
#     'tags': {'demo'},
#     'provider': None,
#     'capabilities': None,
#     'metadata': None
# }
```

---

## Common Patterns

### Role-Based Tool Access

```python
@tool(tags=["admin", "dangerous"])
def delete_user(id: int): pass

@tool(tags=["user", "safe"])
def view_profile(id: int): pass

def get_tools_for_role(tool_node, role: str):
    """Get tools appropriate for user role."""
    if role == "admin":
        return tool_node.all_tools_sync()  # All tools
    else:
        return tool_node.all_tools_sync(tags={"safe"})  # Only safe tools
```

### Environment-Specific Tools

```python
@tool(tags=["production", "external"])
def call_payment_api(): pass

@tool(tags=["development", "mock"])
def mock_payment_api(): pass

# Select based on environment
import os
env = os.getenv("ENVIRONMENT", "development")
tools = await tool_node.all_tools(tags={env})
```

---

## See Also

- [Tool Decorator Tutorial](../../Tutorial/tool-decorator.md) - Comprehensive guide
- [Tools Concept Guide](tools.md) - Deep dive into ToolNode
- [React Examples](../../../examples/tool-decorator/) - Working code examples
