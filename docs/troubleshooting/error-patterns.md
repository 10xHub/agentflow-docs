---
title: Error Patterns Guide — AgentFlow Python AI Agent Framework
description: Map common symptoms and failure modes to error codes and resolution strategies. Part of the AgentFlow agentflow troubleshooting guide for production-ready.
keywords:
  - agentflow troubleshooting
  - agent debugging
  - ai agent errors
  - agentflow
  - python ai agent framework
  - error patterns guide
---


# Error Patterns Guide

Use this guide when you encounter a specific symptom and need to identify the root cause and fix.

## Symptom-to-Error Mapping

```mermaid
flowchart TD
    A[Error Occurred] --> B{What does the error say?}
    
    B -->|"loop" or "recursion"| REC["RECURSION_000"]
    B -->|"not found" or "missing"| NF["STORAGE_NOT_FOUND_000"]
    B -->|"timeout" or "connection"| TRANS["STORAGE_TRANSIENT_000"]
    B -->|"serialization" or "schema"| SERIAL["STORAGE_SERIALIZATION_000"]
    B -->|"schema" or "migration"| SCHEMA["STORAGE_SCHEMA_000"]
    B -->|"validation" or "injection"| VALID["VALIDATION_000"]
    B -->|"media" or "unsupported"| MEDIA["MEDIA_000"]
    B -->|"node" or "tool"| NODE["NODE_000"]
    B -->|"graph"| GRAPH["GRAPH_000"]
```

---

## Infinite Loops & Recursion

### Symptom: "Recursion limit exceeded" or "Max iterations reached"

**Error Code**: `RECURSION_000`

**Symptoms**:
- Graph runs forever until hitting limit
- Logs show repeated identical or similar tool calls
- Response never completes

**Root Causes**:

| Cause | Description |
|-------|-------------|
| Tool selection loop | Model keeps calling the same tool with same inputs |
| Routing loop | Conditional edges create infinite path |
| Missing END condition | Graph never terminates |
| Self-referential tool | Tool indirectly calls itself |

**Debugging Steps**:

1. Enable verbose logging to see the loop pattern
2. Check if same tool is called repeatedly
3. Verify routing conditions are not self-referential
4. Confirm END condition exists for all paths

**Fix**:

```python
# Check your graph routing
graph.add_conditional_edges(
    "AGENT",
    route_by_response,  # Make sure this terminates
    {
        "continue": "TOOL",
        "done": END,  # This must be reachable
    }
)

# Add recursion limit
app = graph.compile(recursion_limit=50)
```

---

## Storage & Persistence

### Symptom: "Thread not found" or "Resource not found"

**Error Code**: `STORAGE_NOT_FOUND_000`

**Symptoms**:
- API returns 404 for thread operations
- Conversation history is empty
- Checkpoint retrieval fails

**Root Causes**:

| Cause | Description |
|-------|-------------|
| Wrong thread_id | Typo or stale ID |
| Thread deleted | Thread was manually removed |
| No checkpointer | Storage not configured |
| Checkpoint expired | TTL exceeded |

**Debugging Steps**:

1. Verify `thread_id` is correct and valid
2. Check if checkpointer is configured in `agentflow.json`
3. Verify storage backend is accessible
4. Check for checkpoint TTL settings

**Fix**:

```bash
# List available threads
curl http://localhost:8000/v1/threads

# Check thread state
curl http://localhost:8000/v1/threads/{thread_id}/state
```

---

### Symptom: "Connection timeout" or "Temporary failure"

**Error Code**: `STORAGE_TRANSIENT_000`

**Symptoms**:
- Intermittent failures
- Operations fail under load
- Database connection errors

**Root Causes**:

| Cause | Description |
|-------|-------------|
| Network latency | Slow connection to storage backend |
| Lock contention | High concurrency causing locks |
| Resource exhaustion | Memory or connection pool limits |

**Debugging Steps**:

1. Check database connection health
2. Monitor connection pool utilization
3. Review retry logic in your code
4. Check for high concurrency issues

**Fix**: Implement retry with exponential backoff:

