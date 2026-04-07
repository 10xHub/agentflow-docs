---
title: Your First Agent
description: Build and run a small AgentFlow workflow.
---

# Your first agent

:::note Draft
This page is a sprint-0 placeholder. The sample uses current import paths, but the final tutorial still needs full command-level validation.
:::

This page starts with the simplest useful mental model:

1. A workflow owns the execution path.
2. An agent is a node in that workflow.
3. Messages are part of the workflow state.
4. The compiled app runs the workflow.

```python
from agentflow.core.graph import Agent, StateGraph
from agentflow.core.state import AgentState, Message
from agentflow.utils import END

workflow = StateGraph(state_schema=AgentState)

assistant = Agent(
    model="openai/gpt-4o",
    system_prompt="You are a concise assistant for product engineering teams.",
)

workflow.add_node("assistant", assistant)
workflow.set_entry_point("assistant")
workflow.add_edge("assistant", END)

app = workflow.compile()

result = app.invoke({
    "messages": [
        Message.text_message("Explain AgentFlow in one paragraph.", "user")
    ]
})

print(result["messages"][-1].content)
```

## What happened

The workflow creates a predictable execution boundary. Instead of calling a model directly from scattered application code, you register a node, define the start point, define where the workflow ends, then compile it into an app you can invoke.

## What comes next

After this works, the next beginner docs should add:

1. A Python tool.
2. A state update.
3. A second agent.
4. A checkpoint.
5. API streaming.
6. TypeScript client integration.
