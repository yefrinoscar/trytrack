#!/usr/bin/env node
/**
 * Scrolls to each dashboard column on a phone, then touches every control in
 * it: recurring payment toggles, expense delete buttons, the account menu and
 * every dialog. Reports layout problems and console errors per step, and
 * leaves screenshots so the result can be looked at rather than assumed.
 *
 *   node scripts/mobile-check-columns.mjs <url> <cookie> <outDir>
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, cookie, outDir] = process.argv.slice(2)
if (!url) {
  console.error(
    'Usage: node scripts/mobile-check-columns.mjs <url> <cookie> <outDir>',
  )
  process.exit(1)
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = mkdtempSync(join(tmpdir(), 'chrome-cols-'))
const port = 9888
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

const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= vw + 1) continue;
    offenders.push({ el, right: r.right });
  }
  const reported = offenders
    .filter(({ el }) => !offenders.some(({ el: o }) => o !== el && o.contains(el)))
    .sort((a, b) => b.right - a.right).slice(0, 3)
    .map(({ el, right }) => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 70),
      right: Math.round(right),
    }));
  const dialog = document.querySelector('[role="dialog"]');
  const dr = dialog ? dialog.getBoundingClientRect() : null;
  return {
    viewport: vw + 'x' + window.innerHeight,
    docWidth: document.documentElement.scrollWidth,
    overflows: document.documentElement.scrollWidth > vw + 1,
    offenders: reported,
    dialog: dr ? {
      w: Math.round(dr.width), h: Math.round(dr.height),
      top: Math.round(dr.top), bottom: Math.round(dr.bottom),
      insideViewport: dr.top >= -1 && dr.bottom <= window.innerHeight + 1,
      dialogOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
    } : null,
  };
})()`

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
  const errors = []

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (
      msg.method === 'Runtime.consoleAPICalled' &&
      msg.params.type === 'error'
    ) {
      errors.push(
        (msg.params.args ?? [])
          .map((a) => a.value ?? a.description ?? '')
          .join(' ')
          .slice(0, 200),
      )
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      errors.push(
        `UNCAUGHT ${d.exception?.description ?? d.text}`.slice(0, 250),
      )
    }
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

  await send('Runtime.enable')
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
      ? { error: r.exceptionDetails.exception?.description ?? 'eval failed' }
      : r.result.value
  }

  const shot = async (name) => {
    if (!outDir) return
    const s = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(s.data, 'base64'))
  }

  const scrollToText = (text) => `(() => {
    const leaf = [...document.querySelectorAll('*')].find(
      (el) => el.children.length === 0 && (el.textContent||'').trim().startsWith(${JSON.stringify(text)}));
    if (!leaf) return 'no encontrado';
    leaf.scrollIntoView({ block: 'center' });
    return 'ok';
  })()`

  const out = []
  const step = async (name, expression, wait = 800) => {
    const action = await evaluate(expression)
    await sleep(wait)
    const probe = await evaluate(PROBE)
    await shot(name.replace(/[^a-z0-9]+/gi, '-').toLowerCase())
    out.push({ step: name, action, ...probe })
  }

  // Each column, reached by scrolling the way a person would.
  await step('columna deudas', scrollToText('Laptop payment plan'))
  await step('columna gastos', scrollToText('All expenses'))
  await step('columna recurrentes', scrollToText('Monthly subscriptions'))
  await step(
    'marcar recurrente como pagado',
    `(() => {
    const section = [...document.querySelectorAll('section')].find(
      (s) => s.textContent.includes('Monthly subscriptions'));
    if (!section) return 'sin seccion';
    const btn = section.querySelector('button[aria-pressed]');
    if (!btn) return 'sin toggle';
    btn.click();
    return 'ok';
  })()`,
    1400,
  )
  await step(
    'deshacer',
    `(() => {
    const section = [...document.querySelectorAll('section')].find(
      (s) => s.textContent.includes('Monthly subscriptions'));
    const btn = section && section.querySelector('button[aria-pressed]');
    if (!btn) return 'sin toggle';
    btn.click();
    return 'ok';
  })()`,
    1400,
  )
  await step(
    'borrar un gasto',
    `(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => (b.getAttribute('aria-label')||'').startsWith('Delete '));
    if (!btn) return 'sin boton borrar';
    btn.click();
    return 'ok';
  })()`,
    1400,
  )
  await step(
    'menu de cuenta',
    `(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => (b.getAttribute('aria-label')||'').startsWith('Account menu'));
    if (!btn) return 'sin avatar';
    btn.click();
    return 'ok';
  })()`,
    900,
  )
  await step(
    'ir a settings',
    `(() => {
    const link = [...document.querySelectorAll('a[href="/settings"]')].find(
      (a) => a.getBoundingClientRect().height > 0);
    if (!link) return 'sin enlace';
    link.click();
    return 'ok';
  })()`,
    2000,
  )
  await step(
    'settings cargada',
    `(() => { window.scrollTo(0, 0); return 'ok'; })()`,
  )

  console.log(JSON.stringify({ results: out, errors }, null, 2))
  ws.close()
} finally {
  chrome.kill()
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 })
  } catch {
    // fine
  }
}
