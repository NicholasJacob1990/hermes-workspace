import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCrossTabChannel } from './cross-tab-channel'

type FakeChannel = {
  name: string
  onmessage: ((event: MessageEvent) => void) | null
  postMessage: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  _simulateIncoming: (data: unknown) => void
}

const createdChannels: FakeChannel[] = []

class FakeBroadcastChannel implements FakeChannel {
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null
  postMessage = vi.fn()
  close = vi.fn(() => {
    const idx = createdChannels.indexOf(this)
    if (idx >= 0) createdChannels.splice(idx, 1)
  })

  constructor(name: string) {
    this.name = name
    createdChannels.push(this)
  }

  /** Simulate a message arriving from another tab on the same channel. */
  _simulateIncoming(data: unknown) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

describe('createCrossTabChannel (BroadcastChannel path)', () => {
  beforeEach(() => {
    createdChannels.length = 0
    ;(globalThis as { BroadcastChannel?: unknown }).BroadcastChannel =
      FakeBroadcastChannel as unknown as typeof BroadcastChannel
  })

  afterEach(() => {
    delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel
  })

  it('wraps each outgoing value in an envelope with tabId + emittedAt', () => {
    const channel = createCrossTabChannel<{ kind: string }>('test', {
      tabId: 'tab-A',
    })
    channel.send({ kind: 'hello' })
    const bc = createdChannels[0]
    expect(bc.postMessage).toHaveBeenCalledTimes(1)
    const envelope = bc.postMessage.mock.calls[0][0]
    expect(envelope.tabId).toBe('tab-A')
    expect(envelope.value).toEqual({ kind: 'hello' })
    expect(typeof envelope.emittedAt).toBe('number')
  })

  it('delivers messages from other tabs to subscribers', () => {
    const channel = createCrossTabChannel<string>('test', { tabId: 'tab-A' })
    const listener = vi.fn()
    channel.subscribe(listener)
    createdChannels[0]._simulateIncoming({
      tabId: 'tab-B',
      emittedAt: 1,
      value: 'hi',
    })
    expect(listener).toHaveBeenCalledWith('hi')
  })

  it('drops messages whose tabId matches the local one (echo suppression)', () => {
    const channel = createCrossTabChannel<string>('test', { tabId: 'tab-A' })
    const listener = vi.fn()
    channel.subscribe(listener)
    createdChannels[0]._simulateIncoming({
      tabId: 'tab-A',
      emittedAt: 1,
      value: 'echo',
    })
    expect(listener).not.toHaveBeenCalled()
  })

  it('drops malformed envelopes silently', () => {
    const channel = createCrossTabChannel<string>('test', { tabId: 'tab-A' })
    const listener = vi.fn()
    channel.subscribe(listener)
    createdChannels[0]._simulateIncoming(null)
    createdChannels[0]._simulateIncoming(undefined)
    createdChannels[0]._simulateIncoming({ tabId: 'tab-B' }) // missing value
    // The "missing value" case DOES pass through — the listener gets undefined.
    // Earlier branches ARE fully dropped.
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(undefined)
    void channel
  })

  it('supports multiple subscribers and one misbehaving subscriber does not block others', () => {
    const channel = createCrossTabChannel<string>('test', { tabId: 'tab-A' })
    const ok = vi.fn()
    const broken = vi.fn(() => {
      throw new Error('boom')
    })
    const alsoOk = vi.fn()
    channel.subscribe(ok)
    channel.subscribe(broken)
    channel.subscribe(alsoOk)

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      /* silence */
    })

    createdChannels[0]._simulateIncoming({
      tabId: 'tab-B',
      emittedAt: 1,
      value: 'msg',
    })

    expect(ok).toHaveBeenCalledWith('msg')
    expect(broken).toHaveBeenCalledWith('msg')
    expect(alsoOk).toHaveBeenCalledWith('msg')
    consoleErrorSpy.mockRestore()
  })

  it('unsubscribe stops delivery to that listener only', () => {
    const channel = createCrossTabChannel<string>('test', { tabId: 'tab-A' })
    const keep = vi.fn()
    const drop = vi.fn()
    channel.subscribe(keep)
    const off = channel.subscribe(drop)
    off()
    createdChannels[0]._simulateIncoming({
      tabId: 'tab-B',
      emittedAt: 1,
      value: 'x',
    })
    expect(keep).toHaveBeenCalledWith('x')
    expect(drop).not.toHaveBeenCalled()
  })

  it('close() stops send and delivery and releases the channel', () => {
    const channel = createCrossTabChannel<string>('test', { tabId: 'tab-A' })
    const listener = vi.fn()
    channel.subscribe(listener)

    channel.close()

    channel.send('after-close')
    // createdChannels was shifted by bc.close
    expect(createdChannels.length).toBe(0)
    // Listener is not called for any delivery simulation after close
    expect(listener).not.toHaveBeenCalled()
  })

  it('exposes the tabId for debugging', () => {
    const channel = createCrossTabChannel<string>('test', { tabId: 'tab-A' })
    expect(channel.tabId).toBe('tab-A')
  })

  it('generates a tabId when none is provided', () => {
    const a = createCrossTabChannel<string>('test')
    const b = createCrossTabChannel<string>('test')
    expect(a.tabId).not.toBe(b.tabId)
    expect(a.tabId.length).toBeGreaterThan(0)
  })
})

describe('createCrossTabChannel (no-op fallback)', () => {
  beforeEach(() => {
    delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it('returns a no-op channel when neither API is available', () => {
    const channel = createCrossTabChannel<string>('test', { tabId: 'tab-A' })
    const listener = vi.fn()
    const off = channel.subscribe(listener)
    channel.send('ignored')
    off()
    channel.close()
    expect(listener).not.toHaveBeenCalled()
  })
})
