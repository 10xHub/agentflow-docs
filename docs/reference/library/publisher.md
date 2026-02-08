# Publisher: Real-time Agent Observability

The publisher system in  Agentflow provides real-time visibility into your agent's execution, transforming what was once a black box into a transparent, observable process. Rather than simply logging events after the fact, the publisher system creates live streams of execution data that enable monitoring, debugging, analytics, and real-time decision making.

## Understanding Event-Driven Observability

Traditional logging systems capture what happened after it's over.  Agentflow's publisher system captures what's happening as it happens, creating a continuous stream of execution events that flow from your agent graphs to whatever destination you choose—console output, message queues, databases, monitoring systems, or custom analytics platforms.

Think of it as the nervous system of your AI application: every decision, every tool call, every state change, every error generates events that flow through the publisher pipeline, giving you unprecedented insight into your agent's behavior and performance.

## Event Model: The Foundation of Observability

Every observable action in  Agentflow is captured as a structured `EventModel` that contains rich metadata about what's happening:

```python
from agentflow.publisher.events import EventModel, Event, EventType, ContentType

# Events are automatically generated during execution
event = EventModel(
    event=Event.NODE_EXECUTION,  # Source: graph, node, tool, or streaming
    event_type=EventType.START,  # Phase: start, progress, result, end, error
    content="Processing user query...",  # Human-readable content
    content_type=ContentType.TEXT,  # Semantic type of content
    node_name="research_agent",  # Which node is executing
    run_id="run_12345",  # Unique execution identifier
    thread_id="thread_abc",  # Conversation thread
    sequence_id=1,  # Ordering within the stream
    timestamp=1638360000.0,  # When this occurred
    metadata={  # Additional context
        "user_id": "user_123",
        "query_type": "research",
        "estimated_duration": 5.2
    }
)
```

This rich event model enables sophisticated analysis, filtering, and routing based on any combination of attributes, making it possible to build powerful monitoring and analytics systems on top of your agent execution.

## Event Sources and Types

 Agentflow generates events from four primary sources, each providing different levels of granularity:

### Graph Execution Events
These provide the highest-level view of your agent's operation:

```python
# Automatic graph-level events include:
Event.GRAPH_EXECUTION + EventType.START     # Agent conversation begins
Event.GRAPH_EXECUTION + EventType.PROGRESS  # Moving between nodes
Event.GRAPH_EXECUTION + EventType.RESULT    # Final response generated
Event.GRAPH_EXECUTION + EventType.END       # Conversation complete
Event.GRAPH_EXECUTION + EventType.ERROR     # Graph-level failures
```

Graph events help you understand the overall flow and performance of your agent conversations, including duration, success rates, and flow patterns.

### Node Execution Events
These track individual node operations within your graph:

```python
# Node execution lifecycle events:
Event.NODE_EXECUTION + EventType.START      # Node begins processing
Event.NODE_EXECUTION + EventType.PROGRESS   # Node internal progress
Event.NODE_EXECUTION + EventType.RESULT     # Node produces output
Event.NODE_EXECUTION + EventType.END        # Node completes
Event.NODE_EXECUTION + EventType.ERROR      # Node encounters error
```

Node events are crucial for identifying bottlenecks, understanding decision flows, and debugging issues in specific parts of your agent logic.

### Tool Execution Events
These capture all tool and function calls:

```python
# Tool execution events provide detailed operational insights:
Event.TOOL_EXECUTION + EventType.START      # Tool call initiated
Event.TOOL_EXECUTION + EventType.PROGRESS   # Tool processing
Event.TOOL_EXECUTION + EventType.RESULT     # Tool returns data
Event.TOOL_EXECUTION + EventType.END        # Tool call complete
Event.TOOL_EXECUTION + EventType.ERROR      # Tool call fails
```

Tool events enable monitoring of external service calls, API usage, performance analysis, and error tracking for all your agent's external interactions.

### Streaming Events
These capture real-time content generation:

```python
# Streaming events for real-time content delivery:
Event.STREAMING + EventType.START           # Stream begins
Event.STREAMING + EventType.PROGRESS        # Content chunks
Event.STREAMING + EventType.END             # Stream complete
Event.STREAMING + EventType.INTERRUPTED     # Stream stopped
```

Streaming events enable real-time UI updates, progressive content delivery, and live monitoring of content generation processes.

## Content Types and Semantic Understanding

Events carry semantic information about their content through the `ContentType` enum, enabling intelligent processing and routing:

