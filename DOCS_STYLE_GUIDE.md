# AgentFlow Docs Style Guide

This is an internal sprint-0 note for rebuilding the docs in `agentflow-docs/`.

## Status Labels

- Mark unfinished public pages with a `:::note Draft` admonition near the top.
- Do not present planned APIs or packages as production-ready.
- Keep `docs-mkdocs-legacy/` as source material only.

## Import Paths

- Use current imports only.
- Prefer `from agentflow.core.graph import Agent, StateGraph, ToolNode`.
- Prefer `from agentflow.core.state import AgentState, Message`.
- Prefer `from agentflow.storage.checkpointer import InMemoryCheckpointer, PgCheckpointer`.
- Prefer `from agentflow.runtime.adapters.llm import ModelResponseConverter`.
- Use `from agentflow.utils import END` when examples need graph termination.
- Do not document old imports such as `agentflow.graph` or `agentflow.state`.

## Tutorial Format

- Start with the outcome and the minimum prerequisites.
- Teach one concept per page.
- Include copy-paste friendly code.
- Include expected output or a verification command.
- End with `What you learned` and `Next step`.

## Validation

- Validate Python snippets against the current packages before removing draft status.
- Validate CLI docs against `agentflow-api/agentflow_cli/cli/main.py`.
- Validate TypeScript client docs against `agentflow-client/src/client.ts`.
- Run `cd agentflow-docs && npm run build` before marking sprint work complete.

## Scope Rules

- Document `agentflow`, `agentflow-api`, `agentflow-client`, and the hosted playground opened by `agentflow play`.
- Do not add public navigation for `agentflow-ui` until the UI library is ready.
- Do not document separate playground frontend setup in public getting-started guides.
