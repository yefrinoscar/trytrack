#!/usr/bin/env node
/**
 * Measures a real page load in Chrome: TTFB, first paint, and when the
 * dashboard data finishes arriving. Used to check /debts in production.
 *
 *   node scripts/measure-page.mjs <url> [cookie]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const url = process.argv[2]
const cookie = process.argv[3]

if (!url) {
  console.error('Usage: node scripts/measure-page.mjs <url> [cookie]')
  process.exit(1)
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = mkdtempSync(join(tmpdir(), 'chrome-measure-'))
const port = 9333

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForDevtools() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await sleep(250)
  }
  throw new Error('Chrome DevTools did not start')
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    ws.addEventListener('open', () => resolve(ws))
    ws.addEventListener('error', reject)
  })
}

function rpc(ws, state) {
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++state.id
      state.pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
}

try {
  await waitForDevtools()
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
      method: 'PUT',
    })
  ).json()

  const ws = await connect(target.webSocketDebuggerUrl)
  const state = { id: 0, pending: new Map() }
  const send = rpc(ws, state)

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && state.pending.has(msg.id)) {
      const { resolve, reject } = state.pending.get(msg.id)
      state.pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  })

  await send('Network.enable')
  await send('Page.enable')

  if (cookie) {
    // Accepts a full Cookie header so both the session token and better-auth's
    // cached session_data cookie are sent, the way a returning browser does.
    for (const pair of cookie.split(/;\s*/)) {
      const eq = pair.indexOf('=')
      if (eq < 1) continue
      const name = pair.slice(0, eq)
      const value = pair.slice(eq + 1)
      const result = await send('Network.setCookie', { name, value, url })
      if (!result?.success) {
        throw new Error(
          `Could not set cookie ${name}: ${JSON.stringify(result)}`,
        )
      }
    }
  }

  // Record when each request finishes so we can see what the page waits on.
  const finished = []
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.method === 'Network.loadingFinished') {
      finished.push(msg.params)
    }
  })

  await send('Page.navigate', { url })
  await sleep(6000)

  const metrics = await send('Runtime.evaluate', {
    expression: `(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const paints = {};
      for (const p of performance.getEntriesByType('paint')) paints[p.name] = Math.round(p.startTime);
      const resources = performance.getEntriesByType('resource')
        .filter(r => r.name.includes('_serverFn'))
        .map(r => ({ name: r.name.slice(-24), ms: Math.round(r.duration), start: Math.round(r.startTime) }));
      const done = performance.timing ? Math.round(performance.timing.responseEnd - performance.timing.navigationStart) : null;
      return JSON.stringify({ ttfb: Math.round(nav.responseStart || 0), domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0), responseEnd: done, paints, serverFn: resources });
    })()`,
    returnByValue: true,
  })

  console.log(JSON.stringify(JSON.parse(metrics.result.value), null, 2))

  ws.close()
} finally {
  chrome.kill()
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 })
  } catch {
    // Chrome may still be flushing its profile; leaving a temp dir is fine.
  }
}
