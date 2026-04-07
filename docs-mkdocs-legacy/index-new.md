# 🚀 AgentFlow - Build AI Agents in Minutes

![PyPI](https://img.shields.io/pypi/v/agentflow?color=blue)
![License](https://img.shields.io/github/license/10xhub/agentflow)
![Python](https://img.shields.io/pypi/pyversions/agentflow)
[![Coverage](https://img.shields.io/badge/coverage-73%25-yellow.svg)](#)

**AgentFlow** helps you build AI agents that think and act. No complex frameworks. No confusing abstractions. Just simple, working code.

Think of it like building with LEGO blocks:
- **Block 1**: Create an agent
- **Block 2**: Give it tasks (tools)
- **Block 3**: Run it!

That's it. You're building multi-agent systems.

---

## ⏱️ Start Here: 5-Minute Quick Start

### New to agents? Start here:

1. **[What is AgentFlow?](./getting-started/what-is-agentflow.md)** (2 min read)
2. **[Install it](./getting-started/installation.md)** (3 min)
3. **[Build your first agent](./getting-started/hello-world.md)** (5 min)
4. **[Learn the concepts](./getting-started/core-concepts.md)** (5 min)

🎉 **You'll have a working agent in 15 minutes.**

### Already familiar with agents? Jump to:
- [Hello World Example](./getting-started/hello-world.md)
- [API Reference](./Agentflow/index.md)

---

## 🎯 Ready to See It In Action?

This is all the code you need to create an AI agent:

```python
from agentflow.graph import StateGraph, END
from agentflow.state import AgentState, Message
from agentflow.graph.agent_class import Agent
import os

os.environ["OPENAI_API_KEY"] = "your-key"

# 1. Create workflow
workflow = StateGraph(state_schema=AgentState)

# 2. Add an agent
agent = Agent(model="openai/gpt-4o", system_prompt="You are helpful.")
workflow.add_node("agent", agent)

# 3. Set the flow
workflow.set_entry_point("agent")  
workflow.add_edge("agent", END)

# 4. Run it
app = workflow.compile()
result = app.invoke({"messages": [Message.text_message("Hello!", "user")]})
print(result["messages"][-1].content)
```

**That's a complete agent!** It takes questions, thinks about them, and responds.

---

## 📚 Documentation

- **[Getting Started](./getting-started/index.md)** ⭐ Start here if you're new
- **[Tutorials](./Tutorial/index.md)** - Learn by building real projects
- **[How-To Guides](./how-to/index.md)** - Find solutions to common tasks (coming soon)
- **[API Reference](./Agentflow/index.md)** - Technical details
- **[Concepts](./Agentflow/index.md)** - Understand how it works

---

## ✨ What Can You Build?

### 🤖 Chatbots
```
User: "What's my order status?"
Agent: Checks database → Responds
```

### 🔍 Code Reviewers
```
User: Uploads code
Agent: Reviews it → Suggests improvements
```

### 📚 Research Assistants
```
User: "Tell me about X"
Agent: Searches web → Reads articles → Summarizes
```

### 🎯 Autonomous Workers
```
Scheduled: "Process emails"
Agent: Reads → Categorizes → Takes action
```

All with the same simple pattern.

---

## 🏆 Why AgentFlow?

- **🚀 Fast to build** - Agents in minutes, not weeks
- **🧠 Any LLM** - Works with OpenAI, Gemini, Claude, or your favorite provider
- **🔧 Simple API** - No framework bloat, just clean Python
- **📦 Production-ready** - Deploy with confidence
- **🎓 Easy to learn** - Start simple, scale gradually

---

## 🗂️ Choose Your Path

### 👶 Absolute Beginner
**Path**: What is AgentFlow? → Installation → Hello World → Tutorials

**Time**: ~1 hour

**Goal**: Build your first agent

### 🚀 Developer Familiar with LLMs  
**Path**: Hello World → Tutorials → API Reference

**Time**: ~30 min to first agent

**Goal**: Integrate into existing project

### 🏢 Enterprise/Production
**Path**: Concepts → API Reference → Deployment Guide

**Time**: Variable

**Goal**: Scale to production

---

## 📖 Next Steps

- **Never used an AI agent?** → [Start here](./getting-started/what-is-agentflow.md)
- **Ready to code?** → [Install and build](/getting-started/installation.md)
- **Want examples?** → [Tutorials](./Tutorial/index.md)
- **Need specific help?** → [How-To Guides](./how-to/index.md) (coming soon)

---

## 🙏 Getting Help

- 📖 [Documentation](./getting-started/index.md)
- 🐛 [Report Issues](https://github.com/10xhub/agentflow/issues)
- 💬 [Ask Questions](https://github.com/10xhub/agentflow/discussions)
- 🔗 [GitHub](https://github.com/10xhub/agentflow)

---

**Ready to build?** [Start with Getting Started →](./getting-started/index.md)
