/** Build the offline service worker source for a precache list. */
export function renderServiceWorker(version, urls) {
  const cacheName = `500scorer-${version}`;
  return `/* 500 Scorer offline cache ${version}. Generated at build time. */
const CACHE = ${JSON.stringify(cacheName)};
const PRECACHE = ${JSON.stringify(urls)};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res.ok && !res.redirected) await cache.put(url, res);
      } catch {
        /* skip a missing file rather than failing the whole install */
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh.ok && !fresh.redirected) {
          const cache = await caches.open(CACHE);
          await cache.put('/index.html', fresh.clone());
        }
        return fresh;
      } catch {
        const cached = (await caches.match('/index.html')) || (await caches.match('/'));
        return cached || new Response('500 Scorer is offline and not cached yet. Reconnect once to save the app.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh.ok && !fresh.redirected) {
        const cache = await caches.open(CACHE);
        await cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      return cached || new Response('', { status: 504 });
    }
  })());
});
`;
}
