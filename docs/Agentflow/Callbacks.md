# Callbacks: Interception and Flow Control

Callbacks in Agentflow provide a powerful interception mechanism that allows you to hook into the execution flow of your agent graphs at critical decision points. Rather than simply observing events, callbacks enable you to actively participate in, modify, and control the execution process as it unfolds.

## Understanding the Interception Pattern

Think of callbacks as strategic checkpoints placed throughout your agent's thinking process. When your agent is about to call a tool, query an AI model, or execute any external operation, Agentflow pauses and gives your callback system the opportunity to:

- **Validate inputs** before they're processed
- **Transform or enrich data** as it flows through the system
- **Implement custom logic** for error recovery and handling
- **Modify outputs** before they're returned to the agent
- **Apply security policies** and business rules consistently

This creates a layered architecture where your core agent logic remains clean and focused, while cross-cutting concerns like validation, logging, security, and transformation are handled elegantly through the callback system.

## Callback Lifecycle and Flow

The callback system operates around three fundamental moments in any operation:

### Before Invoke: The Preparation Phase

```python
from agentflow.utils.callbacks import CallbackManager, InvocationType, CallbackContext


async def validate_tool_input(context: CallbackContext, input_data: dict) -> dict:
    """Validate and potentially modify tool inputs before execution."""
    if context.function_name == "database_query":
        # Apply security validations
        if "DROP" in input_data.get("query", "").upper():
            raise ValueError("Dangerous SQL operations not allowed")

        # Add audit context
        input_data["audit_user"] = context.metadata.get("user_id", "unknown")
        input_data["timestamp"] = datetime.utcnow().isoformat()

    return input_data


# Register for tool invocations with a callback manager
callback_manager = CallbackManager()
callback_manager.register_before_invoke(InvocationType.TOOL, validate_tool_input)
```

Before any tool, AI model, or MCP function is called, Agentflow executes all registered `before_invoke` callbacks. This is your opportunity to:
- Validate inputs according to business rules
- Add contextual information or metadata
- Transform data formats or apply normalization
- Implement rate limiting or quota checks
- Log invocation attempts for audit trails

### After Invoke: The Processing Phase

```python
from agentflow.utils.callbacks import CallbackManager, InvocationType


async def enrich_ai_response(context: CallbackContext, input_data: dict, output_data: any) -> any:
    """Enrich AI responses with additional context and formatting."""
    if context.invocation_type == InvocationType.AI:
        # Add confidence scoring based on response characteristics
        response_text = str(output_data)
        confidence_score = calculate_confidence(response_text)

        # Transform the response if needed
        if confidence_score < 0.7:
            enhanced_response = await get_clarification_prompt(response_text, input_data)
            return enhanced_response

    return output_data


callback_manager = CallbackManager()
callback_manager.register_after_invoke(InvocationType.AI, enrich_ai_response)
```

After successful execution, `after_invoke` callbacks process the results. This phase enables:
- Response validation and quality assessment
- Data transformation and formatting
- Adding computed metadata or enrichment
- Implementing caching strategies
- Logging successful operations

### On Error: The Recovery Phase

```python
from agentflow.utils.callbacks import CallbackManager, InvocationType
from agentflow.state.message import Message


async def handle_tool_errors(context: CallbackContext, input_data: dict, error: Exception) -> Message | None:
    """Implement intelligent error recovery for tool failures."""
    if context.function_name == "external_api_call":
        if isinstance(error, TimeoutError):
            # Implement retry logic with backoff
            return await retry_with_backoff(context, input_data, max_retries=3)

        elif isinstance(error, AuthenticationError):
            # Generate helpful error message for the agent
            return Message.from_text(
                "The external service authentication failed. "
                "Please check the API credentials and try again.",
                role="tool"
            )

    # Return None to propagate the error normally
    return None


callback_manager = CallbackManager()
callback_manager.register_on_error(InvocationType.TOOL, handle_tool_errors)
```

When operations fail, `on_error` callbacks provide sophisticated error handling:
- Implementing retry strategies with exponential backoff
- Converting technical errors into actionable agent messages
- Logging failures for monitoring and debugging
- Providing fallback responses or alternative data sources

## Input Validation System

Beyond the standard callback lifecycle, Agentflow provides a dedicated input validation system that works alongside callbacks to ensure data quality and security before messages are processed by your agent.

