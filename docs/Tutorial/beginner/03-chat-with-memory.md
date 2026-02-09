# Tutorial 3: Chat with Memory (25 minutes)

**What you'll build:** A chatbot that remembers your conversation history across multiple turns.

**What you'll learn:**
- What checkpointers are and why they're important
- How to use InMemoryCheckpointer
- How to maintain conversation context
- How to build a multi-turn chat loop

**Prerequisites:**
- Completed [Tutorial 2: Adding Tools](02-adding-tools.md)
- Understanding of basic chat concepts

---

## The Problem

Right now, our agents have amnesia. Every time you invoke the agent, it forgets everything:

```python
# First question
ask_agent("My name is Alice")  # Agent: "Nice to meet you, Alice!"

# Second question
ask_agent("What's my name?")  # Agent: "I don't know your name"  ❌
```

**Memory/Checkpointing** solves this by saving conversation state.

---

## What is a Checkpointer?

**Simple explanation:** A checkpointer saves your conversation history so the agent can remember.

Think of it like:
- **Without checkpointer:** Goldfish memory - forgets instantly
- **With checkpointer:** Human memory - remembers the conversation

### Types of Checkpointers

| Type | Storage | Best For |
|------|---------|----------|
| `InMemoryCheckpointer` | RAM (temporary) | Development, testing |
| `PostgresCheckpointer` | Database (permanent) | Production apps |
| `RedisCheckpointer` | Redis (fast) | Production with caching |

We'll start with InMemoryCheckpointer for learning.

---

## Step 1: Create a Chatbot

Create `chat_agent.py`:

```python
import os
from dotenv import load_dotenv
from agentflow.graph import StateGraph, END
from agentflow.state import AgentState, Message
from agentflow.graph.agent_class import Agent
from agentflow.checkpointer import InMemoryCheckpointer  # <-- Import this

load_dotenv()


# System prompt for a friendly chatbot
system_prompt = """You are Buddy, a friendly AI assistant.

Personality:
- Warm and conversational
- Remember details users share with you
- Ask follow-up questions
- Use the user's name if they tell you

Keep responses concise and friendly.
"""

# Create agent
agent = Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt=system_prompt
)

# Build workflow
workflow = StateGraph(state_schema=AgentState)
workflow.add_node("agent", agent)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

# Create checkpointer
checkpointer = InMemoryCheckpointer()

# Compile with checkpointer!
app = workflow.compile(checkpointer=checkpointer)  # <-- Add checkpointer here

print("✅ Chat agent with memory ready!")
```

---

## Step 2: Use Thread IDs

To maintain conversation memory, you need a **thread_id**. Think of it as a conversation ID.

```python
def chat(user_message: str, thread_id: str = "default"):
    """Send a message and get a response"""
    print(f"\n🙋 You: {user_message}")

    # Config with thread_id - this is how we track conversations
    config = {"thread_id": thread_id}

    result = app.invoke(
        {"messages": [Message.text_message(user_message, "user")]},
        config=config  # <-- Pass the config with thread_id
    )

    response = result["messages"][-1].content
    print(f"🤖 Buddy: {response}")
    return response


if __name__ == "__main__":
    # Start a conversation
    chat("Hi! My name is Alice.", thread_id="alice_chat")
    chat("What's my name?", thread_id="alice_chat")
    chat("I love pizza!", thread_id="alice_chat")
    chat("What do I love?", thread_id="alice_chat")
```

---

## Step 3: Run It!

```bash
python chat_agent.py
```

### Expected Output

```
✅ Chat agent with memory ready!

🙋 You: Hi! My name is Alice.
🤖 Buddy: Hi Alice! It's great to meet you! How are you doing today?

🙋 You: What's my name?
🤖 Buddy: Your name is Alice! 😊 What can I help you with?

🙋 You: I love pizza!
🤖 Buddy: Pizza is awesome! Do you have a favorite type?

🙋 You: What do I love?
🤖 Buddy: You love pizza! 🍕 Have you tried making pizza at home?
```

**🎉 The agent remembers!**

---

## Understanding Thread IDs

The `thread_id` is like a conversation ID:

