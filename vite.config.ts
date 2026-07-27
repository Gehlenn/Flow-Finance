import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { UserConfig } from 'vite';
import type { InlineConfig } from 'vitest';
import { resolveManualChunk } from './build/manualChunks';

type VitestConfigExport = UserConfig & { test: NonNullable<InlineConfig['test']> };
const HTML_MODULE_PRELOAD_ALLOWLIST = [
  /^assets\/rolldown-runtime-/,
  /^assets\/vendor-react-/,
  /^assets\/vendor-react-dom-/,
  /^assets\/vendor-firebase-/,
  /^assets\/vendor-icons-/,
  /^assets\/firebase-/,
  /^assets\/api\.config-/,
  /^assets\/types-/,
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const appVersion = env.VITE_APP_VERSION || process.env.npm_package_version || '0.9.7';
    const config: VitestConfigExport = {
      server: {
        port: 3078,
        host: '0.0.0.0',
      },
      // Capacitor requires a self-contained web build in dist.
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: mode === 'development',
        modulePreload: {
          resolveDependencies: (_url, deps, context) => {
            if (context.hostType !== 'html') {
              return deps;
            }

            return deps.filter((dep) => HTML_MODULE_PRELOAD_ALLOWLIST.some((pattern) => pattern.test(dep)));
          },
        },
        // Chunking para melhor performance mobile
        rollupOptions: {
          output: {
            manualChunks(id) {
              return resolveManualChunk(id);
            },
          },
        },
      },
      plugins: [react()],
      // SECURITY: Never expose API keys in client-side code!
      // Use backend proxy instead. Define safe environment variables only:
      define: {
        // In test mode, zero out backend URLs so unit tests run in frontend-only isolation
        // (prevents .env.local values from contaminating guard logic tests)
        'import.meta.env.VITE_BACKEND_URL': JSON.stringify(mode === 'test' ? '' : (env.VITE_BACKEND_URL || '')),
        'import.meta.env.VITE_API_DEV_URL': JSON.stringify(env.VITE_API_DEV_URL || 'http://localhost:3001'),
        'import.meta.env.VITE_API_PROD_URL': JSON.stringify(mode === 'test' ? '' : (env.VITE_API_PROD_URL || '')),
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
        'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(env.VITE_SENTRY_DSN || ''),
        // Sentry DSN is public by design; expose legacy key for backwards-compatible bootstrap fallback.
        'import.meta.env.SENTRY_DSN': JSON.stringify(env.SENTRY_DSN || ''),
        'import.meta.env.VITE_SENTRY_DEV_ENABLED': JSON.stringify(env.VITE_SENTRY_DEV_ENABLED || 'false'),
        // In test mode, enable local dev login so Login component tests can exercise
        // the onDevelopmentLogin code path (ALLOW_INSECURE_LOCAL_LOGIN = true).
        'import.meta.env.VITE_AUTH_ALLOW_INSECURE_LOCAL_LOGIN': JSON.stringify(mode === 'test' ? 'true' : (env.VITE_AUTH_ALLOW_INSECURE_LOCAL_LOGIN || 'false')),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        globals: true,
        environment: 'jsdom',
        pool: 'forks',
        server: {
          deps: {
            external: [/^firebase/, /^pino/],
          },
        },
          exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/.tmp/**',
          'qa-exhaustive.spec.mjs',
          '**/tests/e2e/**',
          '**/tests/integration/**',
          '**/backend/tests/integration/**',
          // Requires running Firestore emulator — excluded from regular CI runs
          '**/tests/firestore/**',
        ],
      },
    };
    return config;
});



