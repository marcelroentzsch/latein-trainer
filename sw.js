const CACHE = 'latein-v22';
const FILES = ['./', 'index.html', 'app.js?v=22', 'vocab.js?v=22', 'logic.js?v=22', 'gem.js?v=22', 'icons.js?v=22', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()).then(() => self.clients.matchAll({ type: 'window' })).then(cs => cs.forEach(c => c.navigate(c.url).catch(() => { })))); });
// Netzwerk zuerst (Updates kommen sofort an), ohne Netz aus dem Zwischenspeicher
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request)));
});