```python
from agentflow.publisher.events import ContentType

# Text and messaging content
ContentType.TEXT  # Plain text content
ContentType.MESSAGE  # Structured message content
ContentType.REASONING  # Agent reasoning/thinking content

# Tool and function content
ContentType.TOOL_CALL  # Tool invocation details
ContentType.TOOL_RESULT  # Tool execution results

# Multimedia content
ContentType.IMAGE  # Image content or references
ContentType.AUDIO  # Audio content or references
ContentType.VIDEO  # Video content or references
ContentType.DOCUMENT  # Document content or references

# System content
ContentType.STATE  # Agent state information
ContentType.UPDATE  # General update notifications
ContentType.ERROR  # Error information
ContentType.DATA  # Structured data payloads
```

This semantic typing enables sophisticated event processing, such as routing error events to monitoring systems while sending reasoning content to debugging interfaces.

## Publisher Implementations

 Agentflow provides multiple publisher implementations for different use cases:

### Console Publisher: Development and Debugging

```python
from agentflow.publisher.console_publisher import ConsolePublisher

# Simple console output for development
console_publisher = ConsolePublisher({
    "format": "json",  # Output format: json or text
    "include_timestamp": True,  # Include timestamps
    "indent": 2  # JSON indentation
})

# Configure your graph to use console publishing
compiled_graph = graph.compile(
    checkpointer=checkpointer,
    publisher=console_publisher
)

# Now all execution events will be printed to console
result = await compiled_graph.invoke(
    {"messages": [user_message]},
    config={"user_id": "user_123"}
)
```

Console output provides immediate feedback during development:
```json
{
  "event": "node_execution",
  "event_type": "start",
  "node_name": "research_agent",
  "content": "Beginning research phase...",
  "timestamp": 1638360000.0,
  "metadata": {
    "user_id": "user_123",
    "query": "What are the latest AI developments?"
  }
}
```

### Redis Publisher: Distributed Systems

```python
from agentflow.publisher.redis_publisher import RedisPublisher

# Publish to Redis streams for distributed processing
redis_publisher = RedisPublisher({
    "redis_url": "redis://localhost:6379",
    "stream_name": "agent_events",
    "max_len": 10000  # Keep last 10k events
})
```

Redis publishing enables:
- Multiple consumers processing events
- Event persistence and replay
- Distributed monitoring systems
- Real-time dashboards across services

### Kafka Publisher: Enterprise Event Streaming

```python
from agentflow.publisher.kafka_publisher import KafkaPublisher

# Enterprise-grade event streaming
kafka_publisher = KafkaPublisher({
    "bootstrap_servers": ["localhost:9092"],
    "topic": "agent_execution_events",
    "key_serializer": "json",
    "value_serializer": "json"
})
```

Kafka publishing provides:
- High-throughput event processing
- Event durability and replication
- Complex event processing pipelines
- Integration with analytics platforms

### RabbitMQ Publisher: Flexible Messaging

```python
from agentflow.publisher.rabbitmq_publisher import RabbitMQPublisher

# Flexible messaging with routing
rabbitmq_publisher = RabbitMQPublisher({
    "connection_url": "amqp://localhost:5672",
    "exchange": "agent_events",
    "routing_key": "execution.{node_name}",  # Dynamic routing
    "durable": True
})
```

RabbitMQ enables:
- Sophisticated routing patterns
- Multiple subscriber types
- Guaranteed delivery
- Load balancing across consumers

## Event Processing Patterns

The publisher system enables powerful event processing patterns:

### Real-time Monitoring Dashboard

```python
import asyncio
from agentflow.publisher.redis_publisher import RedisPublisher


class AgentMonitor:
    def __init__(self):
        self.active_runs = {}
        self.performance_metrics = {}

    async def monitor_events(self):
        """Process events in real-time for dashboard updates."""
        async for event in self.event_stream():
            await self.process_event(event)

    async def process_event(self, event: EventModel):
        """Update monitoring metrics based on incoming events."""

        # Track active executions
        if event.event_type == EventType.START:
            self.active_runs[event.run_id] = {
                "start_time": event.timestamp,
                "node_name": event.node_name,
                "status": "running"
            }

        # Calculate performance metrics
        elif event.event_type == EventType.END:
            if event.run_id in self.active_runs:
                duration = event.timestamp - self.active_runs[event.run_id]["start_time"]
                node_name = event.node_name

                if node_name not in self.performance_metrics:
                    self.performance_metrics[node_name] = []

                self.performance_metrics[node_name].append(duration)
                del self.active_runs[event.run_id]

        # Track errors
        elif event.event_type == EventType.ERROR:
            await self.handle_error_event(event)

    async def handle_error_event(self, event: EventModel):
        """Handle error events with alerting."""
        error_data = {
            "node": event.node_name,
            "error": event.content,
            "timestamp": event.timestamp,
            "run_id": event.run_id
        }

        # Send alert if error rate is high
        recent_errors = await self.get_recent_error_rate(event.node_name)
        if recent_errors > 0.1:  # > 10% error rate
            await self.send_alert(f"High error rate in {event.node_name}: {recent_errors:.2%}")
```

