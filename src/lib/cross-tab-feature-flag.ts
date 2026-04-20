/**
 * Feature flag for cross-tab broadcast in the workspace chat store.
 *
 * Controlled at build time via `VITE_CROSS_TAB_BROADCAST_ENABLED`.
 *
 * Truthy values (case-insensitive): "1", "true", "yes", "on".
 * Anything else — including unset / empty — leaves the feature OFF and
 * the chat store falls back to its pre-existing per-tab behaviour.
 */
const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on'])

export function isCrossTabBroadcastEnabled(): boolean {
  const raw = import.meta.env.VITE_CROSS_TAB_BROADCAST_ENABLED
  if (typeof raw !== 'string') return false
  return TRUTHY_VALUES.has(raw.trim().toLowerCase())
}
