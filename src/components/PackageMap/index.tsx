import styles from './styles.module.css';

/** Inline SVG diagram of the AgentFlow connected stack. Scales crisp at any size. */
export default function PackageMap() {
  return (
    <div className={styles.wrap} aria-label="AgentFlow connected stack">
      <svg
        className={styles.svg}
        viewBox="0 0 800 360"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-labelledby="package-map-title package-map-desc">
        <title id="package-map-title">AgentFlow connected stack</title>
        <desc id="package-map-desc">
          Diagram of four AgentFlow packages: the Python library and the CLI/REST/SSE
          server connect to a TypeScript client, with a hosted playground below the
          server.
        </desc>
        <defs>
          <linearGradient id="pmEdge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.65" />
          </linearGradient>
          <linearGradient id="pmFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0c1727" />
            <stop offset="100%" stopColor="#08111f" />
          </linearGradient>
          <filter id="pmGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        <path
          d="M 220 80 L 320 80"
          stroke="url(#pmEdge)"
          strokeWidth="2"
          fill="none"
          markerEnd="url(#pmArrow)"
        />
        <path
          d="M 540 80 L 640 80"
          stroke="url(#pmEdge)"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M 425 130 L 425 220"
          stroke="url(#pmEdge)"
          strokeWidth="2"
          fill="none"
        />

        <marker
          id="pmArrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
        </marker>

        {/* Card 1 — Python lib */}
        <g>
          <rect
            x="40"
            y="36"
            width="180"
            height="92"
            rx="14"
            fill="url(#pmFill)"
            stroke="rgba(148,163,184,0.28)"
            strokeWidth="1"
          />
          <text x="58" y="68" fill="#3b82f6" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="600">PYTHON LIBRARY</text>
          <text x="58" y="92" fill="#f8fafc" fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="700">agentflow</text>
          <text x="58" y="111" fill="#94a3b8" fontFamily="Inter, sans-serif" fontSize="11">StateGraph · Agents · Tools</text>
        </g>

        {/* Card 2 — CLI / API */}
        <g>
          <rect
            x="320"
            y="36"
            width="220"
            height="92"
            rx="14"
            fill="url(#pmFill)"
            stroke="rgba(59,130,246,0.5)"
            strokeWidth="1.5"
            filter="url(#pmGlow)"
          />
          <text x="338" y="68" fill="#3b82f6" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="600">CLI · REST · SSE</text>
          <text x="338" y="92" fill="#f8fafc" fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="700">agentflow-cli</text>
          <text x="338" y="111" fill="#94a3b8" fontFamily="Inter, sans-serif" fontSize="11">/v1/graph/invoke · /stream</text>
        </g>

        {/* Card 3 — TS client */}
        <g>
          <rect
            x="640"
            y="36"
            width="120"
            height="92"
            rx="14"
            fill="url(#pmFill)"
            stroke="rgba(148,163,184,0.28)"
            strokeWidth="1"
          />
          <text x="658" y="68" fill="#3b82f6" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="600">TYPESCRIPT</text>
          <text x="658" y="92" fill="#f8fafc" fontFamily="JetBrains Mono, monospace" fontSize="13" fontWeight="700">agentflow-client</text>
          <text x="658" y="111" fill="#94a3b8" fontFamily="Inter, sans-serif" fontSize="11">invoke · stream</text>
        </g>

        {/* Card 4 — Playground (below) */}
        <g>
          <rect
            x="320"
            y="220"
            width="220"
            height="92"
            rx="14"
            fill="url(#pmFill)"
            stroke="rgba(148,163,184,0.28)"
            strokeWidth="1"
          />
          <text x="338" y="252" fill="#8b5cf6" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="600">HOSTED PLAYGROUND</text>
          <text x="338" y="276" fill="#f8fafc" fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="700">agentflow-playground</text>
          <text x="338" y="295" fill="#94a3b8" fontFamily="Inter, sans-serif" fontSize="11">browser-based UI</text>
        </g>
      </svg>
    </div>
  );
}
