# A2A Client Guide

This guide covers how to call remote A2A agents from within your Agentflow graphs.

## Basic Usage

The simplest way to call a remote A2A agent:

```python
from agentflow.a2a_integration import delegate_to_a2a_agent

# Send a message, get a response
response = await delegate_to_a2a_agent(
    url="http://localhost:9999",
    text="What's 100 USD in EUR?",
)
print(response)  # "100 USD is approximately 92.50 EUR as of today."
```

## Function Reference

### delegate_to_a2a_agent

```python
async def delegate_to_a2a_agent(
    url: str,
    text: str,
    *,
    context_id: str | None = None,
    timeout: float = 30.0,
) -> str
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | str | required | Base URL of the remote agent |
| `text` | str | required | Message to send |
| `context_id` | str | `None` | Session ID for multi-turn conversations |
| `timeout` | float | `30.0` | HTTP request timeout in seconds |

#### Returns

The text content of the agent's response.

#### Raises

- `RuntimeError` - If the agent returns an error or no text parts

## Multi-Turn Conversations

Use `context_id` to maintain conversation history:

```python
import uuid

session_id = str(uuid.uuid4())

# First turn
response1 = await delegate_to_a2a_agent(
    "http://localhost:9999",
    "My name is Alice",
    context_id=session_id,
)

# Second turn - agent remembers the name
response2 = await delegate_to_a2a_agent(
    "http://localhost:9999",
    "What's my name?",
    context_id=session_id,
)
# "Your name is Alice."
```

## As a Graph Node

Create a node that delegates to a remote agent:

```python
from agentflow.a2a_integration import create_a2a_client_node
from agentflow.graph import StateGraph
from agentflow.utils.constants import END

# Create a node for the remote agent
currency_node = create_a2a_client_node(
    url="http://currency-agent:9999",
    timeout=60.0,
)

# Build your graph
graph = StateGraph()
graph.add_node("main", my_agent)
graph.add_node("currency", currency_node)

graph.set_entry_point("main")
graph.add_edge("main", "currency")
graph.add_edge("currency", END)

app = graph.compile()
```

### Node Behavior

The client node:
1. Reads the last message from `state.context`
2. Sends its text to the remote agent
3. Returns the response as a new `Message` with role `"assistant"`

### Custom Response Role

```python
currency_node = create_a2a_client_node(
    url="http://currency-agent:9999",
    response_role="tool",  # Or "system", "user", etc.
)
```

### Routing to Remote Agents

Conditionally route to a remote agent:

```python
def route_to_specialist(state):
    last_msg = state.context[-1]
    text = last_msg.text().lower()

    if "currency" in text or "convert" in text:
        return "currency_agent"
    elif "weather" in text:
        return "weather_agent"
    else:
        return "local_agent"

graph.add_conditional_edges(
    "router",
    route_to_specialist,
    {
        "currency_agent": "currency",
        "weather_agent": "weather",
        "local_agent": "main",
    },
)
```

## Session Propagation

The client node automatically propagates `thread_id` from the parent graph:

```python
# Parent graph config
result = app.invoke(
    {"messages": [Message.text_message("Convert 100 USD to EUR")]},
    config={"thread_id": "main-session-123"},
)

# The client node passes this as context_id to the remote agent
# Remote agent uses it as its own thread_id for checkpointing
```

This means:
- Conversation history is maintained server-side
- Multiple calls within the same session are coherent
- The remote agent "remembers" previous turns

## Error Handling

```python
try:
    response = await delegate_to_a2a_agent(url, text)
except RuntimeError as e:
    if "error" in str(e).lower():
        # Agent returned an error response
        handle_agent_error(e)
    else:
        # No text parts in response
        handle_empty_response()
except httpx.TimeoutException:
    # Request timed out
    handle_timeout()
except httpx.ConnectError:
    # Couldn't reach the server
    handle_connection_error()
```

## Graph Node Error Handling

The client node catches exceptions and returns error messages:

```python
# If the remote call fails, the node returns:
# Message(role="assistant", content="A2A call failed: <error details>")
```

This allows your graph to continue rather than crash.

## Multiple Remote Agents

Orchestrate multiple remote agents:

```python
from agentflow.a2a_integration import create_a2a_client_node, delegate_to_a2a_agent

# Option 1: As graph nodes
graph.add_node("currency", create_a2a_client_node("http://currency:9999"))
graph.add_node("weather", create_a2a_client_node("http://weather:9999"))
graph.add_node("translate", create_a2a_client_node("http://translate:9999"))

# Option 2: Direct calls in a custom node
async def orchestrator_node(state, config):
    user_query = state.context[-1].text()

    # Call multiple agents
    currency_result = await delegate_to_a2a_agent(
        "http://currency:9999",
        f"Get exchange rate for: {user_query}",
    )

    formatted_result = await delegate_to_a2a_agent(
        "http://translate:9999",
        f"Translate to Spanish: {currency_result}",
    )

    return [Message.text_message(formatted_result, role="assistant")]
```

## CLI Client Example

A simple interactive CLI client:

```python
import asyncio
import uuid
from agentflow.a2a_integration import delegate_to_a2a_agent

SERVER_URL = "http://localhost:9999"
SESSION_ID = str(uuid.uuid4())

async def main():
    print(f"Connected to {SERVER_URL}")
    print("Type 'quit' to exit\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not user_input or user_input.lower() == "quit":
            break

        try:
            response = await delegate_to_a2a_agent(
                SERVER_URL,
                user_input,
                context_id=SESSION_ID,
            )
            print(f"Agent: {response}\n")
        except Exception as e:
            print(f"Error: {e}\n")

if __name__ == "__main__":
    asyncio.run(main())
```

## Best Practices

1. **Use context_id for sessions** - Without it, each message is independent

2. **Set appropriate timeouts** - Long-running agents need longer timeouts

3. **Handle errors gracefully** - Remote agents can fail or be unavailable

4. **Propagate thread_id** - Ensures consistent session handling across agents

5. **Monitor latency** - Network calls add latency compared to local processing
