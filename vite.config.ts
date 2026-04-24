import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import type { PluginOption } from 'vite'
import { defineConfig } from 'vite-plus'

const lintConfig: any = {
  plugins: ['import', 'typescript'],
  categories: {
    correctness: 'off',
  },
  env: {
    builtin: true,
    browser: true,
    es2020: true,
  },
  ignorePatterns: [
    '**/.nx/**',
    '**/.svelte-kit/**',
    '**/build/**',
    '**/coverage/**',
    '**/dist/**',
    '**/snap/**',
    '**/vite.config.*.timestamp-*.*',
    '.output/**',
  ],
  options: {
    typeAware: true,
    typeCheck: true,
  },
  rules: {
    'for-direction': 'error',
    'no-async-promise-executor': 'error',
    'no-case-declarations': 'error',
    'no-class-assign': 'error',
    'no-compare-neg-zero': 'error',
    'no-cond-assign': 'error',
    'no-constant-binary-expression': 'error',
    'no-constant-condition': 'error',
    'no-control-regex': 'error',
    'no-debugger': 'error',
    'no-delete-var': 'error',
    'no-dupe-else-if': 'error',
    'no-duplicate-case': 'error',
    'no-empty-character-class': 'error',
    'no-empty-pattern': 'error',
    'no-empty-static-block': 'error',
    'no-ex-assign': 'error',
    'no-extra-boolean-cast': 'error',
    'no-fallthrough': 'error',
    'no-global-assign': 'error',
    'no-invalid-regexp': 'error',
    'no-irregular-whitespace': 'error',
    'no-loss-of-precision': 'error',
    'no-misleading-character-class': 'error',
    'no-nonoctal-decimal-escape': 'error',
    'no-regex-spaces': 'error',
    'no-self-assign': 'error',
    'no-shadow': 'warn',
    'no-shadow-restricted-names': 'error',
    'no-sparse-arrays': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-optional-chaining': 'error',
    'no-unused-labels': 'error',
    'no-unused-private-class-members': 'error',
    'no-useless-backreference': 'error',
    'no-useless-catch': 'error',
    'no-useless-escape': 'error',
    'no-var': 'error',
    'no-with': 'error',
    'prefer-const': 'error',
    'require-yield': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
    '@typescript-eslint/ban-ts-comment': [
      'error',
      {
        'ts-expect-error': false,
        'ts-ignore': 'allow-with-description',
      },
    ],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
      },
    ],
    '@typescript-eslint/no-duplicate-enum-values': 'error',
    '@typescript-eslint/no-extra-non-null-assertion': 'error',
    '@typescript-eslint/no-inferrable-types': [
      'error',
      {
        ignoreParameters: true,
      },
    ],
    '@typescript-eslint/no-misused-new': 'error',
    '@typescript-eslint/no-namespace': 'error',
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
    '@typescript-eslint/no-unsafe-function-type': 'error',
    '@typescript-eslint/no-wrapper-object-types': 'error',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/prefer-for-of': 'warn',
    '@typescript-eslint/triple-slash-reference': 'error',
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    'import/first': 'error',
    'import/no-commonjs': 'error',
    'import/no-duplicates': 'off',
  },
}

const isTest = process.env.VITEST === 'true'

const testDependencies = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'scheduler',
  '@tanstack/react-query',
]

/**
 * Vite passes `command` in config callbacks, but oxfmt (used by `vp check`) only
 * accepts a static `export default` object with `fmt` / `lint` - no function form.
 * Mirror Vite: `serve` for dev and preview, `build` for build/check/etc.
 */
function inferViteCommandFromArgv(): 'build' | 'serve' {
  if (isTest) {
    return 'build'
  }
  const { argv } = process
  if (argv.includes('dev') || argv.includes('preview')) {
    return 'serve'
  }
  return 'build'
}

const isServe = inferViteCommandFromArgv() === 'serve'
const nitroErrorHandler = './src/lib/nitro-error-handler.ts'

function normalizePluginOptions(input: PluginOption[]): PluginOption[] {
  return input.flatMap((item) => {
    if (item == null || item === false) {
      return []
    }
    return Array.isArray(item) ? item : [item]
  })
}

const plugins = normalizePluginOptions(
  isTest
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
                      traces: {
                        enabled: false,
                      },
                    },
                  },
                },
                rollupConfig: { external: [/^@sentry\//] },
              },
        ),
      ],
)

// `vp check` tsglint hits deep instantiation limits if this object is fully inferred as Vite+ UserConfig.
export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  lint: lintConfig,
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
  plugins,
} as any)
