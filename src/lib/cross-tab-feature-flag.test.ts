import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCrossTabBroadcastEnabled } from './cross-tab-feature-flag'

describe('isCrossTabBroadcastEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false when the env var is unset', () => {
    vi.stubEnv('VITE_CROSS_TAB_BROADCAST_ENABLED', '')
    expect(isCrossTabBroadcastEnabled()).toBe(false)
  })

  it.each(['1', 'true', 'TRUE', 'True', 'yes', 'on'])(
    'returns true for truthy value %s',
    (value) => {
      vi.stubEnv('VITE_CROSS_TAB_BROADCAST_ENABLED', value)
      expect(isCrossTabBroadcastEnabled()).toBe(true)
    },
  )

  it.each(['0', 'false', 'no', 'off', 'maybe', ' '])(
    'returns false for non-truthy value %s',
    (value) => {
      vi.stubEnv('VITE_CROSS_TAB_BROADCAST_ENABLED', value)
      expect(isCrossTabBroadcastEnabled()).toBe(false)
    },
  )
})
