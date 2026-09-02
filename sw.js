// Service Worker for "向上走" PWA
// Version: 1.3.0 - 招聘信息每日自动同步
const CACHE_NAME = 'xiangshangzou-v1.3.0';
const APP_VERSION = '1.3.0';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/xiangshangzou/',
  '/xiangshangzou/index.html',
  '/xiangshangzou/manifest.json',
  '/xiangshangzou/app-config.json',
  '/xiangshangzou/recruit-data.json',
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

// Install event - cache all static assets, skip waiting immediately
self.addEventListener('install', event => {
  console.log('[向上走 SW v1.2.0] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[向上走 SW] Caching static assets');
      // Use addAll but ignore individual failures
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url))
      );
    }).then(() => {
      console.log('[向上走 SW] Install complete, forcing skipWaiting');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean ALL old caches, claim all clients immediately
self.addEventListener('activate', event => {
  console.log('[向上走 SW v1.2.0] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      // Delete ALL caches that don't match current version
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[向上走 SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      console.log('[向上走 SW] Claiming all clients immediately');
      return self.clients.claim();
    }).then(() => {
      // Notify all clients that a new SW has taken control
      return self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION });
        });
      });
    })
  );
});

// Helper: fetch with timeout
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Network timeout'));
    }, timeoutMs);

    fetch(request).then(response => {
      clearTimeout(timeoutId);
      resolve(response);
    }).catch(err => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

// Fetch event
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip cross-origin requests (like recruit-data.json from GitHub Pages)
  // Let them go straight to network
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => {
      // Return a basic offline response for cross-origin failures
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }));
    return;
  }

  // For HTML pages: network-first with 3-second timeout, then cache fallback
  if (event.request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetchWithTimeout(event.request, 3000)
        .then(response => {
          // Cache the fresh response
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, cloned);
          });
          return response;
        })
        .catch(() => {
          // Network failed or timed out - serve from cache
          return caches.match(event.request).then(cached => {
            return cached || caches.match('/xiangshangzou/index.html');
          });
        })
    );
    return;
  }

  // For JSON data (recruit-data.json, app-config.json): network-first.
  // 招聘数据每次都要取线上最新，用干净 URL（去掉 ?t= 时间戳）做离线缓存
  if (url.pathname.endsWith('.json')) {
    const cleanUrl = url.origin + url.pathname;
    event.respondWith(
      fetchWithTimeout(event.request, 3000)
        .then(response => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            // 以干净 URL 缓存，避免带时间戳的 URL 无限堆积
            cache.put(cleanUrl, cloned);
          });
          return response;
        })
        .catch(() => {
          return caches.match(cleanUrl).then(cached => cached || caches.match(event.request));
        })
    );
    return;
  }

  // For other assets: cache-first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, cloned);
        });
        return response;
      }).catch(() => {
        return caches.match(event.request);
      });
    })
  );
});

// Listen for messages from the main page
self.addEventListener('message', event => {
  if (event.data === 'CHECK_UPDATE') {
    self.registration.update().catch(err => {
      console.log('[向上走 SW] Update check failed:', err);
    });
  }

  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => {
      Promise.all(keys.map(key => caches.delete(key))).then(() => {
        console.log('[向上走 SW] All caches cleared');
      });
    });
  }
});
