// Service worker do Orion: só recebe Web Push e abre o chamado no clique.
// Não faz cache de nada (o vercel.json manda no-cache e o app não é offline).
//
// O payload vem da Edge enviar-push: { title, body, url, tag }.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let aviso = { title: 'Orion System', body: '', url: '/', tag: undefined };
  try {
    if (event.data) aviso = { ...aviso, ...event.data.json() };
  } catch {
    if (event.data) aviso.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(aviso.title, {
      body: aviso.body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: aviso.tag,
      data: { url: aviso.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Só caminho interno; a Edge já filtra, aqui é a segunda trava.
  const caminho = typeof event.notification.data?.url === 'string' && event.notification.data.url.startsWith('/')
    && !event.notification.data.url.startsWith('//')
    ? event.notification.data.url
    : '/';
  const destino = new URL(caminho, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // Reaproveita uma aba do Orion já aberta em vez de abrir outra.
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin && 'focus' in janela) {
          janela.navigate(destino);
          return janela.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
