---
title: Production
description: Production guidance for operating AgentFlow apps.
slug: /production
---

# Production

Production docs should help teams move from a working demo to a maintainable service.

:::tip Production mindset
Treat the workflow as application code: define clear boundaries, persist the right state, observe failures, and keep the API contract stable.
:::

## Production checklist

| Area | Checklist |
| --- | --- |
| Workflow design | Define workflow boundaries and keep state schemas stable. |
| Persistence | Configure checkpointing and storage for recoverable threads. |
| Observability | Add structured logging, callbacks, and useful error reporting. |
| Tool safety | Validate tool inputs and outputs before they affect application state. |
| Reliability | Add retry and failure handling where external systems are involved. |
| Evaluation | Test important trajectories before release. |
| API contract | Expose stable request, response, streaming, thread, and memory behavior. |
| Frontend integration | Connect application surfaces through the documented client. |
| Deployment | Use environment-specific configuration for provider keys, storage, and runtime settings. |

## Documentation goal

Every production page should describe the operational tradeoff, show the recommended default, and explain when to choose a different option.
