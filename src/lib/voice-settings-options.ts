export type VoiceOption = {
  value: string
  label: string
}

export type VoiceToggleField = {
  key: string
  label: string
  description: string
}

export const VOICE_RECOMMENDED_STACK = {
  ttsProvider: 'edge',
  fallbackProvider: 'mistral',
  telegramVoiceLive: true,
} as const

export const VOICE_TTS_PROVIDER_OPTIONS: Array<VoiceOption> = [
  { value: 'edge', label: 'Edge TTS (recommended base)' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'openai', label: 'OpenAI TTS' },
  { value: 'gemini', label: 'Google Gemini TTS' },
  { value: 'mistral', label: 'Mistral Voxtral TTS' },
  { value: 'neutts', label: 'NeuTTS' },
]

export const VOICE_FALLBACK_PROVIDER_OPTIONS: Array<VoiceOption> = [
  { value: '', label: 'None' },
  ...VOICE_TTS_PROVIDER_OPTIONS,
]

export const VOICE_STT_PROVIDER_OPTIONS: Array<VoiceOption> = [
  { value: 'local', label: 'Local (Whisper)' },
  { value: 'openai', label: 'OpenAI Whisper' },
  { value: 'mistral', label: 'Mistral Voxtral' },
]

export const VOICE_PIPECAT_TOGGLE_FIELDS: Array<VoiceToggleField> = [
  {
    key: 'telegram_voice_live',
    label: 'Telegram Voice Live',
    description: 'Recommended for Telegram: use Gemini Live first, then fall back to Edge + Voxtral if needed.',
  },
]
