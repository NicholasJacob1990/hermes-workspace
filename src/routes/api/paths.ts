import path from 'node:path'
import os from 'node:os'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'

const VORBIUM_HOME =
  process.env.VORBIUM_HOME || path.join(os.homedir(), '.vorbium')

export const Route = createFileRoute('/api/paths')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        return json({
          ok: true,
          vorbiumHome: VORBIUM_HOME,
          memoriesDir: path.join(VORBIUM_HOME, 'memories'),
          skillsDir: path.join(VORBIUM_HOME, 'skills'),
        })
      },
    },
  },
})