### Understanding Validators

Validators are specialized components that examine messages for security threats, content policy violations, or structural issues. Unlike callbacks that intercept specific operations, validators run at the message level to provide a security and quality gate:

```python
from agentflow.utils.callbacks import BaseValidator, ValidationError, CallbackManager
from agentflow.state.message import Message


class CustomSecurityValidator(BaseValidator):
    """Custom validator to enforce domain-specific security policies."""
    
    async def validate(self, messages: list[Message]) -> bool:
        """Validate messages according to security policies.
        
        Args:
            messages: List of messages to validate
            
        Returns:
            True if validation passes, False otherwise
            
        Raises:
            ValidationError: If strict mode and validation fails
        """
        for message in messages:
            content = str(message.content)
            
            # Check for sensitive data patterns
            if self._contains_pii(content):
                self._handle_violation(
                    "pii_detected",
                    f"Message contains personal identifiable information",
                    message
                )
                
            # Check for malicious patterns
            if self._contains_malicious_code(content):
                self._handle_violation(
                    "malicious_code",
                    f"Message contains potentially malicious code",
                    message
                )
                
        return True
    
    def _contains_pii(self, content: str) -> bool:
        """Check if content contains PII patterns."""
        import re
        # Example: Check for SSN, credit card patterns
        patterns = [
            r'\b\d{3}-\d{2}-\d{4}\b',  # SSN
            r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b'  # Credit card
        ]
        return any(re.search(pattern, content) for pattern in patterns)
    
    def _contains_malicious_code(self, content: str) -> bool:
        """Check for malicious code patterns."""
        dangerous_keywords = ['eval(', 'exec(', '__import__', 'subprocess']
        return any(keyword in content.lower() for keyword in dangerous_keywords)


# Register the validator
callback_manager = CallbackManager()
callback_manager.register_input_validator(CustomSecurityValidator(strict=True))
```

### Built-in Validators

Agentflow includes two powerful built-in validators:

**PromptInjectionValidator**: Protects against OWASP LLM01:2025 prompt injection attacks by detecting:
- System prompt leakage attempts
- Instruction override patterns
- Role confusion attacks
- Encoding-based obfuscation (Base64, Unicode, hex)
- Payload splitting techniques
- Suspicious keyword clustering

**MessageContentValidator**: Ensures message structure integrity by validating:
- Proper role assignments (user, assistant, system, tool)
- Content block structure and types
- Required fields and formats

```python
from agentflow.utils.validators import register_default_validators

# Register built-in validators
callback_manager = CallbackManager()
register_default_validators(callback_manager)

# Now compile your graph with the validator-enabled manager
compiled_graph = graph.compile(callback_manager=callback_manager)
```

### Validator Modes: Strict vs Lenient

Validators support two operational modes:

**Strict Mode** (default): Raises `ValidationError` immediately when validation fails, blocking the operation:
```python
from agentflow.utils.callbacks import CallbackManager
from agentflow.utils.validators import PromptInjectionValidator

callback_manager = CallbackManager()
validator = PromptInjectionValidator(strict=True)
callback_manager.register_input_validator(validator)

# This will raise ValidationError if injection detected
await compiled_graph.invoke({"messages": [suspicious_message]})
```

**Lenient Mode**: Logs violations but allows execution to continue, useful for monitoring and gradual rollout:
```python
from agentflow.utils.callbacks import CallbackManager
from agentflow.utils.validators import PromptInjectionValidator

callback_manager = CallbackManager()
validator = PromptInjectionValidator(strict=False)
callback_manager.register_input_validator(validator)

# This will log warnings but continue execution
result = await compiled_graph.invoke({"messages": [suspicious_message]})
```

### Validation in Practice

Validators integrate seamlessly into your graph execution flow:

```python
from agentflow.utils.callbacks import CallbackManager
from agentflow.utils.validators import register_default_validators
from agentflow.graph import StateGraph
from agentflow.state.message import Message

# Set up callback manager with validators
callback_manager = CallbackManager()
register_default_validators(callback_manager)

# Add custom validators
callback_manager.register_input_validator(CustomSecurityValidator(strict=True))

# Build your graph
graph = StateGraph(AgentState)
graph.add_node("assistant", assistant_node)
graph.add_node("tools", ToolNode([search_tool]))
graph.set_entry_point("assistant")

# Compile with validator-enabled manager
compiled_graph = graph.compile(callback_manager=callback_manager)

# Safe execution - validators run automatically
try:
    result = await compiled_graph.invoke({
        "messages": [
            Message.from_text("What is the weather?", role="user")
        ]
    })
except ValidationError as e:
    print(f"Validation failed: {e}")
    # Handle validation failure appropriately
```

