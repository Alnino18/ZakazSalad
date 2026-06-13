// TeeGu zakaz — Service Worker v4 (mobile optimized)
const CACHE_NAME = 'teegu-v4';
const STATIC_ASSETS = [
  '/ZakazSalad/index.html',
  '/ZakazSalad/admin.html',
  '/ZakazSalad/manifest-admin.json',
  '/ZakazSalad/manifest.json',
  '/ZakazSalad/app-icon.png',
  '/ZakazSalad/icon.png',
  '/ZakazSalad/logo.png',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// ── Install ────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => console.warn('Cache miss:', url))
        )
      )
    )
  );
});

// ── Activate: delete old caches ────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // ❌ Never cache — always network
  const neverCache = [
    'api.telegram.org',
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firebase.googleapis.com',
    'gstatic.com',
  ];
  if (neverCache.some(h => url.hostname.includes(h))) return;

  // ✅ CDN — cache first (rarely changes)
  if (url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          return res;
        })
      )
    );
    return;
  }

  // ✅ Local HTML/CSS/JS/Images — Stale While Revalidate
  // Дарҳол кэшдан бериб, орқада янгилайди
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => null);

          if (cached) {
            // Кэшдан бер, орқада янгила
            fetchPromise; // background update
            return cached;
          }

          // Кэш йўқ — тармоқдан ол
          return fetchPromise.then(res => {
            if (res) return res;
            // Offline fallback — ҳар файл учун ўзи
            if (e.request.destination === 'document') {
              const path = url.pathname;
              if (path.includes('admin')) {
                return cache.match('/ZakazSalad/admin.html');
              }
              return cache.match('/ZakazSalad/index.html');
            }
          });
        })
      )
    );
  }
});

// ── Message ────────────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
