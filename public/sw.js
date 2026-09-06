const CACHE_NAME = "viagem-planner-shell-v1";
const APP_SHELL = ["/", "/login", "/manifest.webmanifest", "/app-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});

self.addEventListener("push", (event) => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch { dados = { mensagem: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(dados.titulo || "Vaiviajar", {
    body: dados.mensagem || "Você recebeu uma nova atualização.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { link: dados.link || "/" },
    tag: dados.tag || "vaiviajar-alerta",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.link || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
    const cliente = clientes.find((item) => item.url === destino);
    if (cliente) return cliente.focus();
    return self.clients.openWindow(destino);
  }));
});
