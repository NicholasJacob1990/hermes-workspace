type ProviderStatusLike = {
  id?: string
  configured?: boolean
}

export function getPipecatVoiceBridgeStatus(
  config: Record<string, unknown>,
  providers: Array<ProviderStatusLike>,
) {
  const pipecat =
    config.pipecat && typeof config.pipecat === 'object'
      ? (config.pipecat as Record<string, unknown>)
      : {}

  const geminiKeyConfigured = providers.some(
    (provider) => provider.id === 'google' && provider.configured,
  )

  const pipecatConfigured =
    (typeof pipecat.tool_name === 'string' && pipecat.tool_name.trim().length > 0) ||
    (typeof pipecat.gemini_live_model === 'string' &&
      pipecat.gemini_live_model.trim().length > 0)

  return {
    geminiKeyConfigured,
    pipecatConfigured,
  }
}
