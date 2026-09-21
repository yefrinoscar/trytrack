import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Mail, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  disconnectGmailAccount,
  getGmailStatus,
} from '@/server/gmail-connection.functions'

const QUERY_KEY = ['gmail-status'] as const

const ERROR_MESSAGES: Record<string, string> = {
  denied: 'Cancelaste el permiso en Google. No se conectó ninguna cuenta.',
  invalid_state:
    'La conexión caducó o ya se usó. Intenta de nuevo desde este botón.',
  missing_code: 'Google no devolvió el código de autorización.',
  no_email: 'No se pudo leer el correo de la cuenta de Google.',
  not_configured:
    'El servidor no tiene configuradas las credenciales de Google.',
  no_profile:
    'Falta tu perfil en la app. Recarga la página e intenta otra vez.',
  failed: 'La conexión falló. Revisa el estado e intenta de nuevo.',
}

function formatDate(value: string | null) {
  if (!value) {
    return null
  }
  return new Date(value).toLocaleString()
}

/**
 * Settings card that connects the signed-in account's Gmail so bank emails are
 * imported automatically. The connection is stored server-side, so it survives
 * reloads and needs no terminal steps.
 */
export function GmailConnectionCard({ result }: { result?: string }) {
  const queryClient = useQueryClient()
  const status = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getGmailStatus(),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  const disconnect = useMutation({
    mutationFn: () => disconnectGmailAccount(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] })
    },
  })

  const data = status.data
  const isWorking = status.isLoading || disconnect.isPending
  const errorMessage = result ? ERROR_MESSAGES[result] : undefined

  return (
    <div className="rounded-lg border border-border bg-sidebar/30 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
          <Mail className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          {status.isLoading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking Gmail connection…
            </p>
          ) : !data?.configured ? (
            <>
              <p className="text-foreground text-sm font-medium">
                Gmail import is not available
              </p>
              <p className="text-muted-foreground text-sm">
                The server is missing Google credentials, so accounts cannot be
                connected yet.
              </p>
            </>
          ) : data.connected ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <p className="text-foreground text-sm font-medium">
                  Connected as {data.email}
                </p>
              </div>
              <dl className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-[auto_1fr] sm:gap-x-3">
                <dt>Connected</dt>
                <dd className="text-foreground">
                  {formatDate(data.connectedAt)}
                </dd>
                <dt>Last sync</dt>
                <dd className="text-foreground">
                  {formatDate(data.lastSyncedAt) ?? 'Not run yet'}
                </dd>
                <dt>Pending review</dt>
                <dd className="text-foreground">{data.pendingImports}</dd>
              </dl>
              {data.lastError ? (
                <p className="text-destructive text-xs">
                  Last error: {data.lastError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  disabled={isWorking}
                  onClick={() =>
                    window.location.assign('/api/email/gmail/connect')
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reconnect
                </Button>
                <Button
                  disabled={isWorking}
                  onClick={() => disconnect.mutate()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-foreground text-sm font-medium">
                Connect Gmail to import expenses
              </p>
              <p className="text-muted-foreground text-sm">
                We read only bank notification emails to create pending expenses
                for your review. Nothing is confirmed automatically, and you can
                disconnect at any time.
              </p>
              {result === 'connected' ? (
                <p className="text-muted-foreground text-xs">
                  The connection was saved but is not showing yet. Refresh the
                  page.
                </p>
              ) : null}
              <Button
                disabled={isWorking}
                onClick={() =>
                  window.location.assign('/api/email/gmail/connect')
                }
                size="sm"
                type="button"
              >
                <Mail className="h-3.5 w-3.5" />
                Connect Gmail
              </Button>
            </>
          )}

          {result === 'connected' && data?.connected ? (
            <p className="text-xs text-emerald-500">
              Gmail connected. New bank emails will appear for review within 15
              minutes.
            </p>
          ) : null}

          {errorMessage ? (
            <p className="text-destructive text-xs">{errorMessage}</p>
          ) : null}

          {disconnect.isError ? (
            <p className="text-destructive text-xs">
              Could not disconnect. Try again.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
