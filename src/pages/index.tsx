import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import HomepageFeatures from '../components/HomepageFeatures';
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

const stackItems = [
  ['agentflow', 'Core Python runtime'],
  ['agentflow-api', 'API, CLI, and serving layer'],
  ['agentflow-client', 'TypeScript client surface'],
  ['agentflow-playground', 'Hosted testing workspace'],
];

const quickstart = `from agentflow.core import Agent, StateGraph, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.utils.constants import END

checkpointer = InMemoryCheckpointer()

def get_weather(location: str) -> str:
    return f"The weather in {location} is sunny"

tool_node = ToolNode([get_weather])

agent = Agent(
    model="gemini-3-flash-preview",
    provider="google",
    system_prompt="You are a helpful assistant.",
    trim_context=True,
    reasoning_config=True,
    tool_node=tool_node,
)

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")

app = graph.compile(checkpointer=checkpointer)`;

export default function Home() {
  return (
    <Layout
      title="AgentFlow — Open-Source Python Framework for Production AI Agents"
      description="AgentFlow is an open-source Python framework for building production AI agents — multi-agent orchestration, memory, streaming, REST API, and TypeScript client out of the box. A modern alternative to LangGraph, CrewAI, and AutoGen.">
      <main>
        <section className="hero hero--agentflow">
          <div className="heroOrb heroOrb--one" />
          <div className="heroOrb heroOrb--two" />
          <div className="container heroGrid">
            <div className="heroCopy">
              <p className="eyebrow">Open-source · Python 3.10+ · MIT licensed</p>
              <Heading as="h1" className="heroTitle">
                Build production-ready AI agents in Python — in minutes, not weeks.
              </Heading>
              <Heading as="h2" className="heroSubheadline">
                A batteries-included framework for multi-agent orchestration, memory, and
                streaming APIs — a modern alternative to LangGraph, CrewAI, and AutoGen.
              </Heading>
              <p className="heroSubtitle">
                AgentFlow gives Python teams a graph-based runtime, durable state and
                checkpointing, a REST API and CLI, and a typed TypeScript client — so you
                can ship a working agent fast and scale to production without rewriting the
                foundation.
              </p>
              <div className="heroActions">
                <Link
                  className="button button--primary button--lg"
                  to="/docs/get-started"
                  onClick={() => trackEvent('cta_start_building', {location: 'hero'})}>
                  Start building
                </Link>
                <Link
                  className="button button--secondary button--lg"
                  to="/docs/tutorials"
                  onClick={() => trackEvent('cta_browse_tutorials', {location: 'hero'})}>
                  Browse tutorials
                </Link>
              </div>
              <div className="trustBar">
                <span>Beginner path</span>
                <span>Concepts</span>
                <span>Tutorials</span>
                <span>Reference</span>
              </div>
            </div>
            <div className="heroVisual">
              <div className="codeCard" aria-label="AgentFlow quickstart code sample">
                <div className="codeCardHeader">
                  <span></span>
                  <span></span>
                  <span></span>
                  <strong>react_sync.py</strong>
                </div>
                <pre>
                  <code>{quickstart}</code>
                </pre>
              </div>
              <div className="stackCard" aria-label="AgentFlow package map">
                <p className="stackCardLabel">Connected stack</p>
                {stackItems.map(([name, body]) => (
                  <div className="stackCardRow" key={name}>
                    <strong>{name}</strong>
                    <span>{body}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <HomepageFeatures />

        <section className="section section--tracks">
          <div className="container">
            <div className="sectionHeader sectionHeader--center">
              <p className="eyebrow">Documentation tracks</p>
              <Heading as="h2">Pick the next useful page fast.</Heading>
              <p>
                The main docs now separate learning, architecture, and production work
                so readers can move forward without scanning the whole sidebar.
              </p>
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

        <section className="section section--journey">
          <div className="container">
            <div className="sectionHeader">
              <p className="eyebrow">Beginner-friendly by design</p>
              <Heading as="h2">A docs path that teaches the product, not just the API.</Heading>
              <p>
                The new docs are organized around the real journey: install the library,
                build one agent, add tools, add memory, expose it through the API, connect
                a client, then deploy with confidence.
              </p>
            </div>
            <div className="journeyGrid">
              {[
                ['01', 'First agent', 'Create a small, working agent and understand the moving parts.'],
                ['02', 'Tools and state', 'Give the agent capabilities and learn how state moves through a workflow.'],
                ['03', 'Multi-agent flow', 'Compose agents into predictable handoffs and reusable workflows.'],
                ['04', 'Production surface', 'Add persistence, APIs, streaming, clients, and deployment practices.'],
              ].map(([step, title, body]) => (
                <article className="journeyCard" key={step}>
                  <span>{step}</span>
                  <Heading as="h3">{title}</Heading>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
