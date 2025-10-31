# React Agents with Model Context Protocol (MCP)

The **Model Context Protocol (MCP)** is a standardized way to connect LLMs with external data sources and tools.  Agentflow provides seamless MCP integration, allowing your React agents to interact with databases, APIs, file systems, and custom services through a unified protocol.

## 🎯 Learning Objectives

By the end of this tutorial, you'll understand:

- What MCP is and why it's important for agent development
- How to integrate MCP servers with  Agentflow React agents
- Building and consuming MCP tools in agent workflows
- Creating custom MCP servers for domain-specific functionality
- Debugging and monitoring MCP-enabled agents

## 🌐 Understanding Model Context Protocol

### What is MCP?

MCP is an open protocol that enables secure, standardized communication between AI applications and data sources. It provides:

- **Standardized Interface**: Consistent API for different data sources
- **Security**: Built-in authentication and authorization
- **Flexibility**: Support for various transport mechanisms
- **Extensibility**: Easy to add new capabilities and data sources

### MCP Architecture

```
React Agent ←→  Agentflow ←→ MCP Client ←→ MCP Server ←→ External System
                                ↑              ↑
                          Protocol Layer   Data Source
```

### Benefits of MCP Integration

- **Protocol Standardization**: No need to learn different APIs for each service
- **Security**: Built-in authentication and permission management
- **Scalability**: Easy to add new data sources without agent changes
- **Maintainability**: Centralized tool management through MCP servers
- **Interoperability**: Works with any MCP-compliant system

## 🏗️ MCP Components in  Agentflow

### 1. MCP Client Setup

```python
from fastmcp import Client

# MCP client configuration
config = {
    "mcpServers": {
        "weather": {
            "url": "http://127.0.0.1:8000/mcp",
            "transport": "streamable-http",
        },
        "database": {
            "url": "http://db-service:8001/mcp",
            "transport": "streamable-http",
        }
    }
}

# Create MCP client
mcp_client = Client(config)
```

### 2. ToolNode with MCP Integration

```python
from agentflow.graph import ToolNode

# ToolNode with MCP client (no custom functions needed)
tool_node = ToolNode(functions=[], client=mcp_client)

#  Agentflow automatically discovers and registers MCP tools
```

### 3. MCP-Enabled React Agent

```python
async def mcp_agent(state: AgentState, config: dict) -> ModelResponseConverter:
    """React agent with MCP tool integration."""

    system_prompt = """
    You are an intelligent assistant with access to various data sources
    through standardized tools. Use the available tools to help users
    with their requests.
    """

    messages = convert_messages(
        system_prompts=[{"role": "system", "content": system_prompt}],
        state=state
    )

    # Get MCP tools dynamically
    tools = await tool_node.all_tools()

    response = await acompletion(
        model="gemini/gemini-2.0-flash",
        messages=messages,
        tools=tools
    )

    return ModelResponseConverter(response, converter="litellm")
```

## 🌤️ Complete Example: Weather Agent with MCP

Let's build a weather agent that uses MCP for tool integration:

### Step 1: Create MCP Server

First, create a simple MCP server that provides weather functionality:

```python
# File: weather_mcp_server.py
from fastmcp import FastMCP
from typing import Dict, Any
import uvicorn
import asyncio

# Create MCP server
mcp = FastMCP("Weather Service")

@mcp.tool()
def get_weather(location: str) -> str:
    """
    Get current weather for a location.

    Args:
        location: City name or location to get weather for

    Returns:
        Current weather information
    """
    # In production, call actual weather API
    return f"Current weather in {location}: Sunny, 24°C (75°F), light breeze"

@mcp.tool()
def get_forecast(location: str, days: int = 3) -> str:
    """
    Get weather forecast for multiple days.

    Args:
        location: City name or location
        days: Number of days to forecast (1-7)

    Returns:
        Multi-day weather forecast
    """
    if days > 7:
        days = 7

    return f"{days}-day forecast for {location}: Mostly sunny with temperatures between 20-26°C"

@mcp.tool()
def get_weather_alerts(location: str) -> str:
    """
    Get weather alerts and warnings for a location.

    Args:
        location: City name or location

    Returns:
        Active weather alerts, if any
    """
    # Mock implementation
    return f"No active weather alerts for {location}"

# Additional server info
@mcp.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "weather_mcp"}

if __name__ == "__main__":
    print("Starting Weather MCP Server on http://127.0.0.1:8000")
    uvicorn.run(mcp.app, host="127.0.0.1", port=8000)
```

