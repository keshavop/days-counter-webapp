/* Days Counter service worker — offline app shell + asset caching.
 * Data never goes through here: /api/* (accounts and events.csv in Google Drive) always goes
 * to the network, and events live in localStorage, so the app works offline and syncs when back online. */

const VERSION = "dc-v2";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const SHELL = ["/login", "/signup", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Sessions and data are never cached.
  if (url.pathname.startsWith("/api/")) return;

  // Pages: network first so updates show up, cached copy when offline.
  // Pages read their event id from ?id=, so cache by path only.
  if (req.mode === "navigate") {
    const key = url.pathname;
    event.respondWith(
      fetch(req)
        .then((res) => {
          // A redirect (e.g. to /login when signed out) must not be cached under this page's path.
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(key, { cacheName: PAGES })) || (await caches.match("/", { cacheName: PAGES })) || Response.error()),
    );
    return;
  }

  // Build output is content-hashed: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else on our origin (RSC payloads, manifest…): stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || net;
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
