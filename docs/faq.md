# Frequently Asked Questions (FAQ)

Quick answers to common questions about AgentFlow.

---

## Getting Started

### What is AgentFlow?

AgentFlow is a Python framework for building AI agents and orchestrating multi-agent workflows. It's LLM-agnostic, meaning you can use any LLM provider (OpenAI, Google, Anthropic, etc.).

Think of it as the "orchestration layer" - you bring your LLM, we handle the workflow.

### Do I need to know LangChain or LlamaIndex?

No! AgentFlow is designed to be simple and intuitive. If you know basic Python, you can build agents.

### Which LLM should I use?

Start with whatever you have an API key for:
- **Google Gemini** - Fast and cost-effective (`google/gemini-2.5-flash`)
- **OpenAI GPT-4** - Very capable (`openai/gpt-4o`)
- **Anthropic Claude** - Excellent reasoning (`anthropic/claude-3-5-sonnet-20241022`)

You can easily switch between them!

---

## Installation & Setup

### How do I install AgentFlow?

```bash
pip install 10xscale-agentflow
```

For specific features:
```bash
# PostgreSQL + Redis checkpointing
pip install 10xscale-agentflow[pg_checkpoint]

# MCP support
pip install 10xscale-agentflow[mcp]

# LiteLLM for multi-provider support
pip install 10xscale-agentflow[litellm]
```

### Do I need LiteLLM?

**No, it's optional.** AgentFlow works with:
- LiteLLM (multi-provider, recommended for beginners)
- Native SDKs (OpenAI, Google, Anthropic)
- Any LLM library that returns compatible responses

### Where do I put my API keys?

**Best practice:** Use a `.env` file:

```
OPENAI_API_KEY=sk-proj-xxxxx
GOOGLE_API_KEY=AIzaSy-xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

Then load it:
```python
from dotenv import load_dotenv
load_dotenv()
```

---

## Core Concepts

### What's the difference between Agent class and custom functions?

| Agent Class | Custom Functions |
|-------------|------------------|
| 10-30 lines of code | 50-150 lines |
| Uses LiteLLM | Use any LLM library |
| Best for most cases | Best for custom logic |

**Recommendation:** Start with Agent class. Use custom functions only if you need special LLM handling.

### What is a StateGraph?

A `StateGraph` is the workflow orchestrator. It:
- Holds your processing nodes (agents, tools, etc.)
- Defines the flow between them
- Manages state/memory

Think of it as the "director" of your agent system.

### What is a checkpointer?

A checkpointer saves conversation state so agents can remember across messages.

Types:
- `InMemoryCheckpointer` - Development/testing (data lost on restart)
- `PostgresCheckpointer` - Production (persistent storage)
- `RedisCheckpointer` - Production with caching

### What are tools?

Tools are Python functions your agent can call to perform actions:
- Fetch data from APIs
- Query databases
- Send emails
- Perform calculations
- Anything you can code!

---

## Building Agents

### How do I make my agent use tools?

1. Define your tool (Python function with docstring)
2. Create a `ToolNode`
3. Connect agent to tools with `tool_node_name`
4. Set up routing

See: [How to Create a Python Tool](how-to/tools/create-python-tool.md)

### Why isn't my agent calling tools?

**Common reasons:**
1. **Unclear docstring** - Make it very clear what the tool does
2. **Wrong tool_node_name** - Make sure it matches the node name
3. **No routing** - You need conditional edges to route to tools

### How do I make my agent remember conversations?

Use a checkpointer:

```python
from agentflow.checkpointer import InMemoryCheckpointer

checkpointer = InMemoryCheckpointer()
app = workflow.compile(checkpointer=checkpointer)

# Use thread_id to track conversations
result = app.invoke(
    {"messages": [...]},
    config={"thread_id": "user_123"}
)
```

See: [How to Add Conversation Memory](how-to/memory/add-conversation-memory.md)

### Can I use multiple agents together?

Yes! This is called multi-agent workflows. You can:
- Route between specialized agents
- Have agents hand off to each other
- Build complex systems with many agents

See: [Tutorial: Multi-Agent Handoff](tutorials/beginner/04-multi-agent-handoff.md)

---

## Production & Deployment

### Is AgentFlow production-ready?

Yes! AgentFlow includes:
- ✅ Persistent checkpointing (PostgreSQL + Redis)
- ✅ Event publishing (Kafka, RabbitMQ, Redis)
- ✅ Error handling and retries
- ✅ Streaming support
- ✅ Background task management

### How do I deploy to production?

See our deployment guides:
- [Deploy with Docker](how-to/deployment/docker-deployment.md)
- [Production Deployment Guide](how-to/deployment/production-deployment.md)

### How much does it cost to run?

AgentFlow itself is free and open-source (MIT license).

Costs come from:
- **LLM API calls** - Pay only for what you use
- **Infrastructure** - If using PostgreSQL, Redis, etc.

Typical costs:
- **Gemini Flash:** ~$0.15 per 1M tokens
- **GPT-4o Mini:** ~$0.15 per 1M tokens
- **Claude Sonnet:** ~$3 per 1M tokens

### Can I use AgentFlow offline?

AgentFlow works offline if you use:
- Local LLMs (Ollama, LM Studio, etc.)
- Self-hosted checkpointers

The framework itself doesn't require internet.

---

## Troubleshooting

### "ModuleNotFoundError: No module named 'agentflow'"

Install AgentFlow:
```bash
pip install 10xscale-agentflow
```

### "No API key provided"

Set your API key:
```bash
export OPENAI_API_KEY=sk-proj-xxxxx
```

Or use a `.env` file.

### "Invalid model name"

Use the correct format: `"provider/model-name"`

✅ Correct: `"openai/gpt-4o"`, `"google/gemini-2.5-flash"`
❌ Wrong: `"gpt-4o"`, `"gemini-2.5-flash"`

### "Rate limit exceeded"

You've hit your LLM provider's rate limit. Solutions:
1. Wait a few seconds and retry
2. Upgrade your API plan
3. Switch to a different model
4. Implement rate limiting in your code

### "Context length exceeded"

Your conversation is too long. Solutions:
1. Use a context manager to trim messages
2. Summarize old messages
3. Use a model with larger context window

---

## Features & Capabilities

### Does AgentFlow support streaming?

Yes! Use `app.astream()` instead of `app.invoke()`:

```python
async for chunk in app.astream(input, config):
    print(chunk)
