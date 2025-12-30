# Tool Decorator Tutorial

This tutorial covers how to use the `@tool` decorator to create well-documented, discoverable tools for your agents.

---

## Why Use the @tool Decorator?

The `@tool` decorator provides several benefits:

1. **Rich Metadata**: Attach names, descriptions, tags, and custom metadata to tools
2. **Better Organization**: Filter and group tools by tags
3. **Improved Discovery**: Help LLMs understand what tools do
4. **Provider Tracking**: Know where each tool comes from
5. **Capability Documentation**: Document what each tool can and cannot do

---

## Quick Start

### Step 1: Import the Decorator

```python
from agentflow.utils import tool
```

### Step 2: Decorate Your Functions

```python
@tool
def add_numbers(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b
```

### Step 3: Use in ToolNode

```python
from agentflow.graph import ToolNode

tools = ToolNode([add_numbers])
```

That's it! The decorator automatically enhances your tool without changing its behavior.

---

## Adding Metadata

### Custom Name and Description

```python
@tool(
    name="add",
    description="Add two integers and return the sum"
)
def add_numbers(a: int, b: int) -> int:
    return a + b
```

### Adding Tags

Tags help organize and filter tools:

```python
@tool(
    name="read_database",
    description="Read data from the database",
    tags=["database", "read", "safe"]
)
def read_db(table: str, id: int) -> dict:
    # Implementation
    pass

@tool(
    name="write_database",
    description="Write data to the database",
    tags=["database", "write", "dangerous"]
)
def write_db(table: str, data: dict) -> bool:
    # Implementation
    pass
```

### Provider and Capabilities

Document where tools come from and what they can do:

```python
@tool(
    name="openai_completion",
    description="Get a completion from OpenAI",
    tags=["llm", "external"],
    provider="openai",
    capabilities=["streaming", "rate_limited"],
    metadata={
        "max_tokens": 4096,
        "cost_per_1k_tokens": 0.002
    }
)
async def openai_complete(prompt: str) -> str:
    # Implementation
    pass
```

### Custom Metadata

Store any additional information:

```python
@tool(
    name="expensive_api",
    description="Call an expensive third-party API",
    tags=["external", "paid"],
    metadata={
        "cost_per_call": 0.01,
        "rate_limit": 100,
        "timeout_seconds": 30,
        "requires_auth": True
    }
)
def call_api(endpoint: str) -> dict:
    # Implementation
    pass
```

---

## Tag-Based Filtering

Create different tool sets for different scenarios:

```python
from agentflow.graph import ToolNode

# Define tools with tags
@tool(tags=["database", "read"])
def read_user(user_id: int):
    """Read user from database."""
    pass

@tool(tags=["database", "write"])
def create_user(name: str):
    """Create a new user."""
    pass

@tool(tags=["web", "search"])
def search_web(query: str):
    """Search the web."""
    pass

@tool(tags=["web", "scrape"])
def scrape_page(url: str):
    """Scrape a web page."""
    pass

# Create ToolNode with all tools
all_tools = [read_user, create_user, search_web, scrape_page]
tool_node = ToolNode(all_tools)

# Get filtered tools by passing tags parameter to all_tools()
read_only_tools = await tool_node.all_tools(tags={"read"})      # Just read_user
web_tools = await tool_node.all_tools(tags={"web"})             # search_web, scrape_page
# Note: Tools with ANY of the specified tags are included (set intersection check)
```

### Real-World Example: Multi-Agent System

```python
# Define tools for different agent roles
@tool(tags=["research", "web"])
def research_topic(topic: str) -> str:
    """Research a topic on the web."""
    pass

@tool(tags=["research", "database"])
def query_knowledge_base(query: str) -> str:
    """Query internal knowledge base."""
    pass

@tool(tags=["writing", "generate"])
def draft_content(outline: str) -> str:
    """Draft content from an outline."""
    pass

@tool(tags=["writing", "edit"])
def edit_content(content: str) -> str:
    """Edit and improve content."""
    pass

@tool(tags=["review", "check"])
def check_facts(content: str) -> dict:
    """Verify facts in content."""
    pass

# Create specialized agent tool nodes
all_tools = [research_topic, query_knowledge_base, draft_content, edit_content, check_facts]
tool_node = ToolNode(all_tools)

# Get filtered tools for each agent type
research_tools = await tool_node.all_tools(tags={"research"})
writing_tools = await tool_node.all_tools(tags={"writing"})
review_tools = await tool_node.all_tools(tags={"review"})

# Use in agent LLM calls
response = completion(
    model="gpt-4o-mini",
    messages=messages,
    tools=research_tools  # Only research-tagged tools
)
```

---

## Working with Injectable Parameters

The decorator works seamlessly with injectable parameters:

