import { createServerFn } from '@tanstack/react-start'
import {
  disconnectGmail,
  getGmailConnection,
  isGmailConfigured,
} from '#/server/api/gmailOAuth'
import { requireAppUser } from '#/server/api/authz'
import { listPendingEmailImports } from '#/server/api/expenses'

export type GmailConnectionStatus = {
  configured: boolean
  connected: boolean
  email: string | null
  connectedAt: string | null
  lastSyncedAt: string | null
  lastError: string | null
  pendingImports: number
}

/** Connection state rendered by the Settings card. */
export const getGmailStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GmailConnectionStatus> => {
    const appUser = await requireAppUser()
    const connection = await getGmailConnection(appUser.id)
    const pending = await listPendingEmailImports()

    return {
      configured: isGmailConfigured(),
      connected: Boolean(connection),
      email: connection?.email ?? null,
      connectedAt: connection
        ? new Date(connection.connectedAt).toISOString()
        : null,
      lastSyncedAt: connection?.lastSyncedAt
        ? new Date(connection.lastSyncedAt).toISOString()
        : null,
      lastError: connection?.lastError ?? null,
      pendingImports: Array.isArray(pending) ? pending.length : 0,
    }
  },
)

/** Disconnects Gmail and stops future syncs for this account. */
export const disconnectGmailAccount = createServerFn({
  method: 'POST',
}).handler(async () => {
  const appUser = await requireAppUser()
  await disconnectGmail(appUser.id)
  return { ok: true }
})
