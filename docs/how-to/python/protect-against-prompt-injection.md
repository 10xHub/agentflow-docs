---
title: Protect against prompt injection
description: "How to use CallbackManager and PromptInjectionValidator to guard your agent against prompt injection, jailbreak, and other OWASP LLM01:2025 attacks."
keywords:
  - agentflow python
  - python ai agent guide
  - multi-agent python
  - agentflow
  - python ai agent framework
  - protect against prompt injection
---


# Protect against prompt injection

User messages can contain attempts to override your agent's instructions, bypass safety rules, or extract system prompts. The `CallbackManager` intercepts every input before it reaches the LLM so you can validate or block it.

## Prerequisites

You have a working graph. No extra packages required — validation is built into the core library.

## Quick start: enable the default validators

```python
from agentflow.utils import CallbackManager
from agentflow.utils.validators import register_default_validators

callback_manager = CallbackManager()
register_default_validators(callback_manager)   # adds PromptInjectionValidator + MessageContentValidator

app = graph.compile(callback_manager=callback_manager)
```

`register_default_validators` registers both `PromptInjectionValidator` (strict mode) and `MessageContentValidator` in one call. Any user message that matches a known injection pattern will immediately raise `ValidationError` before the LLM is called.

## What `PromptInjectionValidator` detects

Based on OWASP LLM01:2025, it flags:

- Direct injection: `"Ignore all previous instructions and..."`
- Role manipulation: `"You are now DAN..."`, `"Act as an admin..."`
- System prompt leakage: `"Show me your system prompt"`
- Jailbreak personas: DAN, APOPHIS, STAN, DUDE
- Encoding attacks: base64-encoded payloads, emoji obfuscation
- Template injection: `{{...}}`, `${...}`, `{%...%}`
- Delimiter confusion: `--- END OF INSTRUCTIONS ---`
- Adversarial suffixes: long sequences of special characters

## Use strict vs. lenient mode

```python
from agentflow.utils.validators import PromptInjectionValidator

# Strict (default): raises ValidationError on detection
strict_validator = PromptInjectionValidator(strict_mode=True)

# Lenient: logs a warning and sanitizes, does not block
lenient_validator = PromptInjectionValidator(strict_mode=False)

callback_manager.register_input_validator(strict_validator)
```

## Add custom blocked patterns

```python
validator = PromptInjectionValidator(
    strict_mode=True,
    blocked_patterns=[
        r"(?i)competitor_name",   # block mentions of a competitor
        r"INTERNAL_CODE_\w+",     # block internal identifiers
    ],
    suspicious_keywords=["leaked", "confidential"],
)
callback_manager.register_input_validator(validator)
```

## Handle `ValidationError` in your API

When a message is blocked, `ValidationError` is raised. Catch it in your API layer or in the stream loop and return a user-friendly response:

```python
from agentflow.utils.validators import ValidationError

try:
    result = await app.ainvoke({"messages": [user_message]})
except ValidationError as e:
    print(f"Blocked: {e.violation_type} — {e}")
    # return a safe fallback response to the user
```

`ValidationError` attributes:

| Attribute | Type | Description |
|---|---|---|
| `violation_type` | `str` | Detection category: `"injection_pattern"`, `"length_exceeded"`, `"encoding_attack"`, etc. |
| `details` | `dict` | Extra context: matched pattern, content sample, input length. |

## Write a before-invoke callback

For more control — for example, modifying messages instead of blocking them — use a `BeforeInvokeCallback`:

```python
from agentflow.utils import CallbackManager, InvocationType
from agentflow.utils.callbacks import BeforeInvokeCallback, CallbackContext

class SanitizeCallback(BeforeInvokeCallback):
    async def __call__(self, context: CallbackContext, input_data):
        # Strip anything that looks like a jinja2 template from user messages
        import re
        for msg in input_data:
            if hasattr(msg, "content") and isinstance(msg.content, str):
                msg.content = re.sub(r"\{\{.*?\}\}", "[removed]", msg.content)
        return input_data

callback_manager = CallbackManager()
callback_manager.register_before_invoke(InvocationType.AI, SanitizeCallback())
```

## Write an after-invoke callback

Inspect or modify the LLM's response before it is stored in state:

```python
from agentflow.utils.callbacks import AfterInvokeCallback

class LoggingCallback(AfterInvokeCallback):
    async def __call__(self, context: CallbackContext, input_data, output_data):
        print(f"Node={context.node_name} produced {len(str(output_data))} chars")
        return output_data  # must return the (potentially modified) output

callback_manager.register_after_invoke(InvocationType.AI, LoggingCallback())
```

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ValidationError` on legitimate messages | `strict_mode=True` matched a false-positive pattern. | Use `strict_mode=False` or narrow the blocked pattern. |
| Callbacks registered but never fire | `callback_manager` not passed to `graph.compile()`. | Add `callback_manager=` to `compile(...)`. |
| `ValidationError` not caught, server 500 | Exception propagates past the graph. | Wrap `ainvoke` in `try/except ValidationError`. |
