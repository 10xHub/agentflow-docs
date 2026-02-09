# Error Handling Guidelines for AgentFlow

This document provides comprehensive guidelines for error handling in the AgentFlow framework.

## Table of Contents

1. [Overview](#overview)
2. [Exception Hierarchy](#exception-hierarchy)
3. [Error Codes](#error-codes)
4. [Structured Error Responses](#structured-error-responses)
5. [Logging Best Practices](#logging-best-practices)
6. [Usage Examples](#usage-examples)
7. [Migration Guide](#migration-guide)

## Overview

AgentFlow uses a structured error handling approach with:
- **Error Codes**: Unique identifiers for each error type
- **Contextual Information**: Additional data to aid debugging
- **Structured Logging**: Consistent log format with error codes and context
- **Serializable Responses**: Convert errors to dictionaries for API responses

## Exception Hierarchy

```
Exception
├── GraphError (GRAPH_XXX)
│   ├── NodeError (NODE_XXX)
│   └── GraphRecursionError (RECURSION_XXX)
├── StorageError (STORAGE_XXX)
│   ├── TransientStorageError (STORAGE_TRANSIENT_XXX)
│   ├── SerializationError (STORAGE_SERIALIZATION_XXX)
│   └── SchemaVersionError (STORAGE_SCHEMA_XXX)
├── MetricsError (METRICS_XXX)
└── ValidationError (VALIDATION_XXX)
```

## Error Codes

Error codes follow a hierarchical pattern: `CATEGORY_SUBCATEGORY_NNN`

### Graph Errors (GRAPH_XXX)
- `GRAPH_000`: Generic graph error
- `GRAPH_001`: Invalid graph structure
- `GRAPH_002`: Missing entry point
- `GRAPH_003`: Orphaned nodes detected
- `GRAPH_004`: Invalid edge configuration

### Node Errors (NODE_XXX)
- `NODE_000`: Generic node error
- `NODE_001`: Node execution failed
- `NODE_002`: No tool calls to execute
- `NODE_003`: Invalid node configuration
- `NODE_004`: Node not found

### Recursion Errors (RECURSION_XXX)
- `RECURSION_000`: Generic recursion error
- `RECURSION_001`: Recursion limit exceeded
- `RECURSION_002`: Infinite loop detected

### Storage Errors (STORAGE_XXX)
- `STORAGE_000`: Generic storage error
- `STORAGE_TRANSIENT_000`: Transient storage error (retryable)
- `STORAGE_SERIALIZATION_000`: Serialization/deserialization error
- `STORAGE_SCHEMA_000`: Schema version mismatch

### Metrics Errors (METRICS_XXX)
- `METRICS_000`: Generic metrics error
- `METRICS_001`: Failed to emit metrics

### Validation Errors (VALIDATION_XXX)
- `VALIDATION_000`: Generic validation error
- `VALIDATION_001`: Prompt injection detected
- `VALIDATION_002`: Message content validation failed
- `VALIDATION_003`: Content policy violation

## Structured Error Responses

All exceptions support the `to_dict()` method for structured responses:

```python
{
    "error_type": "NodeError",
    "error_code": "NODE_001",
    "message": "Node failed to execute",
    "context": {
        "node_name": "process_data",
        "input_size": 100,
        "execution_time_ms": 1500
    }
}
```

## Logging Best Practices

### 1. Always Include Context

```python
raise NodeError(
    message="Node failed to execute",
    error_code="NODE_001",
    context={
        "node_name": node_name,
        "input_size": len(input_data),
        "execution_time_ms": execution_time
    }
)
```

### 2. Use Appropriate Log Levels

- **ERROR**: For exceptions that indicate a failure (`GraphError`, `NodeError`, `SerializationError`)
- **WARNING**: For recoverable issues (`TransientStorageError`, `MetricsError`)
- **INFO**: For normal operation logs
- **DEBUG**: For detailed diagnostic information

### 3. Include Stack Traces

All exception classes automatically include `exc_info=True` in their logging, which captures the full stack trace.

### 4. Avoid Sensitive Information

Never log sensitive information such as:
- API keys or credentials
- Personal identifiable information (PII)
- Raw user data
- Password hashes

## Usage Examples

### Basic Usage

```python
from agentflow.exceptions import NodeError

try:
    result = process_node(data)
except Exception as e:
    raise NodeError(
        message=f"Failed to process node: {e!s}",
        error_code="NODE_001",
        context={
            "node_name": "data_processor",
            "error_type": type(e).__name__
        }
    ) from e
```

### With Retry Logic

```python
from agentflow.exceptions import TransientStorageError, StorageError

max_retries = 3
for attempt in range(max_retries):
    try:
        result = save_to_database(data)
        break
    except ConnectionError as e:
        if attempt < max_retries - 1:
            raise TransientStorageError(
                message=f"Database connection failed, attempt {attempt + 1}/{max_retries}",
                error_code="STORAGE_TRANSIENT_001",
                context={
                    "attempt": attempt + 1,
                    "max_retries": max_retries
                }
            ) from e
        else:
            raise StorageError(
                message="Database connection failed after all retries",
                error_code="STORAGE_001",
                context={
                    "total_attempts": max_retries
                }
            ) from e
```

### API Response

```python
from agentflow.exceptions import GraphError

@app.exception_handler(GraphError)
async def graph_error_handler(request, exc: GraphError):
    return JSONResponse(
        status_code=400,
        content=exc.to_dict()
    )
```

### Conditional Logging

```python
from agentflow.exceptions import MetricsError

try:
    emit_metric("node_execution", value)
except Exception as e:
    # Metrics errors are non-critical, log but don't raise
    raise MetricsError(
        message=f"Failed to emit metric: {e!s}",
        error_code="METRICS_001",
        context={"metric_name": "node_execution"}
    )
```

### Input Validation Error

```python
from typing import Any
from agentflow.utils.validators import ValidationError
from agentflow.state.message import Message

class ValidationError(Exception):
    """Custom exception raised when input validation fails."""

    def __init__(self, message: str, violation_type: str, details: dict[str, Any] | None = None):
        """
        Initialize ValidationError.

        Args:
            message: Human-readable error message
            violation_type: Type of validation violation
            details: Additional details about the validation failure
        """
        super().__init__(message)
        self.violation_type = violation_type
        self.details = details or {}


# Usage example
try:
    if "DROP" in user_input.upper():
        raise ValidationError(
            message="Potential SQL injection detected",
            violation_type="injection_pattern",
            details={"content_sample": user_input[:100]}
        )
except ValidationError as e:
    logger.error(
        f"Validation failed: {e.violation_type}",
        extra={
            "violation_type": e.violation_type,
            "details": e.details
        }
    )
    raise
```

## Migration Guide

### Updating Existing Code

#### Before (Old Style)

```python
from agentflow.exceptions import GraphError

raise GraphError("Invalid graph structure")
```

#### After (New Style)

```python
from agentflow.exceptions import GraphError

raise GraphError(
    message="Invalid graph structure",
    error_code="GRAPH_001",
    context={"node_count": 5, "edge_count": 3}
)
```

However, we recommend migrating to the new structured format for better observability and debugging.

### Finding Exceptions to Update

Search for exception raises in your codebase:

```bash
# Find all GraphError raises
grep -r "raise GraphError" agentflow/

# Find all NodeError raises
grep -r "raise NodeError" agentflow/

# Find all other exception raises
grep -r "raise.*Error" agentflow/
```

## Best Practices Summary

1. ✅ Always include meaningful error codes
2. ✅ Provide contextual information in the `context` dict
3. ✅ Use structured logging with consistent format
4. ✅ Chain exceptions with `from e` to preserve stack traces
5. ✅ Document error codes in your API documentation
6. ✅ Use `to_dict()` for API responses
7. ❌ Don't log sensitive information
8. ❌ Don't catch generic `Exception` without re-raising with context
9. ❌ Don't suppress errors silently
10. ❌ Don't use the same error code for different error scenarios

## Future Enhancements

- Add error code registry with descriptions
- Implement error monitoring integration (Sentry, etc.)
- Add error metrics and dashboards
- Create error code lookup CLI tool
- Add internationalization (i18n) support for error messages
