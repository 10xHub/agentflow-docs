# Thread Name Generator

AgentFlow can optionally generate user-friendly thread names for new conversation threads. This is useful for readability in dashboards, logs, and any UI that surfaces thread history.

## What it does

The thread name generator produces a short human-readable label such as `thoughtful-dialogue`, `exploring-ideas`, or `bright-spark`. When configured, the API server calls it when a new thread is created and stores the returned name alongside the thread metadata.

## Built-in generator

AgentFlow ships with a built-in generator in `agentflow_cli/src/app/utils/thread_name_generator.py`.

The built-in generator supports three name patterns:

- `simple` — adjective + noun, for example `creative-exploration` or `methodical-journey`.
- `action` — verb + target, for example `building-connections` or `discovering-insights`.
- `compound` — modifier + noun, for example `deep-dive` or `bright-spark`.

The default implementation uses `secrets.choice` to select words, making the names unpredictable and varied.

## Configuring a custom generator

In `agentflow.json`, set the `thread_name_generator` field to a module path in `module:attribute` format.

Example:

```json
{
  "thread_name_generator": "graph.thread_name_generator:MyNameGenerator"
}
```

The loader accepts either:

- a class that subclasses `ThreadNameGenerator`, or
- an already-created instance.

## Custom generator interface

The custom generator must implement the deprecated `ThreadNameGenerator` abstract interface:

```python
from agentflow_cli.src.app.utils.thread_name_generator import ThreadNameGenerator

class MyNameGenerator(ThreadNameGenerator):
    async def generate_name(self, messages: list[str]) -> str:
        # Use message history or an external LLM to derive a name.
        return "custom-thread-name"

my_thread_name_generator = MyNameGenerator()
```

The loader will instantiate the class if a class object is provided, or use the instance directly if one is supplied.

## When to use it

Use a thread name generator when you want:

- easier debugging of conversation threads
- friendlier thread labels in a UI
- better traceability in logs and audit records

If not configured, AgentFlow will still create threads, but they may be identified only by raw IDs rather than readable labels.
