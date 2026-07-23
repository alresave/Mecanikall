/* global firebase */
// Este archivo debe vivir en la raíz del sitio para que FCM pueda usarlo.
// La configuración pública se inyecta en /firebase-config.js al desplegar.
try {
  importScripts('/firebase-config.js');
} catch {
  console.warn('[FCM] Falta firebase-config.js; las notificaciones push no se inicializaron.');
}

if (self.FIREBASE_CONFIG) {
  // Debe registrarse antes de cargar Firebase para conservar el clic personalizado.
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url ?? '/taller';
    event.waitUntil(clients.openWindow(url));
  });

  // API compat: permite usar Firebase sin compilar este worker por separado.
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

  firebase.initializeApp(self.FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification ?? {};
    const data = payload.data ?? {};
    self.registration.showNotification(notification.title ?? 'Mecanikall', {
      body: notification.body ?? 'Tienes una nueva actualización.',
      icon: '/mecanikall.png',
      badge: '/mecanikall.png',
      data: { url: data.url ?? '/taller' },
    });
  });
}
