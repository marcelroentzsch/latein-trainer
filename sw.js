const CACHE = 'latein-v24';
const FILES = ['./', 'index.html', 'app.js?v=24', 'vocab.js?v=24', 'logic.js?v=24', 'gem.js?v=24', 'icons.js?v=24', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Netzwerk zuerst (Updates kommen sofort an), ohne Netz aus dem Zwischenspeicher. Die Seite lädt sich selbst neu, sobald gerade nicht gelernt wird.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request)));
});
