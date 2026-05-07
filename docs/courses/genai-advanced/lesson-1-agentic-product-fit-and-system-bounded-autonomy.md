---
title: "Lesson 1: Agentic Product Fit and System Boundaries"
sidebar_label: Lesson 1
description: Learn when to use deterministic workflows, single agents, or multi-agent systems. Part of the AgentFlow genai course guide for production-ready Python AI.
keywords:
  - genai course
  - ai agent course
  - agent engineering course
  - agentflow
  - python ai agent framework
  - lesson 1 agentic product fit and system boundaries
---


# Lesson 1: Agentic Product Fit and System Boundaries

## Learning Outcome

By the end of this lesson, you will be able to:
- Distinguish between workflows, single agents, and multi-agent systems
- Identify signals that justify each architecture choice
- Define system boundaries and user goals clearly

## Prerequisites

- Completed Beginner Course or equivalent
- [Design checklists](/docs/courses/shared/design-checklists.md)

---

## Concept: The Architecture Spectrum

GenAI systems exist on a spectrum from fully deterministic to fully autonomous:

```mermaid
flowchart TB
    subgraph Spectrum["Architecture Spectrum"]
        Workflow["Workflow\nDeterministic, sequential steps"]
        SingleAgent["Single Agent\nDynamic with bounded tools"]
        MultiAgent["Multi-Agent\nCoordinated autonomous agents"]
        Autonomous["Autonomous System\nFully autonomous (rare)"]
    end
    
    Workflow --> SingleAgent --> MultiAgent --> Autonomous
    
    style Workflow fill:#ccffcc
    style SingleAgent fill:#ffffcc
    style MultiAgent fill:#ffcc99
    style Autonomous fill:#ffcccc
```

### When to Use Each

| Architecture | Best For | Signs You Need It |
|--------------|----------|-------------------|
| **Workflow** | Sequential tasks, known steps | Steps are predictable |
| **Single Agent** | Dynamic paths, tool use | Steps depend on input |
| **Multi-Agent** | Multiple expertise areas | Different skills needed |
| **Autonomous** | Research, exploration | Human oversight possible |

---

## Concept: Workflow vs. Agent Decision

### Key Questions

Before reaching for an agent, ask:

```mermaid
flowchart TB
    Q1["Is the task sequential?"] --> |"Yes"| Workflow["Workflow\n(likely)"]
    Q1 --> |"No"| Q2
    
    Q2["Are tool calls needed?"] --> |"No"| SimplePrompt["Simple prompt\n(no agent)"]
    Q2 --> |"Yes"| Q3
    
    Q3["Multiple expertise areas?"] --> |"Yes"| Multi["Multi-agent"]
    Q3 --> |"No"| Single["Single agent"]
```

### Decision Matrix

| Task Characteristic | Workflow | Single Agent | Multi-Agent |
|--------------------|----------|--------------|-------------|
| **Steps known in advance** | ✅ | ⚠️ | ⚠️ |
| **Dynamic tool selection** | ❌ | ✅ | ✅ |
| **Branching logic** | ⚠️ | ✅ | ✅ |
| **Different expertise needed** | ❌ | ❌ | ✅ |
| **Parallel processing** | ❌ | ❌ | ✅ |
| **Human review needed** | ✅ | ✅ | ✅ |

---

## Concept: Signals That Justify Multi-Agent

### When Single Agent Isn't Enough

```mermaid
flowchart LR
    subgraph Signals["Multi-Agent Signals"]
        S1["Multiple domains\n(e-commerce + inventory)"]
        S2["Different LLMs\n(specialized models)"]
        S3["Context isolation\n(separate memory)"]
        S4["Parallel execution\n(concurrent tasks)"]
        S5["Role separation\n(analyst vs executor)"]
    end
```

### Real-World Triggers

| Trigger | Example | Solution |
|---------|---------|----------|
| **Tool conflict** | Same tool used differently | Separate agents with own tools |
| **Context bloat** | Too many tools for one prompt | Specialists with focused tools |
| **Latency requirements** | Slow because of all tools | Parallel specialists |
| **Domain separation** | Legal docs vs. code | Domain-specific agents |

---

## Concept: Defining System Boundaries

### What the System Decides vs. What the User Decides

