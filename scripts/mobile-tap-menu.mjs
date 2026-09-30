#!/usr/bin/env node
/**
 * Taps the mobile account avatar with real touch events (not element.click(),
 * which Radix ignores) and reports whether the menu opens and where it lands.
 *
 *   node scripts/mobile-tap-menu.mjs <url> <cookie> <outDir>
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, cookie, outDir] = process.argv.slice(2)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = mkdtempSync(join(tmpdir(), 'chrome-tap-'))
const port = 9111
if (outDir) mkdirSync(outDir, { recursive: true })

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=390,844',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  for (let i = 0; i < 40; i += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break
    } catch {
      // not up yet
    }
    await sleep(250)
  }

  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
      method: 'PUT',
    })
  ).json()
  const ws = await new Promise((resolve, reject) => {
    const s = new WebSocket(target.webSocketDebuggerUrl)
    s.addEventListener('open', () => resolve(s))
    s.addEventListener('error', reject)
  })

  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id
      pending.set(i, { resolve, reject })
      ws.send(JSON.stringify({ id: i, method, params }))
    })

  await send('Network.enable')
  await send('Page.enable')

  const phone = () =>
    send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      screenWidth: 390,
      screenHeight: 844,
      deviceScaleFactor: 3,
      mobile: true,
    })
  await phone()
  await send('Emulation.setTouchEmulationEnabled', { enabled: true })

  for (const pair of (cookie ?? '').split(/;\s*/)) {
    const eq = pair.indexOf('=')
    if (eq < 1) continue
    await send('Network.setCookie', {
      name: pair.slice(0, eq),
      value: pair.slice(eq + 1),
      url,
    })
  }

  await send('Page.navigate', { url })
  await sleep(2500)
  await phone()
  await sleep(3000)

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    })
    return r.exceptionDetails
      ? { error: r.exceptionDetails.exception?.description }
      : r.result.value
  }

  // Locate the visible avatar.
  const box = await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => {
      const r = b.getBoundingClientRect();
      return (b.getAttribute('aria-label')||'').startsWith('Account menu') && r.width > 0;
    });
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  })()`)

  if (!box || box.error) {
    console.log(JSON.stringify({ error: 'no avatar found', box }, null, 2))
    process.exit(0)
  }

  // A real tap: touchStart then touchEnd, which is what a phone sends.
  const tap = async (x, y) => {
    await send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    })
    await sleep(60)
    await send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  }

  await tap(box.x, box.y)
  await sleep(1200)

  const after = await evaluate(`(() => {
    const menus = [...document.querySelectorAll('[role="menu"]')].map((m) => {
      const r = m.getBoundingClientRect();
      return {
        w: Math.round(r.width), h: Math.round(r.height),
        top: Math.round(r.top), bottom: Math.round(r.bottom),
        left: Math.round(r.left), right: Math.round(r.right),
        insideViewport:
          r.top >= -1 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1,
        text: (m.textContent||'').trim().slice(0, 50),
      };
    });
    const settings = [...document.querySelectorAll('a[href="/settings"]')].map((a) => {
      const r = a.getBoundingClientRect();
      return {
        visible: r.width > 0 && r.height > 0,
        top: Math.round(r.top),
        reachable: r.top >= 0 && r.bottom <= window.innerHeight,
      };
    });
    return { menus, settings };
  })()`)

  if (outDir) {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(
      join(outDir, 'tapped-menu.png'),
      Buffer.from(s.data, 'base64'),
    )
  }

  console.log(JSON.stringify({ avatar: box, after }, null, 2))
  ws.close()
} finally {
  chrome.kill()
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 })
  } catch {
    // fine
  }
}
