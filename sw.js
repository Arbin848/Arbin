// Offline support: keeps the whole course on the device after the first visit.
// Pages and data come from the cache at once and are refreshed in the background.
// Native recordings live in their own cache, kept across app updates.
const CACHE = 'slowka-v11';
const AUDIO_CACHE = 'slowka-audio-v1';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'js/core.js', 'js/practice.js', 'js/extras.js', 'js/trainers.js', 'js/guided.js', 'js/assess.js', 'js/numbers.js', 'js/listening.js', 'js/pron.js', 'js/mywords.js', 'js/speaking.js', 'audio/manifest.js', 'audio/tts.js',
  'icons/icon-192.png', 'icons/icon-512.png',
  'data/start.js', 'data/a1-part1.js', 'data/a1-part2.js', 'data/a2-part1.js', 'data/a2-part2.js',
  'data/b1-part1.js', 'data/b1-part2.js', 'data/b2.js', 'data/work.js',
  'data/drills-1.js', 'data/drills-2.js', 'data/drills-3.js', 'data/drills-4.js',
  'data/roleplays-1.js', 'data/roleplays-2.js', 'data/stories-1.js', 'data/stories-2.js', 'data/exams.js',
  'data/verbs-1.js', 'data/verbs-2.js', 'data/cases.js', 'data/sounds.js', 'data/listening.js',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache so a new version never stores old files.
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== AUDIO_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Recordings: answer from the audio cache; otherwise fetch the whole file (no Range) and keep it.
// Safari asks for byte ranges when playing audio and needs a 206 answer, so ranges are cut here.
async function audio(req) {
  const cache = await caches.open(AUDIO_CACHE);
  const key = req.url.split('#')[0];
  let res = await cache.match(key);
  if (!res) {
    try {
      res = await fetch(key);
      if (res.status === 200) await cache.put(key, res.clone());
    } catch (e) {
      return new Response('', { status: 504 });
    }
  }
  const range = req.headers.get('range');
  if (!range || res.status !== 200) return res;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const body = await res.blob();
  const size = body.size;
  let start = m && m[1] !== '' ? Number(m[1]) : NaN;
  let end = m && m[2] !== '' ? Number(m[2]) : size - 1;
  if (Number.isNaN(start)) { start = Math.max(0, size - end); end = size - 1; } // "bytes=-500": the last 500 bytes
  end = Math.min(end, size - 1);
  if (start >= size || start > end) return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && /\/audio\/.+\.mp3$/.test(url.pathname)) {
    event.respondWith(audio(req));
    return;
  }
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!cacheable) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      // Same-site files are re-checked with the server (not the browser's HTTP cache) in the background.
      const fresh = (url.origin === location.origin ? fetch(url.href, { cache: 'no-cache' }) : fetch(req)).then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
