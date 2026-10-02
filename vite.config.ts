import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { crx } from '@crxjs/vite-plugin';
import preact from '@preact/preset-vite';
import manifest from './manifest.config.ts';

export default defineConfig(({ command, mode }) => {
  // The app ID is baked into the bundle at build time; a build without it is a broken extension.
  if (command === 'build' && !loadEnv(mode, process.cwd()).VITE_INBOXSDK_APP_ID) {
    throw new Error('VITE_INBOXSDK_APP_ID is not set. Copy .env.example to .env and fill it in.');
  }
  return {
    plugins: [preact(), crx({ manifest })],
    server: {
      port: 5174,
      strictPort: false,
      cors: { origin: [/chrome-extension:\/\//] },
    },
    test: { environment: 'happy-dom' },
  };
});
