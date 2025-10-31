# React Agents with Dependency Injection

Dependency Injection (DI) is a powerful pattern that makes your React agents more modular, testable, and maintainable.  Agentflow uses **InjectQ** for sophisticated dependency management, enabling clean separation of concerns and easy testing.

## 🎯 Learning Objectives

By the end of this tutorial, you'll understand:

- How dependency injection works in  Agentflow React agents
- Using InjectQ for service management and parameter injection
- Building modular, testable agent architectures
- Advanced DI patterns for enterprise applications
- Debugging and testing DI-enabled agents

## 🧩 What is Dependency Injection?

Dependency Injection is a design pattern where objects receive their dependencies from external sources rather than creating them internally. This leads to:

- **Testability**: Easy to mock dependencies for unit testing
- **Modularity**: Components are loosely coupled and reusable
- **Configurability**: Different implementations can be injected based on context
- **Maintainability**: Changes to dependencies don't require modifying dependent code

### Traditional Approach (Tight Coupling)
```python
def weather_tool(location: str) -> str:
    # Hard-coded dependencies - difficult to test/change
    api_client = WeatherAPIClient("api_key_123")
    cache = RedisCache("localhost:6379")
    logger = FileLogger("/var/log/weather.log")

    # Tool logic
    return api_client.get_weather(location)
```

### Dependency Injection Approach (Loose Coupling)
```python
def weather_tool(
    location: str,
    api_client: WeatherAPIClient = Inject[WeatherAPIClient],
    cache: CacheService = Inject[CacheService],
    logger: Logger = Inject[Logger]
) -> str:
    # Dependencies injected automatically
    # Easy to test with mocks
    # Configurable implementations
    return api_client.get_weather(location)
```

## 🏗️ InjectQ Fundamentals

 Agentflow uses **InjectQ** for dependency injection. Here's how it works:

### 1. Container Setup

```python
from injectq import InjectQ, Inject

# Get the global DI container
container = InjectQ.get_instance()

# Bind services to the container
container.bind_instance(WeatherAPIClient, WeatherAPIClient("api_key"))
container.bind_instance(Logger, ConsoleLogger())
container.bind_singleton(CacheService, RedisCache)
```

### 2. Service Registration

```python
# Bind specific instances
weather_client = WeatherAPIClient(api_key="your_key")
container.bind_instance(WeatherAPIClient, weather_client)

# Bind singletons (created once, reused)
container.bind_singleton(CacheService, InMemoryCache)

# Bind factories (new instance each time)
container.bind_factory(Logger, lambda: FileLogger(f"log_{datetime.now().isoformat()}.txt"))
```

### 3. Dependency Injection in Functions

```python
def my_tool(
    param: str,
    # Standard auto-injected parameters
    tool_call_id: str | None = None,
    state: AgentState | None = None,
    config: dict | None = None,
    # Custom dependencies (InjectQ)
    weather_client: WeatherAPIClient = Inject[WeatherAPIClient],
    cache: CacheService = Inject[CacheService],
    logger: Logger = Inject[Logger]
) -> str:
    logger.info(f"Tool called with param: {param}")

    # Use injected dependencies
    cached_result = cache.get(f"weather_{param}")
    if cached_result:
        return cached_result

    result = weather_client.get_weather(param)
    cache.set(f"weather_{param}", result, ttl=300)

    return result
```

## 🌤️ Complete Example: Advanced Weather Agent with DI

Let's build a production-ready weather agent using dependency injection:

### Step 1: Define Services and Interfaces

```python
from abc import ABC, abstractmethod
from typing import Optional
import time

# Abstract interfaces for dependency injection
class WeatherService(ABC):
    @abstractmethod
    def get_weather(self, location: str) -> str:
        pass

class CacheService(ABC):
    @abstractmethod
    def get(self, key: str) -> Optional[str]:
        pass

    @abstractmethod
    def set(self, key: str, value: str, ttl: int = 300) -> None:
        pass

class Logger(ABC):
    @abstractmethod
    def info(self, message: str) -> None:
        pass

    @abstractmethod
    def error(self, message: str) -> None:
        pass

# Concrete implementations
class MockWeatherService(WeatherService):
    def get_weather(self, location: str) -> str:
        return f"Mock weather for {location}: Sunny, 75°F (24°C)"

class InMemoryCache(CacheService):
    def __init__(self):
        self._cache = {}

    def get(self, key: str) -> Optional[str]:
        data, expiry = self._cache.get(key, (None, 0))
        if data and time.time() < expiry:
            return data
        return None

    def set(self, key: str, value: str, ttl: int = 300) -> None:
        expiry = time.time() + ttl
        self._cache[key] = (value, expiry)

class ConsoleLogger(Logger):
    def info(self, message: str) -> None:
        print(f"INFO: {message}")

    def error(self, message: str) -> None:
        print(f"ERROR: {message}")
```

