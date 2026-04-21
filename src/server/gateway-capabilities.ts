/**
 * Probes the Vorbium gateway to detect which API groups are available.
 * Results are cached and refreshed periodically so route handlers can
 * degrade cleanly against older Vorbium gateways.
 *
 * Two-tier capability model:
 *   - Core: portable chat readiness (health, chat completions, models)
 *   - Enhanced: Vorbium-native extras (sessions, skills, memory, config, jobs)
 *
 * Zero-fork architecture (upstream v2.0.0):
 *   - Gateway (:8645 by default): /health, /v1/chat/completions, /v1/models
 *   - Dashboard (:9119 by default): sessions, skills, config, cron, env, analytics
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Fallback: read .env directly if process.env wasn't populated by Vite.
// TanStack Start SSR pode rodar em worker isolado — ESM context, require()
// não funciona, então usamos imports top-level.
function readDotenvVar(key: string): string {
  if (process.env[key]) return process.env[key] as string
  const candidates: string[] = [resolve(process.cwd(), '.env')]
  try {
    const here = fileURLToPath(import.meta.url)
    let dir = dirname(here)
    for (let i = 0; i < 6; i++) {
      candidates.push(resolve(dir, '.env'))
      dir = dirname(dir)
    }
  } catch {
    // import.meta.url pode falhar em alguns contextos
  }
  // Fallback absoluto (dev)
  candidates.push(
    '/Users/nicholasjacob/Documents/Aplicativos/Iudex/apps/vorbium-workspace/.env',
  )
  for (const envPath of candidates) {
    try {
      if (!existsSync(envPath)) continue
      for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq < 0) continue
        const k = trimmed.slice(0, eq).trim()
        if (k !== key) continue
        let v = trimmed.slice(eq + 1).trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (v) {
          process.env[key] = v
          // eslint-disable-next-line no-console
          console.log(`[gateway-capabilities] loaded ${key} (${v.length} chars) from ${envPath}`)
          return v
        }
      }
    } catch {
      // try next candidate
    }
  }
  // eslint-disable-next-line no-console
  console.warn(`[gateway-capabilities] ${key} not found in process.env or any .env`)
  return ''
}

export let HERMES_API = readDotenvVar('HERMES_API_URL') || readDotenvVar('VORBIUM_API_URL') || 'http://127.0.0.1:8642'
export let HERMES_DASHBOARD_URL =
  readDotenvVar('HERMES_DASHBOARD_URL') || 'http://127.0.0.1:9119'

export const HERMES_UPGRADE_INSTRUCTIONS =
  'For full features, use the enhanced fork: git clone https://github.com/outsourc-e/vorbium-agent && cd vorbium-engine && pip install -e . && vorbium-engine dashboard run'

export const SESSIONS_API_UNAVAILABLE_MESSAGE = `Your Vorbium gateway does not support the sessions API. ${HERMES_UPGRADE_INSTRUCTIONS}`

const PROBE_TIMEOUT_MS = 3_000
const PROBE_TTL_MS = 120_000
const DASHBOARD_TOKEN_REGEX =
  /window\.__HERMES_SESSION_TOKEN__\s*=\s*["'](.+?)["']/

// ── Types ─────────────────────────────────────────────────────────

export type CoreCapabilities = {
  health: boolean
  chatCompletions: boolean
  models: boolean
  streaming: boolean
  probed: boolean
}

export type EnhancedCapabilities = {
  sessions: boolean
  enhancedChat: boolean
  skills: boolean
  memory: boolean
  config: boolean
  jobs: boolean
}

export type DashboardCapabilities = {
  dashboard: {
    available: boolean
    url: string
  }
}

/** Full capabilities — backward compat with existing code */
export type GatewayCapabilities =
  CoreCapabilities &
  EnhancedCapabilities &
  DashboardCapabilities

export type GatewayMode =
  | 'zero-fork'
  | 'enhanced-fork'
  | 'portable'
  | 'disconnected'

export type ChatMode = 'enhanced-vorbium' | 'portable' | 'disconnected'

