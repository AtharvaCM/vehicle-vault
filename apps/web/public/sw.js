/* Vehicle Vault push service worker. Receives web-push payloads raised by
 * the API's PushChannel and shows them as system notifications. */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
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
  const link = (event.notification.data && event.notification.data.link) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(link);
          return;
        }
      }
      return clients.openWindow(link);
    }),
  );
});
