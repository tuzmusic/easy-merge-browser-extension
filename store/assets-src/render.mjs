// Renders the Web Store screenshots, promo tile and extension icons with headless Chrome.
// Usage: npm run store-assets [-- <name filter>], e.g. `-- promo` to render just the promo tiles.
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import preact from '@preact/preset-vite';

// Async on purpose: a sync spawn would block the Vite server running in this same process.
const execFile = promisify(execFileCb);

const here = import.meta.dirname;
const repo = resolve(here, '../..');
const out = join(here, '../assets');
const icons = join(repo, 'public/icons');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const server = await createServer({
  root: here,
  configFile: false,
  plugins: [preact()],
  server: { port: 5199, hmr: false, ws: false, fs: { allow: [repo] } },
  logLevel: 'error',
});
await server.listen();
const profile = mkdtempSync(join(tmpdir(), 'easymerge-shots-'));

const only = process.argv[2];

async function shoot(scene, [w, h], file) {
  if (only && !scene.includes(only)) return;
  await execFile(chrome, [
    '--headless=new',
    '--hide-scrollbars',
    '--disable-gpu',
    `--user-data-dir=${profile}`,
    '--default-background-color=00000000',
    '--force-device-scale-factor=1',
    '--virtual-time-budget=3000',
    `--window-size=${w},${h}`,
    `--screenshot=${file}`,
    `http://localhost:5199/?scene=${scene}`,
  ], { timeout: 30_000 });
  console.log(`${file.replace(repo + '/', '')}  ${w}×${h}`);
}

try {
  await shoot('template', [1280, 800], join(out, 'screenshot-1-template.png'));
  await shoot('fill', [1280, 800], join(out, 'screenshot-2-fill.png'));
  await shoot('reuse', [1280, 800], join(out, 'screenshot-3-reuse.png'));
  for (const variant of ['', '-highlighter', '-poster', '-rows', '-form']) {
    await shoot(`promo${variant}`, [440, 280], join(out, `promo-small${variant}-440x280.png`));
  }

  // Small sizes are drawn edge to edge; the 128 follows the store's 96px-plus-padding rule.
  // Rendered large and scaled down: headless Chrome won't make a window as small as 16px.
  const padded = join(profile, 'icon-padded-512.png');
  const full = join(profile, 'icon-512.png');
  await shoot('icon-padded', [512, 512], padded);
  await shoot('icon', [512, 512], full);
  for (const [size, src] of only ? [] : [[128, padded], [48, full], [32, full], [16, full]]) {
    await execFile('sips', ['-z', size, size, src, '--out', join(icons, `icon-${size}.png`)]);
    console.log(`public/icons/icon-${size}.png  ${size}×${size}`);
  }
} finally {
  await server.close();
  rmSync(profile, { recursive: true, force: true });
}
