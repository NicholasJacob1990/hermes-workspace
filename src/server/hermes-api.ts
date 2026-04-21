/**
 * hermes-api.ts — compatibility shim
 *
 * Upstream (outsourc-e/hermes-workspace) ships a `server/hermes-api.ts` facade.
 * Vorbium Workspace splits the same functionality across gateway-capabilities.ts
 * and vorbium-api.ts. This shim re-exports the needed symbols so that upstream-
 * added routes (e.g. session-history.ts) resolve without modification.
 */

export {
  SESSIONS_API_UNAVAILABLE_MESSAGE,
  ensureGatewayProbed,
  getCapabilities as getGatewayCapabilities,
} from './gateway-capabilities'

export { deleteSession, getMessages, toChatMessage } from './vorbium-api'
