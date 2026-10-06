import { describe, expect, it } from 'vitest';
import { renderServiceWorker } from '../scripts/sw-source.mjs';

describe('service worker', () => {
  it('precaches the app shell and leaves sw.js itself to the browser', () => {
    const src = renderServiceWorker('abc123', ['/', '/index.html', '/favicon.svg']);
    expect(src).toContain('500scorer-abc123');
    expect(src).toContain('"/index.html"');
    expect(src).toContain("url.pathname === '/sw.js'");
    expect(src).toContain('skipWaiting');
    expect(src).toContain('caches.open(CACHE)');
    expect(src).toContain("req.mode === 'navigate'");
  });
});