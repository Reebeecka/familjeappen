import { matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, setCatchHandler } from 'workbox-routing'

// Precache appens filer (fylls i av vite-plugin-pwa vid bygget).
precacheAndRoute(self.__WB_MANIFEST)

// Försök hämta direkta sidnavigeringar från nätet. Vid avbrott visar
// Workbox den precachade offline-sidan utan att påverka övriga resurser.
registerRoute(({ request }) => request.mode === 'navigate', ({ request }) => fetch(request))

setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    return (await matchPrecache('/offline.html')) ?? Response.error()
  }

  return Response.error()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Ta emot push-meddelanden och visa notis.
self.addEventListener('push', (event) => {
  let payload = { title: 'Familjeappen', body: 'Ny uppdatering' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    if (event.data) payload.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: payload.url ?? '/' },
      tag: payload.tag,
    }),
  )
})

// Öppna appen när användaren klickar på notisen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
      return undefined
    }),
  )
})
