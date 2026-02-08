# What is AgentFlow?

## The Simplest Explanation (30 seconds)

**AgentFlow** is a tool that helps you build AI agents. Think of an AI agent as a program that:

1. **Listens** to what you ask
2. **Thinks** about it using an LLM (like ChatGPT)
3. **Acts** to help you

AgentFlow handles all the boring orchestration so you can focus on building.

---

## Let's Use an Analogy

### Without AgentFlow
Imagine a customer support system where you have to manually:
- Read the email
- Send it to ChatGPT
- Read the response
- Send it back to the customer
- Keep track of the conversation
- Handle errors if something goes wrong

That's a lot of busywork.

### With AgentFlow
You say: "Here's my workflow: read → think → reply"

AgentFlow does all the busywork. You focus on the logic.

---

## Real-World Examples

### Example 1: Customer Support Bot 🤖
```
User → "Where's my order?" 
AgentFlow → Searches database for order info
         → Summarizes with LLM
         → Sends response
```

### Example 2: Code Review Agent 🔍
```
User → Sends code
AgentFlow → Passes to code analyzer (tool)
         → LLM reviews it
         → Suggests improvements
```

### Example 3: Research Assistant 📚
```
User → "Tell me about X"
AgentFlow → Searches the web (tool)
         → Reads articles (tool)
         → LLM summarizes
         → Sends you the summary
```

---

## What Do You Need to Know?

### ✅ You should know:
- Basic Python (if-statements, functions, etc.)
- How to use the command line
- What an LLM is (ChatGPT, Claude, Gemini, etc.)
- You have an API key to an LLM provider

### ❌ You DON'T need to know:
- Building from scratch with LangChain
- Graph theory
- Advanced architecture patterns
- Checkpointers, Redis, databases (we'll add that later)

---

## How Does AgentFlow Compare?

| Feature | AgentFlow | LangChain | Other Tools |
|---------|-----------|-----------|-------------|
| Easy to learn | ✅ Yes | ❌ Complex | Varies |
| Works with any LLM | ✅ Yes | ✅ Yes | ❌ Often locked in |
| Production-ready | ✅ Yes | ✅ Yes | Varies |
| Graphs/Workflows | ✅ Simple | ✅ Complex | Varies |
| Multi-agent support | ✅ Yes | ✅ Yes | Varies |
| **Getting started speed** | **5 min** | **30 min** | Varies |

---

## Your Learning Path

```
You are here ↓

1. What is AgentFlow? ←← YOU ARE HERE
2. Installation (3 min)
3. Hello World (5 min) ← Your first working agent
4. Core Concepts (5 min)

Then: Build real things!
```

---

## Next Step

Ready? Let's [install AgentFlow](installation.md) →
