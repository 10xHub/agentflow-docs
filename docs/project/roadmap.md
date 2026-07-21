---
title: Roadmap and known gaps — AgentFlow project
sidebar_label: Roadmap
description: What AgentFlow does not do yet, which surfaces are incomplete, and where dated release planning actually lives.
keywords:
  - agentflow roadmap
  - agentflow limitations
  - agentflow known gaps
  - agentflow a2a
  - agentflow future
---

# Roadmap and known gaps

This page is the honest inventory: things that are announced, half-built, or
deliberately absent. It exists so you can tell whether AgentFlow fits your
project before you find out the hard way.

Dated planning and prioritisation happen in the open on GitHub:

- [Issues](https://github.com/10xHub/Agentflow/issues) for tracked work
- [Discussions](https://github.com/10xHub/Agentflow/discussions) for proposals
- [Releases](https://github.com/10xHub/Agentflow/releases) for what actually shipped

Nothing on this page is a delivery commitment. If a gap blocks you, say so in an
issue: real demand reorders the list.

---

## Not implemented yet

### Agent-to-Agent (A2A) serving

The core package ships an optional `a2a_sdk` extra, but the API server does not
expose an A2A endpoint. The `a2a` routers were removed from the CLI package in a
recent release because they were commented out, never mounted, and shipping as
dead code in the wheel. They can be restored from git history when the surface is
actually built.

**Today:** agents talk to each other in-process through
[handoffs](../how-to/python/handoff-between-agents.md) and
[supervisor or swarm topologies](../prebuild/agents/supervisor-team-agent.md).
Cross-process agent calls go over the normal REST API.

### File attachments in the playground

The playground's **Files** page is a placeholder marked "Soon", and the paperclip
button in the chat composer is inert.

**Today:** file upload works over the REST API and the TypeScript client. See
[send images and documents](../how-to/client/send-images-and-documents.md).

### Server-side registration of client tools

`registerTool()` on the TypeScript client stores a handler locally; it does not
yet inform the server. Tools the browser can execute must still be declared on
the Python side.

See [register remote tools](../how-to/client/register-remote-tools.md).

---

## Partial support

| Area | What works | What does not |
| --- | --- | --- |
| Gemini explicit context caching | Caching through the provider directly | `SummaryContextManager` does not accept `cached_content`, and caching is not wired through `CriterionConfig`. See [Google provider](../providers/google.md). |
| OpenAI evaluation judge | The judge calls `call_llm` normally | Extra kwargs are not forwarded from the judge configuration. See [OpenAI provider](../providers/openai.md). |
| `ExactMatchCriterion` | Usable by constructing it directly | Not reachable through `CriteriaConfig`, which forbids unknown keys and has no `exact_match` field. |
| Light theme on this docs site | Readable and complete | Tuned less carefully than the dark theme, which is canonical. |

---

## Deliberately out of scope

These are not gaps. They are decisions, and they are unlikely to change.

- **No hosted control plane.** AgentFlow is a library plus a server you run. There
  is no account, no telemetry phoning home, and no paid tier gating features.
- **No LangChain dependency.** Provider clients are implemented directly. That is
  why the dependency tree is small and why LangChain integrations do not drop in
  unchanged.
- **No sandboxing of tools.** Tools run with the privileges of the host process
  by design. Isolation is your deployment's job. See the
  [security policy](security.md).
- **No prompt-injection guarantee.** The framework gives you validators,
  per-tool authorization, and human-in-the-loop interrupts. It does not claim to
  make a language model safe to point at untrusted input.

---

## Stability commitments

From 1.0 on, the public API is covered by a deprecation policy: nothing public is
removed without at least one minor release of warning, and moved modules keep a
shim. The full policy, and what counts as public API for each package, is in the
[changelog](changelog.md#versioning-policy).
