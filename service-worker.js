/**
 * service-worker.js
 * PWA: caché del shell, recursos, PokéAPI y sprites.
 *
 * Estrategias:
 *  - Navegación:       red primero, con respaldo en caché (funciona sin Internet).
 *  - Recursos propios: stale-while-revalidate (respuesta rápida + actualización).
 *  - PokéAPI:          red primero, con respaldo en caché.
 *  - Sprites:          caché primero (se guardan al mostrar/capturar un Pokémon).
 */

const VERSION = 'v1.0.22';

const SHELL_CACHE = `pokedex-shell-${VERSION}`;
const ASSET_CACHE = `pokedex-assets-${VERSION}`;
const API_CACHE = `pokedex-api-${VERSION}`;
const SPRITE_CACHE = `pokedex-sprites-${VERSION}`;

const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, API_CACHE, SPRITE_CACHE];

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/api.js',
  './js/data.js',
  './js/qr.js',
  './js/storage.js',
  './js/ui.js',
  './vendor/tailwindcss.js',
  './vendor/html5-qrcode.min.js',
  './fonts/manrope-latin.woff2',
  './fonts/dm-mono-400-latin.woff2',
  './fonts/dm-mono-500-latin.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

/* =========================================================================
   Ciclo de vida
   ========================================================================= */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const results = await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' }))),
      );
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn('No se pudo precachear:', PRECACHE_URLS[index], result.reason);
        }
      });
      // No se activa de inmediato: la app avisa cuando hay una actualización.
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('pokedex-') && !CURRENT_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* =========================================================================
   Estrategias de caché
   ========================================================================= */

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  return cached || (await network) || Response.error();
}

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cachedShell = async () =>
    (await cache.match(request)) ||
    (await cache.match('./index.html')) ||
    (await cache.match('./'));

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(new Request('./index.html'), response.clone()).catch(() => {});
      return response;
    }
    // Un 5xx del hosting no debe romper la app: si hay shell en caché, se usa.
    const cached = await cachedShell();
    return cached || response;
  } catch {
    return (await cachedShell()) || Response.error();
  }
}

/* =========================================================================
   Fetch
   ========================================================================= */

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navegación: la interfaz debe abrir sin conexión.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Recursos propios de la app.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
    return;
  }

  // PokéAPI: información de los Pokémon.
  if (url.hostname === 'pokeapi.co') {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Sprites e ilustraciones oficiales.
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(cacheFirst(request, SPRITE_CACHE));
  }
});
