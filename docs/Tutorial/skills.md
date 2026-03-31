# Tutorial: Building a Multi-Skill Assistant

In this tutorial, you'll build an assistant that can switch between three specialized modes: code review, data analysis, and writing assistance. The agent automatically detects which skill matches the user's request and activates it.

## What You'll Build

A single agent that can:
- Review code for bugs, style issues, and improvements
- Analyze data and explain statistics
- Help write and edit professional content

Without skills, you'd need either:
- Three separate agents with routing logic
- One massive system prompt covering everything

Skills let you keep each domain cleanly separated while switching dynamically at runtime.

## Prerequisites

- Python 3.12+
- Agentflow installed: `pip install 10xscale-agentflow`
- A Google API key (or any LiteLLM-compatible provider)

```bash
export GOOGLE_API_KEY="your-api-key"
```

## Step 1: Project Structure

Create this folder structure:

```
multi-skill-assistant/
├── skills/
│   ├── code-review/
│   │   └── SKILL.md
│   ├── data-analysis/
│   │   └── SKILL.md
│   └── writing-assistant/
│       └── SKILL.md
├── .env
└── main.py
```

```bash
mkdir -p multi-skill-assistant/skills/{code-review,data-analysis,writing-assistant}
cd multi-skill-assistant
```

## Step 2: Define the Code Review Skill

Create `skills/code-review/SKILL.md`:

```markdown
---
name: code-review
description: Perform thorough code reviews, identify bugs, suggest improvements, and explain code quality issues
metadata:
  triggers:
    - review my code
    - check this code
    - what's wrong with this code
    - find bugs
    - improve this code
  tags:
    - engineering
  priority: 10
---

You are now in **CODE REVIEW** mode.

Your job is to carefully review code submitted by the user and provide structured, actionable feedback.

## Review Checklist

### 1. Correctness
- Are there logical errors or off-by-one mistakes?
- Are edge cases handled (empty inputs, None, zero, negatives)?
- Are exceptions handled appropriately?

### 2. Code Quality
- Is the code readable and self-documenting?
- Are variable/function names descriptive?
- Is there unnecessary complexity?

### 3. Performance
- Are there obvious inefficiencies (O(n²) where O(n) works)?
- Are there unnecessary loops or repeated calls?

### 4. Security
- Is user input validated/sanitized?
- Are there injection risks?
- Are secrets hardcoded?

## Output Format

Always respond with:
1. **Summary** - one sentence verdict (Looks good / Minor issues / Significant issues)
2. **Issues** - numbered list with severity: 🔴 Critical, 🟡 Warning, 🔵 Suggestion
3. **Improved Version** - rewrite with your fixes (if changes needed)

Be direct and specific. Reference exact line numbers or variable names.
```

## Step 3: Define the Data Analysis Skill

Create `skills/data-analysis/SKILL.md`:

```markdown
---
name: data-analysis
description: Help users analyze data, interpret statistics, explain trends, and answer data-related questions
metadata:
  triggers:
    - analyze this data
    - what does this data mean
    - explain these numbers
    - calculate statistics
    - find trends
  tags:
    - analytics
  priority: 8
---

You are now in **DATA ANALYSIS** mode.

Your job is to help the user make sense of their data clearly and accurately.

## Analysis Approach

### 1. Understand the data
- Identify what each column/field represents
- Note the data type (categorical, numerical, time-series)
- Check for obvious quality issues (missing values, outliers)

### 2. Descriptive statistics
When relevant, compute:
- Count, mean, median, mode
- Min, max, range, standard deviation
- Distributions and skew

### 3. Patterns and trends
- Identify correlations between variables
- Note anomalies or surprising values
- Spot seasonality in time-series data

### 4. Interpretation
- Translate numbers into plain-language insights
- State what the data **suggests** vs what it **proves**
- Flag when sample size limits conclusions

## Output Format

Structure your response as:
1. **Data Overview** - what you see at a glance
2. **Key Findings** - bullet list of important insights
3. **Deeper Analysis** - detailed explanation with numbers
4. **Caveats** - limitations or things to watch out for
5. **Next Steps** - what to investigate further

Always show your working when doing calculations.
```

## Step 4: Define the Writing Assistant Skill

Create `skills/writing-assistant/SKILL.md`:

```markdown
---
name: writing-assistant
description: Help users write, edit, proofread, and improve any type of written content
metadata:
  triggers:
    - help me write
    - proofread this
    - improve my writing
    - edit this
    - write an email
    - draft a message
  tags:
    - writing
  priority: 6
---

You are now in **WRITING ASSISTANT** mode.

Your job is to help the user produce clear, polished, well-structured written content.

## Writing Principles

### Clarity
- Use plain, direct language - avoid jargon unless appropriate
- One idea per sentence; one theme per paragraph
- Active voice is usually stronger than passive

### Structure
- Strong opening that states the purpose immediately
- Logical flow: each paragraph builds on the previous
- Clear conclusion or call to action

### Tone
- Match the tone to the context: professional for business, conversational for casual
- Be warm but concise - avoid filler phrases

## What I Can Help With

- **Emails** - professional, cold outreach, follow-ups, apologies
- **Reports & Docs** - executive summaries, technical docs, proposals
- **Creative Writing** - stories, descriptions, dialogue
- **Social Media** - posts, captions, bios
- **Proofreading** - grammar, spelling, punctuation, style

## Output Format

For **editing tasks**:
1. **Revised Version** - the improved text, ready to use
2. **Changes Made** - brief bullet list of what was changed and why

For **new writing tasks**:
1. **Draft** - the complete written piece
2. **Notes** - any assumptions made about tone, audience, or length

Always ask for clarification on audience and purpose if not specified.
```

