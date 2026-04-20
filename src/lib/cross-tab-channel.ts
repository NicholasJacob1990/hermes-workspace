/**
 * Cross-tab channel primitive.
 *
 * Thin wrapper over the browser's BroadcastChannel API that layers in
 * three pieces of hygiene:
 *
 *  1. **Echo suppression via tabId.** Every envelope carries a tabId
 *     generated once per tab at module init. The subscribe side drops
 *     any message whose tabId matches the local one. This covers the
 *     common case without relying on the store's own dedup pipeline.
 *
 *  2. **Fallback to `storage` events.** Safari 14 and some embedded
 *     WebViews don't ship BroadcastChannel. We fall back to writing a
 *     nonce key into localStorage, which fires a `storage` event in
 *     sibling tabs. Same-origin restrictions still apply.
 *
 *  3. **No-op in SSR / test environments.** When neither API is
 *     available (server, happy-dom without the shims), `send` is a
 *     silent no-op and `subscribe` returns an empty cleanup so the
 *     callers never have to null-check.
 *
 * Intentionally NOT handled here (pushed to callers):
 *   - Dedup beyond tabId. The chat-store's existing `processEvent`
 *     knows how to dedup by message ID / nonce / multipart signature,
 *     so we don't re-implement that here.
 *   - Delivery guarantees. BroadcastChannel is best-effort. If a peer
 *     tab was frozen by the OS it will not replay missed messages.
 *     Callers that need durable sync should use a separate backend
 *     stream (SSE, WebSocket).
 */

export interface CrossTabChannel<T> {
  /** Send a value to every sibling tab on the same origin + channel name. */
  send(value: T): void
  /** Subscribe to values from sibling tabs. Returns an unsubscribe fn. */
  subscribe(listener: (value: T) => void): () => void
  /** Permanently close the channel. Subscribers are cleared. */
  close(): void
  /** The tabId used to drop self-echoes — exposed for debugging / tests. */
  readonly tabId: string
}

interface Envelope<T> {
  tabId: string
  emittedAt: number
  value: T
}

function isBroadcastAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel ===
      'function'
  )
}

function isStorageAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { localStorage?: unknown }).localStorage ===
      'object' &&
    typeof (globalThis as { addEventListener?: unknown }).addEventListener ===
      'function'
  )
}

function generateTabId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `tab-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
}

/**
 * Create a cross-tab channel.
 *
 * @param name Channel name; shared between sibling tabs.
 * @param options.tabId Override the generated tabId (tests only).
 */
export function createCrossTabChannel<T>(
  name: string,
  options: { tabId?: string } = {},
): CrossTabChannel<T> {
  const tabId = options.tabId ?? generateTabId()
  const listeners = new Set<(value: T) => void>()
  let closed = false

  // ── BroadcastChannel path ────────────────────────────────────────────
  if (isBroadcastAvailable()) {
    const bc = new BroadcastChannel(name)

    bc.onmessage = (event: MessageEvent<Envelope<T>>) => {
      if (closed) return
      const envelope = event.data
      if (!envelope || envelope.tabId === tabId) return
      for (const listener of listeners) {
        try {
          listener(envelope.value)
        } catch (err) {
          // A misbehaving subscriber must not take down peers.
          // eslint-disable-next-line no-console
          console.error('[cross-tab-channel] subscriber error', err)
        }
      }
    }

    return {
      tabId,
      send(value) {
        if (closed) return
        const envelope: Envelope<T> = { tabId, emittedAt: Date.now(), value }
        try {
          bc.postMessage(envelope)
        } catch (err) {
          // postMessage throws on structured-clone failures (e.g. a
          // value that holds a Function). Surface it once so we notice.
          // eslint-disable-next-line no-console
          console.error('[cross-tab-channel] postMessage failed', err)
        }
      },
      subscribe(listener) {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      close() {
        closed = true
        listeners.clear()
        try {
          bc.close()
        } catch {
          // already closed
        }
      },
    }
  }

  // ── localStorage event fallback ──────────────────────────────────────
  if (isStorageAvailable()) {
    const storageKey = `__cross_tab_channel__:${name}`
    const handler = (event: StorageEvent) => {
      if (closed) return
      if (event.key !== storageKey || !event.newValue) return
      let envelope: Envelope<T>
      try {
        envelope = JSON.parse(event.newValue) as Envelope<T>
      } catch {
        return
      }
      if (!envelope || envelope.tabId === tabId) return
      for (const listener of listeners) {
        try {
          listener(envelope.value)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[cross-tab-channel] subscriber error', err)
        }
      }
    }

    ;(globalThis as unknown as Window).addEventListener('storage', handler)

    return {
      tabId,
      send(value) {
        if (closed) return
        const envelope: Envelope<T> = { tabId, emittedAt: Date.now(), value }
        try {
          // Set + remove so repeated identical values still fire events
          // (storage fires only on value change).
          const raw = JSON.stringify(envelope)
          localStorage.setItem(storageKey, raw)
          localStorage.removeItem(storageKey)
        } catch (err) {
          // Serialization or quota failure — log once.
          // eslint-disable-next-line no-console
          console.error('[cross-tab-channel] localStorage write failed', err)
        }
      },
      subscribe(listener) {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      close() {
        closed = true
        listeners.clear()
        try {
          ;(globalThis as unknown as Window).removeEventListener('storage', handler)
        } catch {
          // already gone
        }
      },
    }
  }

  // ── No-op fallback (SSR / headless) ──────────────────────────────────
  return {
    tabId,
    send() {
      /* no-op */
    },
    subscribe() {
      return () => {
        /* no-op */
      }
    },
    close() {
      closed = true
    },
  }
}
