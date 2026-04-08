---
title: Callback Manager
description: CallbackManager, BeforeInvokeCallback, AfterInvokeCallback, OnErrorCallback, BaseValidator, PromptInjectionValidator — hook into every LLM, tool, and MCP invocation.
sidebar_position: 14
---

# Callback Manager

## When to use this

Use the callback system to:
- Block or modify inputs before the LLM/tool is called (input validation, prompt injection protection).
- Inspect or modify outputs after the LLM/tool returns (response filtering, logging).
- Handle errors gracefully and optionally return a recovery value.
- Register structured validators as a simpler alternative to manual before-invoke callbacks.

Pass a `CallbackManager` to `graph.compile(callback_manager=...)`.

## Import paths

```python
from agentflow.utils import (
    CallbackManager,
    InvocationType,
    BeforeInvokeCallback,
    AfterInvokeCallback,
    OnErrorCallback,
    BaseValidator,
    CallbackContext,
)
from agentflow.utils.validators import (
    PromptInjectionValidator,
    MessageContentValidator,
    ValidationError,
    register_default_validators,
)
```

---

## `CallbackManager`

Central registry and executor for all callbacks and validators.

```python
from agentflow.utils import CallbackManager

cbm = CallbackManager()
app = graph.compile(callback_manager=cbm)
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `register_before_invoke` | `(invocation_type, callback)` | Register a callback fired before an invocation. |
| `register_after_invoke` | `(invocation_type, callback)` | Register a callback fired after an invocation. |
| `register_on_error` | `(invocation_type, callback)` | Register an error-handler callback. |
| `register_input_validator` | `(validator: BaseValidator)` | Register a validator (simpler than a before-invoke callback). |
| `execute_before_invoke` | `async (context, input_data) → input_data` | Called internally by the framework. |
| `execute_after_invoke` | `async (context, input_data, output_data) → output_data` | Called internally by the framework. |
| `execute_on_error` | `async (context, input_data, error) → Message \| None` | Called internally by the framework. |
| `execute_validators` | `async (messages: list[Message]) → bool` | Called internally; runs all registered validators. |

---

## `InvocationType`

Selects which invocation type a callback fires on.

| Value | Fires when |
|---|---|
| `InvocationType.AI` | The LLM provider is called. |
| `InvocationType.TOOL` | A local Python tool function is called. |
| `InvocationType.MCP` | An MCP tool call is made. |
| `InvocationType.INPUT_VALIDATION` | Input validation phase (validators). |
| `InvocationType.SKILL` | A skill is injected and executed. |

---

## `CallbackContext`

Passed to every callback with metadata about the current invocation.

| Field | Type | Description |
|---|---|---|
| `invocation_type` | `InvocationType` | The type of invocation that fired this callback. |
| `node_name` | `str` | Name of the graph node executing. |
| `function_name` | `str \| None` | Name of the tool or skill function (if applicable). |
| `metadata` | `dict \| None` | Additional context from the framework. |

---

## `BeforeInvokeCallback`

Fires before the LLM/tool call. Can modify or block the input.

```python
from agentflow.utils.callbacks import BeforeInvokeCallback, CallbackContext
from agentflow.utils import InvocationType

class UpperCaseInput(BeforeInvokeCallback):
    async def __call__(self, context: CallbackContext, input_data) -> ...:
        # input_data is the list of messages about to be sent to the LLM
        for msg in input_data:
            if hasattr(msg, "content") and isinstance(msg.content, str):
                msg.content = msg.content.upper()
        return input_data   # must return (possibly modified) input_data

cbm = CallbackManager()
cbm.register_before_invoke(InvocationType.AI, UpperCaseInput())
```

To block execution, raise any exception from the callback.

---

## `AfterInvokeCallback`

Fires after the LLM/tool returns. Can modify the response.

```python
from agentflow.utils.callbacks import AfterInvokeCallback, CallbackContext

class AuditLogger(AfterInvokeCallback):
    async def __call__(self, context: CallbackContext, input_data, output_data):
        print(f"[AUDIT] node={context.node_name} type={context.invocation_type}")
        return output_data   # must return (possibly modified) output_data

cbm.register_after_invoke(InvocationType.AI, AuditLogger())
```

---

## `OnErrorCallback`

Fires when any exception occurs during an invocation. Can return a recovery `Message` or `None` (re-raise).

```python
from agentflow.utils.callbacks import OnErrorCallback, CallbackContext

class FallbackOnError(OnErrorCallback):
    async def __call__(self, context: CallbackContext, input_data, error: Exception):
        print(f"Error in {context.node_name}: {error}")
        return None   # return None to re-raise, or a Message to substitute

cbm.register_on_error(InvocationType.AI, FallbackOnError())
```

---

## `BaseValidator` and the validator API

Validators focus specifically on message content validation. They are simpler than callbacks because they only need one method.

```python
from agentflow.utils import BaseValidator
from agentflow.utils.validators import ValidationError

class AllowedTopicsValidator(BaseValidator):
    async def validate(self, messages) -> bool:
        for msg in messages:
            if "competitor" in msg.text().lower():
                raise ValidationError(
                    "Off-topic content detected",
                    "topic_policy",
                    {"content": msg.text()[:100]},
                )
        return True

cbm.register_input_validator(AllowedTopicsValidator())
```

---

## `PromptInjectionValidator`

Detects OWASP LLM01:2025 prompt injection attacks.

```python
from agentflow.utils.validators import PromptInjectionValidator

validator = PromptInjectionValidator(
    strict_mode=True,        # raises ValidationError (default)
    max_length=10000,        # max allowed message length
    blocked_patterns=[],     # additional regex patterns
    suspicious_keywords=[],  # additional keywords
)
cbm.register_input_validator(validator)
```

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `strict_mode` | `bool` | `True` | `True` raises `ValidationError`; `False` logs a warning and sanitizes. |
| `max_length` | `int` | `10000` | Maximum message content length in characters. |
| `blocked_patterns` | `list[str]` | `[]` | Additional regex patterns to block (merged with default patterns). |
| `suspicious_keywords` | `list[str]` | `[]` | Additional keywords to flag. |

---

## `MessageContentValidator`

Validates message structure integrity.

```python
from agentflow.utils.validators import MessageContentValidator

validator = MessageContentValidator(
    allowed_roles=["user", "assistant", "system"],
    max_content_blocks=50,
)
cbm.register_input_validator(validator)
```

---

## `ValidationError`

Raised by validators when validation fails.

| Attribute | Type | Description |
|---|---|---|
| `violation_type` | `str` | Category: `"injection_pattern"`, `"length_exceeded"`, `"encoding_attack"`, `"invalid_role"`, etc. |
| `details` | `dict` | Extra context: matched pattern, content sample, input length. |

---

## `register_default_validators`

One-call setup that registers both `PromptInjectionValidator` (strict) and `MessageContentValidator`.

```python
from agentflow.utils.validators import register_default_validators

cbm = CallbackManager()
register_default_validators(cbm)
app = graph.compile(callback_manager=cbm)
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Callbacks never fire | `callback_manager` not passed to `compile()`. | `graph.compile(callback_manager=cbm)`. |
| `ValidationError` brings down the server | Not caught outside the graph. | Wrap `ainvoke/astream` in `try/except ValidationError`. |
| Before-invoke callback receives `None` as `input_data` | LLM call with an empty message list. | Check for empty messages in the callback before iterating. |
| After-invoke callback changes return type, graph breaks | Returning wrong type from `__call__`. | Always return the same type as `output_data`. |