### Step 2: Setup Dependency Container

```python
from injectq import InjectQ, Inject
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.utils.callbacks import CallbackManager

# Get the container instance
container = InjectQ.get_instance()

# Register services
container.bind_instance(WeatherService, MockWeatherService())
container.bind_instance(CacheService, InMemoryCache())
container.bind_instance(Logger, ConsoleLogger())

# Register  Agentflow services
container.bind_instance(InMemoryCheckpointer, InMemoryCheckpointer())
container.bind_instance(CallbackManager, CallbackManager())

# Register configuration values
container["api_timeout"] = 5.0
container["cache_ttl"] = 600
container["max_retries"] = 3
```

### Step 3: Create DI-Enabled Tools

```python
from agentflow.graph import ToolNode
from agentflow.state.agent_state import AgentState
from agentflow.utils import Message


def get_weather_with_di(
        location: str,
        # auto-injected parameters
        tool_call_id: str | None = None,
        state: AgentState | None = None,
        config: dict | None = None,
        # Custom injected services
        weather_service: WeatherService = Inject[WeatherService],
        cache: CacheService = Inject[CacheService],
        logger: Logger = Inject[Logger]
) -> Message:
    """
    Advanced weather tool with dependency injection.
    Demonstrates caching, logging, and service abstraction.
    """

    try:
        # Log the request
        logger.info(f"Weather request [ID: {tool_call_id}] for location: {location}")

        # Check cache first
        cache_key = f"weather_{location.lower().replace(' ', '_')}"
        cached_result = cache.get(cache_key)

        if cached_result:
            logger.info(f"Cache hit for {location}")
            return Message.tool_message(
                content=f"[Cached] {cached_result}",
                tool_call_id=tool_call_id
            )

        # Fetch from weather service
        logger.info(f"Fetching fresh weather data for {location}")
        weather_data = weather_service.get_weather(location)

        # Cache the result
        cache.set(cache_key, weather_data, ttl=600)  # 10 minutes

        return Message.tool_message(
            content=weather_data,
            tool_call_id=tool_call_id
        )

    except Exception as e:
        error_msg = f"Error getting weather for {location}: {str(e)}"
        logger.error(error_msg)

        return Message.tool_message(
            content=f"Sorry, I couldn't get weather information for {location}. Please try again.",
            tool_call_id=tool_call_id
        )


def get_forecast_with_di(
        location: str,
        days: int = 3,
        tool_call_id: str | None = None,
        weather_service: WeatherService = Inject[WeatherService],
        logger: Logger = Inject[Logger]
) -> Message:
    """Multi-day forecast tool with DI."""

    logger.info(f"Forecast request for {location}, {days} days")

    # In a real implementation, this would call a forecast API
    forecast = f"{days}-day forecast for {location}: Partly cloudy with temperatures 70-78°F"

    return Message.tool_message(
        content=forecast,
        tool_call_id=tool_call_id
    )


# Create tool node with DI-enabled tools
tool_node = ToolNode([get_weather_with_di, get_forecast_with_di])
```

### Step 4: DI-Enabled Main Agent

