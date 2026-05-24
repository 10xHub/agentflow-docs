import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import HomepageFeatures from '../components/HomepageFeatures';
import TerminalBlock from '../components/TerminalBlock';
import StatsBar from '../components/StatsBar';
import LogoWall from '../components/LogoWall';
import CodeSwitcher, {type CodeSample} from '../components/CodeSwitcher';
import PackageMap from '../components/PackageMap';
import FAQ, {type FAQEntry} from '../components/FAQ';
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

const heroQuickstart = `from agentflow.core.state import AgentState, Message
from agentflow.prebuilt.agent import ReactAgent

def get_weather(
    location: str,
) -> str:
    return f"The weather in {location} is sunny."

react_agent = ReactAgent(
    model="google/gemini-2.5-flash",
    system_prompt=[{
        "role": "system",
        "content": "You are a helpful assistant. Use tools when they help answer the user.",
    }],
    tools=[get_weather],
)

app = react_agent.compile()
result = app.invoke(
    {"messages": [Message.text_message("Weather in Tokyo?")]},
    config={"thread_id": "demo", "recursion_limit": 10},
)`;

const samples: CodeSample[] = [
  {
    label: 'AgentFlow',
    badge: 'recommended',
    filename: 'agent.py',
    language: 'python',
    code: `from agentflow.core.state import AgentState, Message
from agentflow.prebuilt.agent import ReactAgent

def get_weather(
    location: str,
    tool_call_id: str | None = None,
    state: AgentState | None = None,
) -> str:
    return f"The weather in {location} is sunny."

react_agent = ReactAgent(
    model="google/gemini-2.5-flash",
    system_prompt=[{"role": "system", "content": "Helpful assistant."}],
    tools=[get_weather],
    trim_context=True,
)

app = react_agent.compile()`,
    footer: 'Prebuilt ReactAgent — no graph wiring, no LangChain dependency. Built-in API + TS client.',
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

const tenxFeatures = [
  {icon: 'ShieldCheck' as const, text: 'Used in production at 10xScale across all products'},
  {icon: 'GitBranch' as const, text: 'Typed StateGraph — explicit, readable, replayable'},
  {icon: 'DatabaseZap' as const, text: 'Redis + Postgres dual-layer persistence'},
  {icon: 'Zap' as const, text: 'Multi-model: OpenAI, Gemini, Anthropic, and custom'},
  {icon: 'Globe' as const, text: 'REST + SSE server included — zero extra config'},
  {icon: 'Code2' as const, text: 'Typed TypeScript client with React streaming hooks'},
  {icon: 'Lock' as const, text: 'JWT auth, rate limiting, Snowflake IDs built in'},
];

const faqItems: FAQEntry[] = [
  {
    q: 'What is AgentFlow?',
    a: 'AgentFlow (package: 10xscale-agentflow) is an open-source Python framework for building production-grade multi-agent AI systems. It provides a typed StateGraph for workflow orchestration, durable thread persistence via Redis and Postgres, a built-in REST and SSE API server, and a TypeScript client SDK. It is a modern, batteries-included alternative to LangGraph, CrewAI, AutoGen, and Google ADK.',
  },
  {
    q: 'Who built AgentFlow and why?',
    a: '10xScale, an AI-product company, built AgentFlow to power their own production AI products. After finding that existing frameworks required too much custom plumbing to reach production, 10xScale built a batteries-included framework and open-sourced it under the MIT license. Every product at 10xScale runs on AgentFlow.',
  },
  {
    q: 'How is AgentFlow different from LangGraph?',
    a: 'AgentFlow and LangGraph share the graph-based mental model, but AgentFlow ships the full production stack: a built-in REST and SSE API server, a typed TypeScript client, a hosted playground, and dual-layer Redis + Postgres persistence. LangGraph requires separate LangServe or LangSmith integration and pulls in the LangChain dependency tree. AgentFlow has no LangChain dependency.',
  },
  {
    q: 'How is AgentFlow different from CrewAI or AutoGen?',
    a: 'CrewAI uses a role-based DSL that hides control flow; adding persistence and an API server requires significant extra glue. AutoGen is conversation-driven with LLM-powered selectors, making deterministic routing hard to reason about. AgentFlow keeps the graph explicit, typed, and readable, with production infrastructure included from day one.',
  },
  {
    q: 'Which AI models does AgentFlow support?',
    a: 'AgentFlow supports OpenAI (GPT-4o, o1, o3-mini), Google Gemini (Gemini 2.5 Flash, Gemini 2.0), Anthropic Claude (Claude 3.5, Claude 4), and any model exposed via a compatible API. You switch models by changing the model string — the graph and tools stay exactly the same.',
  },
  {
    q: 'Does AgentFlow support streaming?',
    a: 'Yes. AgentFlow ships a built-in SSE (Server-Sent Events) endpoint on the API server. The TypeScript client (@10xscale/agentflow-client) includes React hooks for streaming responses token-by-token or message-by-message. The hosted playground uses these hooks.',
  },
  {
    q: 'Can I use AgentFlow with TypeScript or a Next.js frontend?',
    a: 'Yes. The @10xscale/agentflow-client npm package is a fully typed TypeScript SDK that covers all API endpoints: invoke, stream, threads, memory, and file operations. It ships React hooks for streaming and is compatible with Next.js, Vite, Remix, and any React project.',
  },
  {
    q: 'Is AgentFlow production-ready?',
    a: 'AgentFlow is the runtime used in production by 10xScale for all their AI products. It ships with Postgres + Redis dual-layer persistence for durable threads, JWT authentication, rate limiting, Snowflake ID generation for distributed deployments, and Docker/Kubernetes build support via `agentflow build --docker-compose`.',
  },
  {
    q: 'How do I install AgentFlow?',
    a: 'Install the core library and CLI with: pip install 10xscale-agentflow 10xscale-agentflow-cli. Then scaffold a project with `agentflow init`, start a dev server with `agentflow api`, and open the playground with `agentflow play`. The TypeScript client is available via: npm install @10xscale/agentflow-client.',
  },
  {
    q: 'What is the license for AgentFlow?',
    a: 'AgentFlow is released under the MIT license. You can use it freely in commercial and open-source products without restriction. The full source code is available on GitHub at github.com/10xHub/Agentflow.',
  },
];

export default function Home() {
  return (
    <Layout
      title="AgentFlow by 10xScale — Production Python Framework for AI Agents"
      description="AgentFlow is the open-source Python framework built by 10xScale to power all their AI products in production. Multi-agent orchestration, durable memory, streaming, REST API, and TypeScript client included. A modern alternative to LangGraph, CrewAI, and AutoGen.">
      <main>
        {/* HERO */}
        <section className="hero hero--agentflow">
          <div className="container heroGrid">
            <div className="heroCopy">
              <p className="eyebrow">
                <Icon name="Sparkles" size={12} /> &nbsp;By 10xScale &nbsp;·&nbsp; v0.7 &nbsp;·&nbsp; MIT &nbsp;·&nbsp; Python 3.12+
              </p>
              <Heading as="h1" className="heroTitle">
                Production AI agents in Python. Ship in minutes.
              </Heading>
              <Heading as="h2" className="heroSubheadline">
                The open-source framework 10xScale built to power all their AI
                products — and open-sourced so every team could start from the
                same battle-tested foundation.
              </Heading>
              <p className="heroSubtitle">
                Typed graphs, durable threads, a REST and SSE server, and a typed
                TypeScript client. A modern alternative to LangGraph, CrewAI, and
                AutoGen — with the full production stack included.
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
                code="pip install 10xscale-agentflow 10xscale-agentflow-cli"
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

        {/* 10XSCALE PRODUCTION PROOF */}
        <section className="section section--tenxscale">
          <div className="container">
            <div className="tenxGrid">
              <div className="tenxCopy">
                <p className="eyebrow">
                  <Icon name="Building2" size={12} /> &nbsp;Built by 10xScale
                </p>
                <Heading as="h2" className="tenxHeading">
                  The framework behind every 10xScale product.
                </Heading>
                <p className="tenxLead">
                  10xScale is an AI-product company. AgentFlow is the runtime
                  they built to power their products in production — not a demo,
                  not a side project. When a feature was missing, they built it.
                  When a pattern was painful, they fixed it.
                </p>
                <p className="tenxBody">
                  The result is a framework shaped entirely by real production
                  constraints: durable threads that survive restarts, typed graphs
                  that stay readable at scale, and an API server that ships on
                  day one rather than sprint ten. Then they open-sourced all of
                  it so every team could start from the same foundation.
                </p>
                <Link
                  className="button button--secondary button--md"
                  to="https://10xscale.ai"
                  onClick={() => trackEvent('cta_tenxscale', {location: '10xscale-section'})}>
                  Visit 10xscale.ai &nbsp;→
                </Link>
              </div>
              <ul className="tenxChecklist" aria-label="Production capabilities">
                {tenxFeatures.map(({icon, text}) => (
                  <li key={text} className="tenxItem">
                    <Icon name={icon} size={18} className="tenxIcon" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* SAME AGENT, EVERY FRAMEWORK */}
        <section className="section section--switcher">
          <div className="container">
            <div className="sectionHeader sectionHeader--center">
              <p className="eyebrow">
                <Icon name="GitCompare" size={12} /> &nbsp;Same agent, every framework
              </p>
              <Heading as="h2">A familiar mental model, without the glue.</Heading>
              <p>
                The same ReAct agent in five different frameworks. AgentFlow
                keeps the graph explicit and ships the production stack with it.
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
                the hosted playground are designed together. Same types, same
                threads, same primitives across the whole stack.
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

        {/* FAQ */}
        <section className="section section--faq">
          <div className="container">
            <div className="sectionHeader sectionHeader--center">
              <p className="eyebrow">
                <Icon name="HelpCircle" size={12} /> &nbsp;FAQ
              </p>
              <Heading as="h2">Questions about AgentFlow.</Heading>
              <p>
                Common questions about the framework, how it compares to
                alternatives, and how 10xScale uses it in production.
              </p>
            </div>
            <FAQ items={faqItems} />
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="section section--final-cta">
          <div className="container">
            <div className="finalCta">
              <Heading as="h2">Ship a working agent in five minutes.</Heading>
              <p>
                Install, build a graph, expose an API, connect a TypeScript
                client. Then keep going, without rewriting anything.
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
