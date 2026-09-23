import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite-plus'

const isTest = process.env.VITEST === 'true'
const isServe =
  !isTest && (process.argv.includes('dev') || process.argv.includes('preview'))

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
  clearScreen: false,
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    semi: false,
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 80,
    sortPackageJson: false,
    ignorePatterns: [
      'package-lock.json',
      'yarn.lock',
      'drizzle/meta/**',
      'drizzle/seed.sql',
    ],
  },
  resolve: {
    tsconfigPaths: true,
    // `clsx` is used by `cva` (every UI component) and `cn()`. The SSR bundler
    // otherwise parks clsx inside the browser-only @tanstack/router-devtools-core
    // chunk, whose module scope calls `window`/`document` and crashes the
    // Cloudflare Worker on every render. Resolving clsx to a local,
    // dependency-free shim keeps that code out of the server bundle.
    alias: [
      { find: /^clsx$/, replacement: '/src/lib/clsx.ts' },
      {
        find: /^@tanstack\/router-devtools-core$/,
        replacement: '/src/lib/devtools-stub.ts',
      },
      {
        find: /^@tanstack\/react-router-devtools$/,
        replacement: '/src/lib/devtools-stub.ts',
      },
    ],
  },
  ssr: {
    noExternal: ['better-auth'],
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
        ...(isServe ? [devtools()] : []),
        tanstackStart({
          router: {
            // Keep co-located *.test.ts files out of the generated route tree.
            routeFileIgnorePattern: '\\.test\\.tsx?$',
          },
        }),
        viteReact(),
        tailwindcss(),
        nitro(
          isServe
            ? {
                preset: 'node',
                errorHandler: nitroErrorHandler,
                logging: { compressedSizes: false },
                plugins: ['./src/lib/gmail-scheduled-sync.ts'],
                rollupConfig: {
                  external: [
                    /^@sentry\//,
                    'better-sqlite3',
                    'drizzle-orm/better-sqlite3',
                  ],
                },
              }
            : {
                preset: 'cloudflare_module',
                errorHandler: nitroErrorHandler,
                logging: { compressedSizes: false },
                plugins: ['./src/lib/gmail-scheduled-sync.ts'],
                cloudflare: {
                  deployConfig: true,
                  nodeCompat: true,
                  wrangler: {
                    compatibility_date: '2026-03-19',
                    keep_vars: true,
                    name: 'trytrack',
                    no_bundle: false,
                    d1_databases: [
                      {
                        binding: 'DB',
                        database_name: 'trytrack',
                        database_id: '99b3d804-614d-420f-86e1-d2fc0eec9d8b',
                        migrations_dir: '../../migrations',
                      },
                    ],
                    triggers: {
                      crons: ['*/15 * * * *', '0 */12 * * *'],
                    },
                    observability: {
                      logs: {
                        enabled: true,
                        invocation_logs: true,
                      },
                    },
                  },
                },
                rollupConfig: {
                  external: [
                    /^@sentry\//,
                    'better-sqlite3',
                    'drizzle-orm/better-sqlite3',
                  ],
                  output: {
                    manualChunks: (id: string) => {
                      if (id.includes('src/lib/clsx')) {
                        return 'clsx-shim'
                      }
                      return undefined
                    },
                  },
                },
              },
        ),
      ],
})
