import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import HomepageFeatures from '../components/HomepageFeatures';
import TerminalBlock from '../components/TerminalBlock';
import StatsBar from '../components/StatsBar';
import LogoWall from '../components/LogoWall';
import CodeSwitcher, {type CodeSample} from '../components/CodeSwitcher';
import PackageMap from '../components/PackageMap';
import Icon from '../components/Icon';
import {brandIcons} from '../lib/brand-icons';
import {trackEvent} from '../lib/analytics';

const docTracks = [
  {
    eyebrow: '01',
    title: 'Start with a working Python agent',
    body: 'Install AgentFlow, run your first agent, and move from local code to a served app without guessing the next step.',
    href: '/docs/get-started',
  },
  {
    eyebrow: '02',
    title: 'Learn the core concepts',
    body: 'Understand agents, tools, state, memory, streaming, and production runtime boundaries before you scale up.',
    href: '/docs/concepts/architecture',
  },
  {
    eyebrow: '03',
    title: 'Use tutorials, how-to guides, and reference',
    body: 'Jump into example-driven tutorials, targeted implementation guides, and API reference for Python, REST, and TypeScript.',
    href: '/docs/tutorials',
  },
];

const heroQuickstart = `from agentflow.core.graph import Agent, StateGraph, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.utils import END

def get_weather(location: str) -> str:
    """Get current weather for a city."""
    return f"The weather in {location} is sunny."

agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[{"role": "system", "content": "Helpful assistant."}],
    tool_node="TOOL",
)

graph = StateGraph(AgentState)
graph.add_node("MAIN", agent)
graph.add_node("TOOL", ToolNode([get_weather]))
graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()`;

const samples: CodeSample[] = [
  {
    label: 'AgentFlow',
    badge: 'recommended',
    filename: 'agent.py',
    language: 'python',
    code: `from agentflow.core.graph import Agent, StateGraph, ToolNode
from agentflow.core.state import AgentState, Message

agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[{"role": "system", "content": "Helpful assistant."}],
    tool_node="TOOL",
)

graph = StateGraph(AgentState)
graph.add_node("MAIN", agent)
graph.add_node("TOOL", ToolNode([get_weather]))
# ... add edges + compile + invoke
app = graph.compile()`,
    footer: 'Same graph mental model. No LangChain dependency. Built-in API + TS client.',
  },
  {
    label: 'LangGraph',
    filename: 'agent.py',
    language: 'python',
    code: `from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

@tool
def get_weather(location: str) -> str:
    """Get current weather."""
    return f"The weather in {location} is sunny."

memory = MemorySaver()
app = create_react_agent(
    "openai:gpt-4o-mini",
    tools=[get_weather],
    checkpointer=memory,
)`,
    footer: 'LangGraph: requires langchain_core, prebuilt agent hides the graph.',
  },
  {
    label: 'CrewAI',
    filename: 'crew.py',
    language: 'python',
    code: `from crewai import Agent, Task, Crew, Process

agent = Agent(
    role="Weather assistant",
    goal="Answer weather questions accurately",
    backstory="Expert meteorologist",
    tools=[get_weather_tool],
)

task = Task(
    description="Answer the weather question",
    expected_output="Current weather summary",
    agent=agent,
)

crew = Crew(agents=[agent], tasks=[task], process=Process.sequential)
result = crew.kickoff()`,
    footer: 'CrewAI: role-based DSL. Persistence + API serving are extra glue.',
  },
  {
    label: 'AutoGen',
    filename: 'agent.py',
    language: 'python',
    code: `import asyncio
from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient

async def main():
    model = OpenAIChatCompletionClient(model="gpt-4o-mini")
    agent = AssistantAgent(
        "weather",
        model_client=model,
        system_message="Helpful assistant. Use get_weather.",
        tools=[get_weather],
    )
    await agent.run_stream(task="Weather in Tokyo?")

asyncio.run(main())`,
    footer: 'AutoGen: conversation-driven. LLM-powered selectors hide control flow.',
  },
  {
    label: 'Google ADK',
    filename: 'agent.py',
    language: 'python',
    code: `from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

agent = LlmAgent(
    name="weather_assistant",
    model="gemini-2.0-flash",
    instruction="Helpful assistant. Use get_weather when asked.",
    tools=[FunctionTool(func=get_weather)],
)`,
    footer: 'Google ADK: opinionated for Vertex AI. Best on Google Cloud.',
  },
];

const journey = [
  {step: '01', title: 'First agent', body: 'Create a working agent and understand the moving parts.'},
  {step: '02', title: 'Tools and state', body: 'Give the agent capabilities; learn how state moves through a workflow.'},
  {step: '03', title: 'Multi-agent flow', body: 'Compose agents into predictable handoffs and reusable workflows.'},
  {step: '04', title: 'Production surface', body: 'Add persistence, APIs, streaming, clients, and deployment.'},
];

