// Einfacher Offline-Speicher: Startseite und gebaute Dateien merken, bei fehlendem Netz aus dem Speicher liefern.
const SPEICHER = "app-v1";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(SPEICHER).then((c) => c.addAll(["/", "/index.html"]))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== SPEICHER).map((n) => caches.delete(n))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).then((antwort) => { const kopie = antwort.clone(); caches.open(SPEICHER).then((c) => c.put(r, kopie)); return antwort; })
    .catch(() => caches.match(r).then((m) => m || caches.match("/index.html"))));
});
