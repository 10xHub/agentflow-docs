# Plan-Act-Reflect Pattern

The Plan-Act-Reflect (PAR) architecture introduces an explicit reflection phase between tool
execution rounds—separating intent formation (PLAN), execution (ACT), and interpretation
(REFLECT). This isolation enables clearer control, quality gating, and iterative reasoning.

## 🎯 Goals

- Deterministic loop structure with minimal boilerplate
- Explicit reflection step (easier to inject guardrails / evaluators)
- Supports custom routing condition or built-in heuristic
- Clean extensibility: swap planners, tools, or reflectors independently

## 🔁 Core Loop

```
PLAN --(condition)--> ACT --> REFLECT
  ^                     |
  |---------------------|
```

| Node | Responsibility |
|------|----------------|
| PLAN | Generate next thought, request tool calls (populate `tools_calls`) or finalize |
| ACT | Execute requested tool calls via `ToolNode` and append tool result messages |
| REFLECT | Analyze tool outputs, adjust confidence / metadata, prepare for next PLAN |
| Condition | Decides next edge: ACT / REFLECT / END |

## ⚙️ Routing Heuristic (Default)

If you do not supply `condition` when compiling:
- Assistant message with non-empty `tools_calls` → ACT
- Last message role == `tool` → REFLECT
- Otherwise → END

Override by passing `condition=` to `compile` for custom depth, budgets, or strategies.

## 📦 Minimal Usage

```python
from agentflow.prebuilt.agent.plan_act_reflect import PlanActReflectAgent
from agentflow.graph.tool_node import ToolNode
from agentflow.state.agent_state import AgentState
from agentflow.utils import Message


def fetch(query: str) -> str:
    return f"Result for: {query}"


tools = ToolNode([fetch])


def plan(state: AgentState) -> AgentState:
    user = next((m for m in reversed(state.context) if m.role == "user"), None)
    q = user.text() if user and hasattr(user, "text") else ""
    msg = Message.text_message(f"Planning: need data for '{q}'", role="assistant")
    msg.tools_calls = [{"id": "c1", "name": "fetch", "arguments": {"query": q}}]
    state.context.append(msg)
    return state


def reflect(state: AgentState) -> AgentState:
    state.context.append(
        Message.text_message("Reflection: tool output received.", role="assistant")
    )
    return state


agent = PlanActReflectAgent[AgentState](state=AgentState())
app = agent.compile(plan_node=plan, tool_node=tools, reflect_node=reflect)
res = app.invoke({"messages": [Message.text_message("Explain RAG.", role="user")]})
```

## 🧪 Included Examples

| File | Purpose |
|------|---------|
| `examples/plan_act_reflect/basic_plan_act_reflect.py` | Single tool round, default heuristic |
| `examples/plan_act_reflect/tool_plan_act_reflect.py` | Multi-tool loop + custom routing + confidence |

Run:
```bash
python examples/plan_act_reflect/basic_plan_act_reflect.py
python examples/plan_act_reflect/tool_plan_act_reflect.py
```

## 🛠️ Custom Condition

Use when you need:
- Iteration caps
- Confidence thresholds
- Alternate branch targets (e.g., evaluator node)

```python
from agentflow.utils.constants import END


def condition(state: AgentState) -> str:
    last = state.context[-1] if state.context else None
    if not last:
        return END
    if last.role == "assistant" and getattr(last, "tools_calls", None):
        return "ACT"
    if last.role == "tool":
        return "REFLECT"
    return END
```

Pass it:
```python
app = agent.compile(
    plan_node=plan,
    tool_node=tools,
    reflect_node=reflect,
    condition=condition,
)
```

## 🧩 Design Principles

| Aspect | Benefit |
|--------|---------|
| Explicit Reflection | Insert evaluators / guards easily |
| Tool Isolation | Swap `ToolNode` (local, MCP, Composio, LangChain) |
| Deterministic Wiring | Predictable graph edges aid debugging |
| Custom Condition | Granular termination / looping policies |

## 🧠 Reflection Strategies

Enhance `reflect` to:
- Score relevance / grounding
- Extract structured facts
- Adjust planned next tool set
- Log metrics (latency, token usage)
- Prune outdated tool outputs from context

Example augmentation:

```python
def reflect(state: AgentState) -> AgentState:
    tool_msgs = [m for m in state.context if m.role == "tool"]
    if tool_msgs:
        last_txt = tool_msgs[-1].text()
        heur_score = min(1.0, len(last_txt) / 200)
        state.context.append(
            Message.text_message(f"Reflection: confidence={heur_score:.2f}", role="assistant")
        )
    return state
```

## 🔐 Guard Rails & Evaluation

Insert checks in:
- PLAN (filter tool intents)
- REFLECT (validate tool outputs, detect anomalies)
- Custom condition (abort on policy breach)

## 🗂️ Persistence & Memory

Provide `checkpointer=` in `compile` to persist intermediate states or resume after interruption:

```python
from agentflow.checkpointer import InMemoryCheckpointer

app = agent.compile(
    plan_node=plan,
    tool_node=tools,
    reflect_node=reflect,
    checkpointer=InMemoryCheckpointer(),
)
```

Integrate retrieval memory (e.g., `QdrantStore`, `Mem0Store`) before PLAN to hydrate context.

## 🔄 Comparison: ReAct vs Plan-Act-Reflect

| Dimension | ReAct | Plan-Act-Reflect |
|-----------|-------|------------------|
| Reflection | Implicit | Explicit node |
| Tool Request Emission | Interleaved with reasoning | Isolated in PLAN |
| Control Hooks | Fewer points | PLAN + REFLECT + condition |
| Evaluation Injection | Harder | Straightforward |

Use PAR when you need structured cycles and instrumentation.

## 🧪 Testing Tips

- Assert node ordering via emitted messages
- Inject deterministic tools (pure functions)
- Simulate multiple PLAN iterations by keeping `tools_calls` populated
- Unit test custom `condition` separately

## 🚀 Extending

Add:
- A `JUDGE` node after REFLECT for quality gating
- A summarizer to compress context every N turns
- A cost budget tracker in condition (end when exceeded)
- Parallel tool execution by generating multiple tool calls (ToolNode handles each)

## 🧷 API Summary

```python
PlanActReflectAgent.compile(
    plan_node,          # callable | (callable, "PLAN_NAME")
    tool_node,          # ToolNode | (ToolNode, "ACT_NAME")
    reflect_node,       # callable | (callable, "REFLECT_NAME")
    condition=None,     # custom decision fn (state -> str) or default heuristic
    checkpointer=None,
    store=None,
    interrupt_before=None,
    interrupt_after=None,
    callback_manager=CallbackManager(),
) -> CompiledGraph
```

Condition must return one of: tool node name, reflect node name, `END`.

## 🧭 Next Steps

- Explore ReAct: `docs/Tutorial/react/`
- Add retrieval: see `rag.md`
- Introduce memory: `long_term_memory.md`
- Register additional tools (MCP / Composio) for richer ACT phase

---

Focused iteration, explicit reasoning, and controllable routing—Plan-Act-Reflect is a strong base for auditable agent behaviors.