```python
# Conversation 1
chat("My name is Alice", thread_id="conv_1")
chat("What's my name?", thread_id="conv_1")  # ✅ "Your name is Alice"

# Conversation 2 (different thread)
chat("What's my name?", thread_id="conv_2")  # ❌ "I don't know"

# Back to Conversation 1
chat("Do you remember me?", thread_id="conv_1")  # ✅ "Yes, Alice!"
```

**Each thread_id is a separate conversation.**

---

## Step 4: Build an Interactive Chat Loop

Let's make it interactive so you can chat in real-time:

```python
def interactive_chat(thread_id: str = "interactive"):
    """Start an interactive chat session"""
    print("💬 Interactive Chat (type 'quit' to exit)")
    print("=" * 50)

    config = {"thread_id": thread_id}

    while True:
        # Get user input
        user_input = input("\n🙋 You: ").strip()

        if user_input.lower() in ['quit', 'exit', 'bye']:
            print("🤖 Buddy: Goodbye! It was nice chatting with you! 👋")
            break

        if not user_input:
            continue

        # Send to agent
        result = app.invoke(
            {"messages": [Message.text_message(user_input, "user")]},
            config=config
        )

        response = result["messages"][-1].content
        print(f"🤖 Buddy: {response}")


if __name__ == "__main__":
    # Run interactive chat
    interactive_chat(thread_id="my_chat_session")
```

---

## Step 5: Test Interactive Chat

```bash
python chat_agent.py
```

```
💬 Interactive Chat (type 'quit' to exit)
==================================================

🙋 You: Hey! I'm Bob and I'm learning Python.
🤖 Buddy: Hi Bob! That's great that you're learning Python! How's it going so far? What are you working on?

🙋 You: I'm building a chatbot actually!
🤖 Buddy: That's awesome, Bob! Building a chatbot is a fantastic way to learn Python. What features are you adding to it?

🙋 You: What am I learning?
🤖 Buddy: You're learning Python! And you're building a chatbot as a project. How's that going?

🙋 You: quit
🤖 Buddy: Goodbye! It was nice chatting with you! 👋
```

---

## How Memory Works

### Behind the Scenes

1. **First message:**
   ```python
   User: "My name is Alice"
   # Checkpointer saves: [user_message]
   Agent: "Hi Alice!"
   # Checkpointer saves: [user_message, agent_response]
   ```

2. **Second message:**
   ```python
   User: "What's my name?"
   # Checkpointer loads: [previous messages]
   # Agent sees: ["My name is Alice", "Hi Alice!", "What's my name?"]
   Agent: "Your name is Alice!"
   ```

The agent always sees the full conversation history!

---

## Step 6: View Conversation History

You can see what's stored in memory:

```python
def show_conversation_history(thread_id: str):
    """Display all messages in a conversation"""
    config = {"thread_id": thread_id}

    # Get current state
    state = app.get_state(config)

    if not state or not state.values.get("messages"):
        print(f"No conversation found for thread '{thread_id}'")
        return

    print(f"\n📜 Conversation History (Thread: {thread_id})")
    print("=" * 50)

    for msg in state.values["messages"]:
        if msg.role == "user":
            print(f"🙋 User: {msg.content}")
        elif msg.role == "assistant":
            print(f"🤖 Agent: {msg.content}")

    print("=" * 50)


# Usage
chat("Hi, I'm Alice", thread_id="demo")
chat("I like coding", thread_id="demo")
show_conversation_history("demo")
```

---

## Working with Multiple Conversations

```python
# Customer support scenario
def customer_support_demo():
    """Example: Multiple customer conversations"""

    # Customer 1
    chat("I have a problem with my order", thread_id="customer_001")
    chat("Order number is 12345", thread_id="customer_001")

    # Customer 2 (different conversation)
    chat("How do I reset my password?", thread_id="customer_002")
    chat("My email is user@example.com", thread_id="customer_002")

    # Back to Customer 1
    chat("Did you find my order?", thread_id="customer_001")  # Remembers order 12345!

    # View histories
    show_conversation_history("customer_001")
    show_conversation_history("customer_002")


customer_support_demo()
```

---

## Complete Code

