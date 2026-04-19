import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..', '..')
const startVorbiumPath = resolve(root, 'src/routes/api/start-vorbium.ts')
const startHermesPath = resolve(root, 'src/routes/api/start-hermes.ts')
const vorbiumAgentPath = resolve(root, 'src/server/vorbium-agent.ts')

describe('vorbium public naming', () => {
  it('keeps only the vorbium start route publicly', () => {
    expect(existsSync(startVorbiumPath)).toBe(true)
    expect(existsSync(startHermesPath)).toBe(false)
  })

  it('uses Vorbium naming in the autostart server helper', () => {
    const source = readFileSync(vorbiumAgentPath, 'utf8')
    expect(source).not.toContain('startHermesAgent')
    expect(source).not.toContain('resolveHermesAgentDir')
    expect(source).not.toContain('resolveHermesPython')
    expect(source).not.toContain('isHermesAgentHealthy')
    expect(source).not.toContain('readHermesEnv')
    expect(source).not.toContain('set VORBIUM_ENGINE_PATH/HERMES_AGENT_PATH')
  })
})
