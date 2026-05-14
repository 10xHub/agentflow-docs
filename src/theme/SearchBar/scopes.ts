/**
 * Search scope definitions — the "advanced" part of the search UX.
 *
 * Each scope is a filter pill rendered above the result list. The active
 * scope re-filters the same lunr result set by URL prefix; we never
 * re-run the search engine when the user changes scope.
 *
 * `chip` derives the per-result category badge shown on the right of
 * each row. For specificity, Reference rows get a sub-label (Python /
 * REST / CLI) based on the second path segment.
 */

export type ScopeId = 'all' | 'docs' | 'tutorials' | 'reference' | 'blog'

export interface Scope {
  id: ScopeId
  label: string
  /** Returns true when this URL belongs to the scope. */
  match: (url: string) => boolean
}

const startsWith = (prefix: string) => (url: string) =>
  url.startsWith(prefix)

export const SCOPES: Scope[] = [
  {
    id: 'all',
    label: 'All',
    match: () => true,
  },
  {
    id: 'docs',
    label: 'Docs',
    // Anything under /docs/ that isn't tutorials, reference, or blog.
    match: (url) =>
      url.startsWith('/docs/') &&
      !url.startsWith('/docs/tutorials/') &&
      !url.startsWith('/docs/reference/'),
  },
  {
    id: 'tutorials',
    label: 'Tutorials',
    match: startsWith('/docs/tutorials/'),
  },
  {
    id: 'reference',
    label: 'Reference',
    match: startsWith('/docs/reference/'),
  },
  {
    id: 'blog',
    label: 'Blog',
    match: startsWith('/blog/'),
  },
]

/**
 * Per-result category chip — used in the result row UI so users always
 * see where a hit lives in the IA, especially under the "All" scope.
 */
export function categoryChip(url: string): string {
  if (url.startsWith('/docs/reference/')) {
    const segment = url.split('/')[3] ?? ''
    const sub = segment.toLowerCase()
    if (sub === 'python') return 'Reference · Python'
    if (sub === 'client') return 'Reference · TypeScript'
    if (sub === 'api-cli') return 'Reference · CLI'
    if (sub === 'rest-api') return 'Reference · REST'
    return 'Reference'
  }
  if (url.startsWith('/docs/tutorials/')) return 'Tutorials'
  if (url.startsWith('/docs/how-to/')) {
    const segment = url.split('/')[3] ?? ''
    const sub = segment.toLowerCase()
    if (sub === 'python') return 'How-to · Python'
    if (sub === 'production') return 'How-to · Production'
    if (sub === 'client') return 'How-to · Client'
    if (sub === 'api-cli') return 'How-to · CLI'
    return 'How-to'
  }
  if (url.startsWith('/docs/concepts/')) return 'Concepts'
  if (url.startsWith('/docs/courses/')) return 'Courses'
  if (url.startsWith('/docs/get-started')) return 'Get started'
  if (url.startsWith('/docs/integrations/')) return 'Integrations'
  if (url.startsWith('/docs/providers/')) return 'Providers'
  if (url.startsWith('/docs/skills/')) return 'Skills'
  if (url.startsWith('/docs/use-cases/')) return 'Use cases'
  if (url.startsWith('/docs/compare/')) return 'Compare'
  if (url.startsWith('/docs/troubleshooting/')) return 'Troubleshooting'
  if (url.startsWith('/docs/beginner/')) return 'Beginner'
  if (url.startsWith('/docs/')) return 'Docs'
  if (url.startsWith('/blog/')) return 'Blog'
  return 'Page'
}