### Step 2: Create MCP Client Configuration

```python
# File: mcp_config.py
from fastmcp import Client

def create_mcp_client() -> Client:
    """Create and configure MCP client."""

    config = {
        "mcpServers": {
            "weather": {
                "url": "http://127.0.0.1:8000/mcp",
                "transport": "streamable-http",
            },
            # Add more servers as needed
            # "database": {
            #     "url": "http://127.0.0.1:8001/mcp",
            #     "transport": "streamable-http",
            # }
        }
    }

    return Client(config)
```

### Step 3: Build MCP-Enabled React Agent

```python
# File: mcp_react_agent.py
from typing import Any
from dotenv import load_dotenv
from litellm import acompletion

from agentflow.adapters.llm.model_response_converter import ModelResponseConverter
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.graph import StateGraph, ToolNode
from agentflow.state.agent_state import AgentState
from agentflow.utils import Message
from agentflow.utils.constants import END
from agentflow.utils.converter import convert_messages
from mcp_config import create_mcp_client

load_dotenv()

# Create MCP client and tool node
mcp_client = create_mcp_client()
tool_node = ToolNode(functions=[], client=mcp_client)


async def mcp_main_agent(
        state: AgentState,
        config: dict[str, Any],
        checkpointer: Any | None = None,
        store: Any | None = None,
) -> ModelResponseConverter:
    """
    Main agent that uses MCP tools for weather information.
    """

    system_prompt = """
    You are a helpful weather assistant with access to comprehensive weather services.

    Available capabilities through MCP tools:
    - Current weather information for any location
    - Multi-day weather forecasts
    - Weather alerts and warnings

    Guidelines:
    - Use appropriate tools based on user requests
    - Provide detailed, helpful weather information
    - If users ask for forecasts, use the forecast tool
    - Always check for weather alerts when relevant
    - Be conversational and friendly
    """

    messages = convert_messages(
        system_prompts=[{"role": "system", "content": system_prompt}],
        state=state,
    )

    # Get available MCP tools
    tools = await tool_node.all_tools()
    print(f"Available MCP tools: {len(tools)} tools discovered")

    # Log tool names for debugging
    for tool in tools:
        if isinstance(tool, dict) and "function" in tool:
            print(f"  - {tool['function']['name']}")

    # Make LLM call with MCP tools
    response = await acompletion(
        model="gemini/gemini-2.5-flash",
        messages=messages,
        tools=tools,
    )

    return ModelResponseConverter(response, converter="litellm")


def should_use_mcp_tools(state: AgentState) -> str:
    """Routing logic for MCP-enabled agent."""

    if not state.context:
        return "TOOL"

    last_message = state.context[-1]

    # If assistant made tool calls, execute them via MCP
    if (hasattr(last_message, "tools_calls") and
            last_message.tools_calls and
            len(last_message.tools_calls) > 0 and
            last_message.role == "assistant"):
        return "TOOL"

    # If we got MCP tool results, return to main agent
    if last_message.role == "tool" and last_message.tool_call_id is not None:
        return "MAIN"

    # Default: conversation complete
    return END


# Build the graph
graph = StateGraph()
graph.add_node("MAIN", mcp_main_agent)
graph.add_node("TOOL", tool_node)

graph.add_conditional_edges("MAIN", should_use_mcp_tools, {
    "TOOL": "TOOL",
    END: END
})

graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

# Compile with checkpointer
app = graph.compile(checkpointer=InMemoryCheckpointer())
```

### Step 4: Run the MCP Agent

