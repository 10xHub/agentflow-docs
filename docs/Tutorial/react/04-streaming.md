# React Agents with Streaming Responses

Streaming enables **real-time, progressive responses** from your React agents, providing immediate feedback to users as the agent thinks, acts, and generates responses.  Agentflow's streaming architecture delivers low-latency, interactive experiences perfect for chat interfaces and live applications.

## 🎯 Learning Objectives

By the end of this tutorial, you'll understand:

- How streaming works in  Agentflow React agents
- Building responsive agents with real-time feedback
- Handling streaming with tool calls and LLM responses
- Event-driven architectures for agent monitoring
- Debugging and optimizing streaming performance

## ⚡ Understanding Streaming in React Agents

### What is Agent Streaming?

Agent streaming provides **progressive response delivery**:
- **Immediate feedback**: Users see responses as they're generated
- **Low perceived latency**: Partial responses appear instantly
- **Better UX**: Users know the agent is working, not frozen
- **Real-time monitoring**: Observe agent thinking and decision-making

### Streaming Architecture

```
User Input → Agent Reasoning → Tool Calls → LLM Streaming → Real-time UI Updates
     ↓              ↓             ↓            ↓                    ↓
   Event         Event         Event       Event              Event Stream
```

### Types of Streaming in  Agentflow

1. **Response Streaming**: Progressive LLM text generation
2. **Event Streaming**: Real-time agent state and execution events
3. **Tool Streaming**: Incremental tool execution results
4. **State Streaming**: Continuous agent state updates

## 🏗️ Basic Streaming Setup

### 1. Streaming-Enabled Main Agent

```python
from litellm import acompletion
from agentflow.adapters.llm.model_response_converter import ModelResponseConverter


async def streaming_main_agent(
        state: AgentState,
        config: dict | None = None
) -> ModelResponseConverter:
    """Main agent with streaming support."""

    config = config or {}

    system_prompt = """
    You are a helpful assistant that provides real-time responses.
    Think step by step and use tools when needed.
    """

    messages = convert_messages(
        system_prompts=[{"role": "system", "content": system_prompt}],
        state=state
    )

    # Check streaming configuration
    is_stream = config.get("is_stream", False)

    # Handle tool results vs regular conversation
    if state.context and state.context[-1].role == "tool":
        # Final response after tool execution - enable streaming
        response = await acompletion(
            model="gemini/gemini-2.5-flash",
            messages=messages,
            stream=is_stream  # Stream final responses
        )
    else:
        # Initial response with tools - avoid streaming for tool calls
        tools = await tool_node.all_tools()
        response = await acompletion(
            model="gemini/gemini-2.5-flash",
            messages=messages,
            tools=tools,
            stream=False  # Don't stream when tools are involved
        )

    return ModelResponseConverter(response, converter="litellm")
```

### 2. Stream-Compatible Tool Node

```python
def streaming_weather_tool(
    location: str,
    tool_call_id: str | None = None,
    state: AgentState | None = None
) -> Message:
    """Tool that returns properly formatted messages for streaming."""

    # Log for debugging
    if tool_call_id:
        print(f"🔧 Tool execution [{tool_call_id}]: weather for {location}")

    # Simulate API delay (in production, this would be real API call)
    import time
    time.sleep(0.5)  # Simulate network delay

    weather_data = f"Current weather in {location}: Sunny, 24°C (75°F), light breeze"

    # Return properly formatted tool message
    return Message.tool_message(
        content=weather_data,
        tool_call_id=tool_call_id
    )

# Create tool node
tool_node = ToolNode([streaming_weather_tool])
```

### 3. Graph with Streaming Support

