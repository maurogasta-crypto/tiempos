// sw.js — el cascarón de Tiempos, para que abra sin señal. Sello de caché:
// si cambia un archivo de SHELL, sube VERSION (si no, los teléfonos sirven
// una mezcla de viejo y nuevo). Los DATOS no pasan por acá: van por la caché
// persistente de Firestore.
const VERSION = "tiempos-41";
const SHELL = ["./", "index.html", "app.js?v=27", "estado.js", "agenda.js", "familia.js", "compras.js", "plata.js", "balance.js", "sugerir.js", "propone.js", "deseos.js", "pizarra.js", "lugares.js", "finanzas.js", "extractos.js", "proyectos.js", "nucleo.js", "firebase-init.js", "estilos.css?v=21", "manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Sólo lo propio y sólo GET. Firebase, gstatic y Casa Verde van siempre a
// la red: cachearlos es servir un SDK o un núcleo viejo sin que nadie sepa.
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // ?dictar=<texto> (app-14) trae lo que alguien dictó: no se guarda en la caché.
  if (u.searchParams.has("dictar")) return;
  // ?c=<token> (compras-4) es la llave de una lista compartida: tampoco.
  if (u.searchParams.has("c")) return;
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
});