```python
# File: run_mcp_agent.py
import asyncio
from agentflow.utils import Message


async def demo_mcp_agent():
    """Demonstrate MCP-enabled weather agent."""

    print("🌤️ MCP Weather Agent Demo")
    print("=" * 50)

    test_queries = [
        "What's the weather like in London today?",
        "Can you give me a 5-day forecast for New York?",
        "Are there any weather alerts for Miami?",
        "Compare the weather in Tokyo and Sydney"
    ]

    for i, query in enumerate(test_queries):
        print(f"\n🔹 Query {i + 1}: {query}")
        print("-" * 40)

        try:
            # Prepare input
            inp = {"messages": [Message.from_text(query)]}
            config = {"thread_id": f"mcp-demo-{i}", "recursion_limit": 10}

            # Run agent
            result = app.invoke(inp, config=config)

            # Display conversation
            for message in result["messages"]:
                role_emoji = {
                    "user": "👤",
                    "assistant": "🤖",
                    "tool": "🔧"
                }
                emoji = role_emoji.get(message.role, "❓")

                print(f"{emoji} {message.role.upper()}: {message.content}")

                if message.role == "tool":
                    print(f"   └─ Tool Call ID: {message.tool_call_id}")

        except Exception as e:
            print(f"❌ Error: {e}")

        print()


if __name__ == "__main__":
    asyncio.run(demo_mcp_agent())
```

### Step 5: Running the Complete System

1. **Start the MCP server**:
```bash
python weather_mcp_server.py
```

2. **Run the agent** (in another terminal):
```bash
python run_mcp_agent.py
```

## 🔧 Advanced MCP Patterns

### Multi-Server MCP Client

```python
def create_multi_server_client() -> Client:
    """MCP client with multiple server connections."""

    config = {
        "mcpServers": {
            # Weather service
            "weather": {
                "url": "http://weather-service:8000/mcp",
                "transport": "streamable-http",
            },
            # Database service
            "database": {
                "url": "http://db-service:8001/mcp",
                "transport": "streamable-http",
                "auth": {
                    "type": "bearer",
                    "token": "your_db_token"
                }
            },
            # File system service
            "filesystem": {
                "url": "http://fs-service:8002/mcp",
                "transport": "streamable-http",
            },
            # Web search service
            "search": {
                "url": "http://search-service:8003/mcp",
                "transport": "streamable-http",
            }
        }
    }

    return Client(config)
```

### MCP Tool Discovery and Filtering

```python
async def filtered_mcp_agent(state: AgentState) -> ModelResponseConverter:
    """Agent that filters MCP tools based on context."""

    # Get all available MCP tools
    all_tools = await tool_node.all_tools()

    # Filter tools based on conversation context
    filtered_tools = filter_tools_by_context(state, all_tools)

    # Use only relevant tools
    response = await acompletion(
        model="gpt-4",
        messages=messages,
        tools=filtered_tools
    )

    return ModelResponseConverter(response, converter="litellm")

def filter_tools_by_context(state: AgentState, tools: list) -> list:
    """Filter tools based on conversation context."""

    # Extract context keywords
    context_text = " ".join([msg.content for msg in state.context or []])
    context_lower = context_text.lower()

    filtered = []

    for tool in tools:
        if isinstance(tool, dict) and "function" in tool:
            tool_name = tool["function"]["name"]
            tool_desc = tool["function"].get("description", "")

            # Include weather tools if weather-related context
            if ("weather" in context_lower or "forecast" in context_lower):
                if "weather" in tool_name or "forecast" in tool_name:
                    filtered.append(tool)

            # Include search tools if search-related context
            elif ("search" in context_lower or "find" in context_lower):
                if "search" in tool_name or "find" in tool_name:
                    filtered.append(tool)

            # Include database tools if data-related context
            elif ("data" in context_lower or "query" in context_lower):
                if "query" in tool_name or "database" in tool_name:
                    filtered.append(tool)

            # Default: include general tools
            else:
                if "general" in tool_desc or len(filtered) == 0:
                    filtered.append(tool)

    return filtered or tools  # Return all tools if no matches
```

### Error Handling for MCP Connections