export default function Home() {
  return (
    <Layout
      title="AgentFlow — Open-Source Python Framework for Production AI Agents"
      description="AgentFlow is an open-source Python framework for building production AI agents — multi-agent orchestration, memory, streaming, REST API, and TypeScript client out of the box. A modern alternative to LangGraph, CrewAI, and AutoGen.">
      <main>
        {/* HERO */}
        <section className="hero hero--agentflow">
          <div className="container heroGrid">
            <div className="heroCopy">
              <p className="eyebrow">
                <Icon name="Sparkles" size={12} /> &nbsp;v1.0 &nbsp;·&nbsp; MIT &nbsp;·&nbsp; Python 3.10+
              </p>
              <Heading as="h1" className="heroTitle">
                Build production-ready AI agents in Python — in minutes, not weeks.
              </Heading>
              <Heading as="h2" className="heroSubheadline">
                A batteries-included framework for multi-agent orchestration,
                memory, and streaming APIs — a modern alternative to LangGraph,
                CrewAI, and AutoGen.
              </Heading>
              <p className="heroSubtitle">
                Typed graphs, durable threads, a REST + SSE server, and a typed
                TypeScript client. Ship a working agent fast and scale to
                production without rewriting the foundation.
              </p>
              <div className="heroActions">
                <Link
                  className="button button--primary button--lg"
                  to="/docs/get-started"
                  onClick={() => trackEvent('cta_start_building', {location: 'hero'})}>
                  Start building &nbsp;→
                </Link>
                <Link
                  className="button button--secondary button--lg"
                  to="https://github.com/10xHub/Agentflow"
                  onClick={() => trackEvent('cta_github', {location: 'hero'})}>
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    width={16}
                    height={16}
                    aria-hidden="true"
                    style={{fill: 'currentColor'}}>
                    <path d={brandIcons.github.path} />
                  </svg>
                  &nbsp; GitHub
                </Link>
              </div>
              <TerminalBlock
                filename="bash"
                code="pip install agentflow 10xscale-agentflow-cli"
                language="bash"
                compact
              />
            </div>
            <div className="heroVisual">
              <TerminalBlock
                filename="agent.py"
                code={heroQuickstart}
                language="python"
              />
            </div>
          </div>
        </section>

        {/* STATS */}
        <StatsBar />

        {/* LOGO WALL */}
        <LogoWall />

        {/* FEATURE PILLARS */}
        <HomepageFeatures />

        {/* SAME AGENT, EVERY FRAMEWORK */}
        <section className="section section--switcher">
          <div className="container">
            <div className="sectionHeader sectionHeader--center">
              <p className="eyebrow">
                <Icon name="GitCompare" size={12} /> &nbsp;Same agent, every framework
              </p>
              <Heading as="h2">A familiar mental model — without the glue.</Heading>
              <p>
                Click through the tabs to see the same ReAct agent in five
                different frameworks. AgentFlow keeps the graph explicit and
                ships the production stack with it.
              </p>
            </div>
            <CodeSwitcher samples={samples} />
          </div>
        </section>

        {/* TRACKS */}
        <section className="section section--tracks">
          <div className="container">
            <div className="sectionHeader sectionHeader--center">
              <p className="eyebrow">Documentation tracks</p>
              <Heading as="h2">Pick the next useful page fast.</Heading>
            </div>
            <div className="trackGrid">
              {docTracks.map((track) => (
                <Link
                  className="trackCard"
                  to={track.href}
                  key={track.title}
                  onClick={() =>
                    trackEvent('cta_doc_track', {track: track.title, href: track.href})
                  }>
                  <span>{track.eyebrow}</span>
                  <Heading as="h3">{track.title}</Heading>
                  <p>{track.body}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* PACKAGE MAP */}
        <section className="section section--package-map">
          <div className="container">
            <div className="sectionHeader sectionHeader--center">
              <p className="eyebrow">
                <Icon name="Boxes" size={12} /> &nbsp;Connected stack
              </p>
              <Heading as="h2">One project, four packages, zero glue.</Heading>
              <p>
                The Python runtime, the API server, the TypeScript client, and
                the hosted playground are designed together. Same types,
                same threads, same primitives — across the whole stack.
              </p>
            </div>
            <PackageMap />
          </div>
        </section>

        {/* JOURNEY */}
        <section className="section section--journey">
          <div className="container">
            <div className="sectionHeader">
              <p className="eyebrow">Beginner-friendly by design</p>
              <Heading as="h2">A docs path that teaches the product.</Heading>
              <p>
                Install the library, build one agent, add tools and memory,
                expose it through the API, connect a client, then deploy.
              </p>
            </div>
            <div className="journeyGrid">
              {journey.map((j) => (
                <article className="journeyCard" key={j.step}>
                  <span>{j.step}</span>
                  <Heading as="h3">{j.title}</Heading>
                  <p>{j.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="section section--final-cta">
          <div className="container">
            <div className="finalCta">
              <Heading as="h2">Ship a working agent in five minutes.</Heading>
              <p>
                Install, build a graph, expose an API, connect a TypeScript
                client. Then keep going — without rewriting anything.
              </p>
              <div className="heroActions">
                <Link
                  className="button button--primary button--lg"
                  to="/docs/get-started"
                  onClick={() => trackEvent('cta_start_building', {location: 'footer'})}>
                  Get started &nbsp;→
                </Link>
                <Link
                  className="button button--secondary button--lg"
                  to="/docs/compare"
                  onClick={() => trackEvent('cta_compare_page', {location: 'footer'})}>
                  Compare frameworks
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
