# Core Concepts - The 5 Things You Need to Know

This page explains the essential concepts. **That's it** - just 5 things. Don't worry about advanced topics yet.

---

## 1. Agent 🤖

**What it is**: A wrapper around an LLM that understands your instructions.

**In simple terms**: Think of it as a virtual assistant that uses ChatGPT/Claude/Gemini brain.

```python
agent = Agent(
    model="openai/gpt-4o",
    system_prompt="You are a helpful assistant."
)
```

**What it does**:
- Takes a question or instruction
- Sends it to an LLM
- Gets a response back
- Returns it to you

That's it. Don't overthink it.

---

## 2. StateGraph 📊

**What it is**: The workflow that orchestrates everything.

**In simple terms**: The director that says "do this, then do that, then stop."

```python
workflow = StateGraph(state_schema=AgentState)
```

**What it does**:
- Holds all your processing steps (nodes)
- Defines the flow between them
- Decides when to stop

**Analogy**: Like a recipe that says:
1. First, run the agent
2. Then, stop

---

## 3. AgentState 💾

**What it is**: The data that flows through your workflow.

**In simple terms**: The envelope passing data between steps.

```python
from agentflow.state import AgentState, Message

state = {
    "messages": [Message.text_message("Hello!", "user")]
}
```

**What it contains**:
- `messages`: List of all messages (user input, agent responses)
- Each message has: content, role (user/assistant), and metadata

**Analogy**: Like the clipboard that follows your request through the office.

---

## 4. Message 📨

**What it is**: A single piece of communication.

**In simple terms**: An email/text in your conversation.

```python
# User message
msg1 = Message.text_message("Hello!", "user")

# Agent message  
msg2 = Message.text_message("Hi there!", "assistant")
```

**Every message has**:
- `content`: What was said (`"Hello!"`)
- `role`: Who said it (`"user"` or `"assistant"`)
- `timestamp`: When it was sent

---

## 5. Node 🔲

**What it is**: A single processing step in your workflow.

**In simple terms**: One task in your workflow.

```python
workflow.add_node("agent", agent)  # This is a node
```

**A node can be**:
- An Agent (thinks and responds)
- A Function (does something specific)
- A Tool Call (takes an action)

**In Hello World**, we had just 1 node: the agent.

---

## How They Work Together

Imagine you want to make dinner:

```
You (User) 
    ↓ (send message)
StateGraph (workflow recipe)
    ↓
Agent Node (think about what to do)
    ↓
Response back to you
```

In code:
```python
# 1. Create the workflow
workflow = StateGraph(state_schema=AgentState)

# 2. Add agents/nodes
workflow.add_node("agent", agent)

# 3. Define the flow
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

# 4. Compile
app = workflow.compile()

# 5. Run with messages
result = app.invoke({
    "messages": [Message.text_message("Your question", "user")]
})

# 6. Get response
print(result["messages"][-1].content)
```

---

## You Already Know Everything You Need

Look back at your Hello World code. You used:
- **Agent** ✅ (you created one)
- **StateGraph** ✅ (you created the workflow)
- **AgentState** ✅ (you passed messages)
- **Message** ✅ (you created user messages)
- **Node** ✅ (the agent is a node)

**You already understand the core concepts!**

---

## What's Next?

You can now:
- Add more nodes (more complex workflows)
- Add tools (agents can take actions)
- Add memory (agents remember conversations)
- Add multiple agents (teamwork!)

But those are **next steps**. You don't need them yet.

---

## Things You DON'T Need to Know Yet ❌

These are advanced - skip them for now:

- **Checkpointers**: (Advanced) Saving state to databases
- **Embedding**: (Advanced) Converting text to numbers
- **MAGI/MCP**: (Advanced) Special tool protocols
- **Async patterns**: (Advanced) Running things in parallel
- **Custom memory stores**: (Advanced) Persistent storage

You'll learn these when you need them.

---

## Quick Reference

| Concept | What is it? | When you use it |
|---------|-----------|-----------------|
| **Agent** | LLM wrapper | Always (the brain) |
| **StateGraph** | Workflow | Always (the structure) |
| **AgentState** | Data container | Always (passes messages) |
| **Message** | Single communication | Always (user/agent talk) |
| **Node** | Processing step | Always (tasks in workflow) |

---

## Summary

You now know:
1. ✅ What an Agent is
2. ✅ What a StateGraph is
3. ✅ What AgentState does
4. ✅ What a Message is
5. ✅ What a Node is

**That's enough to build amazing things.** 

Ready to build something real? Go to [Tutorials](../tutorials/index.md) →
