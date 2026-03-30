# A2A Server with Agentflow CLI

This guide covers how to deploy your Agentflow graphs as A2A-compliant servers using the **Agentflow CLI**. The CLI approach is the recommended way for production deployments as it handles server setup, configuration, and deployment automatically.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Project Setup](#project-setup)
- [Configuration File](#configuration-file)
- [Starting the Server](#starting-the-server)
- [CLI Command Reference](#cli-command-reference)
- [Custom Executors](#custom-executors)
- [Skills Configuration](#skills-configuration)
- [Production Deployment](#production-deployment)
- [Examples](#examples)

## Quick Start

```bash
# 1. Install agentflow and CLI
pip install 10xscale-agentflow "10xscale-agentflow-cli[a2a]"

# 2. Create your graph (graph.py)
# See example below

# 3. Configure agentflow.json
# See configuration section

# 4. Start the A2A server
agentflow a2a
```

Your agent is now accessible at `http://localhost:9999/`!

## Installation

### Basic Installation

```bash
pip install 10xscale-agentflow
```

### CLI with A2A Support

```bash
pip install "10xscale-agentflow-cli[a2a]"
```

This installs:
- `agentflow` CLI command
- `a2a-sdk` for A2A protocol support
- All necessary dependencies

### Verify Installation

```bash
agentflow --help
agentflow a2a --help
```

## Project Setup

### 1. Create Your Graph

Create a `graph.py` file with your compiled graph:

```python
"""
Currency conversion agent graph.
The compiled graph is exposed as 'app'.
"""
from __future__ import annotations

import httpx
from dotenv import load_dotenv
from litellm import acompletion

from agentflow.adapters.llm.model_response_converter import ModelResponseConverter
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.graph import StateGraph, ToolNode
from agentflow.state import AgentState
from agentflow.utils.constants import END
from agentflow.utils.converter import convert_messages

load_dotenv()

# --------------------------------------------------------------------------- #
#  Tool Definition                                                             #
# --------------------------------------------------------------------------- #

async def get_exchange_rate(
    currency_from: str,
    currency_to: str,
    currency_date: str = "latest",
    amount: float = 1.0,
) -> dict:
    """Get exchange rate between two currencies.

    Args:
        currency_from: Source currency code (e.g. USD)
        currency_to: Target currency code (e.g. EUR)
        currency_date: Date in YYYY-MM-DD format or 'latest'
        amount: Amount to convert

    Returns:
        dict with conversion details
    """
    url = f"https://api.frankfurter.app/{currency_date}"
    params = {"from": currency_from, "to": currency_to, "amount": amount}
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()

tool_node = ToolNode([get_exchange_rate])

# --------------------------------------------------------------------------- #
#  LLM Node                                                                    #
# --------------------------------------------------------------------------- #

SYSTEM_PROMPT = (
    "You are a helpful currency conversion assistant. "
    "Use the get_exchange_rate tool to look up live exchange rates. "
    "Always tell the user the converted amount and the date."
)

async def llm_node(state: AgentState):
    messages = convert_messages(
        system_prompts=[{"role": "system", "content": SYSTEM_PROMPT}],
        state=state,
    )

    if state.context and state.context[-1].role == "tool":
        response = await acompletion(
            model="gemini/gemini-2.5-flash",
            messages=messages,
        )
    else:
        tools = await tool_node.all_tools()
        response = await acompletion(
            model="gemini/gemini-2.5-flash",
            messages=messages,
            tools=tools,
        )

    return ModelResponseConverter(response, converter="litellm")

# --------------------------------------------------------------------------- #
#  Routing                                                                     #
# --------------------------------------------------------------------------- #

def should_use_tools(state: AgentState) -> str:
    if not state.context:
        return END

    last = state.context[-1]

    if hasattr(last, "tools_calls") and last.tools_calls and last.role == "assistant":
        return "TOOL"

    if last.role == "tool":
        return "MAIN"

    return END

# --------------------------------------------------------------------------- #
#  Graph Compilation                                                           #
# --------------------------------------------------------------------------- #

graph = StateGraph()
graph.add_node("MAIN", llm_node)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", "MAIN": "MAIN", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

# This is the variable referenced in agentflow.json
app = graph.compile(checkpointer=InMemoryCheckpointer[AgentState]())
```

### 2. Create Configuration File

Create `agentflow.json` in the same directory:

```json
{
  "agent": "graph:app",
  "env": ".env",
  "a2a": {
    "name": "CurrencyAgent",
    "description": "Currency conversion assistant using live exchange rates",
    "version": "1.0.0",
    "streaming": true,
    "skills": [
      {
        "id": "currency_conversion",
        "name": "Currency Conversion",
        "description": "Convert amounts between currencies using live rates",
        "tags": ["currency", "finance", "exchange-rate"],
        "examples": [
          "How much is 100 USD in EUR?",
          "Convert 50 GBP to JPY",
          "What's the exchange rate for EUR to USD?"
        ]
      }
    ]
  }
}
```

### 3. Create Environment File

Create `.env` for API keys and secrets:

```bash
# OpenAI (if using OpenAI models)
OPENAI_API_KEY=your-key-here

# Google (if using Gemini models)
GOOGLE_API_KEY=your-key-here

# Other environment variables
LOG_LEVEL=INFO
```

### 4. Project Structure

Your project should look like this:

```
my-agent/
├── graph.py              # Your compiled graph
├── agentflow.json       # CLI configuration
├── .env                 # Environment variables
└── executor.py          # (Optional) Custom executor
```

## Configuration File

The `agentflow.json` file configures your A2A server deployment.

### Basic Configuration

```json
{
  "agent": "graph:app",
  "env": ".env",
  "a2a": {
    "name": "MyAgent",
    "description": "What your agent does",
    "version": "1.0.0",
    "streaming": false
  }
}
```

### Complete Configuration

```json
{
  "agent": "graph:app",
  "env": ".env",
  "a2a": {
    "name": "CurrencyAgent",
    "description": "Currency conversion with INPUT_REQUIRED for missing info",
    "version": "1.0.0",
    "streaming": true,
    "executor": "executor:CurrencyAgentExecutor",
    "skills": [
      {
        "id": "currency_conversion",
        "name": "Currency Conversion",
        "description": "Convert between currencies. Asks if info is missing.",
        "tags": ["currency", "finance", "exchange-rate"],
        "examples": [
          "How much is 100 USD in EUR?",
          "Convert 50 GBP to JPY"
        ]
      }
    ]
  }
}
```

### Configuration Fields

#### Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent` | string | Yes | Path to compiled graph (`module:variable`) |
| `env` | string | No | Path to .env file (default: `.env`) |
| `a2a` | object | Yes | A2A server configuration |

#### A2A Configuration (`a2a` object)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | `"AgentflowAgent"` | Human-readable agent name |
| `description` | string | Auto-generated | What the agent does |
| `version` | string | `"0.1.0"` | Semantic version string |
| `streaming` | boolean | `false` | Enable SSE streaming responses |
| `executor` | string | `null` | Custom executor class path (`module:ClassName`) |
| `skills` | array | `[]` | List of skill definitions (see below) |

#### Skill Definition

Each skill in the `skills` array:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique skill identifier |
| `name` | string | Yes | Display name |
| `description` | string | Yes | What the skill does |
| `tags` | array | No | Category tags |
| `examples` | array | No | Example queries |

### Agent Path Resolution

The `agent` field uses the format `module:variable`:

```json
{
  "agent": "graph:app"
}
```

This resolves to:
1. Import module: `import graph`
2. Get attribute: `graph.app`
3. Expected: `app` is a compiled `CompiledGraph`

Other examples:
- `"agent": "my_module.submodule:compiled_graph"`
- `"agent": "src.agents.currency:currency_app"`

## Starting the Server

### Basic Usage

```bash
agentflow a2a
```

This starts the server with:
- **Host**: `0.0.0.0` (all interfaces)
- **Port**: `9999`
- **Config**: `agentflow.json`
- Settings from `agentflow.json`

### Custom Host and Port

```bash
agentflow a2a --host 127.0.0.1 --port 8080
```

### Custom Configuration File

```bash
agentflow a2a --config production.json
```

### Override Agent Metadata

```bash
agentflow a2a \
  --name "ProductionCurrencyAgent" \
  --description "Production currency conversion service" \
  --streaming
```

### Verbose Logging

```bash
agentflow a2a --verbose
```

### Quiet Mode

```bash
agentflow a2a --quiet
```

## CLI Command Reference

### `agentflow a2a` Options

```
Usage: agentflow a2a [OPTIONS]

Start an A2A-protocol agent server for the configured graph.

Options:
  -c, --config TEXT       Path to agentflow.json config file
                          [default: agentflow.json]

  -H, --host TEXT         Host to bind the A2A server on
                          [default: 0.0.0.0]

  -p, --port INTEGER      Port to run the A2A server on
                          [default: 9999]

  -n, --name TEXT         Agent name (overrides agentflow.json)

  -d, --description TEXT  Agent description (overrides agentflow.json)

  --streaming             Enable A2A streaming (SSE) responses
  --no-streaming          Disable streaming

  -v, --verbose          Enable verbose logging

  -q, --quiet            Suppress all output except errors

  -h, --help             Show this message and exit
```

### Priority Order

Settings are resolved in this order (highest priority first):

1. **CLI flags** (e.g., `--name`, `--port`)
2. **agentflow.json** `a2a` section
3. **Default values**

Example:
```bash
# agentflow.json has "name": "CurrencyAgent"
# This command overrides it:
agentflow a2a --name "ProductionAgent"
# Server will use "ProductionAgent"
```

## Custom Executors

For advanced control over task execution, create a custom executor.

### When to Use Custom Executors

- Implement `INPUT_REQUIRED` state (ask user for clarification)
- Custom pre/post-processing
- Advanced error handling
- Task-specific routing logic
- Integration with external systems

### Creating a Custom Executor

Create `executor.py`:

```python
"""
Custom executor for the CurrencyAgent.

Extends AgentFlowExecutor to emit INPUT_REQUIRED when the LLM asks
for missing information.
"""
from __future__ import annotations

import logging

from a2a.server.agent_execution.context import RequestContext
from a2a.server.events.event_queue import EventQueue
from a2a.server.tasks.task_updater import TaskUpdater
from a2a.types import TaskState, TextPart

from agentflow.a2a_integration.executor import AgentFlowExecutor
from agentflow.state import Message as AFMessage
from agentflow.utils.constants import ResponseGranularity

logger = logging.getLogger(__name__)

# Heuristic: phrases that indicate the agent is asking for input
_ASKING_PHRASES = [
    "could you",
    "please provide",
    "please specify",
    "what amount",
    "which currency",
    "let me know",
    "can you tell",
]

def _is_asking_for_input(text: str) -> bool:
    """Check if the agent is asking for more information."""
    low = text.lower().strip()
    return low.endswith("?") or any(p in low for p in _ASKING_PHRASES)


class CurrencyAgentExecutor(AgentFlowExecutor):
    """Custom executor that emits INPUT_REQUIRED for clarification questions."""

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue
    ) -> None:
        """Execute the currency conversion task."""
        updater = TaskUpdater(
            event_queue=event_queue,
            task_id=context.task_id or "",
            context_id=context.context_id or "",
        )

        # Set task to SUBMITTED state
        await updater.submit()

        # Set task to WORKING state
        await updater.start_work()

        try:
            # Extract user input
            user_text = context.get_user_input() if context.message else ""
            messages = [AFMessage.text_message(user_text, role="user")]

            # Configure graph execution
            run_config = {
                "thread_id": context.context_id or context.task_id or ""
            }

            # Run the graph
            result = await self.graph.ainvoke(
                {"messages": messages},
                config=run_config,
                response_granularity=ResponseGranularity.FULL,
            )

            # Extract response text
            response_text = self._extract_response_text(result)

            # Check if agent is asking for clarification
            if _is_asking_for_input(response_text):
                # Emit INPUT_REQUIRED state
                msg = updater.new_agent_message(
                    parts=[TextPart(text=response_text)]
                )
                await updater.update_status(
                    TaskState.input_required,
                    message=msg
                )
            else:
                # Normal completion
                await updater.add_artifact([TextPart(text=response_text)])
                await updater.complete()

        except Exception as exc:
            logger.exception("CurrencyAgentExecutor failed")
            error_msg = updater.new_agent_message(
                parts=[TextPart(text=f"Error: {exc!s}")]
            )
            await updater.failed(message=error_msg)
```

### Registering Custom Executor

In `agentflow.json`:

```json
{
  "agent": "graph:app",
  "env": ".env",
  "a2a": {
    "name": "CurrencyAgent",
    "description": "Currency conversion with smart clarification",
    "executor": "executor:CurrencyAgentExecutor"
  }
}
```

The format is `module:ClassName`:
- `executor` → import module named `executor`
- `CurrencyAgentExecutor` → get class with that name

### Executor Methods

When extending `AgentFlowExecutor`:

#### Required Method

```python
async def execute(
    self,
    context: RequestContext,
    event_queue: EventQueue
) -> None:
    """Execute the task."""
```

#### Available Helper Methods

```python
# Extract response text from graph result
response_text = self._extract_response_text(result)

# Access the compiled graph
self.graph.ainvoke(...)

# Check if streaming is enabled
if self.streaming:
    async for chunk in self.graph.astream(...):
        # Handle chunk
```

#### TaskUpdater Methods

```python
updater = TaskUpdater(event_queue, task_id, context_id)

# State transitions
await updater.submit()                    # → SUBMITTED
await updater.start_work()                # → WORKING
await updater.complete()                  # → COMPLETED
await updater.failed(message)             # → FAILED
await updater.cancelled()                 # → CANCELLED

# Add artifacts
await updater.add_artifact([TextPart(text="Result")])

# Update status with message
await updater.update_status(
    TaskState.input_required,
    message=updater.new_agent_message(parts=[...])
)

# Create messages
msg = updater.new_agent_message(parts=[TextPart(text="Hello")])
```

## Skills Configuration

Skills describe your agent's capabilities to callers.

### Simple Skill

```json
{
  "a2a": {
    "skills": [
      {
        "id": "general_qa",
        "name": "General Q&A",
        "description": "Answer general questions"
      }
    ]
  }
}
```

### Complete Skill Definition

```json
{
  "id": "currency_conversion",
  "name": "Currency Conversion",
  "description": "Convert amounts between different currencies using live exchange rates from the Frankfurter API.",
  "tags": ["currency", "finance", "exchange-rate", "money"],
  "examples": [
    "How much is 100 USD in EUR?",
    "Convert 50 GBP to JPY",
    "What's the EUR to USD rate?",
    "Convert 1000 INR to CAD on 2024-01-15"
  ]
}
```

### Multiple Skills

```json
{
  "a2a": {
    "skills": [
      {
        "id": "currency_conversion",
        "name": "Currency Conversion",
        "description": "Convert between currencies",
        "tags": ["currency", "finance"]
      },
      {
        "id": "currency_history",
        "name": "Historical Rates",
        "description": "Get historical exchange rates",
        "tags": ["currency", "history"]
      }
    ]
  }
}
```

### Default Skill

If you don't specify `skills`, a default skill is created:

```json
{
  "id": "run_graph",
  "name": "CurrencyAgent",
  "description": "Currency conversion assistant using live exchange rates",
  "tags": [],
  "examples": []
}
```

## Production Deployment

### Environment-Specific Configs

Create different configs for each environment:

**development.json**:
```json
{
  "agent": "graph:app",
  "env": ".env.development",
  "a2a": {
    "name": "CurrencyAgent (Dev)",
    "streaming": true
  }
}
```

**production.json**:
```json
{
  "agent": "graph:app",
  "env": ".env.production",
  "a2a": {
    "name": "CurrencyAgent",
    "version": "1.2.0",
    "streaming": true
  }
}
```

Then run:
```bash
agentflow a2a --config production.json
```

### Docker Deployment

**Dockerfile**:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY graph.py .
COPY executor.py .
COPY agentflow.json .
COPY .env.production .env

# Expose A2A port
EXPOSE 9999

# Start server
CMD ["agentflow", "a2a", "--host", "0.0.0.0", "--port", "9999"]
```

**Build and Run**:
```bash
docker build -t my-currency-agent .
docker run -p 9999:9999 my-currency-agent
```

### Docker Compose

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  currency-agent:
    build: .
    ports:
      - "9999:9999"
    environment:
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - LOG_LEVEL=INFO
    restart: unless-stopped
```

Run:
```bash
docker-compose up -d
```

### Process Manager (systemd)

Create `/etc/systemd/system/currency-agent.service`:

```ini
[Unit]
Description=Currency Agent A2A Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/currency-agent
Environment="PATH=/home/ubuntu/currency-agent/venv/bin"
ExecStart=/home/ubuntu/currency-agent/venv/bin/agentflow a2a --host 0.0.0.0 --port 9999
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable currency-agent
sudo systemctl start currency-agent
sudo systemctl status currency-agent
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name currency-agent.example.com;

    location / {
        proxy_pass http://127.0.0.1:9999;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # For SSE streaming
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

## Examples

### Minimal Example

**graph.py**:
```python
from agentflow import StateGraph, Agent
from agentflow.state import AgentState

agent = Agent(model="google/gemini-2.5-flash")
graph = StateGraph()
graph.add_node("agent", agent.execute)
graph.set_entry_point("agent")

app = graph.compile()
```

**agentflow.json**:
```json
{
  "agent": "graph:app",
  "a2a": {
    "name": "SimpleAgent",
    "description": "A simple conversational agent"
  }
}
```

**Run**:
```bash
agentflow a2a
```

### Complete Example

See `examples/a2a_sdk/currency_agent_cli/` for a complete working example with:
- Custom tools
- Custom executor
- Skill definitions
- Streaming support
- INPUT_REQUIRED handling

## Accessing Your Agent

Once the server is running:

### Agent Card

```bash
curl http://localhost:9999/.well-known/agent-card.json
```

Response:
```json
{
  "name": "CurrencyAgent",
  "description": "Currency conversion assistant",
  "url": "http://localhost:9999/",
  "version": "1.0.0",
  "skills": [
    {
      "id": "currency_conversion",
      "name": "Currency Conversion",
      "description": "Convert amounts between currencies",
      "tags": ["currency", "finance"],
      "examples": ["How much is 100 USD in EUR?"]
    }
  ],
  "capabilities": {
    "streaming": {
      "supported": true
    }
  }
}
```

### Send Message

```bash
curl -X POST http://localhost:9999/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "agent/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"text": "Convert 100 USD to EUR"}]
      }
    },
    "id": 1
  }'
```

### Using A2A Client

```python
from agentflow.a2a_integration import A2AClient

async def main():
    async with A2AClient("http://localhost:9999") as client:
        response = await client.send_message("Convert 100 USD to EUR")
        print(response)
```

## Troubleshooting

### Server Not Starting

**Check config file**:
```bash
# Validate JSON syntax
python -m json.tool agentflow.json
```

**Check graph import**:
```bash
python -c "from graph import app; print(app)"
```

**Check dependencies**:
```bash
pip list | grep agentflow
pip list | grep a2a-sdk
```

### Port Already in Use

```bash
# Use different port
agentflow a2a --port 8080

# Or find and kill process
lsof -i :9999
kill -9 <PID>
```

### Environment Variables Not Loaded

```bash
# Check .env file exists
ls -la .env

# Manually load and test
python -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.getenv('GOOGLE_API_KEY'))"
```

### ImportError: No module named 'a2a'

```bash
# Install a2a support
pip install "10xscale-agentflow-cli[a2a]"

# Or install a2a-sdk directly
pip install a2a-sdk
```

## Next Steps

- **[Client Documentation](./client.md)** - Learn how to call your A2A agent
- **[Executor Documentation](./executor.md)** - Deep dive into custom executors
- **[Server Documentation](./server.md)** - Low-level server API (non-CLI)
- **[A2A SDK Documentation](https://github.com/10xLab/a2a-sdk)** - A2A protocol details

## See Also

- [Agentflow CLI Documentation](https://github.com/10xHub/agentflow-cli)
- [Example: Currency Agent](../../../examples/a2a_sdk/currency_agent_cli/)
- [A2A Protocol Specification](https://github.com/10xLab/a2a-sdk)
