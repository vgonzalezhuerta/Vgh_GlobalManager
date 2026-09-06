'use strict'

// Instalar y actualizar. Chrome esconde «Instalar aplicación» en sitios distintos según
// la versión, y si no cumple algún requisito no lo dice: simplemente no aparece la opción.
// Por eso la app trae su propio botón y, si Chrome no lo ofrece, un diagnóstico que dice
// cuál es el requisito que falla.
let promptInstalar = null
let regSW = null
let hayNueva = false
let recargando = false

window.addEventListener('beforeinstallprompt', e => {
  // Sin preventDefault, Chrome enseña su propio aviso y luego ya no se puede lanzar a mano.
  e.preventDefault()
  promptInstalar = e
  if (typeof repinta === 'function') repinta()
})

window.addEventListener('appinstalled', () => {
  promptInstalar = null
  status('App instalada.')
  if (typeof repinta === 'function') repinta()
})

const origenSeguro = () => location.protocol === 'https:' ||
  ['localhost', '127.0.0.1'].includes(location.hostname)

const estaInstalada = () =>
  matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: minimal-ui)').matches ||
  navigator.standalone === true

async function instala () {
  if (!promptInstalar) {
    status('Chrome todavía no ofrece instalar. Mira el diagnóstico de abajo.', true)
    return
  }
  try {
    promptInstalar.prompt()
    const r = await promptInstalar.userChoice
    // El evento solo se puede usar una vez; Chrome lo vuelve a lanzar si hace falta.
    promptInstalar = null
    status(r.outcome === 'accepted' ? 'Instalando…' : 'Instalación cancelada.')
  } catch (e) {
    status('No se pudo lanzar la instalación: ' + e.message, true)
  }
  if (typeof repinta === 'function') repinta()
}

/* ---------- diagnóstico ---------- */

// Cada línea es un requisito que Chrome exige para ofrecer la instalación.
async function diagnostico () {
  const l = []
  l.push(['Origen seguro (https)', origenSeguro(),
    origenSeguro() ? location.origin : `${location.protocol}//${location.host} · sin https no hay instalación ni service worker`])

  let man = null
  try {
    const r = await fetch('manifest.webmanifest', { cache: 'no-store' })
    if (r.ok) man = await r.json()
    l.push(['Manifiesto accesible', !!man, man ? `${man.name} · ${man.display}` : `respondió ${r.status}`])
  } catch (e) {
    l.push(['Manifiesto accesible', false, e.message])
  }
  const iconos = man ? (man.icons || []) : []
  const tiene = t => iconos.some(i => (i.sizes || '').split(' ').includes(t))
  l.push(['Iconos de 192 y 512', tiene('192x192') && tiene('512x512'), `${iconos.length} declarados`])

  const sw = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null
  l.push(['Service worker activo', !!(sw && sw.active), sw ? `ámbito ${sw.scope}` : 'no registrado'])

  l.push(['Chrome ofrece instalar', !!promptInstalar || estaInstalada(),
    estaInstalada() ? 'ya está instalada'
      : promptInstalar ? 'sí, usa el botón de arriba'
        : 'todavía no · suele bastar con visitar la página otra vez, y no vale en pestaña de incógnito'])
  return l
}

/* ---------- actualizaciones ---------- */

function vigilaActualizaciones (reg) {
  regSW = reg
  if (reg.waiting && navigator.serviceWorker.controller) hayNueva = true
  reg.addEventListener('updatefound', () => {
    const nuevo = reg.installing
    if (!nuevo) return
    nuevo.addEventListener('statechange', () => {
      // Sin controlador es la primera instalación, no una actualización.
      if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
        hayNueva = true
        status('Hay una versión nueva. Actualiza desde Ajustes.')
        if (typeof repinta === 'function') repinta()
      }
    })
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return
    recargando = true
    location.reload()
  })
}

// El registro tarda un poco en resolverse al arrancar; si alguien abre Ajustes antes,
// `regSW` todavía está vacío y decir «no registrado» sería mentira.
async function registro () {
  if (regSW) return regSW
  if (!('serviceWorker' in navigator)) return null
  try { return await navigator.serviceWorker.getRegistration() } catch (e) { return null }
}

async function buscaActualizacion () {
  const reg = await registro()
  if (!reg) { status('El service worker no está registrado; no hay nada que actualizar.', true); return }
  if (!navigator.onLine) { status('Sin conexión: no se puede comprobar si hay versión nueva.', true); return }
  status('Buscando actualizaciones…')
  try {
    await reg.update()
  } catch (e) {
    status('No se pudo comprobar: ' + e.message, true)
    return
  }
  // update() vuelve en cuanto ha preguntado; instalar la nueva tarda un poco más.
  for (let i = 0; i < 12 && !reg.waiting && !hayNueva; i++) await new Promise(r => setTimeout(r, 250))
  if (reg.waiting || hayNueva) { hayNueva = true; status('Hay una versión nueva lista para aplicar.') }
  else status('Ya tienes la última versión.')
  localStorage.setItem('gm_buscada', String(ahora()))
  if (typeof repinta === 'function') repinta()
}

// La versión nueva espera a propósito: si entrase sola, la página seguiría corriendo el
// JavaScript viejo con los archivos ya cambiados debajo.
async function aplicaActualizacion () {
  const reg = await registro()
  const esperando = reg && reg.waiting
  if (!esperando) { recargando = true; location.reload(); return }
  status('Actualizando…')
  esperando.postMessage('actualiza')
  // Si el cambio de controlador no llega, se recarga igual pasados unos segundos.
  setTimeout(() => { if (!recargando) { recargando = true; location.reload() } }, 4000)
}

const ultimaBusqueda = () => Number(localStorage.getItem('gm_buscada') || 0)