```python
from agentflow.graph import StateGraph
from agentflow.utils.constants import END


def streaming_router(state: AgentState) -> str:
    """Router optimized for streaming workflows."""

    if not state.context:
        return "TOOL"

    last_message = state.context[-1]

    # Tool call routing
    if (hasattr(last_message, "tools_calls") and
            last_message.tools_calls and
            last_message.role == "assistant"):
        return "TOOL"

    # Return to main after tool execution
    if last_message.role == "tool":
        return "MAIN"

    # End conversation
    return END


# Build streaming graph
graph = StateGraph()
graph.add_node("MAIN", streaming_main_agent)
graph.add_node("TOOL", tool_node)

graph.add_conditional_edges("MAIN", streaming_router, {
    "TOOL": "TOOL",
    END: END
})

graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=InMemoryCheckpointer())
```

## 🌊 Complete Streaming Example

Let's build a complete streaming React agent:

### Full Streaming Weather Agent

```python
# File: streaming_weather_agent.py
import asyncio
import logging
from typing import Any
from dotenv import load_dotenv
from litellm import acompletion

from agentflow.adapters.llm.model_response_converter import ModelResponseConverter
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.graph import StateGraph, ToolNode
from agentflow.state.agent_state import AgentState
from agentflow.utils import Message, ResponseGranularity
from agentflow.utils.constants import END
from agentflow.utils.converter import convert_messages

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()


# Streaming-compatible tools
def get_weather_stream(
        location: str,
        tool_call_id: str | None = None,
        state: AgentState | None = None,
) -> Message:
    """Weather tool optimized for streaming workflows."""

    logger.info(f"[TOOL] Getting weather for {location}")

    # Simulate realistic API call time
    import time
    time.sleep(0.8)

    # Rich weather data
    weather_info = f"""Current conditions in {location}:
🌡️ Temperature: 22°C (72°F)
💧 Humidity: 65%
☁️ Conditions: Partly cloudy
💨 Wind: 15 km/h SW
🌅 Sunrise: 6:42 AM
🌇 Sunset: 7:18 PM"""

    return Message.tool_message(
        content=weather_info,
        tool_call_id=tool_call_id
    )


def get_forecast_stream(
        location: str,
        days: int = 3,
        tool_call_id: str | None = None,
) -> Message:
    """Multi-day forecast tool for streaming."""

    logger.info(f"[TOOL] Getting {days}-day forecast for {location}")

    import time
    time.sleep(1.2)  # Simulate longer API call

    forecast_info = f"""📅 {days}-day forecast for {location}:

Day 1: ☀️ Sunny - High 24°C, Low 16°C
Day 2: ⛅ Partly cloudy - High 21°C, Low 14°C
Day 3: 🌧️ Light rain - High 19°C, Low 12°C"""

    if days > 3:
        forecast_info += f"\n\nExtended forecast available for up to 7 days."

    return Message.tool_message(
        content=forecast_info,
        tool_call_id=tool_call_id
    )


# Create tool node
tool_node = ToolNode([get_weather_stream, get_forecast_stream])


async def streaming_main_agent(
        state: AgentState,
        config: dict[str, Any] | None = None,
        checkpointer: Any | None = None,
        store: Any | None = None,
) -> ModelResponseConverter:
    """
    Main agent optimized for streaming responses.
    """

    config = config or {}

    system_prompt = """
    You are an expert weather assistant with access to real-time weather data.

    Available tools:
    - get_weather_stream: Current weather conditions for any location
    - get_forecast_stream: Multi-day weather forecasts

    Guidelines:
    - Provide detailed, helpful weather information
    - Use appropriate tools based on user requests
    - Be conversational and engaging
    - Explain weather patterns when relevant
    """

    messages = convert_messages(
        system_prompts=[{"role": "system", "content": system_prompt}],
        state=state,
    )

    # Streaming configuration
    is_stream = config.get("is_stream", False)

    logger.info(f"[AGENT] Processing request - streaming: {is_stream}")

    if state.context and len(state.context) > 0 and state.context[-1].role == "tool":
        # We have tool results - provide streaming final response
        logger.info("[AGENT] Generating final response with streaming")
        response = await acompletion(
            model="gemini/gemini-2.5-flash",
            messages=messages,
            stream=is_stream,  # Enable streaming for final responses
            temperature=0.7
        )
    else:
        # Initial interaction or no tool results - get tools but don't stream
        tools = await tool_node.all_tools()
        logger.info(f"[AGENT] Available tools: {len(tools)}")

        # Don't stream when making tool calls (causes parsing issues)
        response = await acompletion(
            model="gemini/gemini-2.5-flash",
            messages=messages,
            tools=tools,
            stream=False,  # Disable streaming when tools are involved
            temperature=0.7
        )

    return ModelResponseConverter(response, converter="litellm")


def should_use_tools_stream(state: AgentState) -> str:
    """Routing logic optimized for streaming."""

    if not state.context:
        logger.info("[ROUTER] No context - routing to TOOL")
        return "TOOL"

    # Safety: prevent infinite loops
    recent_tools = sum(1 for msg in state.context[-5:] if msg.role == "tool")
    if recent_tools >= 3:
        logger.warning("[ROUTER] Too many tool calls - ending")
        return END

    last_message = state.context[-1]

    if (hasattr(last_message, "tools_calls") and
            last_message.tools_calls and
            len(last_message.tools_calls) > 0 and
            last_message.role == "assistant"):
        logger.info("[ROUTER] Tool calls detected - routing to TOOL")
        return "TOOL"

    if last_message.role == "tool":
        logger.info("[ROUTER] Tool results received - routing to MAIN")
        return "MAIN"

    logger.info("[ROUTER] Conversation complete - ending")
    return END


# Build the streaming graph
graph = StateGraph()
graph.add_node("MAIN", streaming_main_agent)
graph.add_node("TOOL", tool_node)

graph.add_conditional_edges("MAIN", should_use_tools_stream, {
    "TOOL": "TOOL",
    END: END
})

graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

# Compile with checkpointer
app = graph.compile(checkpointer=InMemoryCheckpointer())


# Demo function
async def demo_streaming_agent():
    """Demonstrate streaming weather agent."""

    print("🌊 Streaming Weather Agent Demo")
    print("=" * 50)

    test_queries = [
        "What's the weather like in Paris right now?",
        "Can you give me a 5-day forecast for Tokyo?",
        "How's the weather in New York and London today?"
    ]

    for i, query in enumerate(test_queries):
        print(f"\n🔹 Query {i + 1}: {query}")
        print("-" * 40)

        # Prepare input with streaming enabled
        inp = {"messages": [Message.text_message(query)]}
        config = {
            "thread_id": f"stream-demo-{i}",
            "recursion_limit": 10,
            "is_stream": True  # Enable streaming
        }

        try:
            print("📡 Streaming response:")

            # Use stream method for real-time responses
            message_count = 0

            async for event in app.astream(inp, config=config):
                message_count += 1

                # Display streaming events
                print(f"💫 Event {message_count}:")
                print(f"   Role: {event.role}")
                print(f"   Content: {event.content[:100]}{'...' if len(event.content) > 100 else ''}")

                if hasattr(event, 'delta') and event.delta:
                    print(f"   Delta: {event.delta}")

                if hasattr(event, 'tools_calls') and event.tools_calls:
                    print(f"   Tool calls: {len(event.tools_calls)}")

                print()

            print(f"✅ Completed - {message_count} events received\n")

        except Exception as e:
            print(f"❌ Error: {e}\n")


if __name__ == "__main__":
    asyncio.run(demo_streaming_agent())
```

