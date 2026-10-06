import { fileURLToPath } from 'node:url';
import { emitServiceWorker } from './emit-sw.mjs';

/** Astro integration: write dist/sw.js after the static build. */
export function offlineShell() {
  return {
    name: '500scorer-offline',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const { version, count } = await emitServiceWorker(fileURLToPath(dir));
        logger.info(`Offline cache ${version} (${count} files)`);
      },
    },
  };
}