```python
from litellm import acompletion
from agentflow.adapters.llm.model_response_converter import ModelResponseConverter
from agentflow.utils.converter import convert_messages


async def main_agent_with_di(
        state: AgentState,
        config: dict,
        # services injected via DI
        checkpointer: InMemoryCheckpointer = Inject[InMemoryCheckpointer],
        callback_manager: CallbackManager = Inject[CallbackManager],
        # Custom services
        logger: Logger = Inject[Logger]
) -> ModelResponseConverter:
    """
    Main agent with dependency injection for services.
    """

    # Access injected services
    logger.info(f"Main agent processing - Context size: {len(state.context or [])}")

    # Access DI container for configuration
    container = InjectQ.get_instance()
    api_timeout = container.get("api_timeout", 5.0)

    system_prompt = """
    You are an advanced weather assistant with caching capabilities.

    Available tools:
    - get_weather_with_di: Get current weather for any location (with caching)
    - get_forecast_with_di: Get multi-day weather forecast

    Guidelines:
    - Use appropriate tools based on user requests
    - Mention if data is cached for transparency
    - Be helpful and conversational
    """

    messages = convert_messages(
        system_prompts=[{"role": "system", "content": system_prompt}],
        state=state
    )

    try:
        # Check if we just received tool results
        if state.context and state.context[-1].role == "tool":
            # Final response after tool execution
            response = await acompletion(
                model="gemini/gemini-2.5-flash",
                messages=messages,
                timeout=api_timeout
            )
        else:
            # Regular response with tools available
            tools = await tool_node.all_tools()
            response = await acompletion(
                model="gemini/gemini-2.5-flash",
                messages=messages,
                tools=tools,
                timeout=api_timeout
            )

        return ModelResponseConverter(response, converter="litellm")

    except Exception as e:
        logger.error(f"Main agent error: {e}")

        # Return graceful error response
        error_response = Message.text_message(
            "I apologize, but I'm experiencing technical difficulties. Please try again."
        )
        return [error_response]
```

### Step 5: Graph with DI Container

```python
from agentflow.graph import StateGraph
from agentflow.utils.constants import END


def should_use_tools_with_logging(
        state: AgentState,
        logger: Logger = Inject[Logger]
) -> str:
    """Routing function with injected logging."""

    if not state.context:
        logger.info("No context, routing to TOOL")
        return "TOOL"

    # Count recent tool calls for safety
    recent_tools = sum(1 for msg in state.context[-5:] if msg.role == "tool")
    if recent_tools >= 3:
        logger.warning("Too many recent tool calls, ending conversation")
        return END

    last_message = state.context[-1]

    if (hasattr(last_message, "tools_calls") and
            last_message.tools_calls and
            last_message.role == "assistant"):
        logger.info("Assistant made tool calls, routing to TOOL")
        return "TOOL"

    if last_message.role == "tool":
        logger.info("Tool results received, routing to MAIN")
        return "MAIN"

    logger.info("Conversation complete, ending")
    return END


# Create graph with DI container
graph = StateGraph(container=container)

# Add nodes (DI happens automatically)
graph.add_node("MAIN", main_agent_with_di)
graph.add_node("TOOL", tool_node)

# Add conditional routing
graph.add_conditional_edges("MAIN", should_use_tools_with_logging, {
    "TOOL": "TOOL",
    END: END
})

# Tools return to main
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

# Compile with DI-injected checkpointer
app = graph.compile()
```

### Step 6: Running and Testing the DI Agent

```python
from agentflow.utils import Message


async def demo_di_agent():
    """Demonstrate the DI-enabled weather agent."""

    test_cases = [
        "What's the weather in New York?",
        "What's the weather in New York?",  # Should hit cache
        "Can you give me a 5-day forecast for London?",
        "How about the weather in Tokyo?"
    ]

    for i, query in enumerate(test_cases):
        print(f"\n{'=' * 60}")
        print(f"Test {i + 1}: {query}")
        print('=' * 60)

        inp = {"messages": [Message.text_message(query)]}
        config = {"thread_id": f"di-test-{i}", "recursion_limit": 10}

        try:
            result = await app.ainvoke(inp, config=config)

            for message in result["messages"]:
                role_emoji = {"user": "👤", "assistant": "🤖", "tool": "🔧"}
                emoji = role_emoji.get(message.role, "❓")
                print(f"{emoji} {message.role.upper()}: {message.content}")

        except Exception as e:
            print(f"❌ Error: {e}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(demo_di_agent())
```

## 🧪 Testing DI-Enabled Agents

Dependency injection makes testing much easier:

### Unit Testing Tools

```python
import pytest
from unittest.mock import Mock, AsyncMock

@pytest.fixture
def mock_weather_service():
    """Create a mock weather service for testing."""
    mock = Mock(spec=WeatherService)
    mock.get_weather.return_value = "Test weather: Sunny, 75°F"
    return mock

@pytest.fixture
def mock_cache():
    """Create a mock cache service."""
    mock = Mock(spec=CacheService)
    mock.get.return_value = None  # No cache hits by default
    return mock

@pytest.fixture
def mock_logger():
    """Create a mock logger."""
    return Mock(spec=Logger)

def test_weather_tool_with_mocks(mock_weather_service, mock_cache, mock_logger):
    """Test weather tool with mocked dependencies."""

    # Setup DI container with mocks
    test_container = InjectQ()
    test_container.bind_instance(WeatherService, mock_weather_service)
    test_container.bind_instance(CacheService, mock_cache)
    test_container.bind_instance(Logger, mock_logger)

    # Temporarily replace global container
    original_container = InjectQ._instance
    InjectQ._instance = test_container

    try:
        # Call the tool
        result = get_weather_with_di("New York", tool_call_id="test-123")

        # Verify behavior
        assert "Test weather: Sunny, 75°F" in result.content
        mock_weather_service.get_weather.assert_called_once_with("New York")
        mock_cache.get.assert_called_once()
        mock_logger.info.assert_called()

    finally:
        # Restore original container
        InjectQ._instance = original_container
```

