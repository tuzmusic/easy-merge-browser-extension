import { defineManifest } from '@crxjs/vite-plugin';
import { loadEnv } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineManifest(({ mode }) => {
  // Pins the extension ID for unpacked builds, since the Gmail API's OAuth redirect URI contains it. The
  // Web Store assigns the ID itself, so `npm run release` leaves the key out.
  const { EXTENSION_PUBLIC_KEY } = loadEnv(mode, process.cwd(), '');
  const key = process.env.EASYMERGE_RELEASE ? undefined : EXTENSION_PUBLIC_KEY || undefined;

  return {
    manifest_version: 3,
    name: 'EasyMerge',
    version: pkg.version,
    description: 'Mail merge without the spreadsheet. Type wildcards like _FIRST_NAME in any Gmail draft and fill them in when you hit Send.',
    homepage_url: 'https://github.com/tuzmusic/easy-merge-browser-extension',
    icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
    ...(key && { key }),
    permissions: ['scripting', 'storage', 'identity'],
    host_permissions: ['https://mail.google.com/*', 'https://gmail.googleapis.com/*', 'https://oauth2.googleapis.com/*'],
    background: { service_worker: 'src/background/index.ts', type: 'module' },
    // The compose button's icon is loaded by the Gmail page.
    web_accessible_resources: [{ resources: ['icons/*.png'], matches: ['https://mail.google.com/*'] }],
    content_scripts: [
      {
        matches: ['https://mail.google.com/*'],
        js: ['src/content/index.ts'],
        run_at: 'document_end',
      },
    ],
  };
});