```python
from agentflow.state import AgentState
from agentflow.utils import Message

@tool(
    name="stateful_tool",
    description="A tool that accesses agent state"
)
def stateful_tool(
    user_input: str,
    tool_call_id: str | None = None,  # Auto-injected
    state: AgentState | None = None   # Auto-injected
) -> Message:
    """Tool that uses injected parameters."""
    # Access current state
    history = state.context if state else []
    
    # Do something with user_input
    result = f"Processed: {user_input}"
    
    # Return tool message
    return Message.tool_message(
        content=result,
        tool_call_id=tool_call_id
    )
```

**Important**: Injectable parameters (`tool_call_id`, `state`, `config`) are automatically excluded from the tool schema presented to the LLM.

---

## Metadata Introspection

Access tool metadata at runtime:

```python
from agentflow.utils import get_tool_metadata, has_tool_decorator

@tool(
    name="example",
    description="An example tool",
    tags=["demo"],
    provider="internal"
)
def my_tool(x: int) -> int:
    return x * 2

# Check if decorated
if has_tool_decorator(my_tool):
    print("Tool is decorated!")

# Get metadata
metadata = get_tool_metadata(my_tool)
print(f"Name: {metadata['name']}")           # "example"
print(f"Description: {metadata['description']}")  # "An example tool"
print(f"Tags: {metadata['tags']}")           # {"demo"}
print(f"Provider: {metadata['provider']}")   # "internal"
```

### Building Tool Registries

```python
def build_tool_registry(tools: list) -> dict:
    """Build a registry of tools by provider."""
    registry = {}
    
    for tool in tools:
        if has_tool_decorator(tool):
            metadata = get_tool_metadata(tool)
            provider = metadata.get("provider", "unknown")
            
            if provider not in registry:
                registry[provider] = []
            
            registry[provider].append({
                "function": tool,
                "name": metadata["name"],
                "description": metadata["description"],
                "tags": metadata["tags"]
            })
    
    return registry

# Use it
registry = build_tool_registry(all_tools)
internal_tools = registry.get("internal", [])
openai_tools = registry.get("openai", [])
```

---

## Async Tools

The decorator works with async functions:

```python
import httpx

@tool(
    name="fetch_url",
    description="Fetch content from a URL",
    tags=["network", "async"],
    capabilities=["async"]
)
async def fetch_url(url: str) -> str:
    """Asynchronously fetch URL content."""
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.text

# Use in async context
tool_node = ToolNode([fetch_url])
result = await tool_node.invoke(...)
```

---

## Complete Example: React Agent

Here's a complete example using the decorator with a React agent:

```python
from agentflow.graph import StateGraph, ToolNode
from agentflow.state import AgentState
from agentflow.utils import tool, Message
from agentflow.utils.constants import START, END
from litellm import completion

# Define tools with decorator
@tool(
    name="calculator",
    description="Perform mathematical calculations",
    tags=["math", "safe"]
)
def calculate(expression: str) -> float:
    """Safely evaluate a mathematical expression."""
    try:
        # Note: Use a safe eval library in production
        return eval(expression)
    except Exception as e:
        return f"Error: {str(e)}"

@tool(
    name="search",
    description="Search for information on the web",
    tags=["web", "external"],
    provider="google",
    capabilities=["rate_limited"]
)
def search(query: str) -> str:
    """Search the web for information."""
    # Implementation here
    return f"Search results for: {query}"

@tool(
    name="summarize",
    description="Summarize long text into key points",
    tags=["text", "processing"]
)
def summarize(text: str, max_length: int = 100) -> str:
    """Summarize text to a maximum length."""
    return text[:max_length] + "..."

# Create tool node
tools = ToolNode([calculate, search, summarize])

# Define agent node
def agent_node(state: AgentState, config: dict) -> list[Message]:
    """Agent reasoning node."""
    response = completion(
        model="gpt-4o-mini",
        messages=[msg.model_dump() for msg in state.context],
        tools=tools.all_tools_sync()
    )
    return [Message.from_response(response)]

# Define router
def should_continue(state: AgentState) -> str:
    """Route based on last message."""
    last_message = state.context[-1]
    if last_message.role == "assistant" and last_message.tool_calls:
        return "tools"
    return END

# Build graph
graph = StateGraph()
graph.add_node("agent", agent_node)
graph.add_node("tools", tools)
graph.set_entry_point("agent")
graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")

# Compile and use
app = graph.compile()
result = app.invoke({
    "context": [Message.from_text("What is 15 * 234?", role="user")]
})
```

---

## Advanced Patterns

### Dynamic Tool Loading

