# Custom A2A Executors

The `AgentFlowExecutor` bridges Agentflow graphs to the A2A execution model. For advanced use cases, you can subclass it to customize task handling.

## Default Executor

The default `AgentFlowExecutor` provides:

- Extract user text from A2A message parts
- Run the graph via `ainvoke()` or `astream()`
- Push the result as an A2A artifact
- Handle errors with `TaskState.failed`

```python
from agentflow.a2a_integration.executor import AgentFlowExecutor

executor = AgentFlowExecutor(
    compiled_graph=app,
    config={"recursion_limit": 50},
    streaming=True,
)
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `compiled_graph` | CompiledGraph | required | A fully compiled agentflow graph |
| `config` | dict | `{}` | Base config forwarded to graph invocation |
| `streaming` | bool | `False` | Use `astream()` instead of `ainvoke()` |

## Creating a Custom Executor

Subclass `AgentFlowExecutor` and override `execute()`:

```python
from agentflow.a2a_integration.executor import AgentFlowExecutor
from a2a.server.agent_execution.context import RequestContext
from a2a.server.events.event_queue import EventQueue
from a2a.server.tasks.task_updater import TaskUpdater
from a2a.types import TaskState, TextPart

from agentflow.state.message import Message as AFMessage
from agentflow.utils.constants import ResponseGranularity


class MyCustomExecutor(AgentFlowExecutor):
    """Custom executor with specialized behavior."""

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        # Create task updater for state management
        updater = TaskUpdater(
            event_queue=event_queue,
            task_id=context.task_id or "",
            context_id=context.context_id or "",
        )

        # Signal task started
        await updater.submit()
        await updater.start_work()

        try:
            # Extract user input
            user_text = context.get_user_input() if context.message else ""

            # Build agentflow messages
            messages = [AFMessage.text_message(user_text, role="user")]

            # Configure the run
            run_config = {**self._base_config}
            run_config["thread_id"] = context.context_id or context.task_id or ""

            # Run the graph
            result = await self.graph.ainvoke(
                {"messages": messages},
                config=run_config,
                response_granularity=ResponseGranularity.FULL,
            )

            # Extract response
            response_text = self._extract_response_text(result)

            # Custom logic here!
            await self._handle_response(response_text, updater)

        except Exception as exc:
            error_msg = updater.new_agent_message(
                parts=[TextPart(text=f"Error: {exc!s}")]
            )
            await updater.failed(message=error_msg)

    async def _handle_response(
        self,
        response_text: str,
        updater: TaskUpdater,
    ) -> None:
        """Override this for custom response handling."""
        await updater.add_artifact([TextPart(text=response_text)])
        await updater.complete()
```

## Common Customizations

### INPUT_REQUIRED for Clarification

Detect when the agent needs more information:

```python
class ClarificationExecutor(AgentFlowExecutor):
    """Emits INPUT_REQUIRED when agent asks a question."""

    ASKING_PHRASES = [
        "could you", "please provide", "please specify",
        "what amount", "which currency", "what is the",
    ]

    async def _handle_response(self, response_text: str, updater: TaskUpdater):
        if self._is_asking_for_input(response_text):
            # Tell client we need more info
            msg = updater.new_agent_message(parts=[TextPart(text=response_text)])
            await updater.update_status(TaskState.input_required, message=msg)
        else:
            # Normal completion
            await updater.add_artifact([TextPart(text=response_text)])
            await updater.complete()

    def _is_asking_for_input(self, text: str) -> bool:
        low = text.lower().strip()
        return low.endswith("?") or any(p in low for p in self.ASKING_PHRASES)
