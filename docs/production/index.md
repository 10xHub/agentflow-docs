---
title: Production
description: Production guidance for operating AgentFlow apps.
slug: /production
---

# Production

:::note Draft
This page is currently hidden from the sprint-0 sidebar and will be folded into later how-to and concept work.
:::

Production docs should help teams move from a working demo to a maintainable service.

## Production checklist

1. Define workflow boundaries.
2. Use stable state schemas.
3. Configure checkpointing and storage.
4. Add structured logging and callbacks.
5. Validate tool inputs and outputs.
6. Add retry and failure handling.
7. Test important trajectories.
8. Expose a stable API contract.
9. Connect application surfaces through the documented client.
10. Deploy with environment-specific configuration.

## Documentation goal

Every production page should describe the operational tradeoff, show the recommended default, and explain when to choose a different option.