export type ConnectionStatus =
  | 'connected'
  | 'enhanced'
  | 'partial'
  | 'disconnected'

// ── State ─────────────────────────────────────────────────────────

let capabilities: GatewayCapabilities = {
  health: false,
  chatCompletions: false,
  models: false,
  streaming: false,
  sessions: false,
  enhancedChat: false,
  skills: false,
  memory: false,
  config: false,
  jobs: false,
  dashboard: {
    available: false,
    url: HERMES_DASHBOARD_URL,
  },
  probed: false,
}

let probePromise: Promise<GatewayCapabilities> | null = null
let lastProbeAt = 0
let lastLoggedSummary = ''
let dashboardTokenPromise: Promise<string> | null = null
let dashboardTokenCache = ''

/** Optional bearer token for authenticated endpoints. */
export const BEARER_TOKEN = readDotenvVar('HERMES_API_TOKEN')

function authHeaders(): Record<string, string> {
  return BEARER_TOKEN ? { Authorization: `Bearer ${BEARER_TOKEN}` } : {}
}

export async function fetchDashboardToken(options?: {
  force?: boolean
}): Promise<string> {
  const force = options?.force === true
  if (!force && dashboardTokenCache) return dashboardTokenCache
  if (!force && dashboardTokenPromise) return dashboardTokenPromise

  dashboardTokenPromise = (async () => {
    // Dashboard injects the session token inline on `/` (root), not on
    // `/index.html` which serves the raw Vite-built HTML without the token.
    const res = await fetch(`${HERMES_DASHBOARD_URL}/`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (!res.ok) {
      throw new Error(`Dashboard index failed: ${res.status}`)
    }
    const html = await res.text()
    const token = html.match(DASHBOARD_TOKEN_REGEX)?.[1]?.trim() || ''
    if (!token) {
      throw new Error('Dashboard session token not found in root HTML')
    }
    dashboardTokenCache = token
    return token
  })()

  try {
    return await dashboardTokenPromise
  } finally {
    dashboardTokenPromise = null
  }
}

export async function getDashboardToken(options?: {
  force?: boolean
}): Promise<string> {
  return fetchDashboardToken(options)
}

export async function dashboardAuthHeaders(options?: {
  force?: boolean
}): Promise<Record<string, string>> {
  const token = await getDashboardToken(options)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function withDashboardBase(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${HERMES_DASHBOARD_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export async function dashboardFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const requestPath = withDashboardBase(path)
  const method = (init.method || 'GET').toUpperCase()
  const doFetch = async (forceToken = false) => {
    const headers = new Headers(init.headers)
    const isProtected =
      requestPath.includes('/api/') &&
      !requestPath.endsWith('/api/status') &&
      !requestPath.endsWith('/api/config/defaults') &&
      !requestPath.endsWith('/api/config/schema') &&
      !requestPath.endsWith('/api/model/info') &&
      !requestPath.endsWith('/api/dashboard/themes') &&
      !requestPath.endsWith('/api/dashboard/plugins') &&
      !requestPath.endsWith('/api/dashboard/plugins/rescan')

    if (isProtected && !headers.has('Authorization')) {
      const auth = await dashboardAuthHeaders({ force: forceToken })
      for (const [key, value] of Object.entries(auth)) {
        headers.set(key, value)
      }
    }

    return fetch(requestPath, {
      ...init,
      method,
      headers,
    })
  }

  let res = await doFetch(false)
  if (res.status === 401) {
    dashboardTokenCache = ''
    res = await doFetch(true)
  }
  return res
}

// ── Probing ───────────────────────────────────────────────────────

async function probe(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${HERMES_API}${path}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (res.status === 404 || res.status === 403) return false
    return true
  } catch {
    return false
  }
}

async function probeChatCompletions(): Promise<boolean> {
  try {
    const getRes = await fetch(`${HERMES_API}/v1/chat/completions`, {
      method: 'GET',
      headers: authHeaders(),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (getRes.status === 405) return true
    if (getRes.ok) return true
    if (getRes.status === 400 || getRes.status === 422) return true
    if (getRes.status === 404) return false
    return true
  } catch {
    return false
  }
}

async function probeDashboard(): Promise<{ available: boolean; url: string }> {
  try {
    const res = await fetch(`${HERMES_DASHBOARD_URL}/api/status`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (!res.ok) return { available: false, url: HERMES_DASHBOARD_URL }
    const body = (await res.json()) as { version?: string }
    if (!body.version) return { available: false, url: HERMES_DASHBOARD_URL }
    await fetchDashboardToken().catch(() => '')
    return { available: true, url: HERMES_DASHBOARD_URL }
  } catch {
    return { available: false, url: HERMES_DASHBOARD_URL }
  }
}

// Vanilla hermes-agent 0.10.0 satisfies: health, chatCompletions, models, streaming,
// sessions, skills, config, jobs. Dashboard-only endpoints (themes/plugins) and the
// legacy enhanced-fork chat stream are optional — their absence should not emit the
// "Missing Hermes APIs detected" warning, which only applies to critical gaps.
const OPTIONAL_APIS = new Set([
  'jobs',
  'chatCompletions',
  'streaming',
  'memory',
  'dashboard',
  'enhancedChat',
])

function logCapabilities(next: GatewayCapabilities): void {
  const core: Array<string> = []
  const enhanced: Array<string> = []
  const missing: Array<string> = []

  const coreKeys: Array<keyof CoreCapabilities> = [
    'health',
    'chatCompletions',
    'models',
    'streaming',
  ]
  const enhancedKeys: Array<keyof EnhancedCapabilities> = [
    'sessions',
    'enhancedChat',
    'skills',
    'memory',
    'config',
    'jobs',
  ]

  for (const key of coreKeys) {
    ;(next[key] ? core : missing).push(key)
  }
  for (const key of enhancedKeys) {
    ;(next[key] ? enhanced : missing).push(key)
  }
  if (next.dashboard.available) core.push('dashboard')
  else missing.push('dashboard')

  const mode = getGatewayMode()
  const summary = `[gateway] gateway=${HERMES_API} dashboard=${next.dashboard.url} mode=${mode} core=[${core.join(', ')}] enhanced=[${enhanced.join(', ')}] missing=[${missing.join(', ')}]`
  if (summary === lastLoggedSummary) return
  lastLoggedSummary = summary
  console.log(summary)

  const criticalMissing = missing.filter((key) => !OPTIONAL_APIS.has(key))
  if (criticalMissing.length > 0 && (next.health || next.dashboard.available)) {
    console.warn(
      `[gateway] Missing Vorbium APIs detected. ${HERMES_UPGRADE_INSTRUCTIONS}`,
    )
  }
}

async function autoDetectGatewayUrl(): Promise<void> {
  if (process.env.HERMES_API_URL) return

  const candidates = [
    'http://127.0.0.1:8645',
    'http://127.0.0.1:8642',
    'http://127.0.0.1:8643',
  ]

  for (const candidate of candidates) {
    try {
      const res = await fetch(`${candidate}/health`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
      if (res.ok) {
        HERMES_API = candidate
        console.log(`[gateway] Connected to Hermes gateway at ${HERMES_API}`)
        return
      }
    } catch {
      // continue
    }
  }

  console.warn('[gateway] Could not reach Hermes gateway on 8645, 8642, or 8643')
}

async function autoDetectDashboardUrl(): Promise<void> {
  if (process.env.HERMES_DASHBOARD_URL) return

  const candidates = ['http://127.0.0.1:9119']
  for (const candidate of candidates) {
    try {
      const res = await fetch(`${candidate}/api/status`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
      if (res.ok) {
        HERMES_DASHBOARD_URL = candidate
        return
      }
    } catch {
      // continue
    }
  }
}

export async function probeGateway(options?: {
  force?: boolean
}): Promise<GatewayCapabilities> {
  const force = options?.force === true
  if (!force && capabilities.probed) {
    return capabilities
  }
  if (probePromise) {
    return probePromise
  }

  probePromise = (async () => {
    await Promise.all([autoDetectGatewayUrl(), autoDetectDashboardUrl()])

    const [
      health,
      chatCompletions,
      models,
      legacySessions,
      enhancedChat,
      legacySkills,
      legacyConfig,
      legacyJobs,
      dashboard,
    ] = await Promise.all([
      probe('/health'),
      probeChatCompletions(),
      probe('/v1/models'),
      probe('/api/sessions'),
      probe('/api/sessions/__probe__/chat/stream'),
      probe('/api/skills'),
      probe('/api/config'),
      probe('/api/jobs'),
      probeDashboard(),
    ])

    capabilities = {
      health,
      chatCompletions,
      models,
      streaming: chatCompletions,
      probed: true,
      sessions: dashboard.available || legacySessions,
      enhancedChat,
      skills: dashboard.available || legacySkills,
      // Memory is always available: workspace reads $HERMES_HOME/MEMORY.md +
      // memory/*.md + memories/*.md directly from the local filesystem.
      // No remote gateway endpoint is required.
      memory: true,
      config: dashboard.available || legacyConfig,
      jobs: dashboard.available || legacyJobs,
      dashboard,
    }
    lastProbeAt = Date.now()
    logCapabilities(capabilities)
    return capabilities
  })()

  try {
    return await probePromise
  } finally {
    probePromise = null
  }
}

export async function ensureGatewayProbed(): Promise<GatewayCapabilities> {
  const isStale = Date.now() - lastProbeAt > PROBE_TTL_MS
  if (!capabilities.probed || isStale) {
    return probeGateway({ force: isStale })
  }
  return capabilities
}

// ── Accessors ─────────────────────────────────────────────────────

export function getCapabilities(): GatewayCapabilities {
  return capabilities
}

export function getCoreCapabilities(): CoreCapabilities {
  return {
    health: capabilities.health,
    chatCompletions: capabilities.chatCompletions,
    models: capabilities.models,
    streaming: capabilities.streaming,
    probed: capabilities.probed,
  }
}

/** Vorbium-native enhanced capabilities only */
export function getEnhancedCapabilities(): EnhancedCapabilities {
  return {
    sessions: capabilities.sessions,
    enhancedChat: capabilities.enhancedChat,
    skills: capabilities.skills,
    memory: capabilities.memory,
    config: capabilities.config,
    jobs: capabilities.jobs,
  }
}

export function getGatewayMode(): GatewayMode {
  // 'zero-fork' requires the optional dashboard plugin bundle; 'enhanced' is
  // granted whenever the core enhanced-chat endpoints are present — which
  // vanilla hermes-agent (≥0.10) satisfies. The label 'enhanced-fork' is
  // legacy copy from the 2025-era fork and does NOT imply an actual fork is
  // required. We keep the value for backwards compatibility with UI code.
  if (capabilities.dashboard.available && capabilities.chatCompletions) {
    return 'zero-fork'
  }
  if (capabilities.sessions && capabilities.enhancedChat) {
    return 'enhanced-fork'
  }
  if (capabilities.chatCompletions || capabilities.health) return 'portable'
  return 'disconnected'
}

/**
 * UI-facing chat transport mode:
 * - enhanced-vorbium: full Vorbium session API available
 * - portable: OpenAI-compatible /v1/chat/completions transport
 * - disconnected: no usable chat backend
 */
export function getChatMode(): ChatMode {
  if (capabilities.enhancedChat) return 'enhanced-vorbium'
  if (capabilities.chatCompletions || capabilities.health) return 'portable'
  return 'disconnected'
}

export function getConnectionStatus(): ConnectionStatus {
  if (!capabilities.health && !capabilities.chatCompletions) {
    return capabilities.dashboard.available ? 'partial' : 'disconnected'
  }
  const enhanced =
    (capabilities.dashboard.available || capabilities.sessions) &&
    capabilities.skills &&
    capabilities.config
  if (enhanced) return 'enhanced'
  if (capabilities.chatCompletions || capabilities.sessions) return 'partial'
  return 'connected'
}

export function isVorbiumConnected(): boolean {
  return capabilities.health || capabilities.dashboard.available
}

void ensureGatewayProbed()
