'use strict'

// Lo que la web puede y no puede hacer aquí, para que quede escrito:
// no existe forma de programar una notificación futura con la app cerrada (la API que
// lo permitía nunca llegó a producción y el push de verdad exige un servidor). Así que
// esto avisa al abrir la app y, en PWA instalada, aprovecha `periodicsync`, que el
// navegador dispara cuando le parece y como mucho cada pocas horas. El aviso puntual
// y fiable lo da Google Calendar.

const avisosOn = () => localStorage.getItem('gm_avisos') === '1'

async function pidePermisoAvisos () {
  if (!('Notification' in window)) {
    status('Este navegador no admite notificaciones.', true)
    return false
  }
  const p = await Notification.requestPermission()
  if (p !== 'granted') {
    status('No has dado permiso para notificaciones.', true)
    localStorage.setItem('gm_avisos', '0')
    return false
  }
  localStorage.setItem('gm_avisos', '1')
  await registraPeriodico()
  return true
}

async function registraPeriodico () {
  try {
    const reg = await navigator.serviceWorker.ready
    if (!('periodicSync' in reg)) return
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' })
    if (st.state !== 'granted') return
    await reg.periodicSync.register('revisar-tareas', { minInterval: 12 * 60 * 60 * 1000 })
  } catch (e) {
    // No es un fallo que merezca molestar: la app avisa igual al abrirse.
  }
}

// Un solo aviso agrupado. Una notificación por tarea llena la barra y se ignoran todas.
async function avisaPendientes () {
  if (!avisosOn() || Notification.permission !== 'granted') return
  const hoy = paraAvisar()
  if (!hoy.length) return
  const sello = hoyISO()
  if (localStorage.getItem('gm_avisado') === sello) return
  localStorage.setItem('gm_avisado', sello)

  const titulo = hoy.length === 1 ? 'Tienes 1 tarea pendiente' : `Tienes ${hoy.length} tareas pendientes`
  const cuerpo = hoy.slice(0, 4).map(t => {
    const d = diasHasta(t.due)
    return `${t.title}${d < 0 ? ` (${-d} d de retraso)` : ''}`
  }).join('\n') + (hoy.length > 4 ? `\n…y ${hoy.length - 4} más` : '')

  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(titulo, {
      body: cuerpo,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'gm-pendientes',
      renotify: true,
      data: { url: './' }
    })
  } catch (e) {
    status('No se pudo mostrar la notificación: ' + e.message, true)
  }
}

// El service worker necesita leer las tareas por su cuenta cuando despierta sin la app
// abierta, así que se le deja un resumen ligero en IndexedDB en cada guardado.
async function guardaResumenParaSW () {
  const resumen = paraAvisar().slice(0, 20).map(t => ({ title: t.title, due: t.due }))
  try { await idbSet('meta', 'avisos', { at: ahora(), tareas: resumen }) } catch (e) {}
}
