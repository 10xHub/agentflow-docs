---
title: Security and Validators
description: Graph-level validation, prompt-injection checks, and safety boundaries for AgentFlow apps.
sidebar_position: 13
---

# Security and validators

AgentFlow separates HTTP security from graph-level safety:

- API auth, CORS, middleware, and request limits protect the server boundary.
- Validators and callbacks protect graph inputs, tool arguments, model outputs, and memory writes.

## Validator API

Validators subclass `BaseValidator` and implement `validate`.

```python
from agentflow.utils import BaseValidator
from agentflow.utils.validators import ValidationError

class TopicValidator(BaseValidator):
    async def validate(self, messages):
        for message in messages:
            if "forbidden topic" in message.text().lower():
                raise ValidationError("Topic is not allowed", "topic_policy")
        return True
```

Register validators on a callback manager:

```python
from agentflow.utils import CallbackManager

callback_manager = CallbackManager()
callback_manager.register_input_validator(TopicValidator())

app = graph.compile(callback_manager=callback_manager)
```

## Built-in validators

| Validator | Purpose |
|---|---|
| `PromptInjectionValidator` | Detect common prompt-injection patterns and suspicious content. |
| `MessageContentValidator` | Validate message structure and content limits. |
| `register_default_validators` | Register the standard validation set. |

## Safety points

Use callbacks when validation needs to happen around a specific invocation.

| Safety point | Example |
|---|---|
| Before model calls | Block prompt injection or disallowed topics. |
| Before tool calls | Validate tool arguments and permissions. |
| After model calls | Filter or inspect output before returning it. |
| Before memory writes | Prevent sensitive data from entering long-term memory. |

## Production boundary

Graph validators are not a replacement for HTTP security. In production, also configure API auth, restrict CORS origins, protect docs endpoints when needed, and validate remote tool registrations if untrusted clients can call setup routes.

## Rules

| Rule | Why it matters |
|---|---|
| Keep validators deterministic and fast | They run on the hot path. |
| Avoid LLM calls inside validators by default | That adds latency and nondeterminism. |
| Raise `ValidationError` for expected policy failures | Error handling can distinguish policy from system failures. |
| Sanitize logs | User and tool data can contain secrets. |

## Related docs

- [Callbacks and Command](./callbacks-and-command.md)
- [Protect against prompt injection](/docs/how-to/python/protect-against-prompt-injection)
- [Auth and authorization](/docs/how-to/production/auth-and-authorization)