```python
async def robust_mcp_agent(state: AgentState) -> ModelResponseConverter:
    """MCP agent with robust error handling."""

    try:
        # Try to get MCP tools
        tools = await asyncio.wait_for(
            tool_node.all_tools(),
            timeout=5.0  # 5 second timeout
        )

        # Check if tools are available
        if not tools:
            return await fallback_response(state, "No tools available")

        # Normal operation with tools
        response = await acompletion(
            model="gpt-4",
            messages=messages,
            tools=tools
        )

        return ModelResponseConverter(response, converter="litellm")

    except asyncio.TimeoutError:
        return await fallback_response(state, "Tool service timeout")

    except ConnectionError:
        return await fallback_response(state, "Tool service unavailable")

    except Exception as e:
        logging.error(f"MCP agent error: {e}")
        return await fallback_response(state, "Unexpected error")

async def fallback_response(state: AgentState, error_reason: str) -> list[Message]:
    """Provide fallback response when MCP tools are unavailable."""

    fallback_message = f"""
    I apologize, but I'm currently experiencing technical difficulties
    with my tool services ({error_reason}). I can still help with
    general questions that don't require real-time data.
    """

    return [Message.text_message(fallback_message)]
```

## 🏗️ Building Custom MCP Servers

### Database MCP Server

```python
# File: database_mcp_server.py
from fastmcp import FastMCP
import sqlite3
import json

mcp = FastMCP("Database Service")

# Initialize database
conn = sqlite3.connect("example.db")
cursor = conn.cursor()

# Create sample tables
cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT,
        city TEXT
    )
""")

cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER,
        product TEXT,
        amount REAL,
        order_date TEXT
    )
""")

# Insert sample data
sample_customers = [
    (1, "John Doe", "john@example.com", "New York"),
    (2, "Jane Smith", "jane@example.com", "London"),
    (3, "Bob Johnson", "bob@example.com", "Tokyo")
]

cursor.executemany("INSERT OR REPLACE INTO customers VALUES (?, ?, ?, ?)", sample_customers)
conn.commit()

@mcp.tool()
def query_customers(city: str | None = None) -> str:
    """
    Query customers from database.

    Args:
        city: Optional city filter

    Returns:
        JSON list of customers
    """
    try:
        if city:
            cursor.execute("SELECT * FROM customers WHERE city = ?", (city,))
        else:
            cursor.execute("SELECT * FROM customers")

        customers = cursor.fetchall()

        # Convert to dict format
        result = []
        for customer in customers:
            result.append({
                "id": customer[0],
                "name": customer[1],
                "email": customer[2],
                "city": customer[3]
            })

        return json.dumps(result, indent=2)

    except Exception as e:
        return f"Database error: {str(e)}"

@mcp.tool()
def add_customer(name: str, email: str, city: str) -> str:
    """
    Add a new customer to the database.

    Args:
        name: Customer name
        email: Customer email
        city: Customer city

    Returns:
        Success message with customer ID
    """
    try:
        cursor.execute(
            "INSERT INTO customers (name, email, city) VALUES (?, ?, ?)",
            (name, email, city)
        )
        conn.commit()

        customer_id = cursor.lastrowid
        return f"Customer added successfully with ID: {customer_id}"

    except Exception as e:
        return f"Error adding customer: {str(e)}"

@mcp.tool()
def get_customer_stats() -> str:
    """
    Get customer statistics.

    Returns:
        Statistics about customers in the database
    """
    try:
        # Total customers
        cursor.execute("SELECT COUNT(*) FROM customers")
        total = cursor.fetchone()[0]

        # Customers by city
        cursor.execute("SELECT city, COUNT(*) FROM customers GROUP BY city")
        by_city = cursor.fetchall()

        stats = {
            "total_customers": total,
            "customers_by_city": dict(by_city)
        }

        return json.dumps(stats, indent=2)

    except Exception as e:
        return f"Error getting stats: {str(e)}"

if __name__ == "__main__":
    import uvicorn
    print("Starting Database MCP Server on http://127.0.0.1:8001")
    uvicorn.run(mcp.app, host="127.0.0.1", port=8001)
```

### File System MCP Server

