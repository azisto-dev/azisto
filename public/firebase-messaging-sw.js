/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCrGWLXtr2_wCczVUnovilqTokF_zcJqI4",
  authDomain: "azisto.firebaseapp.com",
  projectId: "azisto",
  storageBucket: "azisto.firebasestorage.app",
  messagingSenderId: "608836048713",
  appId: "1:608836048713:web:825be31d0e06b05ca2ac98",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = data.title || notification.title || "AZISTO";
  const options = {
    body: data.body || notification.body || "You have a new update.",
    icon: "/azisto-app-icon.png",
    badge: "/azisto-app-icon.png",
    data: {
      url: data.url || "/notifications",
    },
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/notifications";
  const targetUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client && client.url === targetUrl) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }

        return undefined;
      }),
  );
});
