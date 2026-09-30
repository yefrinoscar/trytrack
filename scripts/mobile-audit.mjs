#!/usr/bin/env node
/**
 * Opens a page in Chrome emulating a phone, screenshots it, and reports the
 * things that usually break on mobile: horizontal overflow and tap targets
 * that are too small to hit with a thumb.
 *
 *   node scripts/mobile-audit.mjs <url> <cookie> <out.png> [width] [height]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, cookie, out, widthArg, heightArg, scrollArg] = process.argv.slice(2)
if (!url) {
  console.error(
    'Usage: node scripts/mobile-audit.mjs <url> <cookie> <out.png> [width] [height] [scrollY]',
  )
  process.exit(1)
}

const width = Number(widthArg ?? 390)
const height = Number(heightArg ?? 844)
const scrollY = Number(scrollArg ?? 0)

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = mkdtempSync(join(tmpdir(), 'chrome-mobile-'))
const port = 9555

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${width},${height}`,
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
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return
    } catch {
      // not up yet
    }
    await sleep(250)
  }
  throw new Error('Chrome DevTools did not start')
}

/** The page walks itself: it is easier and more accurate than doing it from here. */
const AUDIT = `(() => {
  // documentElement.clientWidth is the real layout width; window.innerWidth
  // reports something larger under mobile emulation.
  const vw = document.documentElement.clientWidth;
  const overflow = [];
  const small = [];
  const seen = new Set();

  for (const el of document.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    // Anything sticking out past the right edge of the viewport.
    if (rect.right > vw + 1 || rect.left < -1) {
      const key = el.tagName + (el.className || '').toString();
      if (!seen.has(key)) {
        seen.add(key);
        overflow.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 110),
          right: Math.round(rect.right),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          text: (el.textContent || '').trim().slice(0, 34),
        });
      }
    }

    // Controls a thumb has to hit.
    const interactive =
      el.tagName === 'BUTTON' ||
      el.tagName === 'A' ||
      (el.getAttribute && el.getAttribute('role') === 'button');
    if (interactive && rect.width < 40) {
      small.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 80),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        label:
          (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30),
      });
    }
  }

  // The true source of a wide page: an element whose box reaches further right
  // than the viewport, on a scroll container that cannot scroll. Descendants
  // are usually just content, so only the outermost offender is reported.
  const offenders = [];
  for (const el of document.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.right <= vw + 1) continue;
    offenders.push({ el, right: rect.right });
  }
  const reported = offenders
    .filter(
      ({ el }) =>
        !offenders.some(
          ({ el: other }) => other !== el && other.contains(el),
        ),
    )
    .sort((a, b) => b.right - a.right);

  // How the page is laid out, to spot an element that cannot shrink.
  const chain = [];
  let node = reported[0]?.el;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    chain.push({
      tag: node.tagName.toLowerCase(),
      cls: (node.className || '').toString().slice(0, 70),
      w: Math.round(node.getBoundingClientRect().width),
      minWidth: style.minWidth,
      width: style.width,
      display: style.display,
      overflowX: style.overflowX,
    });
    node = node.parentElement;
  }

  return {
    viewport: vw + 'x' + window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
    dpr: window.devicePixelRatio,
    scale: window.visualViewport ? Number(window.visualViewport.scale.toFixed(2)) : null,
    pageScrollWidth: document.documentElement.scrollWidth,
    horizontalScroll: document.documentElement.scrollWidth > vw + 1,
    bodyHeight: document.body.scrollHeight,
    worstOffenders: reported.slice(0, 6).map(({ el, right }) => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 90),
      right: Math.round(right),
      w: Math.round(el.getBoundingClientRect().width),
      // Narrowest width this element can be laid out at, and what sets it.
      minContent: Math.round(
        (() => {
          const probe = el.cloneNode(true);
          probe.style.cssText =
            'position:absolute;left:-99999px;top:0;width:min-content;height:auto';
          document.body.appendChild(probe);
          const value = probe.getBoundingClientRect().width;
          probe.remove();
          return value;
        })(),
      ),
    })),
    offenderChain: chain.slice(0, 14),
    // Walk down the widest offender to find the leaf that refuses to shrink.
    rigidDescendants: (() => {
      const root = reported[0]?.el;
      if (!root) return [];
      const rows = [];
      const visit = (el, depth) => {
        const rect = el.getBoundingClientRect();
        if (rect.width < vw * 0.9) return;
        rows.push({
          depth,
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 80),
          w: Math.round(rect.width),
          text: (el.textContent || '').trim().slice(0, 30),
        });
        for (const child of el.children) visit(child, depth + 1);
      };
      visit(root, 0);
      return rows.slice(0, 20);
    })(),
    smallTargets: small.slice(0, 18),
  };
})()`

try {
  await waitForDevtools()
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
      method: 'PUT',
    })
  ).json()

  const ws = await new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl)
    socket.addEventListener('open', () => resolve(socket))
    socket.addEventListener('error', reject)
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

  // This is what makes it a phone rather than a narrow desktop window.
  const emulatePhone = () =>
    send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      screenWidth: width,
      screenHeight: height,
      positionX: 0,
      positionY: 0,
      deviceScaleFactor: 3,
      mobile: true,
    })

  await emulatePhone()
  await send('Emulation.setTouchEmulationEnabled', { enabled: true })

  if (cookie) {
    for (const pair of cookie.split(/;\s*/)) {
      const eq = pair.indexOf('=')
      if (eq < 1) continue
      const result = await send('Network.setCookie', {
        name: pair.slice(0, eq),
        value: pair.slice(eq + 1),
        url,
      })
      if (!result?.success) {
        throw new Error(`Could not set cookie: ${JSON.stringify(result)}`)
      }
    }
  }

  await send('Page.navigate', { url })
  await sleep(2500)
  // Headless Chrome drops the override when the navigation commits, so it has
  // to be re-applied once the page owns the viewport.
  await emulatePhone()
  await sleep(3200)

  if (out) {
    if (scrollY) {
      await send('Runtime.evaluate', {
        expression: `window.scrollTo(0, ${scrollY})`,
      })
      await sleep(600)
    }
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(out, Buffer.from(shot.data, 'base64'))
  }

  const audit = await send('Runtime.evaluate', {
    expression: AUDIT,
    returnByValue: true,
  })

  console.log(JSON.stringify(audit.result.value, null, 2))
  ws.close()
} finally {
  chrome.kill()
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 })
  } catch {
    // Chrome may still be flushing its profile; a temp dir left behind is fine.
  }
}