```python
# File: filesystem_mcp_server.py
from fastmcp import FastMCP
import os
import json
from pathlib import Path

mcp = FastMCP("File System Service")

# Define safe sandbox directory
SANDBOX_DIR = Path("./sandbox")
SANDBOX_DIR.mkdir(exist_ok=True)

def safe_path(filename: str) -> Path:
    """Ensure file operations stay within sandbox."""
    path = SANDBOX_DIR / filename
    # Resolve to absolute path and check it's within sandbox
    abs_path = path.resolve()
    abs_sandbox = SANDBOX_DIR.resolve()

    if not abs_path.is_relative_to(abs_sandbox):
        raise ValueError(f"Path outside sandbox: {filename}")

    return abs_path

@mcp.tool()
def read_file(filename: str) -> str:
    """
    Read contents of a file from the sandbox directory.

    Args:
        filename: Name of file to read

    Returns:
        File contents or error message
    """
    try:
        path = safe_path(filename)

        if not path.exists():
            return f"File not found: {filename}"

        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()

        return f"Content of {filename}:\n\n{content}"

    except Exception as e:
        return f"Error reading file: {str(e)}"

@mcp.tool()
def write_file(filename: str, content: str) -> str:
    """
    Write content to a file in the sandbox directory.

    Args:
        filename: Name of file to write
        content: Content to write to the file

    Returns:
        Success message or error
    """
    try:
        path = safe_path(filename)

        # Create parent directories if needed
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

        return f"Successfully wrote {len(content)} characters to {filename}"

    except Exception as e:
        return f"Error writing file: {str(e)}"

@mcp.tool()
def list_files(directory: str = ".") -> str:
    """
    List files in a directory within the sandbox.

    Args:
        directory: Directory to list (relative to sandbox)

    Returns:
        JSON list of files and directories
    """
    try:
        path = safe_path(directory)

        if not path.exists():
            return f"Directory not found: {directory}"

        if not path.is_dir():
            return f"Not a directory: {directory}"

        items = []
        for item in path.iterdir():
            items.append({
                "name": item.name,
                "type": "directory" if item.is_dir() else "file",
                "size": item.stat().st_size if item.is_file() else None
            })

        return json.dumps(items, indent=2)

    except Exception as e:
        return f"Error listing directory: {str(e)}"

if __name__ == "__main__":
    import uvicorn
    print("Starting File System MCP Server on http://127.0.0.1:8002")
    uvicorn.run(mcp.app, host="127.0.0.1", port=8002)
```

## 🐛 Debugging MCP Integration

### MCP Connection Testing

```python
async def test_mcp_connection():
    """Test MCP server connections."""

    client = create_mcp_client()

    try:
        # Create test tool node
        test_tool_node = ToolNode(functions=[], client=client)

        # Test tool discovery
        tools = await asyncio.wait_for(
            test_tool_node.all_tools(),
            timeout=10.0
        )

        print(f"✅ MCP Connection successful - {len(tools)} tools available")

        # List discovered tools
        for tool in tools:
            if isinstance(tool, dict) and "function" in tool:
                name = tool["function"]["name"]
                desc = tool["function"].get("description", "No description")
                print(f"  🔧 {name}: {desc}")

        return True

    except asyncio.TimeoutError:
        print("❌ MCP Connection timeout")
        return False

    except Exception as e:
        print(f"❌ MCP Connection error: {e}")
        return False

# Run connection test
if __name__ == "__main__":
    asyncio.run(test_mcp_connection())
```

### MCP Tool Introspection