## 📊 Event-Driven Streaming

### Understanding  Agentflow Events

 Agentflow streams events that represent different stages of agent execution:

```python
from agentflow.utils.streaming import EventModel

# Event types you'll receive:
# - "message_start": Beginning of a message
# - "message_chunk": Incremental content
# - "message_complete": Full message ready
# - "tool_call": Tool execution started
# - "tool_result": Tool execution completed
# - "agent_state": Agent state updates
```

### Advanced Stream Processing

```python
async def advanced_stream_handler():
    """Advanced streaming with event processing."""

    inp = {"messages": [Message.text_message("Weather in multiple cities?")]}
    config = {"thread_id": "advanced-stream", "is_stream": True}

    # Track streaming metrics
    events_received = 0
    tool_calls_made = 0
    content_chunks = 0

    start_time = time.time()

    async for event in app.astream(inp, config=config):
        events_received += 1

        # Process different event types
        if event.role == "assistant":
            if hasattr(event, 'delta') and event.delta:
                content_chunks += 1
                # Real-time UI update here
                print(f"📝 Streaming: {event.delta}", end="", flush=True)

        elif event.role == "tool":
            tool_calls_made += 1
            print(f"\n🔧 Tool executed: {event.content[:50]}...")

        # Log event details for debugging
        if hasattr(event, 'message_id'):
            print(f"\n🆔 Event ID: {event.message_id}")

    # Final metrics
    duration = time.time() - start_time
    print(f"\n📊 Stream completed:")
    print(f"   Duration: {duration:.2f}s")
    print(f"   Events: {events_received}")
    print(f"   Tool calls: {tool_calls_made}")
    print(f"   Content chunks: {content_chunks}")
```

