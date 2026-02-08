# Hello World - Your First Agent

## 5-Minute Challenge ⏱️

By the end of this page, you'll have a **working AI agent**. Let's go!

---

## Step 1: Write the Code

Create a file called `hello_world.py`:

```python
import os
from agentflow.graph import StateGraph, END
from agentflow.state import AgentState, Message
from agentflow.graph.agent_class import Agent

# Set your API key
os.environ["OPENAI_API_KEY"] = "your-api-key-here"

# Step 1: Create a StateGraph (the workflow)
workflow = StateGraph(state_schema=AgentState)

# Step 2: Create an Agent node
agent = Agent(
    model="openai/gpt-4o",
    system_prompt="You are a helpful assistant."
)

# Step 3: Add the agent to the workflow
workflow.add_node("agent", agent)

# Step 4: Set up the flow
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

# Step 5: Compile the workflow
app = workflow.compile()

# Step 6: Run it!
result = app.invoke({
    "messages": [Message.text_message("Hey! What's 2 + 2?", "user")]
})

# Step 7: See the response
print("Agent:", result["messages"][-1].content)
```

---

## Step 2: Run It

```bash
python hello_world.py
```

### Expected Output

```
Agent: 2 + 2 equals 4. It's a simple addition problem where you add 2 and 2 together to get 4.
```

**Congratulations! 🎉 You just built your first AI agent!**

---

## What Just Happened? 🤔

Let me break down the code:

```python
# 1. Create a workflow
workflow = StateGraph(state_schema=AgentState)

# 2. Add an Agent node that uses an LLM
agent = Agent(model="openai/gpt-4o", system_prompt="...")
workflow.add_node("agent", agent)

# 3. Tell it where to start and end
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

# 4. Compile (prepare it to run)
app = workflow.compile()

# 5. Give it a message and run
result = app.invoke({"messages": [Message.text_message("Your question", "user")]})

# 6. Get the response
print(result["messages"][-1].content)
```

**That's a complete agent!**

---

## Try It Yourself

### Try 1: Ask a question
```python
result = app.invoke({
    "messages": [Message.text_message("Who won the 2024 Olympics?", "user")]
})
print(result["messages"][-1].content)
```

### Try 2: Ask for code
```python
result = app.invoke({
    "messages": [Message.text_message("Write me a hello world in Python", "user")]
})
print(result["messages"][-1].content)
```

### Try 3: Ask it to summarize
```python
result = app.invoke({
    "messages": [Message.text_message("Summarize what is machine learning in 2 sentences", "user")]
})
print(result["messages"][-1].content)
```

---

## Common Issues

### "ModuleNotFoundError: No module named 'agentflow'"
Make sure you installed it:
```bash
pip install 10xscale-agentflow
```

### "No API key provided"
Check that your API key is set:
```python
import os
os.environ["OPENAI_API_KEY"] = "your-actual-key-here"
```

### "Invalid API key"
Go to your LLM provider's website and check that your key is correct.

### "Rate limited"
The LLM provider is temporarily blocking requests. Wait a moment and try again.

---

## Next Steps 🚀

Now that you have a working agent, let's understand the concepts:

**[Learn the Core Concepts →](core-concepts.md)**

Or jump to building:
- [Build a Chatbot](../tutorials/beginner/chat-with-memory.md)
- [Add Tools](../tutorials/beginner/adding-tools.md)

---

## What You've Learned

✅ How to create an agent  
✅ How to send a message to it  
✅ How to get a response  

**That's 80% of what you need to know!**

The rest is just variations on this pattern.