```

See: [Streaming Documentation](client/stream-usage.md)

### Can I use custom LLM providers?

Yes! AgentFlow is LLM-agnostic. You can use:
- Any LiteLLM-supported provider (100+ models)
- Native SDKs (OpenAI, Google, Anthropic)
- Local models (Ollama, LM Studio)
- Custom adapters

### Does it work with LangChain tools?

Yes! Install the adapter:
```bash
pip install 10xscale-agentflow[langchain]
```

Then use LangChain tools with ToolNode.

### What about Composio tools?

Yes! Install the adapter:
```bash
pip install 10xscale-agentflow[composio]
```

### Can I run background tasks?

Yes! AgentFlow includes a built-in background task manager for:
- Data prefetching
- Memory persistence
- Cleanup operations

See: [Background Task Manager](Agentflow/background-task-manager.md)

---

## Community & Support

### Where can I get help?

- **Documentation:** You're reading it! 📖
- **GitHub Discussions:** [Ask questions](https://github.com/10xhub/agentflow/discussions)
- **GitHub Issues:** [Report bugs](https://github.com/10xhub/agentflow/issues)
- **Examples:** Check the [examples directory](https://github.com/10xhub/agentflow/tree/main/examples)

### How can I contribute?

We welcome contributions!
- Report bugs or request features on GitHub
- Submit pull requests
- Improve documentation
- Share your projects

See: [GitHub Repository](https://github.com/10xhub/agentflow)

### Is there a community?

Yes! Join us on:
- GitHub Discussions
- GitHub Issues
- Follow the project for updates

---

## Comparison with Other Frameworks

### AgentFlow vs LangChain?

| Feature | AgentFlow | LangChain |
|---------|-----------|-----------|
| **Learning curve** | Easy | Steep |
| **Code verbosity** | Minimal | Verbose |
| **LLM flexibility** | Any provider | Any provider |
| **Graph workflows** | Simple | Complex |
| **Production features** | Built-in | Requires setup |

**Use AgentFlow if:** You want simplicity and quick development
**Use LangChain if:** You need extensive integrations and components

### AgentFlow vs AutoGen?

| Feature | AgentFlow | AutoGen |
|---------|-----------|---------|
| **Focus** | Workflows | Multi-agent chat |
| **Flexibility** | High | Medium |
| **Learning curve** | Easy | Medium |
| **Production ready** | Yes | Varies |

**Use AgentFlow if:** You need flexible workflows
**Use AutoGen if:** You focus on agent conversations

### Why choose AgentFlow?

- **🚀 Fast development:** Agents in minutes, not weeks
- **🧠 LLM freedom:** Use any LLM provider
- **🔧 Simple API:** Clean, Pythonic code
- **📦 Production-ready:** Built-in persistence, events, monitoring
- **🎓 Easy to learn:** Great docs and examples

---

## Advanced Topics

### Can I customize the context manager?

Yes! Implement a custom context manager to control message history:

```python
from agentflow.context.context_manager import ContextManager

class MyContextManager(ContextManager):
    def filter_messages(self, messages):
        # Your logic here
        return filtered_messages
```

### How do I implement custom checkpointers?

Extend the base checkpointer class:

```python
from agentflow.checkpointer.base import BaseCheckpointer

class MyCheckpointer(BaseCheckpointer):
    def put(self, config, checkpoint):
        # Save logic
        pass

    def get(self, config):
        # Load logic
        pass
```

### Can I use AgentFlow with async/await?

Yes! Most methods have async versions:

```python
# Async invoke
result = await app.ainvoke(input, config)

# Async stream
async for chunk in app.astream(input, config):
    print(chunk)
```

---

## Documentation & AI Tools

### Does AgentFlow support AI assistants reading the documentation?

Yes! We provide an [llms.txt](llms.txt) file that helps AI assistants like ChatGPT, Claude, and Gemini better understand and navigate our documentation structure. This follows the [llms.txt standard](https://llmstxt.org/).

**For AI Assistants:**
- Access our structured documentation overview at `/llms.txt`
- Get curated links to key pages organized by topic
- Find the most relevant resources quickly within context limits

**For Users:**
- Get better AI-assisted help when working with AgentFlow
- AI tools can now provide more accurate guidance and examples
- Improved discoverability through AI-powered search

### Can I use AI coding assistants with AgentFlow?

Absolutely! Our documentation is optimized for AI assistants:
- **ChatGPT** - Point it to our docs and it can help with code
- **GitHub Copilot** - Works great with AgentFlow patterns
- **Claude Code** - Understands our architecture through llms.txt
- **Cursor** - Can reference our documentation for context

Simply reference our documentation when asking for help!

---

## Didn't Find Your Answer?

- **Search the docs** - Use the search bar above
- **Check tutorials** - [Beginner Tutorials](tutorials/beginner/index.md)
- **Browse examples** - [Examples](examples/index.md)
- **Ask on GitHub** - [GitHub Discussions](https://github.com/10xhub/agentflow/discussions)

---

**Still have questions?** Open an issue on [GitHub](https://github.com/10xhub/agentflow/issues)!
