// Service worker mínimo: habilita la instalación como PWA y cachea el
// "app shell" estático (estilos, íconos) para que cargue más rápido en
// visitas repetidas. La intranet es mayormente dinámica/autenticada
// (marcación, nómina, solicitudes), así que NO se cachean respuestas de
// `/api/*` — solo se ofrece una página de aviso cuando no hay red.
const CACHE_NAME = 'intranet-shell-v1';
const APP_SHELL = ['/styles/global.css', '/favicon.svg', '/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nunca interceptar la API ni el BFF: siempre deben ir a red (datos en
  // vivo de nómina/marcación/solicitudes, nunca servidos desde caché).
  if (url.pathname.startsWith('/api/')) return;

  // Navegación de páginas: red primero (contenido SSR siempre fresco),
  // con una página de aviso offline como respaldo si no hay conexión.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html')),
    );
    return;
  }

  // Estáticos (CSS, íconos): caché primero, red como respaldo.
  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request)),
  );
});
