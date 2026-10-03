---
title: Getting help — AgentFlow project
sidebar_label: Support
description: Where to ask questions, how to file a good bug report for AgentFlow, and what information to collect before you do.
keywords:
  - agentflow support
  - agentflow help
  - report a bug
  - agentflow issues
  - agentflow community
---

# Getting help

## Start here

Most problems have a page already:

| Symptom | Page |
| --- | --- |
| `pip install` fails, wrong Python version, `agentflow` not found | [Installation troubleshooting](../troubleshooting/installation.md) |
| Server will not start, 401/403, CORS, rate limits | [API server troubleshooting](../troubleshooting/api-server.md) |
| Streaming stalls, types missing, upload fails | [Client troubleshooting](../troubleshooting/client.md) |
| Playground shows nothing, or a page is empty | [Playground troubleshooting](../troubleshooting/playground.md) |
| You have an error code like `GRAPH_ROUTING_001` | [Error codes](../troubleshooting/error-codes.md) |
| Something worked in 0.9 and broke after upgrading | [Upgrade to 1.0](upgrade-to-1.0.md) |

Search covers every page on this site. Press <kbd>Ctrl</kbd> + <kbd>K</kbd>.

## Ask a question

- **GitHub Discussions** on [10xHub/Agentflow](https://github.com/10xHub/Agentflow/discussions)
  for usage questions, design questions, and "is this the right approach"
  conversations.
- **GitHub Issues** on the repository for the package that misbehaves:
  the core library, the CLI and API server, or the TypeScript client.

For a security problem, do not use either. Follow the
[security policy](security.md).

## File a good bug report

A report that includes the following usually gets a fix in one round trip
instead of three.

```bash
# Versions of everything involved
agentflow version
python --version
pip show 10xscale-agentflow 10xscale-agentflow-cli | grep -E "Name|Version"
node --version && npm list @10xscale/agentflow-client
```

Then include:

1. **What you expected and what happened.** The full traceback or the failing
   HTTP response body, not a paraphrase.
2. **A minimal graph that reproduces it.** Strip the tools and prompts down to
   the smallest thing that still fails. Most bugs shrink to 20 lines.
3. **Your configuration.** The relevant part of `agentflow.json`, which
   checkpointer and store you use, and whether you run with `MODE=production`.
   Redact secrets.
4. **Whether it reproduces without persistence.** Swapping `PgCheckpointer` for
   `InMemoryCheckpointer` separates a storage problem from a graph problem
   immediately.

If the run is long, enable structured logging and attach the records for the
failing run. They carry `run_id`, `thread_id`, and `node`, so a single run can be
extracted from a busy log:

```python
from agentflow.utils.logging import setup_structured_logging

setup_structured_logging()
```

## Commercial support

AgentFlow is built and maintained by [10xScale](https://10xscale.ai). For
commercial support, architecture review, or production onboarding, contact
[contact@10xscale.ai](mailto:contact@10xscale.ai).

## Contributing a fix

Found the bug and know the fix? See [contributing](contributing.md).
