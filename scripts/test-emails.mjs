// Copies tuzmusic+1@gmail.com, …, tuzmusic+N@gmail.com to the clipboard, to paste into a draft's To.
// Usage: npm run te --5 (or npm run te 5).
import { execFileSync } from 'node:child_process';

// `npm run te --5` reaches us as the npm config flag npm_config_5, not as an argument.
const flag = Object.keys(process.env).find((key) => /^npm_config_\d+$/.test(key))?.slice('npm_config_'.length);
const n = Number(process.argv[2] ?? flag ?? 3);
if (!Number.isInteger(n) || n < 1) {
  console.error('Usage: npm run te --<count>, e.g. npm run te --5');
  process.exit(1);
}

const addresses = Array.from({ length: n }, (_, i) => `tuzmusic+${i + 1}@gmail.com`).join(', ');
execFileSync('pbcopy', { input: addresses });
console.log(`Copied ${n}: ${addresses}`);
