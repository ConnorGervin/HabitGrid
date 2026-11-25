// HabitGrid service worker.
// - Makes the app open offline (network-first, falling back to the cache).
// - Never caches /api/ (sync data always comes from the network or fails loudly).
// - Shows Web Push reminders.
// Both placeholders are filled in by vite.config.js at build time.
const CACHE = 'habitgrid-__BUILD_ID__';
const SHELL = /*__PRECACHE__*/[];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch {
    // Match by URL and ignore Vary: module scripts and stylesheets can carry headers the
    // precached copy was stored without.
    const opts = { ignoreVary: true, ignoreSearch: false };
    const cached =
      (await cache.match(request, opts)) ||
      (await cache.match(request.url, opts)) ||
      (request.mode === 'navigate' ? await cache.match('/index.html', opts) : null);
    return cached || Response.error();
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text or empty */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'HabitGrid', {
      body: data.body || 'Time to tick off a habit.',
      tag: data.tag,
      icon: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
