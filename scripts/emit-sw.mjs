import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderServiceWorker } from './sw-source.mjs';

/** Walk `dist/` and write `sw.js` with a content-hashed precache. Splash screens stay out of the cache. */
export async function emitServiceWorker(distDir) {
  const files = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(abs);
      else if (ent.isFile()) files.push(abs);
    }
  }
  await walk(distDir);
  files.sort();

  const hash = createHash('sha256');
  const urls = [];
  for (const abs of files) {
    const rel = path.relative(distDir, abs).split(path.sep).join('/');
    if (rel === 'sw.js' || rel.endsWith('.map') || rel.startsWith('splash/')) continue;
    const buf = await readFile(abs);
    hash.update(rel);
    hash.update(buf);
    urls.push(`/${rel.split('/').map((part) => encodeURIComponent(part)).join('/')}`);
  }
  if (urls.includes('/index.html') && !urls.includes('/')) urls.push('/');
  urls.sort();

  const version = hash.digest('hex').slice(0, 12);
  await writeFile(path.join(distDir, 'sw.js'), renderServiceWorker(version, urls));
  return { version, count: urls.length };
}
