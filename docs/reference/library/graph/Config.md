# Graph Configuration

The configuration object (`config`) is a Python dictionary that controls various aspects of graph execution in  Agentflow. It serves as the control panel for how your agent graph behaves during runtime, affecting everything from execution limits to state persistence and authentication.

## Core Configuration Fields

### Required Fields

#### `thread_id: str`
**Purpose**: Unique identifier for the conversation or execution session.

**Usage**: Essential for state persistence and resuming interrupted executions.
```python
config = {"thread_id": "user-session-123"}
```

**Notes**:
- Required when using checkpointers (state persistence)
- Must be unique per conversation/session
- Used to group related messages and state snapshots
- Can be any string format: UUIDs, user IDs, session names, etc.

---

### Optional Fields (with defaults)

#### `user_id: str`
**Default**: `"test-user-id"` (auto-generated if not provided)

**Purpose**: Identifies the user or system making the request.

**Usage**: Used for multi-tenant systems, authentication, and data isolation.
```python
config = {
    "thread_id": "session-456",
    "user_id": "john.doe@example.com"
}
```

**Notes**:
- Critical for production deployments with multiple users
- Used by checkpointers for data segregation
- Required by some store implementations (Mem0, Qdrant)
- Can be username, email, UUID, or any unique identifier

#### `recursion_limit: int`
**Default**: `25`

**Purpose**: Maximum number of execution steps before the graph stops automatically.

**Usage**: Prevents infinite loops and runaway executions.
```python
config = {
    "thread_id": "demo-thread",
    "recursion_limit": 50  # Allow up to 50 steps
}
```

**Notes**:
- Each node execution counts as one step
- Helps control resource usage and execution time
- Particularly important for conditional routing scenarios
- Set higher for complex workflows, lower for simple ones

#### `is_stream: bool`
**Default**: `False` (auto-set by execution method)

**Purpose**: Indicates whether this is a streaming execution.

**Usage**: Automatically set by framework, rarely configured manually.
```python
# Usually auto-set by the framework
for chunk in app.stream(input_data, config={"thread_id": "stream-1"}):
    print(chunk.content)
```

**Notes**:
- Automatically set to `True` when using `stream()` or `astream()`
- Affects how events are published and responses are formatted
- Influences internal execution flow and optimization

#### `run_id: str`
**Default**: Auto-generated UUID

**Purpose**: Unique identifier for this specific graph execution.

**Usage**: Useful for tracing, logging, and debugging individual runs.
```python
config = {
    "thread_id": "session-123",
    "run_id": "exec-2024-001"  # Custom run identifier
}
```

**Notes**:
- Auto-generated if not provided
- Different from `thread_id` - multiple runs can share the same thread
- Useful for audit trails and execution tracking

#### `timestamp: str`
**Default**: Current ISO timestamp (auto-generated)

**Purpose**: Records when the graph execution started.

**Usage**: For auditing, logging, and temporal analysis.
```python
config = {
    "thread_id": "session-789",
    "timestamp": "2024-01-15T10:30:00Z"  # Custom timestamp
}
```

**Notes**:
- Auto-generated in ISO format if not provided
- Used by publishers and logging systems
- Helps with execution tracking and debugging

---

## Extended Configuration Options

### State Management

#### `state_class: type`
**Default**: `AgentState`

**Purpose**: Specifies custom state class for specialized workflows.

**Usage**: For applications requiring custom state fields.

```python
from agentflow.state import AgentState


class CustomState(AgentState):
    user_data: dict = Field(default_factory=dict)
    custom_field: str = "default"


config = {
    "thread_id": "custom-session",
    "state_class": CustomState
}
```

### Store Integration

#### `collection: str` (Qdrant Store)
**Purpose**: Specifies which collection to use for vector storage.

**Usage**: For organizing memories by domain or use case.
```python
config = {
    "thread_id": "session-123",
    "user_id": "user-456",
    "collection": "customer_support_memories"
}
```

#### `app_id: str` (Mem0 Store)
**Purpose**: Application identifier for Mem0 memory service.

**Usage**: For multi-application deployments using Mem0.
```python
config = {
    "thread_id": "session-123",
    "user_id": "user-456",
    "app_id": "customer-service-bot"
}
```

### Thread Management

#### `thread_name: str`
**Purpose**: Human-readable name for the conversation thread.

**Usage**: Improves thread organization and user experience.
```python
config = {
    "thread_id": "thread-123",
    "thread_name": "Customer Support - Billing Issue",
    "user_id": "customer-456"
}
```

