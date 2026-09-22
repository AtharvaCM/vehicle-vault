/// <reference lib="webworker" />
/* Vehicle Vault service worker, built to /sw.js by vite-plugin-pwa
 * (injectManifest). Two jobs: keep the app shell cached so the app opens
 * instantly and offline, and receive web-push payloads raised by the API's
 * PushChannel. The URL stays /sw.js so existing push subscriptions, which
 * belong to this registration, keep working. */

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

// The build's own file list, each with a content revision: a deploy changes the
// revisions, the new worker re-caches what changed, and the caches of earlier
// builds are dropped, so no deploy can leave an old shell behind.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// A new build takes over at once rather than waiting for every tab to close.
void self.skipWaiting();
clientsClaim();

// Pages come from the network while there is one, so an online visit always
// gets the current deploy; the precached shell is only the offline fallback.
// The API is never answered from here.
registerRoute(
  new NavigationRoute(
    async ({ request }) => {
      try {
        return await fetch(request);
      } catch {
        return (await matchPrecache('/index.html')) ?? Response.error();
      }
    },
    { denylist: [/^\/api\//] },
  ),
);

type PushPayload = { title?: string; message?: string; link?: string };

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = { title: 'Vehicle Vault', message: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Vehicle Vault', {
      body: payload.message || '',
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-32x32.png',
      data: { link: payload.link || '/' },
      tag: payload.link || undefined, // collapse repeats for the same target
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data as { link?: string } | null)?.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          void client.focus();
          if ('navigate' in client) void client.navigate(link);
          return;
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
