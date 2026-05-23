---
title: How to use prebuilt agents
sidebar_label: Prebuilt agents
description: Guide to ReactAgent, PlanActReflectAgent, StructuredOutputAgent, SupervisorTeamAgent, SwarmAgent, and RAGAgent — drop-in compiled graph factories.
keywords:
  - agentflow prebuilt agents
  - react agent
  - supervisor agent
  - swarm agent
  - rag agent
  - plan act reflect
  - agentflow
sidebar_position: 8
---

# How to use prebuilt agents

AgentFlow ships six prebuilt agent classes that wrap a fully wired `StateGraph` behind a single `compile()` call. Each class exposes the same surface as a raw `StateGraph`: you get a `CompiledGraph` you can `invoke()` or `astream()`.

```python
from agentflow.prebuilt.agent import (
    ReactAgent,
    PlanActReflectAgent,
    StructuredOutputAgent,
    SupervisorTeamAgent,
    SwarmAgent,
    RAGAgent,
)
```

---

## ReactAgent

The most common pattern: an LLM agent that can call tools in a loop until it has enough information to answer.

```python
from agentflow.prebuilt.agent import ReactAgent
from agentflow.prebuilt.tools import fetch_url, safe_calculator

agent = ReactAgent(
    model="gpt-4o",
    tools=[fetch_url, safe_calculator],
    system_prompt=[{"role": "system", "content": "You are a research assistant."}],
)

app = agent.compile()
result = app.invoke(
    {"messages": [Message.text_message("What is 1234 * 5678?")]},
    config={"thread_id": "react-1"},
)
print(result["messages"][-1].content)
```

### ReactAgent constructor

```python
ReactAgent(
    model: str,
    state: StateT | None = None,               # custom AgentState subclass
    context_manager: BaseContextManager | None = None,
    publisher: BasePublisher | None = None,
    id_generator: BaseIDGenerator = DefaultIDGenerator(),
    container: InjectQ | None = None,
    *,
    output_type: str = "text",
    system_prompt: list[dict] | None = None,
    tools: Iterable[Callable] | None = None,
    client: Any = None,                        # FastMCP client for MCP tools
    pass_user_info_to_mcp: bool = False,
    extra_messages: list[Message] | None = None,
    trim_context: bool = False,
    tools_tags: set[str] | None = None,
    reasoning_config: dict | bool | None = True,
    skills: SkillConfig | None = None,
    memory: MemoryConfig | None = None,
    retry_config: RetryConfig | bool = True,
    fallback_models: list[str | tuple[str, str]] | None = None,
    multimodal_config: MultimodalConfig | None = None,
    output_schema: type[BaseModel] | None = None,
    main_node_name: str = "MAIN",
    tool_node_name: str = "TOOL",
    **agent_kwargs,
)
```

`ReactAgent.compile()` accepts the same arguments as `StateGraph.compile()`: `checkpointer`, `store`, `interrupt_before`, `interrupt_after`, `callback_manager`, `media_store`, `shutdown_timeout`.

### ReactAgent with MCP

```python
from fastmcp import Client

mcp_client = Client("path/to/mcp/server")

agent = ReactAgent(
    model="gpt-4o",
    tools=[],
    client=mcp_client,
    pass_user_info_to_mcp=True,   # forward config["user"] to MCP metadata
)
app = agent.compile()
```

---

## PlanActReflectAgent

Breaks complex tasks into a Plan → Act → Reflect loop. The planner creates a step-by-step plan; the actor executes each step using tools; the reflector evaluates success and decides whether to replan.

```python
from agentflow.prebuilt.agent import PlanActReflectAgent
from agentflow.prebuilt.tools import fetch_url, google_web_search

agent = PlanActReflectAgent(
    model="gpt-4o",
    tools=[fetch_url, google_web_search],
    system_prompt=[{"role": "system", "content": "You are a thorough research agent."}],
)

app = agent.compile()
result = app.invoke(
    {"messages": [Message.text_message("Research the top 3 Python web frameworks and compare them.")]},
    config={"thread_id": "par-1"},
)
```

Good for tasks that require multi-step reasoning and self-correction.

---

## StructuredOutputAgent

Guarantees the response is a JSON object matching a Pydantic schema. Useful for data extraction, classification, and form filling.

```python
from pydantic import BaseModel
from agentflow.prebuilt.agent import StructuredOutputAgent

class ProductReview(BaseModel):
    sentiment: str       # "positive" | "negative" | "neutral"
    score: float         # 0.0 – 5.0
    summary: str
    key_points: list[str]

agent = StructuredOutputAgent(
    model="gpt-4o",
    output_schema=ProductReview,
    system_prompt=[{"role": "system", "content": "Extract structured product review data."}],
)

app = agent.compile()
result = app.invoke(
    {"messages": [Message.text_message("This laptop is amazing! Fast, light, great battery. 5 stars.")]},
    config={"thread_id": "struct-1"},
)
print(result["messages"][-1].content)  # JSON string conforming to ProductReview
```

