# Installation

Get AgentFlow running in under 5 minutes.

---

## Requirements

- **Python 3.10+** — [Download here](https://www.python.org/downloads/) if you don't have it
- **An API key** from at least one LLM provider (Google, OpenAI, or Anthropic)
- **pip** (comes with Python) or [uv](https://docs.astral.sh/uv/) for faster installs

Check your Python version:

```bash
python --version  # Need Python 3.10+
```

---

## Step 1: Install AgentFlow

```bash
pip install 10xscale-agentflow
```

Or with [uv](https://docs.astral.sh/uv/) (faster):

```bash
uv pip install 10xscale-agentflow
```

---

## Step 2: Install an LLM Library

AgentFlow uses official LLM libraries to make API calls. Pick the provider you want:

=== "Google Gemini (Recommended)"

    **Why?** Generous free tier, fast inference, excellent performance

    ```bash
    pip install google-genai
    ```

    Get your free API key at [Google AI Studio](https://aistudio.google.com/app/apikey) — no credit card required.

    ```bash
    export GOOGLE_API_KEY=your-key-here
    # or
    export GEMINI_API_KEY=your-key-here
    ```

=== "OpenAI (GPT-4)"

    **Why?** Industry standard, very capable, great tool-calling support

    ```bash
    pip install openai
    ```

    Get your API key at [OpenAI Platform](https://platform.openai.com/account/api-keys).

    ```bash
    export OPENAI_API_KEY=sk-proj-your-key-here
    ```

=== "Anthropic (Claude)"

    **Why?** Excellent reasoning and long context understanding

    ```bash
    pip install anthropic
    ```

    Get your API key at [Anthropic Console](https://console.anthropic.com/).

    ```bash
    export ANTHROPIC_API_KEY=sk-ant-your-key-here
    ```

=== "Multiple Providers"

    **Why?** Switch between 100+ models with a unified interface

    ```bash
    pip install litellm
    ```

    Set the API keys for whichever providers you want to use:

    ```bash
    export OPENAI_API_KEY=sk-...
    export GOOGLE_API_KEY=...
    export ANTHROPIC_API_KEY=sk-ant-...
    ```

---

## Step 3: Set Up API Keys

### Option 1: .env File (Recommended)

Create a `.env` file in your project root:

```bash
# .env
GOOGLE_API_KEY=your-key-here

# or for OpenAI
OPENAI_API_KEY=sk-proj-your-key-here

# or for Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Then load it in your code:

```python
from dotenv import load_dotenv
load_dotenv()  # reads from .env automatically
```

Install python-dotenv if needed:

```bash
pip install python-dotenv
```

> **Never commit API keys to git!** Add `.env` to your `.gitignore`.

### Option 2: Environment Variables

=== "Linux / macOS"

    ```bash
    export GOOGLE_API_KEY=your-key-here
    ```

=== "Windows (CMD)"

    ```cmd
    set GOOGLE_API_KEY=your-key-here
    ```

=== "Windows (PowerShell)"

    ```powershell
    $env:GOOGLE_API_KEY="your-key-here"
    ```

---

## Step 4: Verify Installation

Run this quick smoke test:

```python
# test_install.py
from agentflow.graph import StateGraph, Agent
from agentflow.state import Message

print("✅ AgentFlow installed!")

# Minimal agent (no API call, just verifies imports)
graph = StateGraph()
graph.add_node("agent", Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt="You are a helpful assistant"
))
print("✅ Agent created successfully!")
```

```bash
python test_install.py
```

---

## End-to-End Test

To verify your API key and network access work correctly:

```python
# e2e_test.py
from dotenv import load_dotenv
from agentflow.graph import StateGraph, Agent, END
from agentflow.state import Message

load_dotenv()

agent = Agent(
    model="gemini/gemini-2.5-flash",  # Change to your provider if needed
    system_prompt="You are a helpful assistant"
)

graph = StateGraph()
graph.add_node("agent", agent)
graph.set_entry_point("agent")
graph.add_edge("agent", END)

app = graph.compile()
result = app.invoke({
    "messages": [Message.text_message("Say hello in one sentence.", "user")]
})

print("Response:", result["messages"][-1].content)
```

```bash
python e2e_test.py
# Response: Hello! How can I assist you today?
```

---

## Optional Packages

Install only what you need:

| Package | Install Command | Use Case |
|---------|----------------|----------|
| PostgreSQL + Redis checkpointing | `pip install 10xscale-agentflow[pg_checkpoint]` | Production-grade persistence |
| MCP tool support | `pip install 10xscale-agentflow[mcp]` | Model Context Protocol servers |
| Composio tools | `pip install 10xscale-agentflow[composio]` | 250+ pre-built integrations |
| LangChain tools | `pip install 10xscale-agentflow[langchain]` | Reuse existing LangChain tools |
| Redis publisher | `pip install 10xscale-agentflow[redis]` | Real-time event streaming |

---

## Troubleshooting

### "No module named 'google.genai'"

```bash
pip install google-genai
```

### "No module named 'openai'"

```bash
pip install openai
```

### "No module named 'anthropic'"

```bash
pip install anthropic
```

### "No API key provided"

Make sure you exported the right variable:

```bash
# Google
export GOOGLE_API_KEY=your-actual-key

# OpenAI
export OPENAI_API_KEY=sk-proj-your-key

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-your-key
```

Or create a `.env` file and call `load_dotenv()` at the top of your script.

### "Invalid API key"

- Double-check the key is copied correctly (no extra spaces)
- Make sure you're using the right variable name for your provider
- Check that the key is active in the provider's dashboard

### "pip install fails"

Try upgrading pip first:

```bash
pip install --upgrade pip
pip install 10xscale-agentflow google-genai
```

Or use uv for more reliable installs:

```bash
pip install uv
uv pip install 10xscale-agentflow google-genai
```

---

## Quick Reference

| Provider | Install | API Key Variable | Model String |
|----------|---------|-----------------|--------------|
| **Google Gemini** | `pip install google-genai` | `GOOGLE_API_KEY` | `gemini/gemini-2.5-flash` |
| **OpenAI** | `pip install openai` | `OPENAI_API_KEY` | `openai/gpt-4o` |
| **Anthropic** | `pip install anthropic` | `ANTHROPIC_API_KEY` | `anthropic/claude-3-5-sonnet-20241022` |
| **Multiple (LiteLLM)** | `pip install litellm` | set per provider | any provider string |

---

## What Did We Install?

- **`10xscale-agentflow`** — The AgentFlow framework (workflow orchestration, state management, tools)
- **`google-genai`** / **`openai`** / **`anthropic`** — The official LLM library that makes API calls
- **`python-dotenv`** (optional) — For loading `.env` files

**AgentFlow handles the workflow. Your LLM library handles the AI calls.**

---

**Ready?** Let's build your [first agent →](hello-world.md)
