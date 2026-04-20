import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { authComponent, createAuth } from './auth'

const http = httpRouter()

http.route({
  path: '/api/convex-ping',
  method: 'GET',
  handler: httpAction(async () => new Response('ok', { status: 200 })),
})

authComponent.registerRoutes(http, createAuth, { cors: true })

export default http
