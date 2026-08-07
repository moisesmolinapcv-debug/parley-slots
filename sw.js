const CACHE_NAME = 'parley-slots-v3';
const ASSETS_TO_CACHE = [
  './',
  './ELEMENTO Y REFERENCIAS PARLEY/PARLEY LOGO.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Ignorar peticiones no HTTP (chrome-extension, etc.) y peticiones no-GET
  if (!event.request.url.startsWith('http') || event.request.method !== 'GET') {
    return;
  }

  const url = event.request.url;
  const isHtmlOrJs = url.endsWith('.html') || url.endsWith('.js') || url.includes('/admin/') || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  // Network-First para HTML y JS (garantiza 100% la última versión sin caché viejo)
  if (isHtmlOrJs) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Stale-While-Revalidate para imágenes y fuentes
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