```python
def load_tools_by_category(category: str) -> list:
    """Load all tools for a category."""
    all_tools = [tool1, tool2, tool3, ...]  # Your tool collection
    
    matching_tools = []
    for tool in all_tools:
        if has_tool_decorator(tool):
            metadata = get_tool_metadata(tool)
            if category in metadata.get("tags", set()):
                matching_tools.append(tool)
    
    return matching_tools

# Load only database tools for this agent
db_tools = load_tools_by_category("database")
tool_node = ToolNode(db_tools)

# Or use ToolNode's built-in tag filtering
all_tool_node = ToolNode(all_tools)
db_tool_schemas = await all_tool_node.all_tools(tags={"database"})
```

### Tool Versioning

```python
@tool(
    name="process_data_v2",
    description="Process data using the latest algorithm",
    tags=["processing"],
    metadata={"version": "2.0", "deprecated": False}
)
def process_data(data: dict) -> dict:
    """New version of data processing."""
    pass

@tool(
    name="process_data_v1",
    description="Process data using legacy algorithm",
    tags=["processing", "legacy"],
    metadata={"version": "1.0", "deprecated": True}
)
def process_data_legacy(data: dict) -> dict:
    """Legacy version - use v2 instead."""
    pass
```

### Permission-Based Filtering

```python
@tool(
    name="read_sensitive",
    description="Read sensitive data",
    tags=["sensitive", "read"],
    metadata={"required_permission": "admin"}
)
def read_sensitive():
    pass

def filter_by_permission(tools: list, user_role: str) -> list:
    """Filter tools based on user permissions."""
    allowed = []
    for tool in tools:
        if has_tool_decorator(tool):
            metadata = get_tool_metadata(tool)
            required = metadata.get("metadata", {}).get("required_permission")
            if not required or user_role == "admin":
                allowed.append(tool)
    return allowed
```

---

## Best Practices

### 1. Consistent Naming

```python
# Good: verb_noun pattern
@tool(name="search_documents")
@tool(name="create_user")
@tool(name="delete_file")

# Avoid: noun-only or unclear
@tool(name="documents")  # What does this do?
@tool(name="user")       # Create? Read? Update?
```

### 2. Clear Descriptions

```python
# Good: specific and actionable
@tool(description="Search the internal knowledge base for technical documentation using semantic search")

# Avoid: vague or generic
@tool(description="Does stuff with documents")
```

### 3. Meaningful Tags

```python
# Good: hierarchical and specific
@tool(tags=["database", "user", "read", "safe"])
@tool(tags=["api", "external", "openai", "expensive"])

# Avoid: too generic
@tool(tags=["function", "tool"])
```

### 4. Document Capabilities

```python
@tool(
    name="api_tool",
    description="Call an API with specific capabilities",
    capabilities=["async", "streaming", "rate_limited"],
    metadata={
        "idempotent": True,         # Safe to retry
        "requires_auth": True       # Needs authentication
    }
)
```

### 5. Include Cost Information

```python
@tool(
    name="paid_api_call",
    description="Call a paid external API",
    provider="external_api",
    tags=["paid", "external"],
    metadata={
        "cost_per_call": 0.001,     # Cost in USD
        "average_latency_ms": 250,  # Expected latency
        "rate_limit": 100,           # Calls per minute
        "timeout_seconds": 30        # Maximum execution time
    }
)
```

---

## Troubleshooting

### Decorator Not Working?

Make sure you're using keyword arguments:

```python
# Wrong
@tool("my_tool")

# Correct
@tool(name="my_tool")
```

### Tags Not Filtering Correctly?

Tags are converted to sets, so order doesn't matter:

```python
@tool(tags=["a", "b"])  # Same as tags=["b", "a"]
```

### Metadata Not Appearing?

Check that you're using `get_tool_metadata()`:

```python
# Wrong
metadata = my_tool._py_tool_metadata  # Direct access

# Correct
from agentflow.utils import get_tool_metadata
metadata = get_tool_metadata(my_tool)
```

---

## Migration from Undecorated Tools

Existing tools continue to work without modification:

```python
# Old style - still works
def legacy_tool(x: int) -> int:
    """Legacy tool without decorator."""
    return x * 2

# New style - recommended
@tool(
    name="modern_tool",
    description="Modern tool with metadata",
    tags=["new"]
)
def modern_tool(x: int) -> int:
    """Modern tool with decorator."""
    return x * 2

# Both work together
tools = ToolNode([legacy_tool, modern_tool])
```

---

## Next Steps

- See [Tools Concept Guide](../Concept/graph/tools.md) for deeper technical details
- Check out [React Tutorial](react/01-basic-react.md) for agent examples
- Explore [MCP Integration](react/03-mcp-integration.md) for external tool sources

---

**Pro Tip**: Start by decorating your most-used tools with basic metadata, then gradually add tags and capabilities as your tool library grows.
