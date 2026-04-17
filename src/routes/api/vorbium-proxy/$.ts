import { createFileRoute } from '@tanstack/react-router'
import { existsSync, readFileSync } from 'node:fs'
import { BEARER_TOKEN, HERMES_API } from '../../../server/gateway-capabilities'
import { isAuthenticated } from '../../../server/auth-middleware'

// Fallback inline: lê o token do .env a cada request se BEARER_TOKEN estiver
// vazio (pode acontecer se TanStack Start SSR worker não herdar env vars).
function getBearerToken(): string {
  if (BEARER_TOKEN) return BEARER_TOKEN
  if (process.env.VORBIUM_API_TOKEN ?? process.env.HERMES_API_TOKEN) return process.env.VORBIUM_API_TOKEN ?? process.env.HERMES_API_TOKEN
  const ENV_PATH =
    '/Users/nicholasjacob/Documents/Aplicativos/Iudex/apps/hermes-workspace/.env'
  try {
    if (!existsSync(ENV_PATH)) return ''
    for (const line of readFileSync(ENV_PATH, 'utf-8').split('\n')) {
      const m = line.match(/^HERMES_API_TOKEN=(.+)$/)
      if (m) return m[1].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
  return ''
}

async function proxyRequest(request: Request, splat: string) {
  const incomingUrl = new URL(request.url)
  const targetPath = splat.startsWith('/') ? splat : `/${splat}`
  const targetUrl = new URL(`${HERMES_API}${targetPath}`)
  targetUrl.search = incomingUrl.search

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  const token = getBearerToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = await request.text()
  }

  const upstream = await fetch(targetUrl, init)
  const body = await upstream.text()
  const responseHeaders = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) responseHeaders.set('content-type', contentType)
  return new Response(body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const Route = createFileRoute('/api/vorbium-proxy/$')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          )
        }
        return proxyRequest(request, params._splat || '')
      },
      POST: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          )
        }
        return proxyRequest(request, params._splat || '')
      },
      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          )
        }
        return proxyRequest(request, params._splat || '')
      },
      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          )
        }
        return proxyRequest(request, params._splat || '')
      },
    },
  },
})
