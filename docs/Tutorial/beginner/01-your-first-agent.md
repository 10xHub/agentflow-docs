# Tutorial 1: Build Your First Real Agent (15 minutes)

**What you'll build:** A weather assistant agent that answers questions about weather using different LLM providers.

**What you'll learn:**
- How to create an agent with custom system prompts
- How to switch between LLM providers (OpenAI, Gemini, Claude)
- How to handle agent responses
- Best practices for agent configuration

**Prerequisites:**
- Completed [Hello World](../../getting-started/hello-world.md)
- AgentFlow installed
- At least one LLM API key

---

## The Goal

By the end of this tutorial, you'll have built a weather assistant agent that:
- Has a specific personality (friendly weather expert)
- Can use different LLMs (you choose!)
- Gives helpful, structured responses

---

## Step 1: Setup Your Project

Create a new file called `weather_agent.py`:

```python
from dotenv import load_dotenv
from agentflow.graph import StateGraph, END, Agent
from agentflow.state import AgentState, Message

# Load environment variables from .env file
load_dotenv()
```

**💡 Tip:** Create a `.env` file in the same directory:

```
OPENAI_API_KEY=sk-proj-xxxxx
# OR
GOOGLE_API_KEY=AIzaSy-xxxxx
# OR
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

---

## Step 2: Define Your Agent's Personality

One of the most powerful features of AgentFlow is customizing your agent's behavior through system prompts.

```python
# Define the system prompt - this shapes your agent's personality
system_prompt = """You are a friendly weather assistant named Sunny.

Your role:
- Provide weather information in a helpful, cheerful way
- Always be enthusiastic about good weather
- Empathize when the weather is bad
- Keep responses concise (2-3 sentences max)
- Use weather emojis when appropriate (☀️, 🌧️, ⛈️, ❄️)

Style:
- Casual and friendly
- Add a fun weather fact occasionally
- Never be overly technical
"""
```

---

## Step 3: Create the Agent with Your Choice of LLM

Now let's create the agent. Choose one of these LLM options:

### Option A: Using OpenAI (GPT-4)

```python
agent = Agent(
    model="openai/gpt-4o",  # or "openai/gpt-4o-mini" for faster/cheaper
    system_prompt=system_prompt
)
```

### Option B: Using Google Gemini

```python
agent = Agent(
    model="gemini/gemini-2.5-flash",  # Fast and cost-effective
    system_prompt=system_prompt
)
```

### Option C: Using Anthropic Claude

```python
agent = Agent(
    model="anthropic/claude-3-5-sonnet-20241022",  # Very capable
    system_prompt=system_prompt
)
```

**💡 Tip:** You can easily switch between providers by just changing the model name!

---

## Step 4: Build the Workflow

```python
# Create the workflow
workflow = StateGraph()

# Add the agent as a node
workflow.add_node("sunny_agent", agent)

# Define the flow: start → agent → end
workflow.set_entry_point("sunny_agent")
workflow.add_edge("sunny_agent", END)

# Compile the workflow
app = workflow.compile()

print("✅ Weather Agent initialized!")
```

---

## Step 5: Run Your Agent

Let's test it with different weather-related questions:

```python
def ask_agent(question: str):
    """Helper function to ask the agent a question"""
    print(f"\n🙋 You: {question}")

    result = app.invoke({
        "messages": [Message.text_message(question, "user")]
    })

    response = result["messages"][-1].content
    print(f"🤖 Sunny: {response}")
    return response


# Test different questions
if __name__ == "__main__":
    # Test 1: General weather question
    ask_agent("Should I bring an umbrella today in New York?")

    # Test 2: Weather planning
    ask_agent("I'm planning a picnic this weekend. What should I know about the weather?")

    # Test 3: Ask for advice
    ask_agent("It's raining outside. What should I do?")
```

---

## Step 6: Run and See Results

Run your agent:

```bash
python weather_agent.py
```

### Expected Output

```
✅ Weather Agent initialized!

🙋 You: Should I bring an umbrella today in New York?
🤖 Sunny: I don't have real-time weather data, but it's always wise to check the forecast! ☔ If rain is predicted, definitely bring that umbrella to stay dry. Fun fact: Did you know an umbrella can reduce rainfall impact by up to 90%?

🙋 You: I'm planning a picnic this weekend. What should I know about the weather?
🤖 Sunny: Great idea! 🌞 Check the forecast for sunny skies and mild temps – perfect picnic conditions! Keep an eye out for any surprise showers, though. Fun fact: The best picnic weather is around 70-75°F with light winds!

