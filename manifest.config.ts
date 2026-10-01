import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'EasyMerge',
  version: '0.1.0',
  description: 'Never send a Gmail draft with unfilled _WILDCARDS. Fill them in a quick dialog before sending.',
  icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
  permissions: ['scripting'],
  host_permissions: ['https://mail.google.com/*', 'https://inbox.google.com/*'],
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  content_scripts: [
    {
      matches: ['https://mail.google.com/*', 'https://inbox.google.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_end',
    },
  ],
});
