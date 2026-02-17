// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAUlLbEm5swojdlsFc-FSZaA212hJCQv3I",
  authDomain: "delivery-dispatcher-f11cc.firebaseapp.com",
  projectId: "delivery-dispatcher-f11cc",
  storageBucket: "delivery-dispatcher-f11cc.firebasestorage.app",
  messagingSenderId: "500959573570",
  appId: "1:500959573570:web:de1a3e313ca9e991f8dfdb"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || 'Nexus Logistics';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