```python
from dotenv import load_dotenv
from agentflow.graph import StateGraph, END, Agent
from agentflow.state import AgentState, Message
from agentflow.checkpointer import InMemoryCheckpointer

load_dotenv()

# System prompt
system_prompt = """You are Buddy, a friendly AI assistant.

Personality:
- Warm and conversational
- Remember details users share
- Ask follow-up questions
- Use the user's name if they tell you

Keep responses concise and friendly.
"""

# Create agent and workflow
agent = Agent(model="gemini/gemini-2.5-flash", system_prompt=system_prompt)

workflow = StateGraph()
workflow.add_node("agent", agent)
workflow.set_entry_point("agent")
workflow.add_edge("agent", END)

# Add checkpointer
checkpointer = InMemoryCheckpointer()
app = workflow.compile(checkpointer=checkpointer)


def chat(user_message: str, thread_id: str = "default"):
    """Send a message and get response"""
    print(f"\n🙋 You: {user_message}")
    config = {"thread_id": thread_id}
    result = app.invoke(
        {"messages": [Message.text_message(user_message, "user")]},
        config=config
    )
    response = result["messages"][-1].content
    print(f"🤖 Buddy: {response}")
    return response


def interactive_chat(thread_id: str = "interactive"):
    """Interactive chat loop"""
    print("💬 Interactive Chat (type 'quit' to exit)")
    print("=" * 50)

    config = {"thread_id": thread_id}

    while True:
        user_input = input("\n🙋 You: ").strip()

        if user_input.lower() in ['quit', 'exit', 'bye']:
            print("🤖 Buddy: Goodbye! 👋")
            break

        if not user_input:
            continue

        result = app.invoke(
            {"messages": [Message.text_message(user_input, "user")]},
            config=config
        )
        print(f"🤖 Buddy: {result['messages'][-1].content}")


if __name__ == "__main__":
    # Option 1: Programmatic chat
    # chat("Hi, I'm Alice!", thread_id="demo")
    # chat("What's my name?", thread_id="demo")

    # Option 2: Interactive chat
    interactive_chat(thread_id="my_session")
```

---

## InMemoryCheckpointer Limitations

⚠️ **Important:** `InMemoryCheckpointer` stores data in RAM:

- ✅ Great for: Development, testing, demos
- ❌ Not for: Production, long-term storage
- ❌ Data lost when: Program restarts

**For production**, use:
- `PostgresCheckpointer` - Persistent database storage
- `RedisCheckpointer` - Fast, distributed caching

We'll cover these in advanced tutorials!

---

## Challenges

### Challenge 1: User Profiles
Make the agent remember user preferences:
```
User: "I prefer dark mode"
User: "What's my theme preference?"
Agent: "You prefer dark mode!"
```

### Challenge 2: Context Tracking
Build an agent that tracks task lists:
```
User: "Add 'buy milk' to my todo list"
User: "What's on my list?"
Agent: "You have: buy milk"
```

### Challenge 3: Multi-User Chat
Create a chat system where:
- Each user has their own thread_id
- Agent remembers each user separately
- Display all active conversations

---

## Common Issues

### "Agent doesn't remember"
1. Check that you're passing `config={"thread_id": "..."}` in invoke
2. Make sure you're using the **same** thread_id across messages
3. Verify checkpointer is passed to compile: `app.compile(checkpointer=...)`

### "Thread not found"
Each thread_id is unique. Make sure you're using the right one:
```python
# Wrong - different IDs
chat("Hi", thread_id="chat1")
chat("Remember me?", thread_id="chat2")  # Different thread!

# Correct - same ID
chat("Hi", thread_id="chat1")
chat("Remember me?", thread_id="chat1")  # Same thread ✅
```

---

## Next Steps

Awesome! Your agents now have memory!

**Next tutorial:** [Multi-Agent Systems](04-multi-agent-handoff.md) →

Learn how to build systems with multiple specialized agents working together.

---

## What You've Accomplished ✅

- ✅ Added memory to your agent with checkpointers
- ✅ Used thread_ids to track conversations
- ✅ Built an interactive chat loop
- ✅ Managed multiple conversations
- ✅ Viewed conversation history

**Your agents can now have real conversations!** 🎉🧠