### Integration Testing

```python
@pytest.mark.asyncio
async def test_full_agent_workflow():
    """Test complete agent workflow with real dependencies."""

    # Use test container with real implementations
    test_container = InjectQ()
    test_container.bind_instance(WeatherService, MockWeatherService())
    test_container.bind_instance(CacheService, InMemoryCache())
    test_container.bind_instance(Logger, ConsoleLogger())

    # Create test graph
    test_graph = StateGraph(container=test_container)
    test_graph.add_node("MAIN", main_agent_with_di)
    test_graph.add_node("TOOL", ToolNode([get_weather_with_di]))
    test_graph.add_conditional_edges("MAIN", should_use_tools_with_logging, {
        "TOOL": "TOOL", END: END
    })
    test_graph.add_edge("TOOL", "MAIN")
    test_graph.set_entry_point("MAIN")

    test_app = test_graph.compile()

    # Test the workflow
    inp = {"messages": [Message.text_message("Weather in Paris?")]}
    config = {"thread_id": "integration-test", "recursion_limit": 5}

    result = await test_app.ainvoke(inp, config=config)

    # Verify results
    assert len(result["messages"]) >= 2

    tool_messages = [m for m in result["messages"] if m.role == "tool"]
    assert len(tool_messages) > 0

    final_response = [m for m in result["messages"] if m.role == "assistant"][-1]
    assert "paris" in final_response.content.lower()
```

## 🏗️ Advanced DI Patterns

### Configuration Injection

```python
# Bind configuration values
container["weather_api_key"] = "your_api_key"
container["cache_ttl"] = 300
container["retry_attempts"] = 3

def configurable_tool(
    location: str,
    api_key: str = Inject["weather_api_key"],
    ttl: int = Inject["cache_ttl"],
    retries: int = Inject["retry_attempts"]
) -> str:
    """Tool with injected configuration."""

    for attempt in range(retries):
        try:
            return call_weather_api(location, api_key, timeout=ttl)
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
```

### Factory Pattern

```python
from datetime import datetime

def create_logger() -> Logger:
    """Factory function for creating loggers."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return FileLogger(f"agent_log_{timestamp}.txt")

# Register factory
container.bind_factory(Logger, create_logger)

# Each injection gets a new logger instance
def tool_with_unique_logger(
    param: str,
    logger: Logger = Inject[Logger]  # New logger each time
) -> str:
    logger.info(f"Processing {param}")
    return f"Processed {param}"
```

### Conditional Binding

```python
import os

# Conditional service binding based on environment
if os.getenv("ENVIRONMENT") == "production":
    container.bind_instance(WeatherService, RealWeatherAPIService())
    container.bind_instance(Logger, FileLogger("/var/log/agent.log"))
else:
    container.bind_instance(WeatherService, MockWeatherService())
    container.bind_instance(Logger, ConsoleLogger())
```

### Service Lifecycle Management

```python
class DatabaseConnection:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.connection = None

    def connect(self):
        # Initialize database connection
        self.connection = create_connection(self.connection_string)

    def disconnect(self):
        # Clean up connection
        if self.connection:
            self.connection.close()

# Singleton with lifecycle management
container.bind_singleton(DatabaseConnection, DatabaseConnection,
                        setup_method="connect",
                        teardown_method="disconnect")
```

## 🔧 Debugging DI Issues

### Container Inspection

```python
def debug_container():
    """Debug the DI container state."""

    container = InjectQ.get_instance()

    print("DI Container Debug Information:")
    print(f"Registered services: {list(container._instances.keys())}")
    print(f"Singleton services: {list(container._singletons.keys())}")
    print(f"Factory services: {list(container._factories.keys())}")

    # Print dependency graph
    dependency_graph = container.get_dependency_graph()
    print(f"Dependency graph: {dependency_graph}")
```

### Dependency Resolution Tracing

