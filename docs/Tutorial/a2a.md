# Tutorial: Building A2A Agents

In this tutorial, you'll build a currency conversion agent that exposes an Agentflow graph as an A2A server. You'll also build a client that calls this agent.

## What You'll Build

1. **CurrencyAgent** - An A2A server that converts between currencies
2. **Client** - An interactive CLI that talks to the agent
3. **Custom Executor** - Handles `INPUT_REQUIRED` for missing information

## Prerequisites

- Python 3.12+
- Agentflow with A2A support: `pip install 10xscale-agentflow[a2a_sdk]`
- A Google API key (or any LiteLLM provider)

```bash
export GOOGLE_API_KEY="your-api-key"
```

## Step 1: Project Structure

```
currency-agent/
├── graph.py          # The agent graph
├── executor.py       # Custom executor
├── server.py         # Starts the A2A server
├── client.py         # Interactive client
├── agentflow.json    # A2A configuration
└── .env              # API keys
```

```bash
mkdir currency-agent
cd currency-agent
```

## Step 2: Create the Agent Graph

Create `graph.py`:

```python
"""Currency conversion agent using the Frankfurter API (free, no key needed)."""

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
# Tool: Get exchange rate from Frankfurter API
# --------------------------------------------------------------------------- #

async def get_exchange_rate(
    currency_from: str,
    currency_to: str,
    currency_date: str = "latest",
    amount: float = 1.0,
) -> dict:
    """Get exchange rate between two currencies.

    Args:
        currency_from: Source currency code (e.g., USD, EUR, GBP).
        currency_to: Target currency code.
        currency_date: Date in YYYY-MM-DD format or 'latest'.
        amount: Amount to convert.

    Returns:
        dict with: amount, base, date, rates.
    """
    url = f"https://api.frankfurter.app/{currency_date}"
    params = {"from": currency_from, "to": currency_to, "amount": amount}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()


tool_node = ToolNode([get_exchange_rate])


# --------------------------------------------------------------------------- #
# LLM Node
# --------------------------------------------------------------------------- #

SYSTEM_PROMPT = """You are a helpful currency conversion assistant.
Use the get_exchange_rate tool to look up live exchange rates from the Frankfurter API.
Always tell the user:
1. The converted amount
2. The exchange rate used
3. The date of the rate

If the user doesn't specify currencies or amounts, ask them to clarify."""


async def llm_node(state: AgentState):
    messages = convert_messages(
        system_prompts=[{"role": "system", "content": SYSTEM_PROMPT}],
        state=state,
    )

    # Don't offer tools if we just got tool results (time to summarize)
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
# Routing
# --------------------------------------------------------------------------- #

def should_use_tools(state: AgentState) -> str:
    if not state.context:
        return END

    last = state.context[-1]

    if (
        hasattr(last, "tools_calls")
        and last.tools_calls
        and last.role == "assistant"
    ):
        return "TOOL"

    if last.role == "tool":
        return "MAIN"

    return END


# --------------------------------------------------------------------------- #
# Graph
# --------------------------------------------------------------------------- #

graph = StateGraph()
graph.add_node("MAIN", llm_node)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges(
    "MAIN",
    should_use_tools,
    {"TOOL": "TOOL", "MAIN": "MAIN", END: END},
)
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

# Compile with in-memory checkpointer for session persistence
app = graph.compile(checkpointer=InMemoryCheckpointer[AgentState]())
```

## Step 3: Create a Custom Executor

Create `executor.py` to handle `INPUT_REQUIRED`:

```python
"""Custom executor that detects when the agent needs more info."""

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


# Phrases that indicate the agent is asking for clarification
ASKING_PHRASES = [
    "could you", "please provide", "please specify",
    "what amount", "which currency", "what currency",
    "let me know", "can you tell", "i need",
    "please tell", "what is the", "what date",
]


def _is_asking_for_input(text: str) -> bool:
    """Check if the response is asking for more information."""
    low = text.lower().strip()
    return low.endswith("?") or any(phrase in low for phrase in ASKING_PHRASES)


class CurrencyAgentExecutor(AgentFlowExecutor):
    """Runs the currency graph; emits INPUT_REQUIRED for vague queries."""

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        updater = TaskUpdater(
            event_queue=event_queue,
            task_id=context.task_id or "",
            context_id=context.context_id or "",
        )
        await updater.submit()
        await updater.start_work()

        try:
            # Extract user text
            user_text = context.get_user_input() if context.message else ""
            messages = [AFMessage.text_message(user_text, role="user")]

            # Use context_id as thread_id for session persistence
            run_config = {"thread_id": context.context_id or context.task_id or ""}

            # Run the graph
            result = await self.graph.ainvoke(
                {"messages": messages},
                config=run_config,
                response_granularity=ResponseGranularity.FULL,
            )
            response_text = self._extract_response_text(result)

            # Check if agent is asking for more information
            if _is_asking_for_input(response_text):
                msg = updater.new_agent_message(parts=[TextPart(text=response_text)])
                await updater.update_status(TaskState.input_required, message=msg)
            else:
                await updater.add_artifact([TextPart(text=response_text)])
                await updater.complete()

        except Exception as exc:
            logger.exception("CurrencyAgentExecutor failed")
            err = updater.new_agent_message(parts=[TextPart(text=f"Error: {exc!s}")])
            await updater.failed(message=err)
```

## Step 4: Create the Server

Create `server.py`:

