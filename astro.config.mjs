// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import { offlineShell } from './scripts/offline-integration.mjs';

// Fully static output — Cloudflare Pages serves ./dist. No server/adapter needed.
export default defineConfig({
  output: 'static',
  integrations: [preact(), offlineShell()],
});