```python
def trace_di_resolution():
    """Trace how dependencies are resolved."""

    container = InjectQ.get_instance()

    # Enable debug mode (if available)
    container.debug = True

    # Call function and observe resolution
    result = get_weather_with_di("Test Location")
    print(f"Result: {result}")
```

### Common DI Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Circular Dependencies** | Stack overflow, infinite recursion | Redesign service interfaces, use factory pattern |
| **Missing Bindings** | `KeyError` or injection errors | Verify all dependencies are registered |
| **Scope Issues** | Unexpected service instances | Check singleton vs factory bindings |
| **Threading Issues** | Race conditions in singletons | Use thread-safe implementations |
| **Memory Leaks** | Growing memory usage | Implement proper cleanup methods |

## ⚡ Performance Considerations

### Lazy Loading

```python
from functools import lru_cache

@lru_cache(maxsize=1)
def get_expensive_service() -> ExpensiveService:
    """Lazy-loaded expensive service."""
    return ExpensiveService(initialize_heavy_resources=True)

# Bind as factory for lazy loading
container.bind_factory(ExpensiveService, get_expensive_service)
```

### Service Pooling

```python
import queue
import threading

class ServicePool:
    """Pool of reusable service instances."""

    def __init__(self, service_factory, pool_size=10):
        self.pool = queue.Queue(maxsize=pool_size)
        self.factory = service_factory

        # Pre-populate pool
        for _ in range(pool_size):
            self.pool.put(service_factory())

    def get_service(self):
        try:
            return self.pool.get_nowait()
        except queue.Empty:
            return self.factory()

    def return_service(self, service):
        try:
            self.pool.put_nowait(service)
        except queue.Full:
            pass  # Discard if pool is full

# Use pooled services
weather_pool = ServicePool(lambda: WeatherAPIService(), pool_size=5)
container.bind_instance(ServicePool, weather_pool)
```

## 🚀 Production Best Practices

### 1. Service Registration Strategy

```python
def setup_production_container():
    """Setup DI container for production environment."""

    container = InjectQ.get_instance()

    # Core services as singletons
    container.bind_singleton(DatabaseConnection, DatabaseConnection)
    container.bind_singleton(CacheService, RedisCache)

    # API clients as instances (potentially pooled)
    container.bind_instance(WeatherAPIClient, WeatherAPIClient(
        api_key=os.getenv("WEATHER_API_KEY"),
        timeout=30,
        max_retries=3
    ))

    # Logging with proper configuration
    container.bind_instance(Logger, StructuredLogger(
        level=logging.INFO,
        output_file="/var/log/agent.log",
        rotation="daily"
    ))

    # Configuration from environment
    container["environment"] = os.getenv("ENVIRONMENT", "development")
    container["debug_mode"] = os.getenv("DEBUG", "false").lower() == "true"
```

### 2. Health Checks

```python
def health_check_services():
    """Check health of injected services."""

    container = InjectQ.get_instance()

    try:
        # Test database connection
        db = container.get(DatabaseConnection)
        db.ping()

        # Test cache service
        cache = container.get(CacheService)
        cache.set("health_check", "ok")
        assert cache.get("health_check") == "ok"

        # Test weather API
        weather = container.get(WeatherAPIClient)
        weather.get_weather("London")  # Quick test call

        return {"status": "healthy", "services": "all_ok"}

    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
```

### 3. Graceful Shutdown

```python
def shutdown_services():
    """Properly shutdown all services."""

    container = InjectQ.get_instance()

    # Close database connections
    try:
        db = container.get(DatabaseConnection)
        db.disconnect()
    except Exception as e:
        logging.error(f"Error shutting down database: {e}")

    # Flush caches
    try:
        cache = container.get(CacheService)
        cache.flush()
    except Exception as e:
        logging.error(f"Error flushing cache: {e}")

    # Close log files
    try:
        logger = container.get(Logger)
        logger.close()
    except Exception as e:
        logging.error(f"Error closing logger: {e}")
```

## 🎯 Real-World Example: Multi-Service Weather Platform

Here's a comprehensive example showing DI in a production-like weather platform:

