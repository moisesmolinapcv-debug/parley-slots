const CACHE_NAME = 'parley-slots-v8-prod';
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

const SLOT_DATA_MAX_CACHE_AGE_MS = 10 * 60 * 1000; // 10 minutos de validez máxima para fallback rápido
const SLOT_DATA_TIMEOUT_MS = 3000; // 3.0 segundos de espera de red antes de evaluar caché de slots

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

  // ⚡ 2. DATASET PRINCIPAL DE SLOTS -> Network-First con Timestamping 'sw-fetched-at' y Fallback de 10 min
  const isSlotData = (
    url.endsWith('/data/slots.js') || 
    url.endsWith('/data/slots.json') || 
    url.includes('/data/slots.js?') || 
    url.includes('/data/slots.json?') || 
    url.includes('data/slots.js') ||
    url.includes('data/slots.json') ||
    /\/data\/slots\.(js|json)($|\?)/.test(url)
  ) && !url.includes('slots_initial');

  if (isSlotData) {
    event.respondWith(
      new Promise((resolve) => {
        let isSettled = false;

        const fetchPromise = fetch(event.request)
          .then(async (networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              try {
                const responseToCache = networkResponse.clone();
                const text = await responseToCache.text();
                const headers = new Headers(networkResponse.headers);
                headers.set('sw-fetched-at', Date.now().toString());

                const stampedResponse = new Response(text, {
                  status: networkResponse.status,
                  statusText: networkResponse.statusText,
                  headers: headers
                });

                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, stampedResponse.clone());

                if (!isSettled) {
                  isSettled = true;
                  resolve(stampedResponse);
                }
              } catch (e) {
                if (!isSettled) {
                  isSettled = true;
                  resolve(networkResponse);
                }
              }
            } else {
              if (!isSettled) {
                isSettled = true;
                resolve(networkResponse);
              }
            }
          })
          .catch(async () => {
            if (!isSettled) {
              isSettled = true;
              const cached = await caches.match(event.request, { ignoreSearch: true });
              if (cached) {
                resolve(cached);
              } else {
                const isJson = url.includes('.json');
                resolve(new Response(isJson ? '[]' : 'var SLOTS_DATA = [];', {
                  status: 200,
                  headers: { 'Content-Type': isJson ? 'application/json' : 'application/javascript' }
                }));
              }
            }
          });

        setTimeout(async () => {
          if (!isSettled) {
            const cached = await caches.match(event.request, { ignoreSearch: true });
            if (cached && !isSettled) {
              const fetchedAt = cached.headers.get('sw-fetched-at');
              const cacheAge = fetchedAt ? (Date.now() - parseInt(fetchedAt, 10)) : Infinity;
              if (cacheAge <= SLOT_DATA_MAX_CACHE_AGE_MS) {
                isSettled = true;
                resolve(cached);
              }
            }
          }
        }, SLOT_DATA_TIMEOUT_MS);
      })
    );
    return;
  }

  // ⚡ 3. ASSETS ESTÁTICOS, TOP-40 INICIAL, IMÁGENES Y FUENTES -> Cache-First / Stale-While-Revalidate
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
