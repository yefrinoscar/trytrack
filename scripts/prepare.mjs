import { spawnSync } from 'node:child_process'

const isCi =
  process.env.CI === 'true' ||
  process.env.CF_PAGES === '1' ||
  process.env.CLOUDFLARE_ENV !== undefined

if (isCi) {
  console.log('Skipping vp config during CI dependency install.')
  process.exit(0)
}

const result = spawnSync('vp', ['config'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
