# How to Create a Simple Agent

**Problem:** You want to create a basic agent that responds to user messages.

**Time:** 5 minutes

**Prerequisites:**
- AgentFlow installed
- LLM API key configured

---

## Quick Solution

```python
from agentflow.graph import StateGraph, END, Agent
from agentflow.state import AgentState, Message

# Create agent
agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt="You are a helpful assistant."
)

# Build workflow
workflow = StateGraph(state_schema=AgentState)
workflow.add_node("agent", agent)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

# Compile and run
app = workflow.compile()
result = app.invoke({"messages": [Message.text_message("Hello!", "user")]})
print(result["messages"][-1].content)
```

---

## Step-by-Step

### 1. Import Required Modules

```python
from agentflow.graph import StateGraph, END, Agent
from agentflow.state import AgentState, Message
```

### 2. Create the Agent

```python
agent = Agent(
    model="google/gemini-2.5-flash",  # Choose your LLM
    system_prompt="You are a helpful assistant."  # Agent instructions
)
```

**Model options:**
- `"openai/gpt-4o"` - OpenAI GPT-4
- `"google/gemini-2.5-flash"` - Google Gemini
- `"anthropic/claude-3-5-sonnet-20241022"` - Anthropic Claude

### 3. Build the Workflow

```python
workflow = StateGraph(state_schema=AgentState)
workflow.add_node("agent", agent)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)
```

### 4. Compile

```python
app = workflow.compile()
```

### 5. Send Messages

```python
result = app.invoke({
    "messages": [Message.text_message("Your question here", "user")]
})

# Get response
response = result["messages"][-1].content
print(response)
```

---

## Verification

Run your script. You should see a response from the agent:

```
$ python my_agent.py
Hello! How can I help you today?
```

---

## Common Options

### Set Custom System Prompt

```python
agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt="You are an expert Python developer. Give concise code examples."
)
```

### Use Environment Variable for API Key

```python
import os
from dotenv import load_dotenv

load_dotenv()  # Loads .env file

agent = Agent(model="openai/gpt-4o", system_prompt="...")
# API key loaded automatically from OPENAI_API_KEY env variable
```

---

## Related Guides

- [Customize System Prompts](customize-system-prompts.md)
- [Switch LLM Providers](switch-llm-providers.md)
- [Add Tools to Agent](../tools/create-python-tool.md)
- [Add Memory](../memory/add-conversation-memory.md)

---

## Troubleshooting

### "No API key provided"
Set your API key in environment:
```bash
export OPENAI_API_KEY=sk-...
# or
export GOOGLE_API_KEY=...
# or
export ANTHROPIC_API_KEY=...
```

### "Invalid model name"
Use correct format: `"provider/model-name"`
- ✅ `"openai/gpt-4o"`
- ❌ `"gpt-4o"`

---

**Next:** [Customize System Prompts](customize-system-prompts.md) →