### Event-Driven Analytics
```python
class AgentAnalytics:
    def __init__(self):
        self.tool_usage = {}
        self.conversation_patterns = {}
        self.user_behavior = {}

    async def analyze_events(self):
        """Continuous analytics processing."""
        async for event in self.event_stream():
            await self.update_analytics(event)

    async def update_analytics(self, event: EventModel):
        """Update analytics based on event patterns."""

        # Tool usage analytics
        if event.event == Event.TOOL_EXECUTION and event.event_type == EventType.START:
            tool_name = event.metadata.get("function_name")
            if tool_name:
                self.tool_usage[tool_name] = self.tool_usage.get(tool_name, 0) + 1

        # Conversation flow analysis
        if event.event == Event.NODE_EXECUTION:
            user_id = event.metadata.get("user_id")
            if user_id:
                if user_id not in self.conversation_patterns:
                    self.conversation_patterns[user_id] = []

                self.conversation_patterns[user_id].append({
                    "node": event.node_name,
                    "timestamp": event.timestamp,
                    "type": event.event_type
                })

        # Generate insights periodically
        if len(self.tool_usage) % 100 == 0:  # Every 100 tool calls
            await self.generate_insights()

    async def generate_insights(self):
        """Generate actionable insights from collected data."""
        # Most used tools
        popular_tools = sorted(self.tool_usage.items(), key=lambda x: x[1], reverse=True)

        # Conversation patterns
        avg_conversation_length = sum(
            len(pattern) for pattern in self.conversation_patterns.values()
        ) / len(self.conversation_patterns) if self.conversation_patterns else 0

        insights = {
            "popular_tools": popular_tools[:5],
            "avg_conversation_length": avg_conversation_length,
            "total_conversations": len(self.conversation_patterns),
            "timestamp": time.time()
        }

        await self.store_insights(insights)
```

### Custom Event Filtering and Routing
```python
class EventRouter:
    def __init__(self):
        self.routes = {
            "errors": self.handle_errors,
            "performance": self.handle_performance,
            "content": self.handle_content,
            "tools": self.handle_tools
        }

    async def route_events(self):
        """Route events to appropriate handlers."""
        async for event in self.event_stream():
            # Route error events
            if event.event_type == EventType.ERROR:
                await self.routes["errors"](event)

            # Route performance events
            elif event.event in [Event.NODE_EXECUTION, Event.GRAPH_EXECUTION]:
                await self.routes["performance"](event)

            # Route tool events
            elif event.event == Event.TOOL_EXECUTION:
                await self.routes["tools"](event)

            # Route content events
            elif event.content_type in [ContentType.TEXT, ContentType.MESSAGE]:
                await self.routes["content"](event)

    async def handle_errors(self, event: EventModel):
        """Specialized error handling."""
        # Send to error monitoring system
        await self.send_to_monitoring(event)

        # Log critical errors
        if event.metadata.get("severity") == "critical":
            await self.alert_on_call_team(event)

    async def handle_performance(self, event: EventModel):
        """Performance monitoring."""
        # Track execution times
        if event.event_type == EventType.END:
            duration = event.metadata.get("duration")
            if duration and duration > 10.0:  # > 10 seconds
                await self.log_slow_operation(event)

    async def handle_tools(self, event: EventModel):
        """Tool usage tracking."""
        # Track API costs and usage
        if event.event_type == EventType.END:
            cost = event.metadata.get("api_cost", 0)
            await self.update_cost_tracking(event.metadata.get("function_name"), cost)
```

## Integration with Agent Graphs

Publishers integrate seamlessly with your graph construction, providing consistent observability across all execution patterns:

