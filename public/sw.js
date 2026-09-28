// Service worker simples: guarda os arquivos do app para abrir rápido
// e funcionar mesmo com internet instável. Dados financeiros NUNCA são
// guardados aqui — eles vêm sempre do Supabase.
const CACHE = 'fina-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Páginas: tenta a rede primeiro, cai para o cache se estiver offline
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }
  // Arquivos estáticos: cache primeiro
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (!res.ok || res.type === 'opaque') return res;
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
    )
  );
});
