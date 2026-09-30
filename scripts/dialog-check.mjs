#!/usr/bin/env node
/**
 * Opens /debts on a phone viewport, taps a debt row to open its dialog, then
 * measures and screenshots the result.
 *
 *   node scripts/dialog-check.mjs <url> <cookie> <out.png> [tapLabel]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, cookie, out, tapLabel] = process.argv.slice(2)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = mkdtempSync(join(tmpdir(), 'chrome-dialog-'))
const port = 9666

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

  const label = tapLabel ?? 'Laptop payment plan'
  const tapped = await send('Runtime.evaluate', {
    expression: `(() => {
      const target = [...document.querySelectorAll('*')].find(
        (el) => el.children.length === 0 && (el.textContent || '').trim() === ${JSON.stringify(label)},
      );
      if (!target) return 'not found';
      // The clickable ancestor that carries the row behaviour.
      let node = target;
      while (node && node.getAttribute('role') !== 'button') node = node.parentElement;
      if (!node) return 'no row';
      node.click();
      return 'clicked';
    })()`,
    returnByValue: true,
  })
  await sleep(1200)

  const audit = await send('Runtime.evaluate', {
    expression: `(() => {
      const vw = document.documentElement.clientWidth;
      const dialog = document.querySelector('[role="dialog"]');
      const r = dialog ? dialog.getBoundingClientRect() : null;
      return {
        viewport: vw + 'x' + window.innerHeight,
        pageScrollWidth: document.documentElement.scrollWidth,
        horizontalScroll: document.documentElement.scrollWidth > vw + 1,
        dialog: r
          ? {
              top: Math.round(r.top),
              bottom: Math.round(r.bottom),
              w: Math.round(r.width),
              h: Math.round(r.height),
              inViewport: r.top >= -1 && r.bottom <= window.innerHeight + 1,
              scrollWidth: dialog.scrollWidth,
              clientWidth: dialog.clientWidth,
            }
          : null,
      };
    })()`,
    returnByValue: true,
  })

  if (out) {
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(out, Buffer.from(shot.data, 'base64'))
  }

  console.log(
    JSON.stringify(
      { tapped: tapped.result.value, ...audit.result.value },
      null,
      2,
    ),
  )
  ws.close()
} finally {
  chrome.kill()
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 })
  } catch {
    // fine
  }
}