### Testing Validators

Test your custom validators in isolation:

```python
import pytest
from agentflow.utils.callbacks import ValidationError
from agentflow.state.message import Message


async def test_custom_validator():
    """Test custom validator behavior."""
    validator = CustomSecurityValidator(strict=True)
    
    # Test normal message
    safe_message = Message.from_text("Hello, how are you?", role="user")
    assert await validator.validate([safe_message])
    
    # Test PII detection
    pii_message = Message.from_text(
        "My SSN is 123-45-6789",
        role="user"
    )
    with pytest.raises(ValidationError):
        await validator.validate([pii_message])
    
    # Test lenient mode
    lenient_validator = CustomSecurityValidator(strict=False)
    result = await lenient_validator.validate([pii_message])
    assert not result  # Returns False but doesn't raise


async def test_validator_integration():
    """Test validator integration with callback manager."""
    callback_manager = CallbackManager()
    validator = CustomSecurityValidator(strict=True)
    callback_manager.register_input_validator(validator)
    
    # Create test messages
    messages = [Message.from_text("Safe content", role="user")]
    
    # Execute validators through manager
    result = await callback_manager.execute_validators(messages)
    assert result  # Validation passed
```

## Invocation Types and Context

Agentflow distinguishes between four types of operations that can trigger callbacks:

### AI Invocations
These occur when your agent calls language models for reasoning, planning, or text generation:

```python
async def monitor_ai_usage(context: CallbackContext, input_data: dict) -> dict:
    """Track AI usage patterns and costs."""
    if context.invocation_type == InvocationType.AI:
        # Log token usage and costs
        estimated_tokens = estimate_tokens(input_data.get("messages", []))
        log_ai_usage(context.node_name, estimated_tokens)

        # Add usage tracking to metadata
        input_data["usage_tracking"] = {
            "node": context.node_name,
            "estimated_tokens": estimated_tokens,
            "timestamp": time.time()
        }

    return input_data
```

### Tool Invocations
These trigger when your agent executes functions, APIs, or external services:

```python
async def secure_tool_access(context: CallbackContext, input_data: dict) -> dict:
    """Apply security policies to tool invocations."""
    user_permissions = context.metadata.get("user_permissions", [])

    # Check if user has permission for this tool
    if context.function_name not in user_permissions:
        raise PermissionError(f"User not authorized to use {context.function_name}")

    # Add security context
    input_data["security_context"] = {
        "user_id": context.metadata.get("user_id"),
        "permissions": user_permissions,
        "access_time": datetime.utcnow().isoformat()
    }

    return input_data
```

### MCP (Model Context Protocol) Invocations
These handle calls to external MCP services for specialized capabilities:

```python
async def optimize_mcp_calls(context: CallbackContext, input_data: dict) -> dict:
    """Optimize and cache MCP service calls."""
    if context.invocation_type == InvocationType.MCP:
        # Check cache first
        cache_key = generate_cache_key(context.function_name, input_data)
        cached_result = await get_from_cache(cache_key)

        if cached_result:
            # Return cached result wrapped as appropriate response
            return create_cached_response(cached_result)

    return input_data
```

### Input Validation Invocations
These are triggered when validators examine messages for security and quality issues:

```python
async def log_validation_attempts(context: CallbackContext, input_data: dict) -> dict:
    """Monitor validation attempts for security analysis."""
    if context.invocation_type == InvocationType.INPUT_VALIDATION:
        # Log validation events for security monitoring
        security_logger.info(
            "Validation check",
            extra={
                "validator": context.function_name,
                "node": context.node_name,
                "message_count": len(input_data.get("messages", [])),
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
        # Track validation patterns
        await track_validation_patterns(
            validator_name=context.function_name,
            messages=input_data.get("messages", [])
        )
    
    return input_data
```

## Callback Context and Metadata

Each callback receives a rich `CallbackContext` that provides detailed information about the current operation:

```python
@dataclass
class CallbackContext:
    invocation_type: InvocationType  # AI, TOOL, or MCP
    node_name: str                   # Name of the executing node
    function_name: str | None        # Specific function being called
    metadata: dict[str, Any] | None  # Additional context data
```

This context enables callbacks to make intelligent decisions about how to handle different operations:

```python
async def adaptive_callback(context: CallbackContext, input_data: dict) -> dict:
    """Apply different logic based on context."""

    # Different handling based on node type
    if context.node_name == "research_node":
        input_data = await apply_research_policies(input_data)
    elif context.node_name == "decision_node":
        input_data = await add_decision_context(input_data)

    # Function-specific logic
    if context.function_name == "web_search":
        input_data = await sanitize_search_query(input_data)

    # Access custom metadata
    user_context = context.metadata.get("user_context", {})
    if user_context.get("debug_mode"):
        input_data["debug"] = True

    return input_data
```

## Advanced Callback Patterns

### Chained Transformations
Multiple callbacks of the same type are executed in registration order, allowing for sophisticated data pipelines:

```python
from agentflow.utils.callbacks import CallbackManager, InvocationType

# First callback: Basic validation
async def validate_input(context: CallbackContext, input_data: dict) -> dict:
    if not input_data.get("required_field"):
        raise ValueError("Missing required field")
    return input_data

# Second callback: Data enrichment
async def enrich_input(context: CallbackContext, input_data: dict) -> dict:
    input_data["enriched_at"] = datetime.utcnow().isoformat()
    input_data["enriched_by"] = "callback_system"
    return input_data

# Third callback: Format transformation
async def transform_format(context: CallbackContext, input_data: dict) -> dict:
    # Convert to expected format
    return transform_to_service_format(input_data)

# Register in order with a callback manager
callback_manager = CallbackManager()
callback_manager.register_before_invoke(InvocationType.TOOL, validate_input)
callback_manager.register_before_invoke(InvocationType.TOOL, enrich_input)
callback_manager.register_before_invoke(InvocationType.TOOL, transform_format)
```

### Conditional Logic with Context Awareness
```python
async def context_aware_processor(context: CallbackContext, input_data: dict) -> dict:
    """Apply different processing based on runtime context."""

    # Environment-based logic
    if os.getenv("ENVIRONMENT") == "production":
        input_data = await apply_production_safeguards(input_data)
    else:
        input_data = await add_debug_information(input_data)

    # User role-based logic
    user_role = context.metadata.get("user_role", "guest")
    if user_role == "admin":
        input_data["admin_privileges"] = True
    elif user_role == "guest":
        input_data = await apply_guest_restrictions(input_data)

    return input_data
```

### Error Recovery Strategies
```python
async def intelligent_error_recovery(
    context: CallbackContext,
    input_data: dict,
    error: Exception
) -> Message | None:
    """Implement sophisticated error recovery patterns."""

    # Network-related errors
    if isinstance(error, (ConnectionError, TimeoutError)):
        retry_count = context.metadata.get("retry_count", 0)
        if retry_count < 3:
            # Update metadata for next retry
            context.metadata["retry_count"] = retry_count + 1
            await asyncio.sleep(2 ** retry_count)  # Exponential backoff
            return await retry_operation(context, input_data)

    # Data validation errors
    elif isinstance(error, ValidationError):
        # Try to fix common issues automatically
        fixed_data = await attempt_data_repair(input_data, error)
        if fixed_data:
            return await execute_with_fixed_data(context, fixed_data)

    # Service-specific errors
    elif context.function_name == "external_api":
        # Generate informative error message for the agent
        return Message.from_text(
            f"External API call failed: {error}. "
            "Consider using alternative data sources or simplified queries.",
            role="tool"
        )

    return None  # Let the error propagate
```

## Integration with Agent Graphs

Callbacks and validators integrate seamlessly with your graph construction, providing consistent behavior across all nodes:

```python
from agentflow.utils.callbacks import CallbackManager, InvocationType
from agentflow.utils.validators import register_default_validators
from agentflow.graph import StateGraph

# Create callback manager
callback_manager = CallbackManager()

# Set up callbacks
callback_manager.register_before_invoke(InvocationType.TOOL, security_validator)
callback_manager.register_after_invoke(InvocationType.AI, response_enhancer)
callback_manager.register_on_error(InvocationType.MCP, error_recovery_handler)

# Set up validators
register_default_validators(callback_manager)

# Create graph with callback integration
graph = StateGraph(AgentState)
graph.add_node("researcher", research_node)
graph.add_node("analyzer", analysis_node)
graph.add_node("tools", ToolNode([web_search, data_processor]))

# Compile with callback manager (includes validators)
compiled_graph = graph.compile(
    checkpointer=checkpointer,
    callback_manager=callback_manager  # Uses registered callbacks and validators
)

# All operations will now use your callbacks and validators
result = await compiled_graph.invoke(
    {"messages": [user_message]},
    config={"user_id": "user123", "permissions": ["web_search", "data_processor"]}
)
```

## Testing and Debugging Callbacks

Callbacks can significantly impact your agent's behavior, making testing crucial:

```python
from agentflow.utils.callbacks import CallbackManager, InvocationType


async def test_callback_behavior():
    """Test callback system with controlled inputs."""

    # Create isolated callback manager for testing
    test_callback_manager = CallbackManager()

    # Register test callbacks
    test_callback_manager.register_before_invoke(
        InvocationType.TOOL,
        test_input_validator
    )

    # Create test context
    test_context = CallbackContext(
        invocation_type=InvocationType.TOOL,
        node_name="test_node",
        function_name="test_function",
        metadata={"test": True}
    )

    # Test the callback
    test_input = {"query": "test query"}
    result = await test_callback_manager.execute_before_invoke(
        test_context,
        test_input
    )

    assert result["query"] == "test query"
    assert "processed_by_callback" in result


# Debug callback with logging
async def debug_callback(context: CallbackContext, input_data: dict) -> dict:
    """Debug callback that logs all interactions."""
    logger.info(f"Callback triggered: {context.invocation_type}")
    logger.info(f"Node: {context.node_name}, Function: {context.function_name}")
    logger.info(f"Input data keys: {list(input_data.keys())}")
    return input_data
```

## Best Practices and Recommendations

### Organizing Callbacks and Validators

Structure your callback and validator code for maintainability:

```python
# callbacks/security.py
from agentflow.utils.callbacks import CallbackManager
from agentflow.utils.validators import PromptInjectionValidator, MessageContentValidator

def setup_security_callbacks(manager: CallbackManager):
    """Set up all security-related callbacks and validators."""
    # Register validators
    manager.register_input_validator(PromptInjectionValidator(strict=True))
    manager.register_input_validator(MessageContentValidator(strict=True))
    
    # Register callbacks
    manager.register_before_invoke(InvocationType.TOOL, validate_tool_permissions)
    manager.register_on_error(InvocationType.AI, handle_security_errors)


# callbacks/monitoring.py
def setup_monitoring_callbacks(manager: CallbackManager):
    """Set up monitoring and logging callbacks."""
    manager.register_before_invoke(InvocationType.AI, log_ai_usage)
    manager.register_after_invoke(InvocationType.TOOL, track_tool_performance)
    manager.register_on_error(InvocationType.MCP, alert_on_mcp_failures)


# main.py
from callbacks.security import setup_security_callbacks
from callbacks.monitoring import setup_monitoring_callbacks

callback_manager = CallbackManager()
setup_security_callbacks(callback_manager)
setup_monitoring_callbacks(callback_manager)

compiled_graph = graph.compile(callback_manager=callback_manager)
```

### Validator Development Guidelines

When creating custom validators:
1. **Extend BaseValidator** for consistency and proper integration
2. **Handle both strict and lenient modes** appropriately
3. **Provide clear violation messages** that help diagnose issues
4. **Test thoroughly** with edge cases and attack patterns
5. **Document detection logic** for security audits

### Performance Considerations

Callbacks and validators add overhead to each operation:
- Keep validation logic efficient (cache compiled regex patterns, reuse expensive operations)
- Use lenient mode in development, strict mode in production
- Consider async operations for I/O-bound validation (external API checks)
- Profile callback chains if latency becomes an issue

The callback and validation systems transform Agentflow from a simple execution engine into a sophisticated, controllable platform where every operation can be monitored, modified, and managed according to your specific requirements. By strategically placing callbacks and validators throughout your agent workflows, you create robust, secure, and maintainable AI systems that adapt to complex real-world requirements.