### Real-Time UI Integration

```python
import asyncio
from typing import AsyncGenerator

class StreamingUI:
    """Simulate real-time UI updates."""

    def __init__(self):
        self.current_message = ""
        self.is_thinking = False

    async def process_stream(self, stream: AsyncGenerator) -> None:
        """Process streaming events for UI updates."""

        async for event in stream:
            await self.handle_event(event)

    async def handle_event(self, event) -> None:
        """Handle individual streaming events."""

        if event.role == "assistant":
            if hasattr(event, 'delta') and event.delta:
                # Append streaming text
                self.current_message += event.delta
                await self.update_ui_text(self.current_message)

            elif hasattr(event, 'tools_calls') and event.tools_calls:
                # Show "thinking" indicator
                self.is_thinking = True
                await self.show_thinking_indicator()

        elif event.role == "tool":
            # Hide thinking, show tool result
            self.is_thinking = False
            await self.hide_thinking_indicator()
            await self.show_tool_execution(event.content)

    async def update_ui_text(self, text: str) -> None:
        """Update streaming text in UI."""
        # Clear current line and show updated text
        print(f"\r💬 Agent: {text}", end="", flush=True)

    async def show_thinking_indicator(self) -> None:
        """Show that agent is using tools."""
        print("\n🤔 Agent is using tools...")

    async def hide_thinking_indicator(self) -> None:
        """Hide thinking indicator."""
        print("\r✅ Tools completed")

    async def show_tool_execution(self, result: str) -> None:
        """Display tool execution result."""
        print(f"\n🔧 Tool result: {result[:100]}...")

# Usage example
async def demo_ui_integration():
    """Demonstrate UI integration with streaming."""

    ui = StreamingUI()

    inp = {"messages": [Message.text_message("Weather in Paris and Tokyo?")]}
    config = {"thread_id": "ui-demo", "is_stream": True}

    # Process stream with UI updates
    await ui.process_stream(app.astream(inp, config=config))

    print(f"\n\n✅ Final message: {ui.current_message}")
```

## 🛠️ Streaming Best Practices

### 1. Tool Call Strategy

```python
async def smart_streaming_agent(state: AgentState, config: dict) -> ModelResponseConverter:
    """Agent with intelligent streaming strategy."""

    is_stream = config.get("is_stream", False)

    # RULE 1: Don't stream when making tool calls
    # Tool calls need complete JSON parsing

    if state.context and state.context[-1].role == "tool":
        # RULE 2: Always stream final responses
        # Users want immediate feedback on results
        response = await acompletion(
            model="gpt-4",
            messages=messages,
            stream=is_stream and True  # Force streaming for final responses
        )
    else:
        # RULE 3: Disable streaming for tool decision making
        tools = await tool_node.all_tools()
        response = await acompletion(
            model="gpt-4",
            messages=messages,
            tools=tools,
            stream=False  # Never stream with tools
        )

    return ModelResponseConverter(response, converter="litellm")
```

### 2. Error Handling in Streams

