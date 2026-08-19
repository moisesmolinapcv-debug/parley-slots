const CACHE_NAME = 'parley-slots-v7-prod';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './data/slots_initial.js',
  './ELEMENTO Y REFERENCIAS PARLEY/PARLEY LOGO.png',
  './BANNER/public.avif',
  './BANNER/banner_1_desktop_hd.webp',
  './BANNER/banner_1_mobile_hd.webp',
  './BANNER/banner_2_desktop_hd.webp',
  './BANNER/banner_2_mobile_hd.webp'
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
  if (!event.request.url.startsWith('http') || event.request.method !== 'GET') {
    return;
  }

  const url = event.request.url;

  // ⚡ 1. DATOS VIVOS DE SUPABASE API Y HTML -> Network-First con Timeout de 1.5s
  const isApiOrHtml = url.includes('/rest/v1/') || 
                      url.includes('site_config') || 
                      url.includes('banners') || 
                      url.endsWith('.html') || 
                      url.includes('/admin/') || 
                      (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isApiOrHtml) {
    event.respondWith(
      new Promise((resolve) => {
        let isSettled = false;

        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            if (!isSettled) {
              isSettled = true;
              resolve(networkResponse);
            }
          })
          .catch(() => {
            if (!isSettled) {
              isSettled = true;
              caches.match(event.request).then((cached) => resolve(cached || new Response('Offline', { status: 503 })));
            }
          });

        setTimeout(() => {
          if (!isSettled) {
            caches.match(event.request).then((cached) => {
              if (cached && !isSettled) {
                isSettled = true;
                resolve(cached);
              }
            });
          }
        }, 1500);
      })
    );
    return;
  }

  // ⚡ 2. IMÁGENES Y FUENTES ESTÁTICAS -> Cache-First / Stale-While-Revalidate ultrarrápido
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
