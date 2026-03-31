# A2A Server Guide

This guide covers how to expose your Agentflow graphs as A2A-compliant HTTP servers.

## Basic Server

The simplest way to start an A2A server:

```python
from agentflow.a2a_integration import create_a2a_server, make_agent_card

# Your compiled graph
app = graph.compile()

# Agent metadata
card = make_agent_card(
    name="MyAgent",
    description="A helpful assistant that can answer questions",
    url="http://localhost:9999",
)

# Start server (blocking call)
create_a2a_server(app, card, port=9999)
```

## Agent Card

The `AgentCard` describes your agent's capabilities to callers:

```python
from a2a.types import AgentSkill

card = make_agent_card(
    name="CurrencyAgent",
    description="Converts between currencies using live exchange rates",
    url="http://localhost:9999",
    version="1.0.0",
    streaming=True,
    skills=[
        AgentSkill(
            id="currency_conversion",
            name="Currency Conversion",
            description="Convert amounts between currencies",
            tags=["currency", "finance"],
            examples=[
                "How much is 100 USD in EUR?",
                "Convert 50 GBP to JPY",
            ],
        ),
    ],
)
```

### Card Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | str | required | Human-readable agent name |
| `description` | str | required | What the agent does |
| `url` | str | required | Public URL where agent is reachable |
| `version` | str | `"1.0.0"` | Semantic version |
| `streaming` | bool | `False` | Whether agent supports SSE streaming |
| `skills` | list | auto-generated | List of `AgentSkill` objects |

If you don't provide `skills`, a default "Run Graph" skill is created.

## Streaming Mode

Enable streaming to send progress updates during long operations:

```python
create_a2a_server(
    app,
    card,
    streaming=True,  # Use astream() instead of ainvoke()
)
```

In streaming mode:
- Progress updates sent as `TaskState.working` events
- Client receives incremental text via SSE
- Final response sent when stream completes

## ASGI App (Composable)

For more control, use `build_a2a_app()` to get a Starlette app:

```python
from agentflow.a2a_integration import build_a2a_app

# Get the ASGI app
a2a_app = build_a2a_app(
    compiled_graph=app,
    agent_card=card,
    streaming=True,
    executor_config={"recursion_limit": 50},
)

# Mount in your existing app
from starlette.applications import Starlette
from starlette.routing import Mount

main_app = Starlette(routes=[
    Mount("/a2a", app=a2a_app),
    # ... other routes
])
```

### Executor Config

Pass configuration to the underlying graph:

```python
a2a_app = build_a2a_app(
    compiled_graph=app,
    agent_card=card,
    executor_config={
        "recursion_limit": 100,
        # Other graph config...
    },
)
```

## Custom Executors

For advanced task handling, subclass `AgentFlowExecutor`:

```python
from agentflow.a2a_integration.executor import AgentFlowExecutor
from a2a.server.agent_execution.context import RequestContext
from a2a.server.events.event_queue import EventQueue
from a2a.server.tasks.task_updater import TaskUpdater
from a2a.types import TaskState, TextPart

class MyCustomExecutor(AgentFlowExecutor):
    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        updater = TaskUpdater(
            event_queue=event_queue,
            task_id=context.task_id or "",
            context_id=context.context_id or "",
        )
        await updater.submit()
        await updater.start_work()

        try:
            # Custom pre-processing
            user_text = context.get_user_input()

            # Run the graph
            result = await self.graph.ainvoke(
                {"messages": [AFMessage.text_message(user_text)]},
                config={"thread_id": context.context_id or ""},
            )

            response_text = self._extract_response_text(result)

            # Custom logic: check if agent needs more info
            if self._is_asking_for_input(response_text):
                msg = updater.new_agent_message(parts=[TextPart(text=response_text)])
                await updater.update_status(TaskState.input_required, message=msg)
            else:
                await updater.add_artifact([TextPart(text=response_text)])
                await updater.complete()

        except Exception as exc:
            error_msg = updater.new_agent_message(parts=[TextPart(text=f"Error: {exc}")])
            await updater.failed(message=error_msg)

    def _is_asking_for_input(self, text: str) -> bool:
        """Check if the response is asking for more information."""
        asking_phrases = ["could you", "please provide", "which currency"]
        low = text.lower()
        return low.endswith("?") or any(p in low for p in asking_phrases)
```

Then use your custom executor:

```python
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore

executor = MyCustomExecutor(app, streaming=False)
handler = DefaultRequestHandler(
    agent_executor=executor,
    task_store=InMemoryTaskStore(),
)
a2a_app = A2AStarletteApplication(
    agent_card=card,
    http_handler=handler,
).build()
```

## Configuration File (agentflow.json)

For CLI deployment, define your agent in `agentflow.json`:

```json
{
  "agent": "graph:app",
  "env": ".env",
  "a2a": {
    "name": "CurrencyAgent",
    "description": "Currency conversion with INPUT_REQUIRED for missing info.",
    "version": "1.0.0",
    "streaming": true,
    "executor": "executor:CurrencyAgentExecutor",
    "skills": [
      {
        "id": "currency_conversion",
        "name": "Currency Conversion",
        "description": "Convert between currencies. Asks if info is missing.",
        "tags": ["currency", "finance"],
        "examples": [
          "How much is 100 USD in EUR?",
          "Convert 50 GBP to JPY"
        ]
      }
    ]
  }
}
```

### Fields

| Field | Description |
|-------|-------------|
| `agent` | Module path to compiled graph (`module:variable`) |
| `env` | Path to .env file |
| `a2a.name` | Agent name |
| `a2a.description` | Agent description |
| `a2a.version` | Version string |
| `a2a.streaming` | Enable streaming mode |
| `a2a.executor` | Custom executor class (`module:ClassName`) |
| `a2a.skills` | List of skill definitions |

## Server Endpoints

The A2A server exposes these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent.json` | GET | Returns the agent card |
| `/` | POST | Send a message (JSON-RPC) |
| `/sse` | GET | Server-sent events for streaming |

## Running with Uvicorn

For production, run directly with uvicorn:

```python
import uvicorn

a2a_app = build_a2a_app(app, card, streaming=True)

if __name__ == "__main__":
    uvicorn.run(
        a2a_app,
        host="0.0.0.0",
        port=9999,
        workers=4,
    )
```

## Health Checks

Add a health check endpoint for load balancers:

```python
from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.responses import JSONResponse

async def health_check(request):
    return JSONResponse({"status": "ok"})

a2a_app = build_a2a_app(app, card)

main_app = Starlette(routes=[
    Route("/health", health_check),
    Mount("/", app=a2a_app),
])
```
