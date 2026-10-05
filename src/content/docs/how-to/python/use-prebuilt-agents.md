---
title: How to use prebuilt agents
description: Guide to ReactAgent, PlanActReflectAgent, StructuredOutputAgent, SupervisorTeamAgent, SwarmAgent, and RAGAgent as compiled graph factories.
section: How-to guides
group: Python library
order: 600
label: Prebuilt agents
updated: "2026-05-23"
---

10xGraph ships six prebuilt agent classes that wrap a fully wired `StateGraph` behind a single `compile()` call. Each class exposes the same surface as a raw `StateGraph`: you get a `CompiledGraph` you can `invoke()` or `astream()`.

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

A supervisor LLM routes tasks to specialist worker agents. Each worker is a pre-built agent (usually an `Agent`) that you configure yourself, so every worker can have its own model, tools and prompt.

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.core.state import Message
from agentflow.prebuilt.agent import SupervisorTeamAgent, WorkerConfig


def lookup_order(order_id: str) -> str:
    """Look up the status of a customer order."""
    return f"Order {order_id}: shipped, delivered 2026-09-30."


def refund_order(order_id: str, amount: float) -> str:
    """Refund an order."""
    return f"Refunded {amount} for order {order_id}."


agent = SupervisorTeamAgent(
    supervisor_model="gpt-4o",
    provider="openai",                  # forwarded to the supervisor Agent only
    workers={
        "ORDERS": WorkerConfig(
            agent=Agent(
                model="gpt-4o-mini",
                provider="openai",
                tool_node=ToolNode([lookup_order]),
                system_prompt=[{"role": "system", "content": "Answer order status questions."}],
            ),
            description="Looks up order status and delivery details.",
        ),
        "REFUNDS": WorkerConfig(
            agent=Agent(
                model="gpt-4o",
                provider="openai",
                tool_node=ToolNode([refund_order]),
                system_prompt=[{"role": "system", "content": "Issue refunds when asked."}],
            ),
            description="Issues refunds for orders.",
        ),
    },
    supervisor_system_prompt=None,      # None builds the prompt from the worker descriptions
    max_rounds=10,
)

app = agent.compile()
result = app.invoke(
    {"messages": [Message.text_message("Order A-1042 arrived damaged. Refund 25.00.")]},
    config={"thread_id": "supervisor-1"},
)
```

### Constructor and WorkerConfig

```python
SupervisorTeamAgent(
    supervisor_model: str,
    workers: dict[str, WorkerConfig],   # worker name -> config
    supervisor_system_prompt: list[dict] | None = None,
    max_rounds: int = 10,
    state=None, context_manager=None, publisher=None, id_generator=..., container=None,
    **supervisor_kwargs,                # forwarded to the supervisor Agent (provider, temperature, ...)
)

WorkerConfig(
    agent: BaseAgent,                   # a fully configured Agent
    description: str = "",              # injected into the supervisor prompt to aid routing
)
```

`SUPERVISOR` is a reserved worker name. See [SupervisorTeamAgent](/docs/prebuild/agents/supervisor-team-agent) for the graph layout.

---

## SwarmAgent

Agents hand off directly to each other. There is no central supervisor: each member decides who handles the task next. Handoff tools are injected automatically, so do not add them to a member's `ToolNode`.

```python
from agentflow.prebuilt.agent import SwarmAgent, SwarmMemberConfig

triage = Agent(model="gpt-4o-mini", provider="openai",
               system_prompt=[{"role": "system", "content": "Route the request to a specialist."}])
orders = Agent(model="gpt-4o", provider="openai", tool_node=ToolNode([lookup_order]),
               system_prompt=[{"role": "system", "content": "Answer order questions."}])
refunds = Agent(model="gpt-4o", provider="openai", tool_node=ToolNode([refund_order]),
                system_prompt=[{"role": "system", "content": "Handle refunds."}])

