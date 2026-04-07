---
title: API and CLI
description: Reference entry point for the AgentFlow API and CLI package.
slug: /reference/api-cli
---

# API and CLI reference

This section documents `agentflow-api`: the API and CLI layer for serving, invoking, testing, and deploying AgentFlow workflows.

:::note Source alignment
Before removing draft labels from deeper reference pages, check each command, endpoint, and option against the current `agentflow-api` CLI and router source.
:::

## Reference map

| Area | What belongs here |
| --- | --- |
| CLI commands | Project setup, local serving, playground launch, deployment, and utility commands. |
| API server configuration | Runtime settings, environment variables, app loading, and provider setup. |
| Authentication | Auth defaults, protected routes, and deployment-specific auth configuration. |
| Streaming endpoints | Event shape, lifecycle, cancellation, and client integration behavior. |
| Thread and memory endpoints | Thread creation, lookup, naming, memory reads, and memory writes. |
| Deployment commands | Packaging, environment selection, and release workflows. |
| Error responses | Response formats, status codes, and recovery guidance. |

The goal is to make backend integration predictable for teams that want to expose AgentFlow workflows as services.
