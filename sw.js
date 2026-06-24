/* ============================================================
   Service Worker — «никогда не залипает на старой версии».
   Стратегия network-first: онлайн всегда берём свежее из сети
   (с обязательной ревалидацией), офлайн — отдаём из кэша.
   Обновляется сам: skipWaiting + clients.claim.
   ============================================================ */
const CACHE = "greek-a1-cache-v4";

// Ядро для офлайна с первого визита (на случай, если ресурс не успели открыть).
// js/firebase-config.js и js/cloud.js намеренно НЕ в precache: cloud.js — ES-модуль,
// тянущий Firebase с CDN, офлайн он всё равно не работает; докешируется fetch-хендлером
// при первом онлайн-визите. Всё остальное (ядро обучения) — ниже.
const PRECACHE = [
  "./", "index.html", "css/styles.css",
  "js/data-alphabet.js", "js/data-decks-core.js", "js/data-decks-extra.js",
  "js/data.js", "js/grammar.js", "js/official_a1.js", "js/rare.js",
  "js/exercises.js", "js/writing.js", "js/reading.js", "js/exams.js",
  "js/srs.js", "js/speech.js", "js/app.js",
  "js/feat-track.js", "js/feat-speaking.js", "js/feat-exams.js",
  "js/feat-writing.js", "js/feat-reading.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    try { const c = await caches.open(CACHE); await c.addAll(PRECACHE); } catch (err) { /* офлайн при установке — ок */ }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Чужие домены (Firebase CDN и т.п.) — не трогаем
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    try {
      // no-cache = всегда сверяемся с сервером (304 если не менялось)
      const fresh = await fetch(req, { cache: "no-cache" });
      if (fresh && fresh.status === 200) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      // Офлайн — отдаём из кэша, для навигации — корневую страницу
      const cached = await caches.match(req);
      return cached || (await caches.match("./")) || (await caches.match("index.html")) || Response.error();
    }
  })());
});