## Step 5: Create the Main Script

Create `main.py`:

```python
"""Multi-skill assistant example using Agentflow Skills."""

import sys
from pathlib import Path

from dotenv import load_dotenv

from agentflow.graph import Agent, StateGraph
from agentflow.state import AgentState, Message
from agentflow.skills import SkillConfig
from agentflow.utils.constants import END

load_dotenv()

# Skills directory - contains code-review/, data-analysis/, writing-assistant/
SKILLS_DIR = str(Path(__file__).parent / "skills")

# Create the agent with skills enabled
agent = Agent(
    model="google/gemini-2.5-flash",  # Or "openai/gpt-4o", etc.
    system_prompt=[
        {
            "role": "system",
            "content": (
                "You are a smart, multi-skilled assistant.\n"
                "You have access to specialized skill modes that give you "
                "deeper expertise in specific domains.\n"
                "When the user's request clearly matches a skill, activate "
                "it immediately by calling set_skill() before doing anything else.\n"
                "When the task is done, call clear_skill() to return to general mode."
            ),
        }
    ],
    skills=SkillConfig(
        skills_dir=SKILLS_DIR,
        inject_trigger_table=True,  # Auto-appends skill table to system prompt
        hot_reload=True,            # Re-reads SKILL.md on every call (great for dev)
        auto_deactivate=True,       # Activating new skill clears the old one
    ),
    trim_context=True,  # Safe with skills - they survive trimming!
)

# Get the tool node - already includes set_skill and clear_skill
tool_node = agent.get_tool_node()


def should_use_tools(state: AgentState) -> str:
    """Route to TOOL node if there are tool calls, else END."""
    if not state.context:
        return END

    last = state.context[-1]

    # If assistant made tool calls, go to TOOL node
    if (
        last.role == "assistant"
        and hasattr(last, "tools_calls")
        and last.tools_calls
    ):
        return "TOOL"

    # If we just got tool results, go back to MAIN for final answer
    if last.role == "tool":
        return "MAIN"

    return END


# Build the graph
graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges(
    "MAIN",
    should_use_tools,
    {"TOOL": "TOOL", "MAIN": "MAIN", END: END},
)
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()


def chat(user_input: str, thread_id: str = "demo-1") -> str:
    """Send a message and get the assistant's response."""
    result = app.invoke(
        {"messages": [Message.text_message(user_input)]},
        config={"thread_id": thread_id, "recursion_limit": 15},
    )

    # Extract assistant response
    for msg in reversed(result["messages"]):
        if msg.role == "assistant":
            return msg.text() or "(no response)"
    return "(no response)"


if __name__ == "__main__":
    # Interactive mode or single query
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        print(f"\nUser: {query}\n")
        print(f"Assistant: {chat(query)}\n")
    else:
        print("Multi-Skill Assistant")
        print("=" * 40)
        print("Try these queries:")
        print("  - Review this code: def add(a,b): return a+b")
        print("  - Analyze: sales=[120,95,140] by month")
        print("  - Help me write an apology email")
        print("  - Type 'quit' to exit")
        print("=" * 40)

        thread_id = "interactive-demo"
        while True:
            try:
                user_input = input("\nYou: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nBye!")
                break

            if not user_input or user_input.lower() == "quit":
                print("Bye!")
                break

            response = chat(user_input, thread_id)
            print(f"\nAssistant: {response}")
```

## Step 6: Create Environment File

Create `.env`:

```
GOOGLE_API_KEY=your-api-key-here
```

## Step 7: Run the Assistant

```bash
python main.py
```

### Try These Queries

**Code Review:**
```
You: Review this code: def add(a,b): return a+b
```
The assistant will call `set_skill("code-review")` and respond with structured feedback.

**Data Analysis:**
```
You: Analyze this data: sales = [120, 95, 140, 88, 160] by month
```
The assistant will call `set_skill("data-analysis")` and provide statistical insights.

**Writing Assistance:**
```
You: Help me write a professional apology email to a client
```
The assistant will call `set_skill("writing-assistant")` and draft the email.

**Skill Switching:**
```
You: Find bugs
[Assistant uses code-review skill]

You: What's the average of these numbers: 10, 20, 30
[Assistant switches to data-analysis skill automatically]
```

## How It Works

1. **Startup**: The agent discovers skills from `./skills/` and registers `set_skill` and `clear_skill` tools.

2. **System Prompt**: Each LLM call includes:
   - Your base system prompt
   - A trigger table listing all skills
   - Active skill content (if a skill is active)

3. **Skill Activation**: When the LLM calls `set_skill("code-review")`:
   - The tool returns `"SKILL_ACTIVATED:code-review"`
   - The framework stores this in `state.execution_meta.internal_data`
   - On the next LLM call, the skill's instructions are injected

4. **Context Trimming**: Skills survive `trim_context=True` because:
   - The active skill name is stored in `internal_data`, not message history
   - Skill content is re-injected fresh on every call

## Next Steps

- Add a `style-guide.md` resource to the code-review skill
- Create custom skills for your domain
- Explore `max_active=2` to allow multiple skills at once
- Use tags to organize and filter skills

## Full Example Code

The complete example is available at:
```
examples/skills/graph.py
```
