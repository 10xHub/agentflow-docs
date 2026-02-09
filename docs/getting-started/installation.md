# Installation

Get AgentFlow running in under 5 minutes.

---

## Quick Install

### Step 1: Check Python Version

```bash
python --version  # Need Python 3.10+
```

Don't have Python? [Download here](https://www.python.org/downloads/)

### Step 2: Install AgentFlow + LLM Library

**Important:** AgentFlow uses official LLM libraries behind the scenes. Pick ONE option below:

=== "Google Gemini (Recommended)"

    **Why?** Free tier, fast, great performance

    ```bash
    pip install 10xscale-agentflow google-genai
    ```

    Get your free API key: [Google AI Studio](https://makersuite.google.com/app/apikey)

    ```bash
    export GOOGLE_API_KEY=your-key-here
    # or
    export GEMINI_API_KEY=your-key-here
    ```

=== "OpenAI (GPT-4)"

    **Why?** Most popular, very capable

    ```bash
    pip install 10xscale-agentflow litellm
    ```

    Get your API key: [OpenAI Platform](https://platform.openai.com/account/api-keys)

    ```bash
    export OPENAI_API_KEY=sk-proj-your-key-here
    ```

=== "Multiple Providers (LiteLLM)"

    **Why?** Switch between 100+ models easily

    ```bash
    pip install 10xscale-agentflow litellm
    ```

    Set API keys for providers you want:
    ```bash
    export OPENAI_API_KEY=sk-...
    export GOOGLE_API_KEY=...
    export ANTHROPIC_API_KEY=sk-ant-...
    ```

---

## Verify Installation

Test that everything works:

```python
# test_install.py
from agentflow.graph import StateGraph, Agent
from agentflow.state import Message

print("✅ AgentFlow installed!")

# Quick test (needs API key)
graph = StateGraph()
graph.add_node("test", Agent(
    model="gemini/gemini-2.5-flash",  # or your provider
    system_prompt="You are helpful"
))
print("✅ Agent created successfully!")
```

Run it:
```bash
python test_install.py
```

---

## Setting Up API Keys

### Option 1: .env File (Recommended)

Create `.env` in your project:

```bash
# .env
GOOGLE_API_KEY=your-key-here
# or
OPENAI_API_KEY=sk-proj-your-key-here
# or
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Then in your code:
```python
from dotenv import load_dotenv
load_dotenv()  # Loads from .env file
```

Install python-dotenv:
```bash
pip install python-dotenv
```

### Option 2: Environment Variables

**Linux/Mac:**
```bash
export GOOGLE_API_KEY=your-key-here
```

**Windows (CMD):**
```cmd
set GOOGLE_API_KEY=your-key-here
```

**Windows (PowerShell):**
```powershell
$env:GOOGLE_API_KEY="your-key-here"
```

### Option 3: In Code (Testing Only)

```python
import os
os.environ["GOOGLE_API_KEY"] = "your-key-here"
```

⚠️ **Never commit API keys to git!** Add `.env` to your `.gitignore`.

---

## Complete Example

Let's verify everything works end-to-end:

```python
# quick_test.py
import os
from dotenv import load_dotenv
from agentflow.graph import StateGraph, Agent, END
from agentflow.state import AgentState, Message

# Load API key
load_dotenv()

# Create agent
agent = Agent(
    model="gemini/gemini-2.5-flash",  # Works with google-genai library
    system_prompt="You are a helpful assistant"
)

# Build workflow
graph = StateGraph()
graph.add_node("agent", agent)
graph.set_entry_point("agent")
graph.add_edge("agent", END)

# Compile and run
app = graph.compile()
result = app.invoke({
    "messages": [Message.text_message("Say hello!", "user")]
})

print("Response:", result["messages"][-1].content)
```

Run it:
```bash
python quick_test.py
```

Expected output:
```
Response: Hello! How can I help you today?
```

**🎉 If you see this, you're ready to build!**

---

## Troubleshooting

### "No module named 'google.genai'" or "No module named 'openai'"

You forgot to install the LLM library:

```bash
# For Google Gemini
pip install google-genai

# For OpenAI
pip install litellm

# For Anthropic
pip install litellm
```

### "No API key provided"

Set your environment variable:
```bash
export GOOGLE_API_KEY=your-actual-key
```

Or create a `.env` file (see above).

### "Invalid API key"

- Double-check your key is correct
- Make sure you're using the right environment variable name
- Check your API key hasn't expired

### "pip install fails"

Try:
```bash
pip install --upgrade pip
pip install 10xscale-agentflow google-genai
```

---

## What Did We Install?

- **`10xscale-agentflow`** - The AgentFlow framework (workflow orchestration)
- **`google-genai`** or **`litellm`** - The actual LLM library that calls the AI
- **`python-dotenv`** (optional) - For loading `.env` files

**AgentFlow handles the workflow, your LLM library handles the AI calls.**

---

## Optional Packages

Install these only if you need them:

```bash
# PostgreSQL + Redis checkpointing (production)
pip install 10xscale-agentflow[pg_checkpoint]

# MCP (Model Context Protocol) support
pip install 10xscale-agentflow[mcp]

# Composio tools
pip install 10xscale-agentflow[composio]

# LangChain tools
pip install 10xscale-agentflow[langchain]
```

---

## Next Steps

✅ **Installed?** Let's build your [first agent →](hello-world.md)

📚 **Want to understand more?** Read [What is AgentFlow?](what-is-agentflow.md)

---

## Quick Reference

| Provider | Install Command | API Key Variable |
|----------|----------------|------------------|
| **Google Gemini** | `pip install 10xscale-agentflow google-genai` | `GOOGLE_API_KEY` or `GEMINI_API_KEY` |
| **OpenAI** | `pip install 10xscale-agentflow litellm` | `OPENAI_API_KEY` |
| **Anthropic** | `pip install 10xscale-agentflow litellm` | `ANTHROPIC_API_KEY` |
| **Multiple** | `pip install 10xscale-agentflow litellm` | Set keys for providers you need |

---

**Got it working?** [Build your first agent now! →](hello-world.md)