#### `meta: dict` / `thread_meta: dict`
**Purpose**: Additional metadata for the execution or thread.

**Usage**: Store custom data alongside execution context.
```python
config = {
    "thread_id": "session-123",
    "meta": {
        "customer_tier": "premium",
        "support_level": 2,
        "region": "us-west"
    }
}
```

---

## Configuration Examples

### Basic Usage
```python
# Minimal configuration
config = {"thread_id": "simple-chat"}

# With user identification
config = {
    "thread_id": "user-session-789",
    "user_id": "alice@company.com"
}
```

### Production Configuration
```python
config = {
    "thread_id": f"support-{ticket_id}",
    "user_id": user.email,
    "thread_name": f"Support Ticket #{ticket_id}",
    "recursion_limit": 30,
    "meta": {
        "ticket_id": ticket_id,
        "priority": "high",
        "department": "technical_support",
        "created_at": datetime.now().isoformat()
    }
}
```

### Multi-Store Configuration
```python
# For applications using memory stores
config = {
    "thread_id": f"chat-{session_id}",
    "user_id": user.id,
    "collection": "user_preferences",  # Qdrant
    "app_id": "personal-assistant",    # Mem0
    "recursion_limit": 20
}
```

### Streaming Configuration
```python
# Streaming execution (is_stream auto-set)
config = {
    "thread_id": "live-chat-123",
    "user_id": "customer-456",
    "recursion_limit": 15  # Lower limit for responsiveness
}

# Use with streaming
for chunk in app.stream(input_data, config=config):
    print(chunk.content)
```

---

## Integration Patterns

### With Authentication Systems

When deployed using  Agentflow CLI or similar deployment systems, the authentication system can populate the config with user information:

```python
# Authentication system provides user context
def create_config_from_auth(request, thread_id):
    user = authenticate_request(request)
    return {
        "thread_id": thread_id,
        "user_id": user.id,
        "user_name": user.name,
        "meta": {
            "roles": user.roles,
            "permissions": user.permissions,
            "session_start": datetime.now().isoformat()
        }
    }
```

### Environment-Based Configuration

```python
import os

def create_production_config(thread_id: str, user_id: str) -> dict:
    return {
        "thread_id": thread_id,
        "user_id": user_id,
        "recursion_limit": int(os.getenv("MAX_RECURSION_LIMIT", "25")),
        "app_id": os.getenv("APP_ID", "default-app"),
        "meta": {
            "environment": os.getenv("ENVIRONMENT", "production"),
            "version": os.getenv("APP_VERSION", "1.0.0")
        }
    }
```

---

## Best Practices

### 1. **Always Provide thread_id**
```python
# ❌ Bad - Missing thread_id for stateful apps
config = {"user_id": "user-123"}

# ✅ Good - Always include thread_id
config = {
    "thread_id": "session-456",
    "user_id": "user-123"
}
```

### 2. **Use Meaningful Identifiers**
```python
# ❌ Bad - Non-descriptive IDs
config = {"thread_id": "abc123"}

# ✅ Good - Descriptive, traceable IDs
config = {
    "thread_id": f"support-ticket-{ticket_number}",
    "user_id": user.email
}
```

### 3. **Set Appropriate Limits**
```python
# ❌ Bad - Too high, potential runaway
config = {"recursion_limit": 1000}

# ❌ Bad - Too low, premature termination
config = {"recursion_limit": 5}

# ✅ Good - Reasonable limit for use case
config = {
    "recursion_limit": 25,  # Default, good for most cases
    "thread_id": "session-123"
}
```

### 4. **Include Relevant Metadata**
```python
# ✅ Good - Rich metadata for debugging/analytics
config = {
    "thread_id": session_id,
    "user_id": user_id,
    "meta": {
        "feature_flags": get_user_features(user_id),
        "client_version": request.headers.get("X-Client-Version"),
        "request_id": request.id
    }
}
```

---

## Security Considerations

- **Never include sensitive data** (passwords, API keys) in config
- **Validate user_id** to prevent unauthorized access to other users' data
- **Sanitize thread_id** to prevent path traversal or injection attacks
- **Use proper authentication** before accepting user-provided config values

```python
# ✅ Good - Validated configuration
def create_safe_config(authenticated_user, thread_id):
    # Validate inputs
    if not authenticated_user.is_active:
        raise ValueError("User not active")

    safe_thread_id = sanitize_thread_id(thread_id)

    return {
        "thread_id": safe_thread_id,
        "user_id": authenticated_user.id,  # Trusted source
        "recursion_limit": min(50, authenticated_user.max_recursion_limit)
    }
```
