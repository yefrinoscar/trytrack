import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite-plus'

const isTest = process.env.VITEST === 'true'
const isServe =
  !isTest &&
  (process.argv.includes('dev') || process.argv.includes('preview'))

const nitroErrorHandler = './src/lib/nitro-error-handler.ts'
const testDependencies = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'scheduler',
  '@tanstack/react-query',
]

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    semi: false,
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 80,
    sortPackageJson: false,
    ignorePatterns: ['package-lock.json', 'yarn.lock'],
  },
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    noExternal: ['@convex-dev/better-auth'],
  },
  test: {
    environment: 'node',
    server: {
      deps: {
        inline: testDependencies,
      },
    },
    deps: {
      optimizer: {
        ssr: {
          include: testDependencies,
        },
      },
    },
  },
  plugins: isTest
    ? [viteReact()]
    : [
        devtools(),
        tanstackStart(),
        viteReact(),
        tailwindcss(),
        nitro(
          isServe
            ? {
                preset: 'node',
                errorHandler: nitroErrorHandler,
                rollupConfig: { external: [/^@sentry\//] },
              }
            : {
                preset: 'cloudflare_module',
                errorHandler: nitroErrorHandler,
                cloudflare: {
                  deployConfig: true,
                  nodeCompat: true,
                  wrangler: {
                    compatibility_date: '2026-03-19',
                    name: 'trytrack',
                    no_bundle: false,
                    observability: {
                      logs: {
                        enabled: true,
                        invocation_logs: true,
                      },
                    },
                  },
                },
                rollupConfig: { external: [/^@sentry\//] },
              },
        ),
      ],
})
