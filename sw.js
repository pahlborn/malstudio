/* Service Worker – speichert die App fürs Offline-Malen */
const CACHE = 'malstudio-v7-40';
const ASSETS = [
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-mask-512.png',
  './albarella-basis.jpg',
  './sprite-reh.png',
  './sprite-schatzkiste.png',
  './sprite-funkeln.png',
  './sprite-muschel.png',
  './sprite-schildkroete.png',
  './sprite-delfin-auf.png',
  './sprite-delfin-tauch.png',
  './sprite-kringel.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        // Google-Fonts u. Ä. für später mitcachen
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => hit);
    })
  );
});