---

## SupervisorTeamAgent

A supervisor LLM routes tasks to specialist worker agents. Each worker is a full `ReactAgent` with its own model and tools.

```python
from agentflow.prebuilt.agent import SupervisorTeamAgent, WorkerConfig

agent = SupervisorTeamAgent(
    model="gpt-4o",                   # supervisor model
    workers=[
        WorkerConfig(
            name="researcher",
            model="gpt-4o-mini",
            tools=[fetch_url, google_web_search],
            description="Searches the web and fetches URLs for information.",
        ),
        WorkerConfig(
            name="analyst",
            model="gpt-4o",
            tools=[safe_calculator],
            description="Performs calculations and data analysis.",
        ),
    ],
    system_prompt=[{
        "role": "system",
        "content": "You are a supervisor. Delegate tasks to the right specialist.",
    }],
)

app = agent.compile()
result = app.invoke(
    {"messages": [Message.text_message("Research the latest AI chip prices and calculate the total cost for 100 units.")]},
    config={"thread_id": "supervisor-1"},
)
```

### WorkerConfig fields

```python
WorkerConfig(
    name: str,                          # worker node name
    model: str,                         # model for this worker
    tools: list[Callable] = [],
    description: str = "",              # shown to the supervisor to aid routing
    system_prompt: list[dict] | None = None,
    **agent_kwargs,                     # any other Agent constructor kwargs
)
```

---

## SwarmAgent

Agents hand off directly to each other based on their own routing logic. No central supervisor — each member decides who handles the task next.

```python
from agentflow.prebuilt.agent import SwarmAgent, SwarmMemberConfig

agent = SwarmAgent(
    members=[
        SwarmMemberConfig(
            name="triage",
            model="gpt-4o-mini",
            description="Classifies requests and routes them to the right specialist.",
        ),
        SwarmMemberConfig(
            name="billing",
            model="gpt-4o",
            tools=[],
            description="Handles billing and payment questions.",
        ),
        SwarmMemberConfig(
            name="technical",
            model="gpt-4o",
            tools=[fetch_url],
            description="Handles technical support and troubleshooting.",
        ),
    ],
    entry_member="triage",             # which member receives the first message
)

app = agent.compile()
result = app.invoke(
    {"messages": [Message.text_message("My payment failed last Tuesday.")]},
    config={"thread_id": "swarm-1"},
)
```

### SwarmMemberConfig fields

```python
SwarmMemberConfig(
    name: str,
    model: str,
    description: str = "",
    tools: list[Callable] = [],
    system_prompt: list[dict] | None = None,
    **agent_kwargs,
)
```

---

## RAGAgent

A retrieval-augmented generation agent. Retrieves relevant documents from a store before each LLM call and includes them in the context.

```python
from agentflow.prebuilt.agent import RAGAgent
from agentflow.storage.store import create_local_qdrant_store, OpenAIEmbedding

store = create_local_qdrant_store("./docs_qdrant", OpenAIEmbedding())

agent = RAGAgent(
    model="gpt-4o",
    store=store,
    system_prompt=[{
        "role": "system",
        "content": "Answer questions using the provided document context.",
    }],
)

app = agent.compile()
result = app.invoke(
    {"messages": [Message.text_message("What is the return policy?")]},
    config={"thread_id": "rag-1"},
)
print(result["messages"][-1].content)
```

`RAGAgent` also accepts `BaseReranker` implementations (`CohereReranker`, `CrossEncoderReranker`) for reranking retrieved chunks before passing them to the LLM.

```python
from agentflow.prebuilt.agent import RAGAgent, CohereReranker

agent = RAGAgent(
    model="gpt-4o",
    store=store,
    reranker=CohereReranker(api_key="your-cohere-key"),
)
```

---

## Compile options (all prebuilt agents)

All prebuilt agents expose the same `compile()` signature:

```python
app = agent.compile(
    checkpointer=None,          # BaseCheckpointer for state persistence
    store=None,                 # BaseStore for memory
    interrupt_before=[],        # pause before these nodes
    interrupt_after=[],         # pause after these nodes
    callback_manager=CallbackManager(),
    media_store=None,           # BaseMediaStore for multimodal content
    shutdown_timeout=30.0,
)
```

---

## What you learned

- `ReactAgent` is the standard tool-calling loop — use it for most tasks.
- `PlanActReflectAgent` adds planning and self-reflection for complex multi-step tasks.
- `StructuredOutputAgent` forces JSON output conforming to a Pydantic schema.
- `SupervisorTeamAgent` routes tasks from a central supervisor to specialist workers.
- `SwarmAgent` routes tasks peer-to-peer without a central supervisor.
- `RAGAgent` retrieves relevant context from a vector store before each LLM call.

## Next steps

- [Use prebuilt tools](use-prebuilt-tools.md) for web fetch, file operations, and search.
- [Build a graph](build-a-graph.md) for custom workflows beyond the prebuilt patterns.
