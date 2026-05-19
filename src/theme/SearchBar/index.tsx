import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import useIsBrowser from '@docusaurus/useIsBrowser'

import styles from './styles.module.css'

const SearchModal = lazy(() => import('./SearchModal'))

/**
 * Custom SearchBar — overrides `@theme/SearchBar` from the default
 * `@easyops-cn/docusaurus-search-local` theme. Docusaurus's webpack
 * alias resolves this `src/theme/SearchBar` directory ahead of the
 * plugin's bundled component, so installing the plugin gives us the
 * search index, while this file gives us the UI.
 */
export default function SearchBar() {
  const isBrowser = useIsBrowser()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const compactRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  const handleOpen = useCallback(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    setOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    // Restore focus to whatever opened the modal (pill on desktop,
    // compact icon on mobile, or whatever else may have triggered ⌘K).
    requestAnimationFrame(() => {
      const target =
        previouslyFocused.current ??
        triggerRef.current ??
        compactRef.current
      target?.focus()
    })
  }, [])

  // Global Cmd/Ctrl+K listener. Skipped when the modal is already open
  // so the modal's own Escape handler stays authoritative.
  useEffect(() => {
    if (!isBrowser) return
    function onKey(event: KeyboardEvent) {
      const isK = event.key === 'k' || event.key === 'K'
      const mod = event.metaKey || event.ctrlKey
      if (mod && isK) {
        event.preventDefault()
        if (!open) handleOpen()
      } else if (event.key === '/' && !open) {
        // Slash hotkey opens search too, unless the user is in a
        // text field already.
        const target = event.target as HTMLElement | null
        const tag = target?.tagName
        const isEditable =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          (target?.isContentEditable ?? false)
        if (!isEditable) {
          event.preventDefault()
          handleOpen()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isBrowser, open, handleOpen])

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!isBrowser) return
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [open, isBrowser])

  const shortcutLabel = useShortcutLabel()

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={handleOpen}
        aria-label="Search documentation"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search aria-hidden className={styles.triggerIcon} strokeWidth={1.75} />
        <span className={styles.triggerLabel}>Search docs…</span>
        <kbd className={styles.triggerKbd}>{shortcutLabel}</kbd>
      </button>

      <button
        ref={compactRef}
        type="button"
        className={styles.triggerCompact}
        onClick={handleOpen}
        aria-label="Search documentation"
      >
        <Search aria-hidden width={20} height={20} strokeWidth={1.75} />
      </button>

      {isBrowser &&
        createPortal(
          <Suspense fallback={null}>
            <SearchModal open={open} onClose={handleClose} />
          </Suspense>,
          document.body,
        )}
    </>
  )
}

/**
 * Show ⌘K on macOS, Ctrl K elsewhere. Only computed in the browser to
 * avoid SSR hydration mismatch.
 */
function useShortcutLabel(): string {
  const [label, setLabel] = useState('Ctrl K')
  useEffect(() => {
    const isMac =
      typeof navigator !== 'undefined' &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform)
    setLabel(isMac ? '⌘ K' : 'Ctrl K')
  }, [])
  return label
}
