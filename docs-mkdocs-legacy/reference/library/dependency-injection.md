# Dependency Injection in  Agentflow

Dependency injection (DI) is a fundamental design pattern that  Agentflow embraces to build flexible, testable, and maintainable agent applications. By integrating with InjectQ,  Agentflow provides a powerful dependency injection system that makes your agents more modular and easier to configure.

## What is Dependency Injection?

Dependency injection is a technique where objects receive their dependencies from external sources rather than creating them internally. Instead of a class saying "I need a database, let me create one," dependency injection says "I need a database, please provide me with one."

This approach offers several advantages:
- **Decoupling**: Components don't need to know how their dependencies are created
- **Testability**: Easy to replace real dependencies with mocks during testing
- **Flexibility**: Different implementations can be swapped without code changes
- **Configuration**: Dependencies can be configured externally

##  Agentflow's DI Integration

 Agentflow integrates seamlessly with [InjectQ](https://iamsdt.github.io/injectq/), a lightweight, type-friendly dependency injection library. This integration allows you to inject dependencies into:

- **Node functions** in your state graphs
- **Tool functions** in your tool nodes
- **Prebuilt agents** and their components
- **Custom services** and utilities

## Available Injectable Objects, that packed with  Agentflow

When you compile a  Agentflow graph, several core services are automatically registered in the dependency injection container:

| Name | Details | Usages |
|------|---------|--------|
| `BaseCheckpointer` | A checkpointer that stores state in memory (default in-memory implementation). | Provide or replace for persistence during graph execution; injected into nodes/tools that need to read/write full state. |
| `CallbackManager` | Manages lifecycle callbacks for agent events (before/after invoke, on error, etc.). | Use to register metrics, logging, or custom hooks that run at specific agent lifecycle points. |
| `BaseStore` | Abstract interface for storing and retrieving arbitrary data (embeddings, documents, blobs). | Bind a concrete store (e.g., Qdrant, Faiss) to persist vectors or documents used by RAG and memory stores. |
| `BaseContextManager` | Manages conversational context windows and summarisation strategies. | Swap implementations to control how context is trimmed or summarised before model calls. |
| `BasePublisher` | Publishes runtime events to sinks (console, Redis, Kafka, etc.). | Inject custom publisher to stream events to monitoring/observability pipelines. |
| `BaseIDGenerator` | Generates unique IDs used across invocations and resources. | Inject for deterministic IDs, integration with existing ID schemes, or testing. |
| `generated_id` | The unique ID string generated for the current agent invocation. | Read-only value injected into nodes/tools for tracing and correlation. |
| `generated_id_type` | The type of the generated ID (e.g., `"uuid"`, `"shortid"`). | Useful for downstream systems that need to parse or route based on ID shape. |
| `CompiledGraph` | The compiled and executable graph instance for runtime introspection and dynamic operations. | Access graph structure, execute operations, or perform runtime modifications. |
| `get_node` | Factory function to retrieve nodes by name from the compiled graph. | `node = get_node("my_node")` - get specific nodes for inspection or dynamic execution. |
| `get_entry_point_node` | Factory function to retrieve the entry point node of the compiled graph. | `entry_node = get_entry_point_node()` - access the starting node of the workflow. |

Note: For `BaseStore`, `BaseContextManager`, and `BasePublisher`,  Agentflow provides default implementations, but you can bind your own implementations to the container if needed.


## The Container Pattern

At the heart of  Agentflow's dependency injection is the **container** - a centralized registry that manages how dependencies are created and provided. Think of it as a smart factory that knows how to build and deliver the right objects when needed.

### Basic Container Usage

```python
from injectq import InjectQ

# Get the global container instance
container = InjectQ.get_instance()

# Register a simple value
container["api_key"] = "your-secret-key"
container[str] = "default-string-value"

# Register an instance
database = DatabaseConnection()
container.bind_instance(DatabaseConnection, database)
```

When you compile a  Agentflow graph, you can pass this container, and it becomes available throughout your agent execution:

```python
graph = StateGraph(container=container)
app = graph.compile(checkpointer=checkpointer)
```

## Injection Patterns

 Agentflow supports several ways to declare and receive dependencies in your functions.

### Type-Based Injection with Inject[]

The most common pattern uses the `Inject[Type]` annotation to specify what dependency you need:

```python
from injectq import Inject
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.utils.callbacks import CallbackManager


async def my_agent_node(
        state: AgentState,
        config: dict,
        checkpointer: InMemoryCheckpointer = Inject[InMemoryCheckpointer],
        callback: CallbackManager = Inject[CallbackManager],
):
    # Use your injected dependencies
    saved_state = await checkpointer.aget(config)
    await callback.before_invoke("AI", state)

    # Your agent logic here
    return updated_state
```

### Tool Parameter Injection

Tool functions can receive special injectable parameters that Agentflow provides automatically. These parameters are automatically injected by the framework and don't need to be passed explicitly:

```python
def get_weather(
    location: str,  # Regular parameter from tool call
    tool_call_id: str | None = None,  # Auto-injected: Unique ID for this tool execution
    state: AgentState | None = None,  # Auto-injected: Current agent state
    config: dict | None = None,       # Auto-injected: Execution configuration
    generated_id: str | None = None,  # Auto-injected: Framework-generated ID
    checkpointer: InMemoryCheckpointer = Inject[InMemoryCheckpointer],  # From container
) -> Message:
    # tool_call_id, state, config, and generated_id are automatically provided
    # checkpointer comes from the dependency injection container

    if tool_call_id:
        print(f"Handling tool call: {tool_call_id}")

    weather_data = fetch_from_api(location)
    return Message.tool_message(content=weather_data, tool_call_id=tool_call_id)
```

**Available Auto-Injected Parameters:**
- `tool_call_id`: Unique identifier for the current tool execution
- `state`: Current `AgentState` instance with full context
- `config`: Configuration dictionary with execution settings
- `generated_id`: Framework-generated identifier for tracing

**Additional Injectable Services:**
- `context_manager`: `BaseContextManager` for cross-node state operations
- `publisher`: `BasePublisher` for event publishing
- `checkpointer`: `BaseCheckpointer` for state persistence
- `store`: `BaseStore` for data storage operations

### Container Access Patterns

Sometimes you need direct access to the container for dynamic dependency resolution:

```python
async def flexible_agent(state: AgentState, config: dict):
    container = InjectQ.get_instance()

    # Get a required dependency
    message_id = container.get("generated_id")

    # Try to get an optional dependency with fallback
    custom_config = container.try_get("custom_config", "default-value")

    # Your logic here
```

## Dependency Lifecycles and Scopes

InjectQ supports different dependency lifecycles that control how and when dependencies are created:

### Singleton Pattern

Singletons are created once and shared across all requests:

```python
from injectq import singleton

@singleton
class ConfigurationService:
    def __init__(self):
        self.settings = load_from_file()

# Register with container
container.bind(ConfigurationService, ConfigurationService)
```

### Transient Dependencies

Transient dependencies are created fresh for each request:

```python
class RequestLogger:
    def __init__(self):
        self.start_time = time.time()

# Each injection gets a new instance
container.bind(RequestLogger, lambda: RequestLogger())
```

### Request Scoping

For web applications or long-running processes, you might want dependencies that live for the duration of a request:

```python
from injectq.scopes import request_scoped

@request_scoped
class RequestContext:
    def __init__(self):
        self.request_id = generate_uuid()
        self.start_time = time.time()
```

## Common  Agentflow Dependency Patterns

### Injecting Core Services

 Agentflow automatically registers several core services in the container:

```python
async def my_node(
    state: AgentState,
    config: dict,
    # Core  Agentflow services
    checkpointer: InMemoryCheckpointer = Inject[InMemoryCheckpointer],
    callback: CallbackManager = Inject[CallbackManager],
    store: BaseStore = Inject[BaseStore],
):
    # These are automatically available when you compile your graph
    pass
```

### Using Graph Instance Injection

You can inject the compiled graph instance and factory functions for dynamic graph operations:

```python
async def dynamic_router(
    state: AgentState,
    config: dict,
    compiled_graph: CompiledGraph = Inject[CompiledGraph],
    get_node = Inject[Callable[[str], Node]],  # get_node factory
    get_entry_point_node = Inject[Callable[[], Node]],  # entry point factory
):
    # Access the compiled graph for runtime introspection
    graph_info = compiled_graph.generate_graph()
    print(f"Graph has {len(graph_info['nodes'])} nodes")

    # Get specific nodes dynamically
    entry_node = get_entry_point_node()
    specific_node = get_node("my_processor")

    # Make routing decisions based on graph structure
    if state.data.get("priority") == "high":
        return "urgent_handler"
    return "normal_handler"
```

### Node Factory Usage

The `get_node` factory allows dynamic access to any node in the compiled graph:

```python
async def meta_agent(
    state: AgentState,
    config: dict,
    get_node = Inject[Callable[[str], Node]],
):
    # Inspect node capabilities at runtime
    tool_node = get_node("my_tools")
    if hasattr(tool_node.func, 'all_tools'):
        available_tools = await tool_node.func.all_tools()
        # Choose tools based on availability
        if "search" in available_tools:
            return "use_search"
    return "fallback_action"
```

### Custom Service Registration

You can register your own services for injection:

```python
class WeatherService:
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def get_weather(self, location: str):
        # Implementation here
        pass

# Register your service
weather_service = WeatherService(api_key="your-key")
container.bind_instance(WeatherService, weather_service)

# Use in your agents
async def weather_agent(
    state: AgentState,
    config: dict,
    weather: WeatherService = Inject[WeatherService],
):
    data = await weather.get_weather("New York")
    # Process weather data
```

### Configuration Injection

A common pattern is injecting configuration values:

```python
# Register configuration
container["llm_model"] = "gpt-4o"
container["temperature"] = 0.7
container["max_tokens"] = 1000

async def llm_agent(
    state: AgentState,
    config: dict,
    model: str = Inject[str],  # Gets "llm_model" if registered as str
    temperature: float = Inject[float],
):
    response = await acompletion(
        model=model,
        temperature=temperature,
        messages=convert_messages(state=state),
    )
```

## Advanced Patterns

### Factory Dependencies

Sometimes you need to create dependencies dynamically based on runtime conditions:

```python
from injectq import provider

@provider
def create_database_connection(environment: str = Inject[str]) -> DatabaseConnection:
    if environment == "production":
        return ProductionDB()
    return DevelopmentDB()

container.bind(DatabaseConnection, create_database_connection)
```

### Multi-Implementation Patterns

You can register different implementations and choose which one to inject:

```python
class EmailService:
    async def send(self, message: str): pass

class SMTPEmailService(EmailService):
    async def send(self, message: str):
        # SMTP implementation
        pass

class AWSEmailService(EmailService):
    async def send(self, message: str):
        # AWS SES implementation
        pass

# Register based on environment
if os.getenv("EMAIL_PROVIDER") == "aws":
    container.bind(EmailService, AWSEmailService())
else:
    container.bind(EmailService, SMTPEmailService())
```

### Conditional Dependencies

Use the container's flexibility for conditional dependency resolution:

```python
async def notification_agent(
    state: AgentState,
    config: dict,
):
    container = InjectQ.get_instance()

    # Choose notification method based on user preference
    user_preference = extract_preference(state)

    if user_preference == "email":
        notifier = container.get(EmailService)
    else:
        notifier = container.get(SlackService)

    await notifier.send("Your agent task is complete!")
```

## Testing with Dependency Injection

One of the biggest advantages of dependency injection is simplified testing. You can easily replace real dependencies with test doubles:

```python
import pytest
from unittest.mock import Mock

def test_weather_agent():
    # Create test container
    test_container = InjectQ.get_instance()

    # Mock the weather service
    mock_weather = Mock()
    mock_weather.get_weather.return_value = "Sunny, 75°F"
    test_container.bind_instance(WeatherService, mock_weather)

    # Create graph with test container
    graph = StateGraph(container=test_container)
    graph.add_node("weather", weather_agent_node)
    # ... configure graph

    app = graph.compile()

    # Test your agent
    result = app.invoke({"messages": [Message.text_message("Weather in NYC?")]})

    # Verify mock was called
    mock_weather.get_weather.assert_called_once_with("NYC")
```

### Test-Specific Overrides

InjectQ provides utilities for test-specific dependency overrides:

```python
def test_with_overrides():
    with container.override(DatabaseService, MockDatabase()):
        # Your test code here
        # The override is automatically cleaned up
        pass
```

## Best Practices

### Keep Dependencies Focused

Don't inject everything into every function. Only inject what you actually need:

```python
# Good: Only inject what you use
async def simple_agent(
    state: AgentState,
    config: dict,
    logger: Logger = Inject[Logger],
):
    logger.info("Processing request")
    # Simple logic here

# Avoid: Injecting unused dependencies
async def over_injected_agent(
    state: AgentState,
    config: dict,
    logger: Logger = Inject[Logger],
    database: Database = Inject[Database],  # Not used
    cache: Cache = Inject[Cache],           # Not used
    email: EmailService = Inject[EmailService],  # Not used
):
    logger.info("Processing request")  # Only using logger
```

### Use Abstract Base Classes

Define interfaces for your services to make them more testable and flexible:

```python
from abc import ABC, abstractmethod

class StorageService(ABC):
    @abstractmethod
    async def save(self, key: str, data: dict): pass

    @abstractmethod
    async def load(self, key: str) -> dict: pass

class FileStorageService(StorageService):
    async def save(self, key: str, data: dict):
        # File implementation
        pass

class DatabaseStorageService(StorageService):
    async def save(self, key: str, data: dict):
        # Database implementation
        pass

# Register the interface, not the concrete class
container.bind(StorageService, FileStorageService())
```

### Initialize Container Early

Set up your container and all dependencies before creating your graph:

```python
def create_app():
    # Container setup
    container = InjectQ.get_instance()

    # Register all dependencies
    container.bind_instance(Logger, setup_logger())
    container.bind(DatabaseService, create_database_service())
    container["environment"] = os.getenv("ENVIRONMENT", "development")

    # Create and configure graph
    graph = StateGraph(container=container)
    # ... add nodes and edges

    return graph.compile(checkpointer=checkpointer)
```

### Leverage Container Debugging

InjectQ provides debugging capabilities to understand your dependency graph:

```python
# See what's registered
print("Registered dependencies:", container.get_dependency_graph())

# Validate your container setup
container.validate()  # Throws if circular dependencies exist
```

## Integration with  Agentflow Features

### Prebuilt Agents

 Agentflow's prebuilt agents automatically work with dependency injection:

```python
from agentflow.prebuilt.agent import ReactAgent

# Create container with your dependencies
container = InjectQ.get_instance()
container.bind_instance(WeatherService, WeatherService(api_key="key"))

# Prebuilt agents will use your container
react_agent = ReactAgent(
    model="gpt-4o",
    tools=[weather_tool],
    container=container,  # Your dependencies are available
)
```

### Callback Integration

Callbacks themselves can be dependency-injected services:

```python
class MetricsCallback:
    def __init__(self, metrics_service: MetricsService):
        self.metrics = metrics_service

    async def before_invoke(self, type_: str, state: AgentState):
        await self.metrics.increment(f"{type_}_invocations")

# Register and use
metrics_callback = MetricsCallback(metrics_service)
container.bind_instance(MetricsCallback, metrics_callback)
```

### Publisher Integration

Publishers can also be injected dependencies:

```python
from agentflow.publisher import ConsolePublisher


class CustomPublisher(ConsolePublisher):
    def __init__(self, notification_service: NotificationService):
        super().__init__()
        self.notifications = notification_service

    async def publish_event(self, event: EventModel):
        await super().publish_event(event)
        if event.event_type == "error":
            await self.notifications.alert("Agent error occurred")


container.bind_instance(CustomPublisher, CustomPublisher(notification_service))
```

## Troubleshooting Common Issues

### Missing Dependencies

If you see errors about missing dependencies, check your container registration:

```python
# Error: No binding found for DatabaseService
# Solution: Register the dependency
container.bind_instance(DatabaseService, DatabaseService(connection_string))
```

### Circular Dependencies

InjectQ can detect circular dependencies. If you encounter them, refactor your design:

```python
# Problematic: A depends on B, B depends on A
class ServiceA:
    def __init__(self, service_b: ServiceB = Inject[ServiceB]): pass

class ServiceB:
    def __init__(self, service_a: ServiceA = Inject[ServiceA]): pass

# Solution: Extract common interface or use factory pattern
```

### Type Resolution Issues

Make sure your type annotations are precise:

```python
# Problematic: Generic type
async def agent(database = Inject[object]):  # Too generic

# Better: Specific type
async def agent(database: DatabaseService = Inject[DatabaseService]):
```

## Performance Considerations

### Container Overhead

The dependency injection container has minimal overhead, but be aware of:

- **Singleton vs Transient**: Singletons are faster for repeated access
- **Factory Functions**: More flexible but slightly slower than direct instances
- **Container Lookups**: Direct `container.get()` calls are fast but consider caching for hot paths

### Memory Management

- Singletons live for the container's lifetime
- Transient dependencies are garbage collected when no longer referenced
- Request-scoped dependencies are cleaned up at request end

Dependency injection in  Agentflow transforms your agent applications from rigid, tightly-coupled systems into flexible, testable, and maintainable architectures. By embracing these patterns, you'll build agents that are easier to develop, test, and deploy in production environments.
