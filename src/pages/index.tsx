import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import HomepageFeatures from '../components/HomepageFeatures';

const docTracks = [
  {
    eyebrow: '01',
    title: 'Get the first agent running',
    body: 'Install AgentFlow, create a single workflow node, and understand the smallest useful app shape.',
    href: '/docs/get-started',
  },
  {
    eyebrow: '02',
    title: 'Learn the framework model',
    body: 'See how agents, tools, state, checkpoints, APIs, clients, and the playground fit together.',
    href: '/docs/concepts/why-agentflow',
  },
  {
    eyebrow: '03',
    title: 'Move toward production',
    body: 'Add persistence, streaming, troubleshooting, and reference-backed integration patterns.',
    href: '/docs/how-to',
  },
];

const stackItems = [
  ['agentflow', 'Core Python runtime'],
  ['agentflow-api', 'API, CLI, and serving layer'],
  ['agentflow-client', 'TypeScript client surface'],
  ['agentflow-playground', 'Hosted testing workspace'],
];

const quickstart = `from agentflow.core.graph import Agent, StateGraph
from agentflow.core.state import AgentState, Message
from agentflow.utils import END

workflow = StateGraph(state_schema=AgentState)
workflow.add_node("assistant", Agent(
    model="openai/gpt-4o",
    system_prompt="You are a helpful production assistant.",
))

workflow.set_entry_point("assistant")
workflow.add_edge("assistant", END)

app = workflow.compile()
result = app.invoke({
    "messages": [Message.text_message("Summarize today's priorities", "user")]
})`;

export default function Home() {
  return (
    <Layout
      title="Production-ready multi-agent framework"
      description="AgentFlow helps teams build, ship, and operate multi-agent systems with reusable orchestration, memory, API, and client foundations.">
      <main>
        <section className="hero hero--agentflow">
          <div className="heroOrb heroOrb--one" />
          <div className="heroOrb heroOrb--two" />
          <div className="container heroGrid">
            <div className="heroCopy">
              <p className="eyebrow">Production docs for agent teams</p>
              <Heading as="h1" className="heroTitle">
                Build agents. Ship the runtime. Keep the docs clear.
              </Heading>
              <p className="heroSubtitle">
                AgentFlow documents the path from a first Python agent to a running API,
                hosted playground, TypeScript client, and production-ready memory.
              </p>
              <div className="heroActions">
                <Link className="button button--primary button--lg" to="/docs/get-started">
                  Start building
                </Link>
                <Link className="button button--secondary button--lg" to="/docs/concepts/why-agentflow">
                  Learn the model
                </Link>
              </div>
              <div className="trustBar">
                <span>Python library</span>
                <span>API and CLI</span>
                <span>TypeScript client</span>
                <span>Production guides</span>
              </div>
            </div>
            <div className="heroVisual">
              <div className="codeCard" aria-label="AgentFlow quickstart code sample">
                <div className="codeCardHeader">
                  <span></span>
                  <span></span>
                  <span></span>
                  <strong>first_agent.py</strong>
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
                <Link className="trackCard" to={track.href} key={track.title}>
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