```python
async def inspect_mcp_tools():
    """Detailed inspection of MCP tools."""

    tool_node = ToolNode(functions=[], client=create_mcp_client())

    try:
        tools = await tool_node.all_tools()

        print("🔍 MCP Tool Inspection Report")
        print("=" * 50)

        for i, tool in enumerate(tools):
            print(f"\n📋 Tool {i+1}:")

            if isinstance(tool, dict):
                # Function details
                if "function" in tool:
                    func = tool["function"]
                    print(f"  Name: {func.get('name', 'Unknown')}")
                    print(f"  Description: {func.get('description', 'No description')}")

                    # Parameters
                    if "parameters" in func:
                        params = func["parameters"]
                        if "properties" in params:
                            print("  Parameters:")
                            for param_name, param_info in params["properties"].items():
                                param_type = param_info.get("type", "unknown")
                                param_desc = param_info.get("description", "No description")
                                required = param_name in params.get("required", [])
                                req_str = " (required)" if required else " (optional)"
                                print(f"    - {param_name}: {param_type}{req_str} - {param_desc}")

                # Raw tool data
                print(f"  Raw data: {json.dumps(tool, indent=4)}")
            else:
                print(f"  Unexpected tool format: {type(tool)}")

    except Exception as e:
        print(f"❌ Tool inspection error: {e}")

# Run inspection
if __name__ == "__main__":
    asyncio.run(inspect_mcp_tools())
```

### MCP Performance Monitoring

```python
import time
from dataclasses import dataclass
from typing import Dict, List

@dataclass
class ToolCallMetrics:
    tool_name: str
    duration_ms: int
    success: bool
    timestamp: float

class MCPMetricsCollector:
    """Collect and analyze MCP tool performance metrics."""

    def __init__(self):
        self.metrics: List[ToolCallMetrics] = []

    def record_call(self, tool_name: str, duration_ms: int, success: bool):
        """Record a tool call metric."""
        self.metrics.append(ToolCallMetrics(
            tool_name=tool_name,
            duration_ms=duration_ms,
            success=success,
            timestamp=time.time()
        ))

    def get_stats(self) -> Dict:
        """Get performance statistics."""
        if not self.metrics:
            return {"error": "No metrics available"}

        # Group by tool name
        by_tool = {}
        for metric in self.metrics:
            if metric.tool_name not in by_tool:
                by_tool[metric.tool_name] = []
            by_tool[metric.tool_name].append(metric)

        # Calculate stats
        stats = {}
        for tool_name, tool_metrics in by_tool.items():
            durations = [m.duration_ms for m in tool_metrics if m.success]
            success_rate = sum(1 for m in tool_metrics if m.success) / len(tool_metrics)

            stats[tool_name] = {
                "total_calls": len(tool_metrics),
                "success_rate": success_rate,
                "avg_duration_ms": sum(durations) / len(durations) if durations else 0,
                "min_duration_ms": min(durations) if durations else 0,
                "max_duration_ms": max(durations) if durations else 0
            }

        return stats

# Global metrics collector
mcp_metrics = MCPMetricsCollector()

# Wrap tool calls with metrics
async def monitored_tool_execution(tool_node: ToolNode, state: AgentState) -> List[Message]:
    """Execute tools with performance monitoring."""

    last_message = state.context[-1]
    tool_calls = getattr(last_message, "tools_calls", [])

    results = []

    for tool_call in tool_calls:
        tool_name = tool_call.get("name", "unknown")
        start_time = time.time()

        try:
            # Execute the tool call
            result = await tool_node.execute_tool_call(tool_call, state)

            # Record success
            duration_ms = int((time.time() - start_time) * 1000)
            mcp_metrics.record_call(tool_name, duration_ms, True)

            results.append(result)

        except Exception as e:
            # Record failure
            duration_ms = int((time.time() - start_time) * 1000)
            mcp_metrics.record_call(tool_name, duration_ms, False)

            # Create error message
            error_result = Message.tool_message(
                content=f"Tool execution failed: {str(e)}",
                tool_call_id=tool_call.get("tool_call_id")
            )
            results.append(error_result)

    return results
```

## ⚡ Production Best Practices

### 1. MCP Server Health Monitoring

```python
import aiohttp
import asyncio

async def monitor_mcp_servers(config: dict) -> dict:
    """Monitor health of MCP servers."""

    health_status = {}

    async with aiohttp.ClientSession() as session:
        for server_name, server_config in config["mcpServers"].items():
            try:
                # Check server health endpoint
                url = server_config["url"].replace("/mcp", "/health")

                async with session.get(url, timeout=5) as response:
                    if response.status == 200:
                        health_status[server_name] = {
                            "status": "healthy",
                            "response_time_ms": response.headers.get("X-Response-Time", "unknown")
                        }
                    else:
                        health_status[server_name] = {
                            "status": "unhealthy",
                            "error": f"HTTP {response.status}"
                        }

            except asyncio.TimeoutError:
                health_status[server_name] = {"status": "timeout"}
            except Exception as e:
                health_status[server_name] = {"status": "error", "error": str(e)}

    return health_status
```

