---
title: Beginner Path
description: A draft learning path for new AgentFlow developers.
slug: /beginner
---

# Beginner path

The beginner path teaches AgentFlow one concept at a time. It starts with a single Python agent, then expands into tools, state, memory, the API runtime, the hosted playground opened by `agentflow play`, and a TypeScript client call.

:::tip Start small
You do not need the full architecture before you run the first workflow. Build one working agent first, then add one production concern at a time.
:::

## Learning track

| Step | Focus | What changes in the app |
| --- | --- | --- |
| 1 | Mental model | Learn workflow, agent, state, and message boundaries. |
| 2 | Your first agent | Compile and invoke a single-node workflow. |
| 3 | Add a tool | Let the agent safely call application logic. |
| 4 | Add memory | Preserve useful context with checkpointing and storage. |
| 5 | Run with the API | Expose the workflow through the serving layer. |
| 6 | Test in the playground | Use `agentflow play` to inspect requests and responses. |
| 7 | Call from TypeScript | Connect a frontend or full-stack application surface. |

## How to read this path

Each beginner page should include a working example, expected output, a short "What you learned" section, and one recommended next step.

If a page introduces a new production concept, it should explain why it matters before showing configuration. That keeps the path approachable for developers who are building their first serious agent app.

## Next step

Start with [Your First Agent](../get-started/first-agent.md), then return here when you are ready to add tools and memory.
