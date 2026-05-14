import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useHistory } from '@docusaurus/router'
import { Search, X } from 'lucide-react'

import { categoryChip, SCOPES, type ScopeId } from './scopes'
import { useSearch, type SearchHit } from './useSearch'
import styles from './styles.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<ScopeId>('all')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const listboxId = useId()
  const history = useHistory()

  const { hits, loading, unavailable } = useSearch(query, scope)

  // Reset state when the modal opens.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setScope('all')
    setSelected(0)
    // Defer focus until after the modal mounts in the DOM.
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  // Reset selection cursor whenever the result set changes.
  useEffect(() => {
    setSelected(0)
  }, [hits.length, scope])

  // Keep the highlighted row scrolled into view as the user arrows down.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const node = list.querySelector<HTMLAnchorElement>(
      `[data-search-row="${selected}"]`,
    )
    node?.scrollIntoView({ block: 'nearest' })
  }, [selected, hits])

  if (!open) return null

  function close() {
    onClose()
  }

  function go(hit: SearchHit) {
    history.push(hit.url)
    close()
  }

  function onKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((idx) => Math.min(hits.length - 1, idx + 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((idx) => Math.max(0, idx - 1))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const hit = hits[selected]
      if (hit) go(hit)
    }
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        // Click-on-backdrop closes; click-inside-modal must not.
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className={styles.modal}
        onKeyDown={onKey}
      >
        <div className={styles.inputRow}>
          <Search aria-hidden className={styles.inputIcon} strokeWidth={1.75} />
          <input
            ref={inputRef}
            id={labelId}
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation, tutorials, references…"
            aria-label="Search documentation"
            aria-controls={listboxId}
            aria-activedescendant={
              hits[selected] ? `${listboxId}-${selected}` : undefined
            }
            className={styles.input}
          />
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            aria-label="Close search"
          >
            <X aria-hidden width={14} height={14} strokeWidth={2} />
          </button>
        </div>

        <ScopeRow
          activeScope={scope}
          onScopeChange={setScope}
          hits={hits}
          query={query}
        />

        {unavailable && process.env.NODE_ENV !== 'production' && (
          <div className={styles.devNotice}>
            <strong>Search is disabled in dev mode.</strong>{' '}
            The local index is only built at production time. Run{' '}
            <code>npm run build &amp;&amp; npm run serve</code> to test.
          </div>
        )}

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className={styles.results}
        >
          {!query.trim() ? (
            <div className={styles.idle}>
              Start typing to search across docs, tutorials, references, and blog.
            </div>
          ) : loading ? (
            <div className={styles.idle}>Searching…</div>
          ) : hits.length === 0 && !unavailable ? (
            <div className={styles.empty}>
              <strong>No results</strong>
              No matches for "{query.trim()}". Try a different term or broaden
              the scope.
            </div>
          ) : (
            hits.map((hit, idx) => (
              <ResultRow
                key={`${hit.url}-${idx}`}
                hit={hit}
                index={idx}
                active={idx === selected}
                listboxId={listboxId}
                onMouseEnter={() => setSelected(idx)}
                onClick={() => go(hit)}
              />
            ))
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerHints}>
            <span className={styles.footerHint}>
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <span>navigate</span>
            </span>
            <span className={styles.footerHint}>
              <kbd>↵</kbd>
              <span>open</span>
            </span>
            <span className={styles.footerHint}>
              <kbd>esc</kbd>
              <span>close</span>
            </span>
          </div>
          <span>{hits.length > 0 ? `${hits.length} results` : ''}</span>
        </div>
      </div>
    </div>
  )
}

interface ScopeRowProps {
  activeScope: ScopeId
  onScopeChange: (scope: ScopeId) => void
  hits: SearchHit[]
  query: string
}

function ScopeRow({ activeScope, onScopeChange, hits, query }: ScopeRowProps) {
  // Show per-scope counts once the user has searched. Cheap because we
  // already have `hits` in hand — we don't re-run the engine.
  const counts = useMemo(() => {
    if (!query.trim()) return null
    const out: Record<ScopeId, number> = {
      all: hits.length,
      docs: 0,
      tutorials: 0,
      reference: 0,
      blog: 0,
    }
    // For non-"all" counts we need to count against the unfiltered set.
    // `hits` is already filtered by the active scope — so counts only make
    // sense for the active scope. For other scopes, leave as 0 (UI hides).
    // To keep things consistent we only show counts for the active pill.
    out[activeScope] = hits.length
    return out
  }, [hits, query, activeScope])

  return (
    <div className={styles.scopes} role="tablist" aria-label="Search scope">
      {SCOPES.map((s) => {
        const isActive = s.id === activeScope
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-pressed={isActive}
            className={
              isActive ? `${styles.scope} ${styles.scopeActive}` : styles.scope
            }
            onClick={() => onScopeChange(s.id)}
          >
            <span>{s.label}</span>
            {isActive && counts && counts[s.id] > 0 && (
              <span className={styles.scopeCount}>{counts[s.id]}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface ResultRowProps {
  hit: SearchHit
  index: number
  active: boolean
  listboxId: string
  onMouseEnter: () => void
  onClick: () => void
}

function ResultRow({
  hit,
  index,
  active,
  listboxId,
  onMouseEnter,
  onClick,
}: ResultRowProps) {
  const chip = categoryChip(hit.url)
  return (
    <a
      id={`${listboxId}-${index}`}
      href={hit.url}
      role="option"
      aria-selected={active}
      data-search-row={index}
      className={active ? `${styles.result} ${styles.resultActive}` : styles.result}
      onMouseEnter={onMouseEnter}
      onClick={(e) => {
        // Let cmd/ctrl/middle-click open in a new tab natively.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        onClick()
      }}
    >
      <div className={styles.resultBody}>
        <span className={styles.resultTitle}>{hit.title}</span>
        {hit.breadcrumb.length > 0 && (
          <span className={styles.resultBreadcrumb}>
            {hit.breadcrumb.join(' › ')}
          </span>
        )}
        {hit.snippet && (
          <span
            className={styles.resultSnippet}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: hit.snippet }}
          />
        )}
      </div>
      <span className={styles.resultChip}>{chip}</span>
    </a>
  )
}
