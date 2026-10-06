---
title: Security policy — AgentFlow project
sidebar_label: Security
description: How to report a vulnerability in AgentFlow, what response to expect, which versions receive fixes, and which behaviours are by design rather than bugs.
keywords:
  - agentflow security
  - report vulnerability
  - agentflow security policy
  - responsible disclosure
  - agent framework security
---

# Security policy

## Reporting a vulnerability

**Do not open a public GitHub issue for a security problem.**

Report privately through either channel:

- **GitHub Security Advisories** (preferred): open a private report at
  [github.com/10xHub/Agentflow/security/advisories/new](https://github.com/10xHub/Agentflow/security/advisories/new)
- **Email:** [contact@10xscale.ai](mailto:contact@10xscale.ai)

Include as much of the following as you can:

- A description of the issue and the impact you believe it has.
- The affected version or versions and, if known, the affected import path
  (for example `agentflow.core.llm.client_factory`).
- A minimal reproduction or proof of concept.
- Any suggested remediation.

### What to expect

| Stage | Target |
| --- | --- |
| Acknowledgement | Within 3 business days |
| Initial assessment and severity triage | Within 7 business days |
| Disclosure | Coordinated. We agree a timeline with you and credit you in the advisory unless you prefer to remain anonymous. |

## Supported versions

Security fixes are applied to the latest published release line. Pin a known-good
version in production and upgrade promptly when a security release is announced.
See the [changelog](changelog.md) for what is current.

## Scope

This policy covers the `10xscale-agentflow` core package. Issues in the API
server (`10xscale-agentflow-cli`), the TypeScript client, or third-party
dependencies should be reported against their own projects, though we are happy
to route a report to the right place.

## Expected behaviour, not vulnerabilities

Some properties of an agent framework look like vulnerabilities and are not.
Reports covering these will be closed with a pointer back here.

### Tools execute arbitrary code by design

Tools registered with a `ToolNode` run with the privileges of the host process.
Register only trusted tools, and treat any tool input derived from model output
as untrusted. See [protect against prompt
injection](../how-to/python/protect-against-prompt-injection.md).

### The model can be persuaded to call a tool

Prompt injection is a property of language models, not a defect in the graph
engine. The framework gives you the controls to bound it — input validators,
per-tool authorization, human-in-the-loop interrupts — but it cannot decide for
you which tool calls are acceptable. See [security and
validators](../concepts/security-and-validators.md).

### Development defaults are permissive

`MODE=development` deliberately enables debug output, permissive CORS, and
unauthenticated access so that a local run works with no setup. That is not a
production configuration. Production has its own defaults and refuses to start
in some unsafe combinations. See [deployment](../how-to/production/deployment.md)
and [environment variables](../how-to/production/environment-variables.md).

## Hardening checklist

Before exposing an agent to untrusted users:

1. Set `MODE=production` and `IS_DEBUG=false`.
2. Set explicit `ORIGINS`. Wildcard CORS with credentials is refused at startup.
3. Enable authentication (`"auth": "jwt"` or a custom `BaseAuth`) and set a
   `JWT_SECRET_KEY` of at least 32 characters. See
   [auth and authorization](../how-to/production/auth-and-authorization.md).
4. Keep `enforce_user_isolation` on so a thread id alone is not an access token.
5. Configure [rate limiting](../how-to/api-cli/configure-rate-limiting.md), and
   make sure your proxy hop count is correct so the limit cannot be bypassed
   with a forged `X-Forwarded-For`.
6. Restrict per-tool access with an `AuthorizationBackend` if any tool can spend
   money, send messages, or reach internal systems.
7. Keep secrets out of the image; pass them at runtime.