```

### Validation and Preprocessing

Validate or transform input before running the graph:

```python
class ValidatingExecutor(AgentFlowExecutor):
    """Validates input before processing."""

    MAX_INPUT_LENGTH = 10000
    BLOCKED_PATTERNS = ["ignore previous", "system prompt"]

    async def execute(self, context: RequestContext, event_queue: EventQueue):
        updater = TaskUpdater(
            event_queue=event_queue,
            task_id=context.task_id or "",
            context_id=context.context_id or "",
        )
        await updater.submit()

        user_text = context.get_user_input() if context.message else ""

        # Validate input
        validation_error = self._validate_input(user_text)
        if validation_error:
            msg = updater.new_agent_message(
                parts=[TextPart(text=validation_error)]
            )
            await updater.failed(message=msg)
            return

        # Continue with normal execution
        await updater.start_work()
        # ... rest of execution

    def _validate_input(self, text: str) -> str | None:
        if len(text) > self.MAX_INPUT_LENGTH:
            return f"Input too long. Maximum {self.MAX_INPUT_LENGTH} characters."

        low = text.lower()
        for pattern in self.BLOCKED_PATTERNS:
            if pattern in low:
                return "Invalid input detected."

        return None  # Valid
```

### Progress Updates

Send intermediate progress updates:

```python
class ProgressExecutor(AgentFlowExecutor):
    """Sends progress updates during execution."""

    async def execute(self, context: RequestContext, event_queue: EventQueue):
        updater = TaskUpdater(
            event_queue=event_queue,
            task_id=context.task_id or "",
            context_id=context.context_id or "",
        )
        await updater.submit()
        await updater.start_work()

        try:
            user_text = context.get_user_input() if context.message else ""

            # Progress update 1
            progress = updater.new_agent_message(
                parts=[TextPart(text="Analyzing your request...")]
            )
            await updater.update_status(TaskState.working, message=progress)

            # Run graph with streaming to get incremental updates
            last_text = ""
            async for chunk in self.graph.astream(
                {"messages": [AFMessage.text_message(user_text)]},
                config={"thread_id": context.context_id or ""},
            ):
                if chunk.message and chunk.message.text():
                    last_text = chunk.message.text()
                    progress = updater.new_agent_message(
                        parts=[TextPart(text=last_text)]
                    )
                    await updater.update_status(TaskState.working, message=progress)

            await updater.add_artifact([TextPart(text=last_text)])
            await updater.complete()

        except Exception as exc:
            error_msg = updater.new_agent_message(
                parts=[TextPart(text=f"Error: {exc!s}")]
            )
            await updater.failed(message=error_msg)
```

### Multimodal Responses

Return structured data or multiple artifacts:

```python
class RichResponseExecutor(AgentFlowExecutor):
    """Returns multiple artifacts."""

    async def _handle_response(self, response_text: str, updater: TaskUpdater):
        # Main text artifact
        await updater.add_artifact([TextPart(text=response_text)])

        # Additional metadata artifact
        await updater.add_artifact([
            TextPart(text=f"Processed at: {datetime.now().isoformat()}")
        ])

        await updater.complete()
```

## Registering Custom Executors

### In Code

```python
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore

executor = MyCustomExecutor(compiled_graph=app)
handler = DefaultRequestHandler(
    agent_executor=executor,
    task_store=InMemoryTaskStore(),
)
a2a_app = A2AStarletteApplication(
    agent_card=card,
    http_handler=handler,
).build()
```

### In agentflow.json

```json
{
  "agent": "graph:app",
  "a2a": {
    "name": "MyAgent",
    "executor": "my_executor:MyCustomExecutor"
  }
}
```

## TaskUpdater Reference

The `TaskUpdater` manages A2A task state:

```python
updater = TaskUpdater(event_queue, task_id, context_id)

# Lifecycle methods
await updater.submit()      # Mark task as submitted
await updater.start_work()  # Mark task as working
await updater.complete()    # Mark task as completed
await updater.failed(message=msg)  # Mark task as failed

# Progress updates
msg = updater.new_agent_message(parts=[TextPart(text="...")])
await updater.update_status(TaskState.working, message=msg)
await updater.update_status(TaskState.input_required, message=msg)

# Artifacts
await updater.add_artifact([TextPart(text="Final response")])
```

## Best Practices

1. **Always call submit() first** - Required for proper task tracking

2. **Handle all exceptions** - Unhandled exceptions leave tasks in limbo

3. **Use context_id for session state** - Enables multi-turn conversations

4. **Signal INPUT_REQUIRED explicitly** - Helps clients understand what's needed

5. **Keep progress updates meaningful** - Don't spam with every chunk