```python
import asyncio
import logging
from datetime import datetime
from typing import Dict, List
from dataclasses import dataclass

# Domain models
@dataclass
class WeatherData:
    location: str
    temperature: float
    humidity: float
    description: str
    timestamp: datetime

@dataclass
class ForecastData:
    location: str
    forecasts: List[WeatherData]

# Service interfaces
class WeatherRepository(ABC):
    @abstractmethod
    async def get_weather(self, location: str) -> WeatherData:
        pass

    @abstractmethod
    async def get_forecast(self, location: str, days: int) -> ForecastData:
        pass

class NotificationService(ABC):
    @abstractmethod
    async def send_alert(self, message: str, severity: str) -> bool:
        pass

class MetricsService(ABC):
    @abstractmethod
    def record_request(self, endpoint: str, duration_ms: int) -> None:
        pass

    @abstractmethod
    def record_error(self, endpoint: str, error_type: str) -> None:
        pass

# Implementations
class ProductionWeatherRepository(WeatherRepository):
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url

    async def get_weather(self, location: str) -> WeatherData:
        # Production API implementation
        return WeatherData(
            location=location,
            temperature=22.5,
            humidity=65,
            description="Partly cloudy",
            timestamp=datetime.now()
        )

    async def get_forecast(self, location: str, days: int) -> ForecastData:
        # Production forecast implementation
        forecasts = [
            WeatherData(
                location=location,
                temperature=20.0 + i,
                humidity=60 + i,
                description=f"Day {i+1} weather",
                timestamp=datetime.now()
            )
            for i in range(days)
        ]
        return ForecastData(location=location, forecasts=forecasts)

# Advanced tool with comprehensive DI
async def comprehensive_weather_tool(
    location: str,
    include_forecast: bool = False,
    forecast_days: int = 3,
    # injections
    tool_call_id: str | None = None,
    state: AgentState | None = None,
    # Custom service injections
    weather_repo: WeatherRepository = Inject[WeatherRepository],
    cache: CacheService = Inject[CacheService],
    logger: Logger = Inject[Logger],
    metrics: MetricsService = Inject[MetricsService],
    notifications: NotificationService = Inject[NotificationService]
) -> Message:
    """Comprehensive weather tool with full DI integration."""

    start_time = time.time()

    try:
        logger.info(f"Weather request: {location}, forecast={include_forecast}")

        # Get current weather
        weather = await weather_repo.get_weather(location)

        response_parts = [
            f"Current weather in {weather.location}:",
            f"🌡️ Temperature: {weather.temperature}°C",
            f"💧 Humidity: {weather.humidity}%",
            f"☁️ Conditions: {weather.description}"
        ]

        # Add forecast if requested
        if include_forecast:
            forecast = await weather_repo.get_forecast(location, forecast_days)
            response_parts.append(f"\n📅 {forecast_days}-day forecast:")

            for i, day_weather in enumerate(forecast.forecasts[:forecast_days]):
                response_parts.append(
                    f"Day {i+1}: {day_weather.temperature}°C, {day_weather.description}"
                )

        # Check for severe weather and send notifications
        if weather.temperature > 35:  # Hot weather alert
            await notifications.send_alert(
                f"High temperature alert for {location}: {weather.temperature}°C",
                severity="warning"
            )

        # Record successful request metrics
        duration_ms = int((time.time() - start_time) * 1000)
        metrics.record_request("weather_tool", duration_ms)

        return Message.tool_message(
            content="\n".join(response_parts),
            tool_call_id=tool_call_id
        )

    except Exception as e:
        # Record error metrics
        metrics.record_error("weather_tool", type(e).__name__)

        logger.error(f"Weather tool error for {location}: {e}")

        return Message.tool_message(
            content=f"Sorry, I couldn't get weather information for {location}. Please try again later.",
            tool_call_id=tool_call_id
        )
```

## 🚀 Next Steps

Congratulations! You now understand how to build sophisticated, maintainable React agents using dependency injection. Here's what to explore next:

1. **[MCP Integration](03-mcp-integration.md)** - Connect to external systems via Model Context Protocol
2. **[Streaming Responses](04-streaming.md)** - Real-time agent responses with event streaming

### Advanced DI Topics to Explore

- **Multi-tenant DI**: Different service configurations per tenant
- **Plugin Architecture**: Dynamic service loading and registration
- **Distributed DI**: Service discovery in microservice architectures
- **Performance Monitoring**: DI container performance optimization

## 📁 Reference Files

Study these examples to see DI patterns in action:

- `examples/react-injection/react_di.py` - Basic DI with InjectQ container
- `examples/react-injection/react_di2.py` - Advanced DI patterns and service management

Dependency injection transforms your React agents from simple scripts into robust, enterprise-ready applications. Master these patterns to build maintainable, testable, and scalable agent systems!