```python
from agentflow.core.exceptions import TransientStorageError

async def retry_operation(operation, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await operation()
        except TransientStorageError:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)  # 1s, 2s, 4s
```

---

### Symptom: "Failed to serialize" or "Invalid data format"

**Error Code**: `STORAGE_SERIALIZATION_000`

**Symptoms**:
- Checkpoint save fails
- State restoration fails
- Messages cannot be decoded

**Root Causes**:

| Cause | Description |
|-------|-------------|
| Schema mismatch | State schema changed without migration |
| Corrupt data | Checkpoint data is corrupted |
| Unsupported type | State contains non-serializable object |

**Debugging Steps**:

1. Check schema version compatibility
2. Verify checkpoint data integrity
3. Review state schema for unsupported types
4. Check logs for specific serialization failure

**Fix**:

```python
# Ensure state uses serializable types
class AgentState(TypedDict):
    messages: list[str]  # Use JSON-serializable types
    context: dict[str, Any]
    # Avoid: functions, custom classes, open connections
```

---

### Symptom: "Schema version mismatch" or "Migration required"

**Error Code**: `STORAGE_SCHEMA_000`

**Symptoms**:
- "Schema out of date" errors
- Migration warnings on startup
- Checkpoint operations fail after upgrade

**Root Causes**:

| Cause | Description |
|-------|-------------|
| Upgrade without migration | AgentFlow upgraded, DB not migrated |
| Version mismatch | Code and database out of sync |
| Corrupt version table | Schema version tracking corrupted |

**Debugging Steps**:

1. Check AgentFlow version
2. Verify database schema version
3. Look for migration warnings in logs

**Fix**: Run migrations after upgrading AgentFlow:

```bash
# Check current schema version
# Look for migration output during upgrade

# After upgrading AgentFlow
pip install --upgrade agentflow
# Migrations should run automatically, or check docs for manual steps
```

---

## Validation & Security

### Symptom: "Input validation failed" or "Prompt injection detected"

**Error Code**: `VALIDATION_000`

**Symptoms**:
- User input is rejected
- "Bad word detected" errors
- Security policy violations

**Violation Types**:

| Type | Description | Example |
|------|-------------|---------|
| `prompt_injection` | Direct or indirect injection | "Ignore previous instructions" |
| `jailbreak` | Attempt to bypass safety | Role-play to override system |
| `content_policy` | Policy violation | Blocked content patterns |
| `encoding_attack` | Obfuscated content | Base64 encoded instructions |
| `delimiter_confusion` | Conflicting markers | Nested special characters |
| `payload_splitting` | Distributed attack | Split across multiple inputs |
| `system_leak` | Prompt extraction attempt | "What are your instructions?" |

**Debugging Steps**:

1. Check validation logs for specific violation type
2. Review user input that triggered the error
3. Determine if input is legitimate or attack
4. Adjust validation strictness if needed

**Fix**:

```python
# Disable strict mode for development (not recommended for production)
from agentflow.utils.callbacks import CallbackManager
from agentflow.utils.validators import PromptInjectionValidator

callback_manager = CallbackManager()
validator = PromptInjectionValidator(strict_mode=False)  # Logs but doesn't block
callback_manager.register_input_validator(validator)
```

---

## Media & Files

### Symptom: "Model does not support media" or "Unsupported media input"

**Error Code**: `MEDIA_000`

**Symptoms**:
- Image/video/audio input fails
- Model-specific capability errors
- Media transport mode errors

**Root Causes**:

| Cause | Description |
|-------|-------------|
| Model lacks capability | e.g., non-vision model for images |
| Wrong source type | URL not supported, use file_id |
| Transport failure | All transport modes failed |

**Supported Capabilities by Model**:

| Model | Vision | Audio | Document |
|-------|--------|-------|----------|
| gpt-4o | Yes | No | Yes |
| gpt-4o-mini | Yes | No | Yes |
| gpt-4-turbo | Yes | No | Yes |
| gemini-1.5-pro | Yes | Yes | Yes |
| gemini-1.5-flash | Yes | Yes | Yes |
| claude-3-opus | Yes | No | No |
| claude-3-sonnet | Yes | No | No |