```python
async def robust_streaming():
    """Robust streaming with error handling."""

    try:
        async for event in app.astream(inp, config=config):
            try:
                # Process individual events safely
                await process_event(event)
            except Exception as e:
                print(f"⚠️ Event processing error: {e}")
                # Continue streaming despite individual event errors
                continue

    except asyncio.TimeoutError:
        print("⏱️ Streaming timeout - agent may be stuck")
    except ConnectionError:
        print("🔌 Connection error - check network/services")
    except Exception as e:
        print(f"❌ Streaming error: {e}")

async def process_event(event) -> None:
    """Safely process a single streaming event."""

    # Validate event structure
    if not hasattr(event, 'role'):
        print(f"⚠️ Invalid event: {event}")
        return

    # Handle different event types
    if event.role == "assistant":
        await handle_assistant_event(event)
    elif event.role == "tool":
        await handle_tool_event(event)
    else:
        print(f"🔍 Unknown event role: {event.role}")
```

### 3. Performance Optimization

```python
import asyncio
from collections import deque

class StreamBuffer:
    """Buffer streaming events for smooth UI updates."""

    def __init__(self, buffer_size: int = 10):
        self.buffer = deque(maxlen=buffer_size)
        self.subscribers = []

    async def add_event(self, event) -> None:
        """Add event to buffer."""
        self.buffer.append(event)
        await self.notify_subscribers()

    async def notify_subscribers(self) -> None:
        """Notify all subscribers of new events."""
        if self.subscribers:
            await asyncio.gather(*[
                subscriber(list(self.buffer))
                for subscriber in self.subscribers
            ])

# Buffered streaming
buffer = StreamBuffer()

async def buffered_streaming():
    """Streaming with event buffering."""

    # Subscribe to buffer updates
    async def ui_updater(events):
        print(f"📦 Buffer update: {len(events)} events")

    buffer.subscribers.append(ui_updater)

    # Process stream into buffer
    async for event in app.astream(inp, config=config):
        await buffer.add_event(event)

        # Optional: throttle updates
        await asyncio.sleep(0.1)
```

## 🔧 Debugging Streaming Issues

### Stream Event Inspection

```python
import json
from datetime import datetime

async def debug_streaming():
    """Debug streaming by inspecting all events."""

    print("🔍 Streaming Debug Mode")
    print("=" * 50)

    event_count = 0

    async for event in app.astream(inp, config=config):
        event_count += 1

        print(f"\n📋 Event #{event_count} at {datetime.now().isoformat()}")
        print(f"   Role: {event.role}")
        print(f"   Message ID: {getattr(event, 'message_id', 'N/A')}")

        # Content analysis
        if hasattr(event, 'content'):
            content_preview = event.content[:100] + "..." if len(event.content) > 100 else event.content
            print(f"   Content: {content_preview}")

        # Delta analysis
        if hasattr(event, 'delta'):
            print(f"   Delta: '{event.delta}'")

        # Tool call analysis
        if hasattr(event, 'tools_calls') and event.tools_calls:
            print(f"   Tool calls: {len(event.tools_calls)}")
            for i, tool_call in enumerate(event.tools_calls):
                print(f"     {i+1}. {tool_call.get('name', 'unknown')}")

        # Raw event data
        try:
            event_dict = event.__dict__ if hasattr(event, '__dict__') else str(event)
            print(f"   Raw: {json.dumps(event_dict, indent=2, default=str)}")
        except Exception:
            print(f"   Raw: {event}")

        print("-" * 30)

    print(f"\n✅ Debug complete - {event_count} events processed")
```

### Performance Monitoring

