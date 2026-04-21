import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'

const RUNTIME_HEALTH_TIMEOUT_MS = 2_000
const VORBIUM_HOME = join(homedir(), '.vorbium')
const DEFAULT_RUNTIME_URL =
  process.env.VORBIUM_API_URL?.trim() ||
  process.env.HERMES_API_URL?.trim() ||
  'http://127.0.0.1:8642'

function getRuntimeBaseUrl(): string {
  return DEFAULT_RUNTIME_URL.replace(/\/$/, '')
}

function getRuntimeHostAndPort(): { host: string; port: number } {
  try {
    const parsed = new URL(getRuntimeBaseUrl())
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80,
    }
  } catch {
    return { host: '127.0.0.1', port: 8642 }
  }
}

let startPromise: Promise<StartVorbiumEngineResult> | null = null

export type StartVorbiumEngineResult =
  | {
      ok: true
      message: string
      pid?: number
    }
  | {
      ok: false
      error: string
    }

/**
 * Read ~/.vorbium/.env and return key=value pairs as an object.
 * Silently returns {} if the file doesn't exist or can't be parsed.
 */
function readVorbiumEnv(): Record<string, string> {
  const envPath = join(VORBIUM_HOME, '.env')
  try {
    const raw = readFileSync(envPath, 'utf-8')
    const result: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx <= 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (key) result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

/** Same directory resolution logic as vite.config.ts. */
export function resolveVorbiumRuntimeDir(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const candidates: Array<string> = []

  if (env.VORBIUM_ENGINE_PATH?.trim()) {
    candidates.push(env.VORBIUM_ENGINE_PATH.trim())
  }

  if (env.HERMES_AGENT_PATH?.trim()) {
    candidates.push(env.HERMES_AGENT_PATH.trim())
  }

  const workspaceRoot = dirname(resolve('.'))
  candidates.push(
    resolve(workspaceRoot, 'vorbium-engine-runtime'),
    resolve(workspaceRoot, '..', 'vorbium-engine-runtime'),
    resolve(workspaceRoot, 'vorbium-engine'),
    resolve(workspaceRoot, '..', 'vorbium-engine'),
    resolve(workspaceRoot, 'hermes-agent'),
    resolve(workspaceRoot, '..', 'hermes-agent'),
    resolve(homedir(), '.hermes', 'hermes-agent'),
    resolve(homedir(), 'hermes-agent'),
  )

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, 'webapi'))) return candidate
  }

  return null
}

/** Find the `hermes` CLI binary installed by Nous's installer (or on PATH). */
export function resolveHermesBinary(): string | null {
  const candidates = [
    resolve(homedir(), '.hermes', 'bin', 'hermes'),
    resolve(homedir(), '.local', 'bin', 'hermes'),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

export function resolveVorbiumPython(runtimeDir: string): string {
  const venvPython = resolve(runtimeDir, '.venv', 'bin', 'python')
  if (existsSync(venvPython)) return venvPython
  const uvVenv = resolve(runtimeDir, 'venv', 'bin', 'python')
  if (existsSync(uvVenv)) return uvVenv
  // Nous installer ships its own uv-managed python alongside the binary
  const nousPython = resolve(homedir(), '.hermes', 'venv', 'bin', 'python')
  if (existsSync(nousPython)) return nousPython
  return 'python3'
}

export async function isVorbiumRuntimeHealthy(
  runtimeUrl = getRuntimeBaseUrl(),
): Promise<boolean> {
  try {
    const response = await fetch(`${runtimeUrl}/health`, {
      signal: AbortSignal.timeout(RUNTIME_HEALTH_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function startVorbiumRuntime(): Promise<StartVorbiumEngineResult> {
  if (await isVorbiumRuntimeHealthy()) {
    return { ok: true, message: 'already running' }
  }

  if (startPromise) {
    return startPromise
  }

  startPromise = (async () => {
    try {
      const vorbiumEnv = readVorbiumEnv()
      const hermesBin = resolveHermesBinary()
      const runtimeDir = resolveVorbiumRuntimeDir()
      const { host, port } = getRuntimeHostAndPort()

      // Prefer the `hermes gateway run` binary path (the Nous installer's
      // canonical entrypoint). Fall back to launching uvicorn against the
      // source tree if we only have a directory.
      let command: string
      let commandArgs: Array<string>
      let cwd: string | undefined

      if (hermesBin) {
        command = hermesBin
        commandArgs = ['gateway', 'run']
        cwd = runtimeDir ?? undefined
      } else if (runtimeDir) {
        command = resolveVorbiumPython(runtimeDir)
        commandArgs = [
          '-m',
          'uvicorn',
          'webapi.app:app',
          '--host',
          host,
          '--port',
          String(port),
        ]
        cwd = runtimeDir
      } else {
        return {
          ok: false,
          error:
            'vorbium-engine-runtime not found. Clone it as a sibling directory or set VORBIUM_ENGINE_PATH in .env',
        }
      }

      const child = spawn(
        command,
        commandArgs,
        {
          cwd,
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env,
            ...vorbiumEnv,
            HERMES_HOME: vorbiumEnv.HERMES_HOME || process.env.HERMES_HOME || VORBIUM_HOME,
            PYTHONPATH: runtimeDir ? [runtimeDir, process.env.PYTHONPATH].filter(Boolean).join(':') : process.env.PYTHONPATH,
            PATH: [
              resolve(homedir(), '.hermes', 'bin'),
              resolve(homedir(), '.local', 'bin'),
              runtimeDir ? resolve(runtimeDir, '.venv', 'bin') : '',
              runtimeDir ? resolve(runtimeDir, 'venv', 'bin') : '',
              process.env.PATH || '',
            ].filter(Boolean).join(':'),
          },
        },
      )

      child.unref()

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolveAttempt) => setTimeout(resolveAttempt, 1_000))
        if (await isVorbiumRuntimeHealthy()) {
          return {
            ok: true,
            pid: child.pid,
            message: 'started',
          }
        }
      }

      return {
        ok: true,
        pid: child.pid,
        message: 'starting',
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })()

  try {
    return await startPromise
  } finally {
    startPromise = null
  }
}
