# Installation

## Prerequisites (2 min)

### Check your Python version
Open your terminal/command prompt and run:

```bash
python --version
```

It should be **Python 3.8 or higher**. If not, [install Python here](https://www.python.org/downloads/).

### Get an LLM API Key

You'll need an API key from one of these providers (pick one):

- **OpenAI** (ChatGPT): Get key at [platform.openai.com](https://platform.openai.com/account/api-keys)
- **Google** (Gemini): Get key at [makersuite.google.com](https://makersuite.google.com/app/apikey)
- **Anthropic** (Claude): Get key at [console.anthropic.com](https://console.anthropic.com/keys)
- **Other providers**: LiteLLM supports 30+ providers

---

## Install AgentFlow (1 min)

Open your terminal and run:

```bash
pip install 10xscale-agentflow
```

That's it! AgentFlow is installed.

---

## Verify Installation (1 min)

Run this Python code to check everything works:

```python
from agentflow.graph import StateGraph
print("✅ AgentFlow installed successfully!")
```

If you see `✅ AgentFlow installed successfully!` - you're good to go!

---

## Set Up Your API Key (1 min)

### Option 1: Environment Variable (Recommended)

Create a file called `.env` in your project folder:

```
OPENAI_API_KEY=sk-proj-xxxxx
# OR
GOOGLE_API_KEY=AIzaSy-xxxxx
# OR  
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

Then load it in Python:

```python
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")  # or GOOGLE_API_KEY, ANTHROPIC_API_KEY
```

### Option 2: Inline (Quick testing only)

```python
import os
os.environ["OPENAI_API_KEY"] = "sk-proj-xxxxx"
```

---

## Troubleshooting

### "pip: command not found"
You need to install Python first. See [Python installation](https://www.python.org/downloads/).

### "No module named agentflow"
Try installing with more details:

```bash
pip install --upgrade 10xscale-agentflow
```

### "API key not working"
Make sure:
1. Your API key is correct (copy-paste carefully)
2. Your key has proper permissions (check provider's dashboard)
3. You haven't exceeded usage limits

---

## Next Step

Installed? Great! Let's create your [first agent in 5 minutes →](hello-world.md)
