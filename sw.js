// Offline support: keeps the whole course on the device after the first visit.
// Pages and data come from the cache at once and are refreshed in the background.
const CACHE = 'slowka-v3.3';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'js/core.js', 'js/practice.js', 'js/extras.js', 'audio/manifest.js',
  'icons/icon-192.png', 'icons/icon-512.png',
  'data/start.js', 'data/a1-part1.js', 'data/a1-part2.js', 'data/a2-part1.js', 'data/a2-part2.js',
  'data/b1-part1.js', 'data/b1-part2.js', 'data/b2.js', 'data/work.js',
  'data/drills-1.js', 'data/drills-2.js', 'data/drills-3.js', 'data/drills-4.js',
  'data/roleplays-1.js', 'data/roleplays-2.js', 'data/stories-1.js', 'data/stories-2.js', 'data/exams.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!cacheable) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