**Debugging Steps**:

1. Check model capabilities
2. Verify input source type (URL vs file_id)
3. Check transport modes tried
4. Consider using a different model

**Fix**:

```python
# Use a vision-capable model for images
agent = Agent(
    model="gpt-4o",  # Supports vision
    # ...
)

# Or upload file and use file_id
from agentflow.storage.media import MediaStorage
media = MediaStorage()
file_id = await media.upload(file_path)
# Use file_id in message instead of URL
```

---

## Node & Tool Execution

### Symptom: "Node execution failed" or "Tool error"

**Error Code**: `NODE_000`

**Symptoms**:
- Tool call returns error
- Node operation fails
- Partial execution before failure

**Root Causes**:

| Cause | Description |
|-------|-------------|
| Tool runtime error | Exception in tool function |
| Invalid tool input | Tool received malformed parameters |
| Tool timeout | Tool exceeded time limit |
| Missing dependencies | Tool requires unavailable resource |

**Debugging Steps**:

1. Check tool error message in logs
2. Verify tool function signature
3. Test tool in isolation
4. Review tool timeout settings

**Fix**:

```python
from agentflow.core.exceptions import NodeError

try:
    result = await tool.execute(input_data)
except NodeError as e:
    # Handle node-specific error
    logger.error(f"Node error: {e.error_code}")
except Exception as e:
    # Handle unexpected errors
    raise NodeError(
        message=f"Tool execution failed: {str(e)}",
        context={"tool_name": tool.name}
    )
```

---

## Quick Reference Tables

### Error by Symptom

| Symptom | Error Code | Action |
|---------|------------|--------|
| Infinite loop | `RECURSION_000` | Add recursion limit, fix routing |
| Not found | `STORAGE_NOT_FOUND_000` | Verify thread_id, check storage |
| Timeout | `STORAGE_TRANSIENT_000` | Retry with backoff |
| Serialization fail | `STORAGE_SERIALIZATION_000` | Fix state schema |
| Schema mismatch | `STORAGE_SCHEMA_000` | Run migrations |
| Validation blocked | `VALIDATION_000` | Check input, adjust validators |
| Media unsupported | `MEDIA_000` | Use capable model |
| Node error | `NODE_000` | Check tool implementation |
| Graph error | `GRAPH_000` | Review graph configuration |

### Error by HTTP Status

| Status | Likely Error | Code |
|--------|--------------|------|
| 400 | Validation | `VALIDATION_000` |
| 404 | Not found | `STORAGE_NOT_FOUND_000` |
| 429 | Rate limit | `STORAGE_TRANSIENT_000` |
| 500 | Graph/Node | `GRAPH_000`, `NODE_000` |
| 503 | Transient | `STORAGE_TRANSIENT_000` |

---

## Common Fixes

### Always

- Check logs first for specific error messages
- Note the error code for programmatic handling
- Use `to_dict()` for structured error inspection

### For Recursion Issues

```python
# Add explicit termination
app = graph.compile(recursion_limit=50)

# Add timeout
app = graph.compile(recursion_limit=50, execution_timeout=60)
```

### For Storage Issues

```python
# Configure proper checkpointer
app = graph.compile(
    checkpointer=PostgresCheckpointer(connection_string=dsn)
)

# Handle transient errors
@retry(attempts=3, backoff=2)
async def save_checkpoint():
    await checkpointer.save(thread_id, state)
```

### For Validation Issues

```python
# For false positives, add to allowlist
validator = PromptInjectionValidator(
    allowlist_patterns=[r"ignore previous"]  # If legitimate
)

# Or disable strict mode for specific inputs
validator = PromptInjectionValidator(strict_mode=False)
```

---

## Related Docs

- [Error Codes Reference](/docs/troubleshooting/error-codes)
- [Production Troubleshooting](/docs/how-to/production/troubleshooting)
- [Checkpointing Guide](/docs/how-to/production/checkpointing)
- [Input Validation](/docs/how-to/python/protect-against-prompt-injection)