### 2. MCP Tool Caching

```python
from functools import lru_cache
import asyncio

class CachedMCPToolNode(ToolNode):
    """ToolNode with tool discovery caching."""

    def __init__(self, *args, cache_ttl: int = 300, **kwargs):
        super().__init__(*args, **kwargs)
        self.cache_ttl = cache_ttl
        self._cache = {}
        self._cache_time = 0

    async def all_tools(self) -> list:
        """Get tools with caching."""

        current_time = time.time()

        # Check cache validity
        if (current_time - self._cache_time) < self.cache_ttl and self._cache:
            return self._cache["tools"]

        # Refresh cache
        try:
            tools = await super().all_tools()
            self._cache = {"tools": tools}
            self._cache_time = current_time
            return tools

        except Exception as e:
            # Return cached tools if available, otherwise raise
            if self._cache:
                print(f"Warning: Using cached tools due to error: {e}")
                return self._cache["tools"]
            else:
                raise
```

### 3. Graceful MCP Failover

```python
async def create_resilient_mcp_agent() -> StateGraph:
    """Create MCP agent with failover capabilities."""

    # Primary MCP configuration
    primary_config = {
        "mcpServers": {
            "weather": {"url": "http://primary-weather:8000/mcp", "transport": "streamable-http"}
        }
    }

    # Fallback MCP configuration
    fallback_config = {
        "mcpServers": {
            "weather": {"url": "http://fallback-weather:8000/mcp", "transport": "streamable-http"}
        }
    }

    # Create clients
    primary_client = Client(primary_config)
    fallback_client = Client(fallback_config)

    # Create tool nodes
    primary_tool_node = ToolNode(functions=[], client=primary_client)
    fallback_tool_node = ToolNode(functions=[], client=fallback_client)

    async def resilient_agent(state: AgentState) -> ModelResponseConverter:
        """Agent that fails over between MCP servers."""

        try:
            # Try primary MCP server
            tools = await asyncio.wait_for(
                primary_tool_node.all_tools(),
                timeout=5.0
            )
            active_tool_node = primary_tool_node

        except (asyncio.TimeoutError, ConnectionError):
            print("Primary MCP server unavailable, using fallback")

            try:
                tools = await asyncio.wait_for(
                    fallback_tool_node.all_tools(),
                    timeout=5.0
                )
                active_tool_node = fallback_tool_node

            except Exception:
                print("All MCP servers unavailable, using local tools only")
                return await local_agent_fallback(state)

        # Use available MCP tools
        response = await acompletion(
            model="gpt-4",
            messages=convert_messages(system_prompts=[...], state=state),
            tools=tools
        )

        return ModelResponseConverter(response, converter="litellm")

    return resilient_agent
```

## 🚀 Next Steps

Excellent! You now understand how to integrate MCP with  Agentflow React agents. Here's what to explore next:

1. **[Streaming Responses](04-streaming.md)** - Real-time agent responses with event streaming
2. **Advanced MCP Servers** - Building production-grade MCP services
3. **Multi-Agent MCP** - Coordinating multiple agents with shared MCP resources

### Advanced MCP Topics

- **MCP Authentication**: Secure server connections and authorization
- **MCP Federation**: Connecting multiple MCP server networks
- **Custom Transports**: Building specialized MCP communication layers
- **MCP Monitoring**: Production monitoring and observability

## 📁 Reference Files

Study these MCP examples:

- `examples/react-mcp/react-mcp.py` - Basic MCP integration with  Agentflow
- `examples/react-mcp/server.py` - Simple MCP server implementation
- `examples/react-mcp/client.py` - Standalone MCP client testing

MCP integration opens up unlimited possibilities for your React agents. With standardized protocol integration, you can easily connect to any data source or service while maintaining clean, maintainable agent code!
