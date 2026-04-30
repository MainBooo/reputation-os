self.addEventListener('push', function (event) {
  let data = {}

  try {
    data = event.data ? event.data.json() : {}
  } catch (error) {
    data = {
      title: 'Reputation OS',
      body: event.data ? event.data.text() : 'Новое уведомление'
    }
  }

  const title = data.title || 'Reputation OS'
  const options = {
    body: data.body || 'Новое уведомление',
    tag: data.tag || 'reputation-os-alert',
    data: {
      url: data.url || '/dashboard'
    }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const url = event.notification && event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url)
      }

      return undefined
    })
  )
})