🙋 You: It's raining outside. What should I do?
🤖 Sunny: Rainy days are perfect for cozy indoor activities! 🌧️ Grab a good book, watch a movie, or try cooking something new. The rain will pass, and you'll appreciate the sunshine even more!
```

---

## What You Just Learned

### 1. **System Prompts Shape Behavior**
The system prompt is like giving your agent a personality and job description. Compare:

```python
# Generic agent
"You are a helpful assistant."

# Specialized agent (like we built)
"You are a friendly weather assistant named Sunny..."
```

The specialized version gives much better, on-brand responses!

### 2. **LLM Flexibility**
You can switch between providers easily:
```python
model="openai/gpt-4o"        # OpenAI
model="gemini/gemini-2.5-flash"  # Google
model="anthropic/claude-3-5-sonnet-20241022"  # Anthropic
```

All work with the same code!

### 3. **Workflow Pattern**
Every AgentFlow app follows this pattern:
```python
StateGraph → add_node → set flow → compile → invoke
```

---

## Experiment Time! 🧪

Try these challenges:

### Challenge 1: Change the Personality
Modify the system prompt to make Sunny more:
- Professional and formal
- Funny and sarcastic
- Technical and scientific

### Challenge 2: Switch LLM Providers
Try running with different models and compare responses:
- Which one is fastest?
- Which gives the most creative responses?
- Which is most accurate?

### Challenge 3: Create a Different Agent
Create a new agent with a completely different purpose:
- Fitness coach
- Cooking assistant
- Study buddy
- Code reviewer

Just change the system prompt and see what happens!

---

## Complete Code

Here's the full `weather_agent.py`:

```python
from dotenv import load_dotenv
from agentflow.graph import StateGraph, END, Agent
from agentflow.state import AgentState, Message

# Load environment variables
load_dotenv()

# Define system prompt
system_prompt = """You are a friendly weather assistant named Sunny.

Your role:
- Provide weather information in a helpful, cheerful way
- Always be enthusiastic about good weather
- Empathize when the weather is bad
- Keep responses concise (2-3 sentences max)
- Use weather emojis when appropriate (☀️, 🌧️, ⛈️, ❄️)

Style:
- Casual and friendly
- Add a fun weather fact occasionally
- Never be overly technical
"""

# Create agent (choose your LLM provider)
agent = Agent(
    model="gemini/gemini-2.5-flash",  # Change this to your preferred model
    system_prompt=system_prompt
)

# Build workflow
workflow = StateGraph()
workflow.add_node("sunny_agent", agent)
workflow.set_entry_point("sunny_agent")
workflow.add_edge("sunny_agent", END)

# Compile
app = workflow.compile()

print("✅ Weather Agent initialized!")


def ask_agent(question: str):
    """Helper function to ask the agent a question"""
    print(f"\n🙋 You: {question}")

    result = app.invoke({
        "messages": [Message.text_message(question, "user")]
    })

    response = result["messages"][-1].content
    print(f"🤖 Sunny: {response}")
    return response


if __name__ == "__main__":
    # Test different questions
    ask_agent("Should I bring an umbrella today in New York?")
    ask_agent("I'm planning a picnic this weekend. What should I know about the weather?")
    ask_agent("It's raining outside. What should I do?")
```

---

## Common Issues

### "No API key provided"
Make sure your `.env` file has the correct API key:
```
OPENAI_API_KEY=sk-proj-xxxxx
```

And you're loading it with `load_dotenv()`.

### "Invalid model name"
Check the model name format:
- ✅ `"openai/gpt-4o"` (provider/model)
- ❌ `"gpt-4o"` (missing provider)

### "Rate limited"
You've hit the API rate limit. Solutions:
1. Wait a few seconds and try again
2. Switch to a different model
3. Add rate limiting to your code

---

## Next Steps

Great job! You've built a specialized AI agent.

**Next tutorial:** [Adding Tools to Your Agent](02-adding-tools.md) →

In the next tutorial, you'll learn how to give your agent superpowers by adding tools (like actually fetching real weather data!).

---

## What You've Accomplished ✅

- ✅ Created an agent with a custom personality
- ✅ Used system prompts effectively
- ✅ Switched between different LLM providers
- ✅ Built a complete workflow
- ✅ Tested your agent with multiple questions

**You're building real AI applications!** Keep going! 🚀
