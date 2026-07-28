// Service Worker for "向上走" PWA
// Version: auto-generated on each update
const CACHE_NAME = 'xiangshangzou-v1';
const APP_VERSION = '1.0.0';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/xiangshangzou/',
  '/xiangshangzou/index.html',
  '/xiangshangzou/manifest.json',
  '/xiangshangzou/icons/icon-72x72.png',
  '/xiangshangzou/icons/icon-96x96.png',
  '/xiangshangzou/icons/icon-128x128.png',
  '/xiangshangzou/icons/icon-144x144.png',
  '/xiangshangzou/icons/icon-152x152.png',
  '/xiangshangzou/icons/icon-192x192.png',
  '/xiangshangzou/icons/icon-384x384.png',
  '/xiangshangzou/icons/icon-512x512.png',
  '/xiangshangzou/icons/maskable-512.png'
];

// Install event - cache all static assets
self.addEventListener('install', event => {
  console.log('[向上走 SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[向上走 SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[向上走 SW] Install complete, skipping waiting');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[向上走 SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[向上走 SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      console.log('[向上走 SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - cache-first then network fallback
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip cross-origin requests
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  
  // For HTML pages: network-first (to get latest content), cache fallback
  if (event.request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // For other assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return response;
      });
    })
  );
});

// Listen for update messages from the main page
self.addEventListener('message', event => {
  if (event.data === 'CHECK_UPDATE') {
    // Trigger update check
    self.registration.update().catch(err => {
      console.log('[向上走 SW] Update check failed:', err);
    });
  }
  
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