```python
from agentflow.graph import StateGraph
from agentflow.publisher.console_publisher import ConsolePublisher

# Create your publisher
publisher = ConsolePublisher({"format": "json", "indent": 2})

# Build your graph
graph = StateGraph(AgentState)
graph.add_node("planner", planning_agent)
graph.add_node("researcher", research_agent)
graph.add_node("tools", ToolNode([web_search, calculator]))

# Set up conditional flows
graph.add_conditional_edges("planner", routing_logic, {
    "research": "researcher",
    "calculate": "tools",
    END: END
})

# Compile with publisher for complete observability
compiled_graph = graph.compile(
    checkpointer=checkpointer,
    publisher=publisher  # All events will be published
)

# Execute with full observability
async for chunk in compiled_graph.astream(
        {"messages": [user_message]},
        config={"user_id": "user_123", "session_id": "session_456"}
):
    # Both the chunks and the published events provide insight
    # Chunks show what the user sees
    # Events show how the agent is thinking and operating
    print(f"User sees: {chunk}")
    # Meanwhile, events are flowing to your monitoring systems
```

## Advanced Event Customization

You can extend the event system with custom metadata and routing:

```python
from agentflow.publisher.events import EventModel
from agentflow.publisher.publish import publish_event


# Custom event generation
async def custom_node_with_events(state: AgentState, config: dict):
    """Node that generates custom observability events."""

    # Generate custom start event
    start_event = EventModel(
        event=Event.NODE_EXECUTION,
        event_type=EventType.START,
        content="Beginning custom analysis...",
        node_name="custom_analyzer",
        run_id=config.get("run_id"),
        thread_id=config.get("thread_id"),
        metadata={
            "analysis_type": "sentiment",
            "data_source": config.get("data_source"),
            "user_tier": config.get("user_tier", "free"),
            "expected_duration": 2.5
        }
    )
    publish_event(start_event)

    # Perform analysis with progress events
    for step in ["preprocessing", "analysis", "postprocessing"]:
        progress_event = EventModel(
            event=Event.NODE_EXECUTION,
            event_type=EventType.PROGRESS,
            content=f"Executing {step}...",
            node_name="custom_analyzer",
            run_id=config.get("run_id"),
            metadata={"step": step, "progress": get_progress_percentage()}
        )
        publish_event(progress_event)

        # Do actual work
        result = await perform_analysis_step(step, state)

    # Generate completion event
    end_event = EventModel(
        event=Event.NODE_EXECUTION,
        event_type=EventType.END,
        content="Analysis complete",
        node_name="custom_analyzer",
        run_id=config.get("run_id"),
        metadata={
            "results_count": len(result),
            "confidence_score": calculate_confidence(result),
            "processing_time": get_processing_time()
        }
    )
    publish_event(end_event)

    return result
```

## Production Monitoring Strategies

For production deployments, combine multiple publishers and processing strategies:

```python
class ProductionMonitoring:
    def __init__(self):
        # Multiple publishers for different purposes
        self.console_publisher = ConsolePublisher({"format": "json"})  # Development
        self.kafka_publisher = KafkaPublisher({  # Production analytics
            "bootstrap_servers": ["kafka1:9092", "kafka2:9092"],
            "topic": "agent_events_prod"
        })
        self.redis_publisher = RedisPublisher({  # Real-time dashboards
            "redis_url": "redis://redis-cluster:6379",
            "stream_name": "live_agent_events"
        })

        # Health metrics
        self.health_metrics = {
            "total_events": 0,
            "error_count": 0,
            "avg_response_time": 0.0,
            "active_sessions": set()
        }

    async def setup_monitoring(self, graph):
        """Set up comprehensive monitoring for production."""

        # Use composite publisher for multiple destinations
        composite_publisher = CompositePublisher([
            self.kafka_publisher,   # Long-term analytics
            self.redis_publisher,   # Real-time monitoring
        ])

        return graph.compile(
            checkpointer=production_checkpointer,
            publisher=composite_publisher
        )

    async def monitor_health(self):
        """Continuous health monitoring."""
        while True:
            # Check error rates
            error_rate = self.health_metrics["error_count"] / max(
                self.health_metrics["total_events"], 1
            )

            if error_rate > 0.05:  # > 5% error rate
                await self.alert_operations_team(f"High error rate: {error_rate:.2%}")

            # Check response times
            if self.health_metrics["avg_response_time"] > 30.0:  # > 30 seconds
                await self.alert_performance_issue(
                    f"Slow response time: {self.health_metrics['avg_response_time']:.1f}s"
                )

            await asyncio.sleep(60)  # Check every minute
```

The publisher system transforms  Agentflow agents from opaque processes into fully observable, monitorable, and analytically rich systems. By providing real-time insight into every aspect of agent execution—from high-level conversation flows to individual tool calls—publishers enable you to build production-ready AI systems with the observability and control needed for enterprise deployment.
