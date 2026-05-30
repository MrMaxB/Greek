/* ============================================================
   Service Worker — «никогда не залипает на старой версии».
   Стратегия network-first: онлайн всегда берём свежее из сети
   (с обязательной ревалидацией), офлайн — отдаём из кэша.
   Обновляется сам: skipWaiting + clients.claim.
   ============================================================ */
const CACHE = "greek-a1-cache-v1";

self.addEventListener("install", () => self.skipWaiting());

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
