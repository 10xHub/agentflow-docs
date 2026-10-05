---
title: Security and Validators
description: How input validators and PromptInjectionValidator work in 10xGraph, what the production template enables, and why they reduce prompt-injection risk.
section: Concepts
order: 171
group: Production
updated: "2026-07-21"
---

Validators are checks that run on incoming messages before a graph executes them. A validator subclasses `BaseValidator`, is registered on a `CallbackManager`, and raises `ValidationError` to reject input. They reduce prompt-injection risk. They do not eliminate it.

## Threat model

Two layers need protection, and they use different tools:

- **The server boundary.** Who may call which endpoint. The API server handles this with JWT or custom auth, role scopes checked per endpoint (`resource:action`, for graph, checkpointer, store, files and config), and owner-only threads. It also provides CORS limits, request-size limits and rate limits.
- **The model boundary.** What text reaches the model. A user, or a document a tool fetched, can try to override instructions, reveal the system prompt or push the agent toward actions it should not take. Validators and callbacks address this layer.

Authorization is not per tool out of the box. A tool receives the verified identity and scopes in `config["authz"]` and can check them itself with `agentflow.core.authz.has_scope`.

## How validators run

When a run starts, the new input messages are passed to `validate_message_content`, which calls `CallbackManager.execute_validators`. Validators run in registration order, each awaited in turn. The first one that raises stops the run, and a rejection event is published if a publisher is configured. Through the API server, a `ValidationError` becomes an HTTP 422 response with error code `AGENTFLOW_VALIDATION_ERROR`.

Input validators see messages entering the graph, on both fresh and continued threads. They do not inspect model output or tool arguments. For those points, use `register_before_invoke` and `register_after_invoke` callbacks (see [Callbacks and Command](/docs/concepts/callbacks-and-command)).

## Writing a validator

```python
from agentflow.core.state import Message
from agentflow.utils import BaseValidator, CallbackManager
from agentflow.utils.validators import PromptInjectionValidator, ValidationError


class NoCardNumbers(BaseValidator):
    async def validate(self, messages: list[Message]) -> bool:
        for message in messages:
            text = message.text()
            if "4111 1111" in text:
                raise ValidationError("Card numbers are not accepted", "pii_card")
        return True


callback_manager = CallbackManager()
callback_manager.register_input_validator(
    PromptInjectionValidator(strict_mode=True, max_length=2000)
)
callback_manager.register_input_validator(NoCardNumbers())

app = graph.compile(callback_manager=callback_manager)
```

`ValidationError(message, violation_type, details=None)` carries a machine-readable `violation_type`.

## Built-in validators

| Validator | What it checks |
|---|---|
| `PromptInjectionValidator` | Maximum length, regex patterns for instruction override, role switching, system-prompt leakage, delimiter tricks and jailbreak names, encoding obfuscation, and three or more suspicious keywords in one message. |
| `MessageContentValidator` | Allowed roles and a cap on content blocks per message (default 50). |
| `register_default_validators(manager, strict_mode=True)` | Registers both of the above. |

With `strict_mode=False`, `PromptInjectionValidator` logs a warning instead of raising. You can extend it with `blocked_patterns` and `suspicious_keywords`.

## What the production template generates

The prod template creates `graph/validators/validators.py` with a `PromptInjectionValidator(strict_mode=True, max_length=1000)` and extra suspicious keywords such as `bypass`, `override`, `token`, `coupon` and `free`. `graph/validators/manager.py` builds a `CallbackManager`, registers that validator and a lifecycle hook, and `graph/agent.py` passes it to `compile(callback_manager=...)`. Tune the keyword list to your domain: words like `free` will flag ordinary customer messages in some products.

## Limits

- Pattern and keyword checks are heuristics. A rephrased or translated attack can pass, and a legitimate message can be rejected.
- Indirect injection, where a tool result or retrieved document carries the attack, is not covered by input validators.
- Validators do not replace authorization. Keep tools narrow, check scopes inside sensitive tools, and make side effects such as refunds replay-safe.

## Rules

| Rule | Why it matters |
|---|---|
| Keep validators deterministic and fast | They run on the hot path. |
| Avoid LLM calls inside validators | They add latency and nondeterminism. |
| Raise `ValidationError` for policy failures | Callers can tell policy from system errors. |
| Sanitize logs | Rejected input can contain secrets. |

## Related docs

- [Callbacks and Command](/docs/concepts/callbacks-and-command)
- [Protect against prompt injection](/docs/how-to/python/protect-against-prompt-injection)
- [Auth and authorization](/docs/how-to/production/auth-and-authorization)
