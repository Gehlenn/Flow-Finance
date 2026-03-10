import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { UserConfig } from 'vite';

interface VitestConfigExport extends UserConfig {
  test: any;
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const config: VitestConfigExport = {
      server: {
        port: 3078,
        host: '0.0.0.0',
      },
      // PART 9 — Build output compatível com Capacitor (Android/iOS)
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: mode === 'development',
        // Chunking para melhor performance mobile
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
                if (id.includes('firebase')) return 'vendor-firebase';
                if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
                if (id.includes('lucide-react')) return 'vendor-icons';
                if (id.includes('@google/generative-ai') || id.includes('@google/genai')) return 'vendor-ai-sdk';
                if (id.includes('@sentry')) return 'vendor-sentry';
              }
            },
          },
        },
      },
      plugins: [react()],
      // SECURITY: Never expose API keys in client-side code!
      // Use backend proxy instead. Define safe environment variables only:
      define: {
        'import.meta.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL || ''),
        'import.meta.env.VITE_API_DEV_URL': JSON.stringify(env.VITE_API_DEV_URL || 'http://localhost:3001'),
        'import.meta.env.VITE_API_PROD_URL': JSON.stringify(env.VITE_API_PROD_URL || ''),
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION || '0.4.0'),
        'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(env.VITE_SENTRY_DSN || ''),
        'import.meta.env.VITE_SENTRY_DEV_ENABLED': JSON.stringify(env.VITE_SENTRY_DEV_ENABLED || 'false'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        globals: true,
        environment: 'jsdom',
      },
    };
    return config;
});

