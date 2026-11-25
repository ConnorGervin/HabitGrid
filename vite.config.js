import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// After the build, list every output file into the service worker so the whole app
// (hashed JS/CSS included) is cached on first visit and opens offline.
const precacheShell = () => ({
  name: 'habitgrid-precache',
  apply: 'build',
  closeBundle() {
    const dir = resolve('dist');
    const swPath = join(dir, 'sw.js');
    if (!existsSync(swPath)) return;
    const files = [];
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else files.push('/' + relative(dir, p).split(sep).join('/'));
      }
    };
    walk(dir);
    const list = ['/', ...files.filter((f) => f !== '/sw.js' && !f.endsWith('.map'))];
    const sw = readFileSync(swPath, 'utf8')
      .replace('/*__PRECACHE__*/[]', JSON.stringify(list))
      .replace('__BUILD_ID__', Date.now().toString(36));
    writeFileSync(swPath, sw);
  },
});

export default defineConfig({
  plugins: [react(), precacheShell()],
  server: { port: 3000 },
});
