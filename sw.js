'use strict'

// Subir este número en cada cambio. Sin eso la app instalada sigue sirviendo la versión
// cacheada y el cambio no llega al móvil. Es el error más fácil de cometer aquí, y el
// único sitio donde se escribe la versión: la insignia de Ajustes se la pregunta al
// service worker con postMessage('version').
const VERSION = 'globalmanager-v3'

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/config.js',
  'js/util.js',
  'js/store.js',
  'js/carpeta.js',
  'js/calendar.js',
  'js/photos.js',
  'js/notify.js',
  'js/instalar.js',
  'js/app.js',
  'js/views/comun.js',
  'js/views/home.js',
  'js/views/areas.js',
  'js/views/task.js',
  'js/views/listas.js',
  'js/views/buscar.js',
  'js/views/ajustes.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
]

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION)
    // Uno a uno: si un archivo falta, addAll tira toda la instalación al suelo y la app
    // se queda sin service worker.
    await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))
    // Ojo: aquí NO se llama a skipWaiting. Si la versión nueva entrase sola, la página
    // seguiría corriendo el JavaScript viejo con los archivos ya cambiados debajo. Espera
    // a que el usuario pulse «Actualizar ahora», que manda el mensaje de abajo.
  })())
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k)
    await self.clients.claim()
  })())
})

// Solo se cachea el armazón propio. Los datos no pasan por aquí: viven en la carpeta que
// el usuario eligió y se leen con la File System Access API, que el service worker no ve.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  e.respondWith((async () => {
    const cache = await caches.open(VERSION)
    const guardado = await cache.match(e.request, { ignoreSearch: true })
    if (guardado) {
      // Se sirve lo cacheado y se refresca por detrás, así arranca al instante offline.
      fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()) }).catch(() => {})
      return guardado
    }
    try {
      const r = await fetch(e.request)
      if (r.ok) cache.put(e.request, r.clone())
      return r
    } catch (err) {
      const inicio = await cache.match('index.html')
      if (inicio && e.request.mode === 'navigate') return inicio
      return new Response('Sin conexión y sin copia local de este archivo.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
  })())
})

self.addEventListener('message', e => {
  if (e.data === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION)
  if (e.data === 'actualiza') self.skipWaiting()
})

/* ---------- avisos ---------- */

// El navegador dispara esto cuando le parece, y como mucho unas pocas veces al día. No
// sustituye a un recordatorio de Calendar; es el aviso de cortesía por si la app lleva
// días sin abrirse.
self.addEventListener('periodicsync', e => {
  if (e.tag !== 'revisar-tareas') return
  e.waitUntil(avisa())
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of abiertas) if (c.url.includes(self.registration.scope)) return c.focus()
    return self.clients.openWindow('./')
  })())
})

// La app deja un resumen ligero en IndexedDB en cada guardado, porque aquí no se puede
// cargar el modelo entero ni hablar con Drive sin token.
function leeResumen () {
  return new Promise(ok => {
    const r = indexedDB.open('globalmanager', 1)
    r.onerror = () => ok(null)
    r.onsuccess = () => {
      try {
        const g = r.result.transaction('meta').objectStore('meta').get('avisos')
        g.onsuccess = () => ok(g.result)
        g.onerror = () => ok(null)
      } catch (err) { ok(null) }
    }
  })
}

async function avisa () {
  const res = await leeResumen()
  if (!res || !res.tareas || !res.tareas.length) return
  const n = res.tareas.length
  await self.registration.showNotification(
    n === 1 ? 'Tienes 1 tarea pendiente' : `Tienes ${n} tareas pendientes`,
    {
      body: res.tareas.slice(0, 4).map(t => t.title).join('\n') + (n > 4 ? `\n…y ${n - 4} más` : ''),
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'gm-pendientes',
      data: { url: './' }
    })
}