```python
"""Start the CurrencyAgent A2A server."""

from __future__ import annotations

from dotenv import load_dotenv

from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import AgentCapabilities, AgentCard, AgentSkill

from executor import CurrencyAgentExecutor
from graph import app

load_dotenv()


def create_agent_card() -> AgentCard:
    """Build the A2A agent card."""
    return AgentCard(
        name="CurrencyAgent",
        description="Converts between currencies using live exchange rates from the Frankfurter API",
        url="http://localhost:10000",
        version="1.0.0",
        capabilities=AgentCapabilities(streaming=False),
        default_input_modes=["text"],
        default_output_modes=["text"],
        skills=[
            AgentSkill(
                id="currency_conversion",
                name="Currency Conversion",
                description="Convert amounts between currencies. Asks for clarification if info is missing.",
                tags=["currency", "finance", "exchange-rate"],
                examples=[
                    "How much is 100 USD in EUR?",
                    "Convert 50 GBP to JPY",
                    "What's the exchange rate from USD to INR?",
                ],
            ),
        ],
    )


def main():
    """Build and run the A2A server."""
    import uvicorn

    card = create_agent_card()

    # Use our custom executor
    executor = CurrencyAgentExecutor(compiled_graph=app)

    handler = DefaultRequestHandler(
        agent_executor=executor,
        task_store=InMemoryTaskStore(),
    )

    a2a_app = A2AStarletteApplication(
        agent_card=card,
        http_handler=handler,
    ).build()

    print(f"Starting CurrencyAgent at {card.url}")
    print(f"Agent card: {card.url}/.well-known/agent.json")
    uvicorn.run(a2a_app, host="0.0.0.0", port=10000)


if __name__ == "__main__":
    main()
```

## Step 5: Create the Client

Create `client.py`:

```python
"""Interactive client for the CurrencyAgent."""

from __future__ import annotations

import asyncio
import uuid

from agentflow.a2a_integration.client import delegate_to_a2a_agent

SERVER_URL = "http://localhost:10000"

# Session ID - ties all turns together for conversation history
SESSION_ID = str(uuid.uuid4())


async def main() -> None:
    print("CurrencyAgent Client")
    print("=" * 40)
    print(f"Server: {SERVER_URL}")
    print(f"Session: {SESSION_ID[:8]}...")
    print("Type 'quit' to exit\n")

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break

        if not user_input or user_input.lower() == "quit":
            print("Bye!")
            break

        try:
            reply = await delegate_to_a2a_agent(
                SERVER_URL,
                user_input,
                context_id=SESSION_ID,
            )
            print(f"Agent: {reply}\n")
        except Exception as exc:
            print(f"Error: {exc}\n")


if __name__ == "__main__":
    asyncio.run(main())
```

## Step 6: Create Configuration Files

Create `.env`:

```
GOOGLE_API_KEY=your-api-key-here
```

Create `agentflow.json` (optional, for CLI usage):

```json
{
  "agent": "graph:app",
  "env": ".env",
  "a2a": {
    "name": "CurrencyAgent",
    "description": "Currency conversion with INPUT_REQUIRED for missing info.",
    "version": "1.0.0",
    "streaming": false,
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

## Step 7: Run It

**Terminal 1: Start the server**

```bash
python server.py
```

You should see:
```
Starting CurrencyAgent at http://localhost:10000
Agent card: http://localhost:10000/.well-known/agent.json
INFO:     Uvicorn running on http://0.0.0.0:10000 (Press CTRL+C to quit)
```

**Terminal 2: Run the client**

```bash
python client.py
```

### Example Conversation

```
CurrencyAgent Client
========================================
Server: http://localhost:10000
Session: a1b2c3d4...
Type 'quit' to exit

You: Convert 100 USD to EUR
Agent: 100 USD is approximately 92.15 EUR.
Exchange rate: 1 USD = 0.9215 EUR
Date: 2024-03-24

You: What about to GBP?
Agent: 100 USD is approximately 79.12 GBP.
Exchange rate: 1 USD = 0.7912 GBP
Date: 2024-03-24

You: Convert some money
Agent: I'd be happy to help! Could you please specify:
1. The amount you want to convert
2. The source currency (e.g., USD, EUR)
3. The target currency

You: 500 from EUR to JPY
Agent: 500 EUR is approximately 81,250 JPY.
Exchange rate: 1 EUR = 162.5 JPY
Date: 2024-03-24
```

## How It Works

1. **Session Persistence**: The `context_id` ties all messages together. The server uses it as `thread_id` for its checkpointer, so it remembers "100 USD" from the first message when you ask "what about to GBP?"

2. **Tool Calling**: The LLM uses `get_exchange_rate()` to fetch live rates from the Frankfurter API.

3. **INPUT_REQUIRED**: When the user is vague ("convert some money"), the executor detects the question and returns `TaskState.input_required` instead of `completed`.

## Testing the Agent Card

```bash
curl http://localhost:10000/.well-known/agent.json | python -m json.tool
```

```json
{
  "name": "CurrencyAgent",
  "description": "Converts between currencies using live exchange rates...",
  "url": "http://localhost:10000",
  "version": "1.0.0",
  "capabilities": {
    "streaming": false
  },
  "skills": [
    {
      "id": "currency_conversion",
      "name": "Currency Conversion",
      ...
    }
  ]
}
```

## Using from Another Graph

You can call this agent from another Agentflow graph:

```python
from agentflow.a2a_integration import create_a2a_client_node

# Create a node that delegates to the currency agent
currency_node = create_a2a_client_node("http://localhost:10000")

# Use it in your graph
graph.add_node("currency", currency_node)
```

## Next Steps

- Add streaming support for longer responses
- Deploy to a cloud provider
- Add more tools (historical rates, rate alerts, etc.)
- Build a frontend that consumes the A2A API

## Full Example

The complete example is available at:
```
examples/a2a_sdk/currency_agent_cli/
```
