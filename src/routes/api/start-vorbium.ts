import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { startVorbiumRuntime } from '../../server/vorbium-agent'

export const Route = createFileRoute('/api/start-vorbium')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const result = await startVorbiumRuntime()
        return json(result, { status: result.ok ? 200 : 500 })
      },
    },
  },
})
