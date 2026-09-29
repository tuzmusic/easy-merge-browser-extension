import { defineConfig } from 'vitest/config';
import { crx } from '@crxjs/vite-plugin';
import preact from '@preact/preset-vite';
import manifest from './manifest.config.ts';

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  server: {
    port: 5174,
    strictPort: false,
    cors: { origin: [/chrome-extension:\/\//] },
  },
  test: { environment: 'happy-dom' },
});
