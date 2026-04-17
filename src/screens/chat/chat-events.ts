export const CHAT_OPEN_MESSAGE_SEARCH_EVENT = 'vorbium:chat-open-message-search'

export const CHAT_RUN_COMMAND_EVENT = 'vorbium:chat-run-command'

export const CHAT_PENDING_COMMAND_STORAGE_KEY = 'vorbium.pending-chat-command'

export type ChatRunCommandDetail = {
  command: string
}

export const CHAT_OPEN_SETTINGS_EVENT = 'vorbium:chat-open-settings'

export type ChatOpenSettingsDetail = {
  section: 'vorbium' | 'appearance'
}
