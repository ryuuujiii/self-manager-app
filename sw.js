const CACHE_NAME = "self-manager-v25";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=24",
  "./src/app.js?v=24",
  "./src/schedule-calendar.js?v=24",
  "./src/db.js?v=24",
  "./src/money.js?v=24",
  "./src/money-categories.js?v=24",
  "./src/money-categories-ui.js?v=24",
  "./src/money-entry-ui.js?v=24",
  "./src/pay-cycle.js?v=24",
  "./src/jp-holidays.js?v=24",
  "./src/money-ui.js?v=24",
  "./src/money-charts.js?v=24",
  "./src/work.js?v=24",
  "./src/work-ui.js?v=24",
  "./src/life.js?v=24",
  "./src/life-ui.js?v=24",
  "./src/domain.js?v=24",
  "./src/icons.js?v=24",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      })
  );
});
