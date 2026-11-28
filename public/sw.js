// Minimal service worker so the checker can be installed to the home screen
// and offered in the Android Share menu. It caches nothing: every check needs
// the live server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
