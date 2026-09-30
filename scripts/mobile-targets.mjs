#!/usr/bin/env node
/**
 * Reports the real touch targets on a phone page: for every control, the size
 * of its clickable box *including* the invisible expansion from ::after.
 * A button can be 24px wide and still be easy to hit; this measures that.
 *
 *   node scripts/mobile-targets.mjs <url> <cookie> [width]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, cookie, widthArg] = process.argv.slice(2)
const width = Number(widthArg ?? 390)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = mkdtempSync(join(tmpdir(), 'chrome-targets-'))
const port = 9222

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${width},844`,
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
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 844,
    screenWidth: width,
    screenHeight: 844,
    deviceScaleFactor: 3,
    mobile: true,
  })
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
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 844,
    screenWidth: width,
    screenHeight: 844,
    deviceScaleFactor: 3,
    mobile: true,
  })
  await sleep(3500)

  // Stretch the page so every row is laid out, then measure hit areas.
  const result = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const controls = [...document.querySelectorAll('button,a[href],[role="button"]')];
      const rows = [];
      for (const el of controls) {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;

        // The ::after pseudo-element is how a small icon gets a bigger hit
        // area. Its inset resolves to px, so the expanded box is simply the
        // pseudo-element's own width and height.
        const after = getComputedStyle(el, '::after');
        const hasAfterHitArea =
          after.content && after.content !== 'none' && after.position === 'absolute';
        let hitW = box.width;
        let hitH = box.height;
        if (hasAfterHitArea) {
          hitW = Math.max(hitW, parseFloat(after.width) || hitW);
          hitH = Math.max(hitH, parseFloat(after.height) || hitH);
        }

        rows.push({
          tag: el.tagName.toLowerCase(),
          w: Math.round(box.width),
          h: Math.round(box.height),
          hitW: Math.round(hitW),
          hitH: Math.round(hitH),
          label: (
            el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            (el.textContent || '').trim()
          ).slice(0, 28),
          cls: (el.className || '').toString().slice(0, 60),
        });
      }

      const tooSmall = rows.filter((r) => r.hitW < 40 || r.hitH < 40);
      return {
        total: rows.length,
        drawn24: rows.filter((r) => r.w <= 24 || r.h <= 24).length,
        tooSmallCount: tooSmall.length,
        tooSmall: tooSmall.slice(0, 12),
      };
    })()`,
  })

  console.log(JSON.stringify(result.result.value, null, 2))
  ws.close()
} finally {
  chrome.kill()
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 })
  } catch {
    // fine
  }
}