```python
import time
from dataclasses import dataclass
from typing import List

@dataclass
class StreamMetrics:
    total_events: int = 0
    total_duration: float = 0
    first_event_latency: float = 0
    tool_execution_time: float = 0
    content_generation_time: float = 0

async def monitored_streaming():
    """Streaming with performance monitoring."""

    metrics = StreamMetrics()
    start_time = time.time()
    first_event_time = None
    tool_start_time = None

    async for event in app.astream(inp, config=config):
        current_time = time.time()

        # Track first event latency
        if first_event_time is None:
            first_event_time = current_time
            metrics.first_event_latency = current_time - start_time

        metrics.total_events += 1

        # Track tool execution timing
        if event.role == "assistant" and hasattr(event, 'tools_calls') and event.tools_calls:
            tool_start_time = current_time
        elif event.role == "tool" and tool_start_time:
            metrics.tool_execution_time += current_time - tool_start_time
            tool_start_time = None

    metrics.total_duration = time.time() - start_time

    # Print performance report
    print(f"\n📊 Streaming Performance Report:")
    print(f"   Total duration: {metrics.total_duration:.2f}s")
    print(f"   Total events: {metrics.total_events}")
    print(f"   First event latency: {metrics.first_event_latency:.2f}s")
    print(f"   Tool execution time: {metrics.tool_execution_time:.2f}s")
    print(f"   Events per second: {metrics.total_events/metrics.total_duration:.1f}")
```

### Common Streaming Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **No streaming** | All content arrives at once | Check `is_stream=True` in config |
| **Broken tool calls** | Tool parsing errors | Disable streaming when tools are involved |
| **Slow first response** | Long delay before streaming starts | Check agent/tool initialization |
| **Choppy updates** | Irregular content delivery | Implement event buffering |
| **Memory leaks** | Growing memory usage | Properly close stream iterators |
| **Connection drops** | Streaming stops mid-response | Add connection retry logic |

## 🎯 Production Streaming Patterns

### WebSocket Integration

```python
import websocket
import json
import asyncio

class WebSocketStreamer:
    """Stream agent responses over WebSocket."""

    def __init__(self, websocket_url: str):
        self.websocket_url = websocket_url
        self.ws = None

    async def connect(self):
        """Connect to WebSocket."""
        # In production, use proper WebSocket library like websockets
        print(f"🔌 Connecting to {self.websocket_url}")

    async def stream_to_client(self, query: str, client_id: str):
        """Stream agent response to WebSocket client."""

        inp = {"messages": [Message.text_message(query)]}
        config = {"thread_id": client_id, "is_stream": True}

        try:
            async for event in app.astream(inp, config=config):
                # Send event to client
                await self.send_event_to_client(client_id, event)

        except Exception as e:
            # Send error to client
            await self.send_error_to_client(client_id, str(e))

    async def send_event_to_client(self, client_id: str, event):
        """Send streaming event to WebSocket client."""

        message = {
            "type": "agent_event",
            "client_id": client_id,
            "role": event.role,
            "content": event.content,
            "timestamp": time.time()
        }

        if hasattr(event, 'delta'):
            message["delta"] = event.delta

        # Send via WebSocket (pseudo-code)
        print(f"📤 Sending to {client_id}: {message}")

    async def send_error_to_client(self, client_id: str, error: str):
        """Send error message to client."""

        error_message = {
            "type": "error",
            "client_id": client_id,
            "error": error,
            "timestamp": time.time()
        }

        print(f"❌ Error to {client_id}: {error_message}")
```

### Server-Sent Events (SSE)

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

app_fastapi = FastAPI()

@app_fastapi.get("/chat/stream")
async def stream_chat(query: str, client_id: str):
    """SSE endpoint for streaming chat responses."""

    async def event_generator():
        """Generate SSE events from agent stream."""

        inp = {"messages": [Message.text_message(query)]}
        config = {"thread_id": client_id, "is_stream": True}

        try:
            async for event in app.astream(inp, config=config):
                # Format as SSE
                event_data = {
                    "role": event.role,
                    "content": event.content,
                    "timestamp": time.time()
                }

                if hasattr(event, 'delta'):
                    event_data["delta"] = event.delta

                # SSE format: data: {json}\n\n
                yield f"data: {json.dumps(event_data)}\n\n"

        except Exception as e:
            # Send error event
            error_data = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"

        # Send completion event
        yield f"data: {json.dumps({'type': 'complete'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )
