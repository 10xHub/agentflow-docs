import { useEffect, useRef, useState } from 'react'
import useBaseUrl from '@docusaurus/useBaseUrl'

import { SCOPES, type ScopeId } from './scopes'

/**
 * Result shape coming out of @easyops-cn/docusaurus-search-local's worker.
 * We only type the fields we render — the worker returns more.
 */
export interface SearchHit {
  /** Resolved page url (already prefixed with baseUrl). */
  url: string
  /** The deepest title hit (heading text). */
  title: string
  /** Page title chain — for the breadcrumb on the result row. */
  breadcrumb: string[]
  /** Plain text around the match, with the match wrapped in <mark>. */
  snippet: string
  /** Lunr score for sort order. */
  score: number
}

interface RawHit {
  document: {
    i: number
    t: string
    u: string
    b?: string[]
    s?: string
    p?: number
    h?: string
    pageTitle?: string
  }
  type: number
  page: { title: string; url: string }
  metadata: Record<string, Record<string, { position: [number, number][] }>>
  score: number
}

const DEBOUNCE_MS = 120
const RESULT_LIMIT = 50

/**
 * Live search hook backed by the plugin's web worker.
 *
 * Worker availability:
 *   - In production builds, fetches the static index and runs lunr in a
 *     dedicated worker.
 *   - In dev (`npm start`), the worker is a no-op by design of the
 *     upstream plugin — returns `unavailable: true` so the UI can hint
 *     the user to test in a production build.
 */
export function useSearch(query: string, scope: ScopeId) {
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const baseUrl = useBaseUrl('/')
  const fetcher = useRef<typeof import('@easyops-cn/docusaurus-search-local/dist/client/client/theme/searchByWorker') | null>(
    null,
  )
  const indexLoaded = useRef(false)
  const isProd = process.env.NODE_ENV === 'production'

  // Lazy-load the worker module on first non-empty query.
  useEffect(() => {
    if (!query.trim()) return
    if (fetcher.current) return
    let cancelled = false
    ;(async () => {
      try {
        const mod = await import(
          /* webpackChunkName: "agentflow-search" */
          '@easyops-cn/docusaurus-search-local/dist/client/client/theme/searchByWorker'
        )
        if (cancelled) return
        fetcher.current = mod
        if (isProd && !indexLoaded.current) {
          await mod.fetchIndexesByWorker(baseUrl, '')
          indexLoaded.current = true
        }
      } catch (err) {
        // Module path mismatch on a future plugin version — degrade quietly.
        // eslint-disable-next-line no-console
        console.warn('[search] failed to load worker:', err)
        if (!cancelled) setUnavailable(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [query, baseUrl, isProd])

  // Debounced query → worker call.
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setHits([])
      setLoading(false)
      return
    }

    // Dev-mode: worker is a no-op upstream. Signal "unavailable" so the
    // UI can show a one-time notice; don't keep flipping it.
    if (!isProd) {
      setUnavailable(true)
      setHits([])
      setLoading(false)
      return
    }

    setLoading(true)
    const handle = window.setTimeout(async () => {
      if (!fetcher.current) {
        setLoading(false)
        return
      }
      try {
        const raw: RawHit[] = await fetcher.current.searchByWorker(
          baseUrl,
          '',
          trimmed,
          RESULT_LIMIT,
        )
        const scopeMatcher = SCOPES.find((s) => s.id === scope)?.match ?? (() => true)
        const seen = new Set<string>()
        const next: SearchHit[] = []
        for (const r of raw) {
          const url = r.document.u || r.page.url
          if (seen.has(url)) continue
          if (!scopeMatcher(url)) continue
          seen.add(url)
          next.push({
            url,
            title: r.document.t || r.document.pageTitle || url,
            breadcrumb: r.document.b ?? [],
            snippet: buildSnippet(r),
            score: r.score,
          })
        }
        setHits(next)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[search] query failed:', err)
        setHits([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(handle)
  }, [query, scope, baseUrl, isProd])

  return { hits, loading, unavailable }
}

/**
 * Pick the section content (or page content) from the worker result
 * and render a <mark>-highlighted snippet around the first match.
 * The worker already gives us match positions, but rather than depend
 * on the internal `highlightStemmed` util we do a simple substring
 * highlight of the query terms in the section content — good enough
 * for v1.
 */
function buildSnippet(hit: RawHit): string {
  const content = hit.document.s || hit.document.h || ''
  if (!content) return ''
  // Find the first non-empty match position from metadata to anchor the snippet.
  let anchor = 0
  for (const term of Object.keys(hit.metadata)) {
    const fields = hit.metadata[term]
    for (const field of Object.keys(fields)) {
      const positions = fields[field]?.position
      if (positions && positions.length > 0 && field === 's') {
        anchor = positions[0][0]
        break
      }
    }
    if (anchor) break
  }
  const SNIPPET_RADIUS = 90
  const start = Math.max(0, anchor - SNIPPET_RADIUS)
  const end = Math.min(content.length, anchor + SNIPPET_RADIUS)
  let snippet = content.slice(start, end)
  if (start > 0) snippet = '…' + snippet
  if (end < content.length) snippet = snippet + '…'
  // Highlight occurrences of each query term — case-insensitive.
  const terms = Object.keys(hit.metadata).filter((t) => t.length > 1)
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    snippet = snippet.replace(new RegExp(`(${escaped})`, 'ig'), '<mark>$1</mark>')
  }
  return snippet
}
