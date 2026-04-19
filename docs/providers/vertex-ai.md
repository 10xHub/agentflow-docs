---
title: Vertex AI
description: Run Gemini models through Google Cloud Vertex AI with IAM-scoped credentials.
sidebar_position: 4
---

# Vertex AI

Run the same Gemini models as the [Google](./google.md) provider, but through Google Cloud Vertex AI. Instead of an API key, Vertex AI authenticates via Application Default Credentials — so you get IAM, audit logs, regional data residency, and VPC Service Controls.

## When to use Vertex AI

Choose `provider="vertex_ai"` when:

- You're deploying on Google Cloud and want to reuse the workload's service account.
- You need regional data residency (EU, Asia, etc.) for compliance.
- You want per-user / per-service IAM permissions instead of a shared API key.
- You need GCP audit logging or VPC Service Controls.

For local prototyping, the [Google](./google.md) provider with a simple API key is usually easier.

## Setup

1. Install the Google GenAI SDK:

    ```bash
    pip install google-genai
    ```

2. Enable the **Vertex AI API** on your GCP project.

3. Create a service account with the `roles/aiplatform.user` role and download its JSON key.

4. Export the required environment variables:

    ```bash
    export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
    export GOOGLE_CLOUD_LOCATION="us-central1"           # optional
    export GOOGLE_APPLICATION_CREDENTIALS="./service_account.json"
    ```

   On GCP runtimes (Cloud Run, GKE, Compute Engine, etc.) the attached service account is picked up automatically — you only need `GOOGLE_CLOUD_PROJECT`.

## Basic usage

```python
from agentflow.core.graph import Agent

agent = Agent(
    model="gemini-2.5-flash",
    provider="vertex_ai",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
)
```

:::note Explicit provider required
`vertex_ai` is never inferred from the model name, because Gemini models are shared with the `google` provider. You must pass `provider="vertex_ai"` explicitly.
:::

## Full example with tools

```python
from dotenv import load_dotenv

from agentflow.core import Agent, StateGraph, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.utils.constants import END

load_dotenv()


def get_weather(location: str) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny"


tool_node = ToolNode([get_weather])

agent = Agent(
    model="gemini-2.5-flash",
    provider="vertex_ai",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    trim_context=True,
    reasoning_config=True,
    tool_node=tool_node,
)


def should_use_tools(state: AgentState) -> str:
    last = state.context[-1] if state.context else None
    if last and getattr(last, "tools_calls", None) and last.role == "assistant":
        return "TOOL"
    if last and last.role == "tool":
        return "MAIN"
    return END


graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=InMemoryCheckpointer())

if __name__ == "__main__":
    inp = {"messages": [Message.text_message("What is the weather in New York City?")]}
    res = app.invoke(inp, config={"thread_id": "demo", "recursion_limit": 10})
    for msg in res["messages"]:
        print(f"[{msg.role}] {msg}")
```

Notice this is identical to the [Google provider example](./google.md#full-example-with-tools) except for `provider="vertex_ai"`. Every other AgentFlow feature — tools, streaming, reasoning, multimodal — works the same way.

## Environment variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | — | yes | GCP project ID with the Vertex AI API enabled |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` | no | Region to run Vertex AI calls in |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | no* | Path to a service-account JSON key |

\* Not required on GCP workloads that have a service account attached at the runtime level.

## Switching from Google to Vertex AI

Because both providers use the same underlying SDK and model names, migrating is a single line change:

```diff
  agent = Agent(
      model="gemini-2.5-flash",
-     provider="google",
+     provider="vertex_ai",
      system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
  )
```

Make sure your environment has `GOOGLE_CLOUD_PROJECT` set and credentials available. That's it — the rest of your graph doesn't change.

## Common errors

| Error | Fix |
|---|---|
| `ValueError: GOOGLE_CLOUD_PROJECT environment variable must be set` | Export `GOOGLE_CLOUD_PROJECT` before creating the agent |
| `ImportError: google-genai SDK is required` | `pip install google-genai` |
| `PermissionDenied: Vertex AI API has not been used` | Enable the Vertex AI API on your GCP project |
| `403: caller does not have permission` | Grant the service account the `roles/aiplatform.user` role |
