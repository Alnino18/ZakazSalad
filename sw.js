// TeeGu zakaz — Service Worker v3
const CACHE_NAME = 'teegu-v3';
const STATIC_ASSETS = [
  '/ZakazSalad/index.html',
  '/ZakazSalad/admin.html',
  '/ZakazSalad/manifest.json',
  '/ZakazSalad/app-icon.png',
  '/ZakazSalad/icon.png',
  '/ZakazSalad/logo.png',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// ── Install: cache all static assets ──────────────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => console.warn('Cache miss:', url))
        )
      );
    })
  );
});

// ── Activate: delete old caches ────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Telegram API, Firebase — network only, no cache
  if (url.hostname === 'api.telegram.org' ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('firestore') ||
      url.hostname.includes('googleapis')) {
    return; // pass through
  }

  // html2canvas CDN — cache first
  if (url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // Local files — network first, fallback to cache
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        // Update cache with fresh response
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline: return exact cached file
        return caches.match(e.request).then(cached => {
          if (cached) return cached;
          // Only fallback to index.html for unknown pages, NOT for admin.html
          if (e.request.destination === 'document' &&
              !url.pathname.includes('admin')) {
            return caches.match('/ZakazSalad/index.html');
          }
        });
      })
    );
  }
});

// ── Message ────────────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
