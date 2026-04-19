import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { json } from '@tanstack/react-start'
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  ensureGatewayProbed,
  getGatewayCapabilities,
} from '../../server/vorbium-api'
import { BEARER_TOKEN, HERMES_API } from '../../server/gateway-capabilities'
import {
  ensureDiscovery,
  getDiscoveredModels,
  ensureProviderInConfig,
} from '../../server/local-provider-discovery'


// Well-known models for providers available via auth store
const AUTH_STORE_MODELS: Record<string, Array<ModelEntry>> = {
  anthropic: [
    {
      id: 'claude-opus-4-6',
      name: 'Claude Opus 4.6',
      provider: 'anthropic',
    },
    {
      id: 'claude-sonnet-4-6',
      name: 'Claude Sonnet 4.6',
      provider: 'anthropic',
    },
  ],
  nous: [
    { id: 'vorbium-3-llama-3.1-405b', name: 'Vorbium 3 405B', provider: 'nous' },
    { id: 'vorbium-3-llama-3.1-70b', name: 'Vorbium 3 70B', provider: 'nous' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'nous' },
  ],
  xiaomi: [
    { id: 'mimo-v2-pro', name: 'MiMo v2 Pro', provider: 'xiaomi' },
    { id: 'mimo-v2-omni', name: 'MiMo v2 Omni', provider: 'xiaomi' },
    { id: 'mimo-v2-flash', name: 'MiMo v2 Flash', provider: 'xiaomi' },
  ],
  openai: [
    { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'o3-mini', name: 'o3 Mini', provider: 'openai' },
  ],
  openrouter: [
    { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', provider: 'openrouter' },
    { id: 'qwen/qwen3-235b-a22b', name: 'Qwen3 235B', provider: 'openrouter' },
    { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'openrouter' },
  ],
  xai: [{ id: 'grok-3', name: 'Grok 3', provider: 'xai' }],
}

function getAuthStoreModels(): Array<ModelEntry> {
  const extra: Array<ModelEntry> = []
  for (const storePath of [
    path.join(os.homedir(), '.vorbium', 'auth-profiles.json'),
    path.join(
      os.homedir(),
      '.openclaw',
      'agents',
      'main',
      'agent',
      'auth-profiles.json',
    ),
  ]) {
    try {
      if (!fs.existsSync(storePath)) continue
      const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
      const profiles = store?.profiles || {}
      const seen = new Set<string>()
      for (const key of Object.keys(profiles)) {
        const providerId = key.split(':')[0]
        if (seen.has(providerId)) continue
        const p = profiles[key]
        const token = String(p?.token || p?.key || p?.access || '').trim()
        if (!token) continue
        seen.add(providerId)
        const models = AUTH_STORE_MODELS[providerId]
        if (models) extra.push(...models)
      }
      if (extra.length > 0) break // Use first store that has data
    } catch {}
  }
  return extra
}

type ModelEntry = {
  provider?: string
  id?: string
  name?: string
  [key: string]: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>
  return {}
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeVorbiumModel(entry: unknown): ModelEntry | null {
  if (typeof entry === 'string') {
    const id = entry.trim()
    if (!id) return null
    return {
      id,
      name: id,
      provider: id.includes('/') ? id.split('/')[0] : 'vorbium-engine',
    }
  }
  const record = asRecord(entry)
  const id =
    readString(record.id) || readString(record.name) || readString(record.model)
  if (!id) return null
  return {
    ...record,
    id,
    name:
      readString(record.name) ||
      readString(record.display_name) ||
      readString(record.label) ||
      id,
    provider:
      readString(record.provider) ||
      readString(record.owned_by) ||
      (id.includes('/') ? id.split('/')[0] : 'vorbium-engine'),
  }
}

/**
 * Read user-configured models from ~/.vorbium/models.json (with ~/.hermes
 * fallback for users migrating from upstream installs). Curated list the
 * user manages via the Vorbium CLI or UI. Each entry has:
 * { id, name, provider, model, baseUrl, createdAt }.
 */
function readVorbiumModelsJson(): Array<ModelEntry> {
  for (const home of ['.vorbium', '.hermes']) {
    const modelsPath = path.join(os.homedir(), home, 'models.json')
    try {
      if (!fs.existsSync(modelsPath)) continue
      const raw = fs.readFileSync(modelsPath, 'utf-8')
      const entries = JSON.parse(raw)
      if (!Array.isArray(entries)) continue
      const parsed = entries
        .map((entry: Record<string, unknown>) => {
          const modelId = readString(entry.model) || readString(entry.id)
          if (!modelId) return null
          return {
            id: modelId,
            name: readString(entry.name) || modelId,
            provider: readString(entry.provider) || 'unknown',
          }
        })
        .filter((e: ModelEntry | null): e is ModelEntry => e !== null)
      if (parsed.length > 0) return parsed
    } catch {
      // try next home
    }
  }
  return []
}

/**
 * Read the default model from ~/.vorbium/config.yaml without a YAML parser
 * (with ~/.hermes fallback). Looks for "default: <model-id>" under the
 * "model:" section.
 */
function readVorbiumDefaultModel(): ModelEntry | null {
  for (const home of ['.vorbium', '.hermes']) {
    const configPath = path.join(os.homedir(), home, 'config.yaml')
    try {
      if (!fs.existsSync(configPath)) continue
      const raw = fs.readFileSync(configPath, 'utf-8')
      const defaultMatch = raw.match(/^\s*default:\s*(.+)$/m)
      const providerMatch = raw.match(/^\s*provider:\s*(.+)$/m)
      if (!defaultMatch) continue
      const modelId = defaultMatch[1].trim()
      const provider = providerMatch ? providerMatch[1].trim() : 'unknown'
      return { id: modelId, name: modelId, provider }
    } catch {
      // try next home
    }
  }
  return null
}

/**
 * Fallback: fetch models from the vorbium-engine /v1/models endpoint.
 */
async function fetchVorbiumModels(): Promise<Array<ModelEntry>> {
  const headers: Record<string, string> = {}
  if (BEARER_TOKEN) headers['Authorization'] = `Bearer ${BEARER_TOKEN}`
  const response = await fetch(`${HERMES_API}/v1/models`, { headers })
  if (!response.ok)
    throw new Error(`Vorbium models request failed (${response.status})`)
  const payload = asRecord(await response.json())
  const rawModels = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.models)
      ? payload.models
      : []
  return rawModels
    .map(normalizeVorbiumModel)
    .filter((e): e is ModelEntry => e !== null)
}

export const Route = createFileRoute('/api/models')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        await ensureGatewayProbed()
        if (!getGatewayCapabilities().models) {
          return json({
            ok: true,
            object: 'list',
            data: [],
            models: [],
            configuredProviders: [],
            source: 'unavailable',
            message: 'Gateway does not support /v1/models',
          })
        }
        try {
          // Primary: read user-curated models from ~/.vorbium/models.json
          // (with ~/.hermes fallback for migration users)
          let models = readVorbiumModelsJson()
          let source = 'models.json'

          // Ensure the default model from config.yaml is always included
          const defaultModel = readVorbiumDefaultModel()
          if (defaultModel) {
            const hasDefault = models.some((m) => m.id === defaultModel.id)
            if (!hasDefault) {
              models.unshift(defaultModel)
            }
          }

          // Fallback: if no models.json, fetch from vorbium-engine /v1/models
          if (models.length === 0 && getGatewayCapabilities().models) {
            models = await fetchVorbiumModels()
            source = 'vorbium-engine'
          }

          // Auth-store models (Anthropic, OpenAI, etc.) — Vorbium-specific
          // discovery layer kept in addition to upstream's curated list.
          const existingIds = new Set(models.map((m) => m.id))
          for (const m of getAuthStoreModels()) {
            if (!existingIds.has(m.id)) {
              models.push(m)
              existingIds.add(m.id)
            }
          }

          // Auto-discover local providers (Ollama, Atomic Chat, etc.)

          await ensureDiscovery()
          const localModels = getDiscoveredModels()
          for (const m of localModels) {
            if (!existingIds.has(m.id)) {
              models.push(m)
              existingIds.add(m.id)
              // Auto-register provider in config if not already there
              ensureProviderInConfig(m.provider)
            }
          }
          const configuredProviders = Array.from(
            new Set(
              models
                .map((model) =>
                  typeof model.provider === 'string' ? model.provider : '',
                )
                .filter(Boolean),
            ),
          )

          return json({
            ok: true,
            object: 'list',
            data: models,
            models,
            configuredProviders,
            source,
          })
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 503 },
          )
        }
      },
    },
  },
})
