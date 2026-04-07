---
title: Troubleshooting
description: Draft troubleshooting entry point for common AgentFlow docs and runtime issues.
slug: /troubleshooting
---

# Troubleshooting

Troubleshooting pages help you recover quickly when a command, import, model call, API request, or playground connection does not work as expected.

:::tip Start with the basics
Most local issues come from the active Python environment, package path, provider key, or running the API from the wrong package directory.
:::

## First checks

| Check | What to confirm |
| --- | --- |
| Python environment | Activate the repository virtual environment before running local Python examples. |
| Package directory | Run package-specific commands from the package you are changing. |
| Import paths | Use the current `agentflow` import paths shown in the tutorial you are following. |
| Provider keys | Confirm the model provider key is exported in the shell running the workflow or API. |
| API server | Start the serving layer before connecting the playground or TypeScript client. |
| Playground | Prefer the hosted playground flow opened by `agentflow play` when testing local APIs. |
| Storage | Check checkpointer and store configuration before debugging agent behavior. |

## Common recovery commands

```bash
source /Users/shudipto/Projects/agentflow/.venv/bin/activate
cd /Users/shudipto/Projects/agentflow/agentflow
```

If a command still fails, move to the guide that matches the failure area instead of changing multiple settings at once.
