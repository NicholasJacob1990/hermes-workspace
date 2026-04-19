import { describe, expect, it } from 'vitest'
import {
  VOICE_FALLBACK_PROVIDER_OPTIONS,
  VOICE_PIPECAT_TOGGLE_FIELDS,
  VOICE_RECOMMENDED_STACK,
  VOICE_STT_PROVIDER_OPTIONS,
  VOICE_TTS_PROVIDER_OPTIONS,
} from '@/lib/voice-settings-options'

describe('vorbium settings dialog voice options', () => {
  it('includes Gemini and Mistral in TTS provider options', () => {
    expect(VOICE_TTS_PROVIDER_OPTIONS).toEqual(
      expect.arrayContaining([
        { value: 'gemini', label: 'Google Gemini TTS' },
        { value: 'mistral', label: 'Mistral Voxtral TTS' },
      ]),
    )
  })

  it('includes a none option plus Gemini/Mistral fallback providers', () => {
    expect(VOICE_FALLBACK_PROVIDER_OPTIONS[0]).toEqual({
      value: '',
      label: 'None',
    })
    expect(VOICE_FALLBACK_PROVIDER_OPTIONS).toEqual(
      expect.arrayContaining([
        { value: 'gemini', label: 'Google Gemini TTS' },
        { value: 'mistral', label: 'Mistral Voxtral TTS' },
      ]),
    )
  })

  it('includes Mistral and OpenAI in STT provider options', () => {
    expect(VOICE_STT_PROVIDER_OPTIONS).toEqual(
      expect.arrayContaining([
        { value: 'openai', label: 'OpenAI Whisper' },
        { value: 'mistral', label: 'Mistral Voxtral' },
      ]),
    )
  })

  it('exposes Telegram Voice Live guidance in pipecat toggle fields', () => {
    expect(VOICE_PIPECAT_TOGGLE_FIELDS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'telegram_voice_live',
          label: 'Telegram Voice Live',
        }),
      ]),
    )
  })

  it('exposes the recommended Telegram voice stack defaults', () => {
    expect(VOICE_RECOMMENDED_STACK).toEqual({
      ttsProvider: 'edge',
      fallbackProvider: 'mistral',
      telegramVoiceLive: true,
    })
  })
})
