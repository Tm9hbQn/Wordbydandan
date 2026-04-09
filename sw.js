/**
 * Service Worker for Wordbydandan PWA
 * Handles: caching, offline support, push notifications
 */

const CACHE_NAME = 'wordbydandan-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './install.html',
  './quick-add.html',
  './css/styles.css',
  './js/app.js',
  './js/acquisition-analysis.js',
  './js/vocab-charts.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './manifest.webmanifest',
];

const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Secular+One&family=Varela+Round&family=Karantina:wght@300;400;700&family=Suez+One&display=swap',
  'https://cdn.jsdelivr.net/npm/lucide@0.344.0/dist/umd/lucide.min.js',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      // Cache local assets (critical)
      const localCaching = cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some static assets failed to cache:', err);
      });
      // Cache CDN assets (best effort)
      const cdnCaching = Promise.allSettled(
        CDN_ASSETS.map((url) =>
          fetch(url, { mode: 'cors' })
            .then((res) => {
              if (res.ok) cache.put(url, res);
            })
            .catch(() => {})
        )
      );
      return Promise.all([localCaching, cdnCaching]);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Supabase API: network only (real-time data)
  if (url.hostname.includes('supabase.co')) return;

  // Supabase SDK: network first, cache fallback
  if (url.href.includes('@supabase/supabase-js')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Google Fonts: cache first (they rarely change)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Local assets: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => {
          // If both network and cache fail, return offline page for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return cached;
        });

      return cached || fetchPromise;
    })
  );
});

// Push notification received
self.addEventListener('push', (event) => {
  let data = { title: 'מילה חדשה!', body: 'מישהו הוסיף מילה חדשה 🌟' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    dir: 'rtl',
    lang: 'he',
    tag: 'new-word',
    renotify: true,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './',
    },
    actions: [
      { action: 'open', title: 'פתחו' },
      { action: 'dismiss', title: 'סגרו' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes('index.html') || client.url.endsWith('/')) {
          client.postMessage({ type: 'WORD_ADDED_NOTIFICATION' });
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});

// Message from main app (e.g., force cache update)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});