```mermaid
flowchart TB
    subgraph Boundaries["System Boundaries"]
        subgraph User["User Control"]
            U1["Overall goal"]
            U2["Approval for risky actions"]
            U3["Final output acceptance"]
        end
        
        subgraph System["System Control"]
            S1["How to achieve goal"]
            S2["Which tools to use"]
            S3["When to ask for help"]
        end
    end
    
    User --> System
```

### Defining Approval Boundaries

| Action Type | Approval Required? | Why |
|-------------|-------------------|-----|
| Read data | No | Low risk |
| Generate text | No | Can be reviewed |
| Send email | ✅ Yes | Irreversible |
| Delete data | ✅ Yes | Irreversible |
| Spend money | ✅ Yes | Financial risk |

---

## Example: Architecture Decision for a Customer Support System

### Scenario

Build a customer support system that:
- Answers questions about orders
- Processes refunds
- Escalates complex issues
- Sends email confirmations

### Decision Process

```mermaid
flowchart TB
    subgraph Analysis["Requirements Analysis"]
        Q1["Is processing sequential?"]
        Q1 --> |"Mixed"| Q2
        
        Q2["Do we need different expertise?"]
        Q2 --> |"Yes"| Q3
        
        Q3["Do some actions need approval?"]
        Q3 --> |"Yes"| Decision["Multi-Agent with Human-in-Loop"]
    end
```

### Architecture: Manager + Specialists

```python
from agentflow.core.graph import StateGraph, END
from agentflow.prebuilt.agent import RouterAgent

# Manager routes to specialists
manager = RouterAgent(
    routes={
        "order_status": "order_agent",
        "refund": "refund_agent",  # Requires approval
        "escalation": "escalation_agent",
        "general": "general_agent"
    }
)

# Specialist agents
order_agent = ReactAgent(tools=[check_order_status, track_shipment])
refund_agent = ReactAgent(
    tools=[process_refund],
    require_approval=True  # Human approval required
)
escalation_agent = ReactAgent(tools=[create_ticket, send_alert])
general_agent = ReactAgent(tools=[search_kb, general_help])
```

---

## Exercise: Architecture Brief

### Your Task

For this product idea, write a one-page architecture brief:

**Product**: Automated code review assistant that:
- Reviews pull requests
- Suggests improvements
- Flags security issues
- Can request changes to code

### Brief Template

```markdown
## Architecture Brief: [Product Name]

### Problem Fit
- Workflow / Single Agent / Multi-Agent: [Choose one]
- Justification: [Why this choice over others]

### System Boundaries
- System decides: [What the system controls]
- User decides: [What users must approve]

### Agent Design
- Number of agents: [How many and why]
- Specialization: [What each agent does]

### Approval Points
- [ ] Action A: [Approval required?]
- [ ] Action B: [Approval required?]

### Why This Is NOT Just a Workflow
[1-2 sentences explaining why agent architecture is necessary]
```

### Discussion Questions

1. Would a simple workflow work for code review?
2. Do you need different agents for security vs. style?
3. When should the system request human approval?

---

## What You Learned

1. **Architecture is a spectrum** — From deterministic workflows to autonomous agents
2. **Match architecture to requirements** — Don't over-engineer
3. **Multi-agent has costs** — Only use when single agent is insufficient
4. **Define boundaries clearly** — What the system does vs. what users approve

---

## Common Failure Mode

**Jumping to multi-agent too early**

```python
# ❌ Over-engineered
manager = ManagerAgent(agents=[
    CoderAgent(), BugFixerAgent(), TesterAgent(), 
    DocumenterAgent(), DeployerAgent(), MonitorAgent()
])

# ✅ Appropriate complexity
review_agent = ReactAgent(
    tools=[check_syntax, check_style, check_security]
)
```

Start simple. Add agents only when you have clear justification.

---

## Next Step

Continue to [Lesson 2: Single-agent runtime and bounded autonomy](./lesson-2-single-agent-runtime-and-bounded-autonomy.md) to learn how to design safe, bounded agent behavior.

### Or Explore

- [StateGraph concepts](/docs/concepts/state-graph.md) — Graph-based agent design
- [Architecture concepts](/docs/concepts/architecture.md) — System architecture patterns
