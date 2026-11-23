/* SPIL service worker (owner request 2026-11-23, modelled on Clink's caching rules).
 *
 * - Pages always come from the network when it is there, so a new version shows at once. A
 *   cached copy is only used offline, and only for public pages that are the same for everyone.
 * - API calls, rooms, the admin console and anything personal are never cached.
 * - Next's hashed build files (/_next/static) never change, so they are cached for good.
 * - Push: game updates and the Today's Spill reminder, with a tap opening the right screen.
 *
 * Bump VERSION when this file changes so old runtime caches are dropped on activate.
 */
const VERSION = "v1";
const PAGES = `spil-pages-${VERSION}`;
const ASSETS = `spil-assets-${VERSION}`;
const STATIC = "spil-static"; // content-hashed files: safe across versions, trimmed instead
const OFFLINE = "/offline";
const PRECACHE = [OFFLINE, "/icons/icon-192.png", "/icons/badge-96.png"];
const STATIC_MAX = 200;

// Never cached, never served from a cache: someone's data, or the admin console.
const NEVER = [
  /^\/api\//,
  /^\/admin(\/|$)/,
  /^\/r\//,
  /^\/crew(s)?(\/|$)/,
  /^\/profile(\/|$)/,
  /^\/badges(\/|$)/,
  /^\/sign-in(\/|$)/,
  /^\/recover(\/|$)/,
  /^\/banned(\/|$)/,
  /^\/og(\/|$)/,
  /^\/dev\//,
];
// Public pages whose last copy is fine to show offline.
const PUBLIC_PAGE =
  /^\/($|games(\/|$)|faq$|how-to-play$|safety$|privacy$|terms$|contact$|join$|create$|daily$|install$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(ASSETS)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, ASSETS, STATIC]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function page(event, url) {
  try {
    const preloaded = await event.preloadResponse;
    const response = preloaded || (await fetch(event.request));
    if (response.ok && !response.redirected && PUBLIC_PAGE.test(url.pathname)) {
      const copy = response.clone();
      event.waitUntil(caches.open(PAGES).then((c) => c.put(event.request, copy)));
    }
    return response;
  } catch {
    const cached = PUBLIC_PAGE.test(url.pathname) ? await caches.match(event.request) : undefined;
    return cached || (await caches.match(OFFLINE)) || Response.error();
  }
}

async function staticFile(event) {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(
      caches
        .open(STATIC)
        .then((c) => c.put(event.request, copy))
        .then(() => trim(STATIC, STATIC_MAX)),
    );
  }
  return response;
}

async function asset(event) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(event.request);
  const fresh = fetch(event.request)
    .then((r) => {
      if (r.ok) cache.put(event.request, r.clone());
      return r;
    })
    .catch(() => cached);
  return cached || fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The router's own data requests (RSC, prefetches) go straight to the network.
  if (request.headers.get("RSC") === "1") return;

  if (request.mode === "navigate") {
    if (NEVER.some((r) => r.test(url.pathname))) {
      // Private pages are never cached, but offline still shows our page, not the browser's.
      event.respondWith(
        fetch(request).catch(async () => (await caches.match(OFFLINE)) || Response.error()),
      );
      return;
    }
    event.respondWith(page(event, url));
    return;
  }
  if (NEVER.some((r) => r.test(url.pathname))) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticFile(event));
    return;
  }
  if (url.pathname.startsWith("/icons/") || request.destination === "font") {
    event.respondWith(asset(event));
  }
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "SPIL";
  event.waitUntil(
    (async () => {
      // A dot on the installed app's icon until SPIL is opened again.
      if (self.navigator.setAppBadge) await self.navigator.setAppBadge(1).catch(() => {});
      await self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag,
        // The same tag replaces the last one; still buzz so the update is noticed.
        renotify: Boolean(data.tag),
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        data: { url: data.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if (open.url !== target) await open.navigate(target).catch(() => {});
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