```

## 🚀 Advanced Streaming Features

### Parallel Tool Streaming

```python
async def parallel_tool_streaming():
    """Execute multiple tools in parallel and stream results."""

    # Mock parallel tool execution
    async def simulate_parallel_tools():
        """Simulate multiple tools running in parallel."""

        tools = [
            ("weather", "Getting weather data..."),
            ("forecast", "Fetching 5-day forecast..."),
            ("alerts", "Checking weather alerts...")
        ]

        # Start all tools
        tasks = []
        for tool_name, description in tools:
            task = asyncio.create_task(simulate_tool_execution(tool_name, description))
            tasks.append(task)

        # Stream results as they complete
        for completed_task in asyncio.as_completed(tasks):
            result = await completed_task
            yield result

    async def simulate_tool_execution(tool_name: str, description: str):
        """Simulate individual tool execution."""

        # Simulate varying execution times
        import random
        await asyncio.sleep(random.uniform(0.5, 2.0))

        return {
            "tool": tool_name,
            "description": description,
            "result": f"Completed {tool_name} successfully",
            "timestamp": time.time()
        }

    print("🔧 Parallel tool execution:")

    async for result in simulate_parallel_tools():
        print(f"   ✅ {result['tool']}: {result['result']}")
```

### Adaptive Streaming

```python
class AdaptiveStreamer:
    """Intelligent streaming that adapts to network conditions."""

    def __init__(self):
        self.latency_samples = deque(maxlen=10)
        self.chunk_size = 50  # Start with small chunks

    def record_latency(self, latency_ms: int):
        """Record network latency sample."""
        self.latency_samples.append(latency_ms)
        self.adjust_chunk_size()

    def adjust_chunk_size(self):
        """Adjust streaming chunk size based on network performance."""

        if len(self.latency_samples) < 3:
            return

        avg_latency = sum(self.latency_samples) / len(self.latency_samples)

        if avg_latency < 50:  # Low latency - use smaller chunks
            self.chunk_size = max(20, self.chunk_size - 10)
        elif avg_latency > 200:  # High latency - use larger chunks
            self.chunk_size = min(200, self.chunk_size + 20)

    async def adaptive_stream(self, content: str):
        """Stream content with adaptive chunking."""

        for i in range(0, len(content), self.chunk_size):
            chunk = content[i:i+self.chunk_size]

            start_time = time.time()
            yield chunk

            # Simulate network delay and record latency
            await asyncio.sleep(0.05)
            latency_ms = int((time.time() - start_time) * 1000)
            self.record_latency(latency_ms)
```

## 🚀 Next Steps

Congratulations! You now have comprehensive knowledge of React agents with streaming capabilities. Here's what to explore next:

### Advanced Topics
1. **Multi-Agent Streaming** - Coordinating streams from multiple agents
2. **Event Sourcing** - Using streaming events for state reconstruction
3. **Stream Analytics** - Real-time analysis of agent behavior
4. **Custom Publishers** - Building specialized event streaming systems

### Production Considerations
- **Load Balancing**: Distributing streaming across multiple servers
- **Caching Strategies**: Optimizing repeated stream requests
- **Monitoring**: Real-time stream performance monitoring
- **Scaling**: Handling thousands of concurrent streams

## 📁 Reference Files

Study these streaming examples:

- `examples/react_stream/stream_react_agent.py` - Complete streaming React agent
- `examples/react_stream/stream1.py` - Basic streaming implementation
- `examples/react_stream/stream_sync.py` - Synchronous streaming variant
- `examples/react_stream/stop_stream.py` - Stream interruption handling

## 📚 Related Documentation

- **[Publishers](../publisher.md)** - Event streaming and monitoring systems
- **[Basic React](01-basic-react.md)** - Foundation React patterns
- **[State Management](../state.md)** - Managing agent state in streaming contexts

Streaming transforms your React agents from batch processors into responsive, interactive experiences. Master these patterns to build agents that feel alive and engaging to your users!
