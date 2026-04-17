/**
 * Migração one-shot de localStorage keys vorbium-* → vorbium-*.
 * Roda uma vez por carga; se a chave nova já existe, não sobrescreve.
 * Remove as chaves antigas depois.
 */

const MIGRATIONS: Record<string, string> = {
  'vorbium-theme': 'vorbium-theme',
  'vorbium-workspace-v1': 'vorbium-workspace-v1',
  'vorbium-onboarding-complete': 'vorbium-onboarding-complete',
  'vorbium-sidebar-last-route': 'vorbium-sidebar-last-route',
  'vorbium-workspace-locale': 'vorbium-workspace-locale',
  'vorbium-auth': 'vorbium-auth',
}

const MIGRATION_FLAG = 'vorbium-ls-migrated-v1'

export function migrateHermesLocalStorage(): void {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem(MIGRATION_FLAG)) return
  let migrated = 0
  for (const [oldKey, newKey] of Object.entries(MIGRATIONS)) {
    const oldValue = window.localStorage.getItem(oldKey)
    if (oldValue === null) continue
    if (window.localStorage.getItem(newKey) === null) {
      window.localStorage.setItem(newKey, oldValue)
      migrated += 1
    }
    window.localStorage.removeItem(oldKey)
  }
  window.localStorage.setItem(MIGRATION_FLAG, String(Date.now()))
  if (migrated > 0 && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log(`[Vorbium] Migrated ${migrated} localStorage key(s) from vorbium-* to vorbium-*`)
  }
}
