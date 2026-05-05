/**
 * Lightweight wrapper over `gtag` for tracking key conversion events.
 *
 * Safe to call before/without analytics loaded — calls are no-ops if `gtag` is missing.
 * The gtag plugin is configured in docusaurus.config.ts (env-driven by GOOGLE_ANALYTICS_ID).
 */
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set',
      action: string,
      params?: Record<string, unknown>,
    ) => void;
  }
}

export type ConversionEvent =
  | 'cta_start_building'
  | 'cta_browse_tutorials'
  | 'cta_doc_track'
  | 'cta_compare_page'
  | 'cta_blog_get_started'
  | 'cta_github'
  | 'cta_install_command_copy';

export function trackEvent(
  event: ConversionEvent,
  params: Record<string, string | number | boolean> = {},
): void {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', event, {
    event_category: 'engagement',
    ...params,
  });
}
