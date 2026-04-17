import { getChatMode } from './gateway-capabilities'

export type { ChatMode } from './gateway-capabilities'

export type ChatBackend = 'vorbium-enhanced' | 'openai-compat' | 'none'

export function resolveChatBackend(): ChatBackend {
  const mode = getChatMode()
  if (mode === 'enhanced-hermes') return 'vorbium-enhanced'
  if (mode === 'portable') return 'openai-compat'
  return 'none'
}