swarm = SwarmAgent(
    members={
        "TRIAGE": SwarmMemberConfig(
            agent=triage,
            can_handoff_to=["ORDERS", "REFUNDS"],
            description="Classifies requests and routes them to the right specialist.",
        ),
        "ORDERS": SwarmMemberConfig(
            agent=orders,
            can_handoff_to=["REFUNDS"],
            description="Handles order status questions.",
        ),
        "REFUNDS": SwarmMemberConfig(
            agent=refunds,
            can_handoff_to=[],           # terminal: no handoffs out
            description="Issues refunds.",
        ),
    },
    entry="TRIAGE",                      # member that receives the first message
)

app = swarm.compile()
result = app.invoke(
    {"messages": [Message.text_message("Where is order A-1042?")]},
    config={"thread_id": "swarm-1"},
)
```

### SwarmMemberConfig fields

```python
SwarmMemberConfig(
    agent: BaseAgent,
    can_handoff_to: list[str] | None = None,   # None = may hand off to every other member
    description: str = "",                     # shown to other members' handoff tools
)
```

See [SwarmAgent](/docs/prebuild/agents/swarm-agent) for details.

---

## RAGAgent

A retrieval-augmented generation agent. It retrieves documents from a store before the LLM call, optionally reranks them, and passes them to the wrapped agent as context.

```python
from agentflow.core.graph import Agent
from agentflow.core.state import Message
from agentflow.prebuilt.agent import RAGAgent
from agentflow.storage import create_local_qdrant_store
from agentflow.storage.store.embedding import OpenAIEmbedding

store = create_local_qdrant_store(
    path="./knowledge_base",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

rag = RAGAgent(
    store=store,
    agent=Agent(
        model="gpt-4o-mini",
        provider="openai",
        system_prompt=[{
            "role": "system",
            "content": "Answer using only the provided context. If it is missing, say so.",
        }],
    ),
    top_k=5,                            # candidates retrieved from the store
)

app = rag.compile()
result = app.invoke(
    {"messages": [Message.text_message("What is the refund policy?")]},
    config={"thread_id": "rag-1"},
)
```

Full signature:

```python
RAGAgent(
    store: BaseStore,
    agent: BaseAgent,
    reranker: BaseReranker | None = None,
    top_k: int = 5,
    top_n: int = 3,                     # kept after reranking
    retrieval_strategy: RetrievalStrategy = RetrievalStrategy.SIMILARITY,
    score_threshold: float | None = None,
    store_config: dict | None = None,   # extra kwargs for every store.asearch call
    state=None, context_manager=None, publisher=None, id_generator=..., container=None,
)
```

Add a reranker (`CohereReranker`, `CrossEncoderReranker`, or your own `BaseReranker`) to rerank retrieved chunks:

```python
from agentflow.prebuilt.agent import CohereReranker

rag = RAGAgent(
    store=store,
    agent=Agent(model="gpt-4o-mini", provider="openai"),
    reranker=CohereReranker(api_key="your-cohere-key"),
    top_k=20,
    top_n=5,
)
```

See [RAGAgent](/docs/prebuild/agents/rag-agent) for where the answer is read from and the full node layout.

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

- `ReactAgent` is the standard tool-calling loop. Use it for most tasks.
- `PlanActReflectAgent` adds planning and self-reflection for complex multi-step tasks.
- `StructuredOutputAgent` forces JSON output conforming to a Pydantic schema.
- `SupervisorTeamAgent` routes tasks from a central supervisor to specialist workers.
- `SwarmAgent` routes tasks peer-to-peer without a central supervisor.
- `RAGAgent` retrieves relevant context from a vector store before each LLM call.

## Next steps

- [Use prebuilt tools](/docs/how-to/python/use-prebuilt-tools) for web fetch, file operations, and search.
- [Build a graph](/docs/how-to/python/build-a-graph) for custom workflows beyond the prebuilt patterns.
