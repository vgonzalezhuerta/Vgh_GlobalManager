'use strict'

/* ---------- navegación ---------- */

// La app es una sola página. En Android, sin entradas de historial, el botón atrás la
// cerraba desde cualquier pantalla. Se lleva una pila propia y se mantiene UNA entrada
// de historial mientras no estemos en la raíz: esa entrada es la que recoge el toque.
const PANTALLAS = {}
let PILA = [{ nombre: 'hoy', arg: null }]
let entradaPuesta = false

const actual = () => PILA[PILA.length - 1]

function registra (nombre, pinta) { PANTALLAS[nombre] = pinta }

function ve (nombre, arg) {
  if (!PANTALLAS[nombre]) { status('Pantalla desconocida: ' + nombre, true); return }
  actual().scroll = $('main').scrollTop
  PILA.push({ nombre, arg })
  sincronizaHistorial()
  dibuja()
}

// Cambio de raíz desde la barra inferior: no apila, sustituye.
function veRaiz (nombre) {
  PILA = [{ nombre, arg: null }]
  sincronizaHistorial()
  dibuja()
}

function atras () {
  if (PILA.length > 1) PILA.pop()
  sincronizaHistorial()
  dibuja()
}

function sincronizaHistorial () {
  const hondo = PILA.length > 1
  if (hondo && !entradaPuesta) {
    history.pushState({ gm: 1 }, '')
    entradaPuesta = true
  } else if (!hondo && entradaPuesta) {
    // Se consume la entrada sin disparar nuestro manejador.
    entradaPuesta = false
    history.back()
  }
}

window.addEventListener('popstate', () => {
  if (!entradaPuesta) return    // era la vuelta que hemos provocado nosotros
  entradaPuesta = false
  if (PILA.length > 1) {
    PILA.pop()
    sincronizaHistorial()
    dibuja()
  }
})

function dibuja () {
  const p = actual()
  $('#lightbox').hidden = true
  $('#atras').hidden = PILA.length < 2
  $$('nav.barra button').forEach(b => {
    b.setAttribute('aria-current', b.dataset.ir === PILA[0].nombre && PILA.length === 1 ? 'page' : 'false')
  })
  p.fab = null
  try {
    PANTALLAS[p.nombre](p.arg)
  } catch (e) {
    $('#app').innerHTML = '<div class="vacio"><strong>Algo se ha roto al dibujar</strong>' + esc(e.message) + '</div>'
    status('Error al dibujar la pantalla: ' + e.message, true)
  }
  $('#fab').hidden = !p.fab
  $('main').scrollTop = p.scroll || 0
}

// Cada pantalla decide qué hace el botón flotante; si no pone nada, no se ve.
const ponFab = fn => { actual().fab = fn }

const repinta = () => dibuja()

function cabecera (titulo, sub, acciones = '') {
  $('#titulo').innerHTML = esc(titulo) + (sub ? `<span class="sub">${esc(sub)}</span>` : '')
  $('#acciones').innerHTML = acciones
}

/* ---------- arranque ---------- */

async function arranca () {
  $('#atras').onclick = atras
  $('#sync').onclick = () => sincroniza(true)
  $('#status').onclick = limpiaStatus
  $$('nav.barra button').forEach(b => { b.onclick = () => veRaiz(b.dataset.ir) })
  $('#fab').onclick = () => { const f = actual(); if (f.fab) f.fab() }

  await cargaLocal()
  siembra()
  dibuja()

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('sw.js')
      vigilaActualizaciones(reg)
      pintaVersion()
      // Comprobar en cada arranque. reg.update() solo vuelve a pedir el sw.js —unos pocos
      // KB— y no hace nada más si no ha cambiado; quedarse anclado a una versión vieja
      // molesta mucho más que ese tráfico.
      if (navigator.onLine) reg.update().catch(() => {})
    } catch (e) {
      status('No se pudo instalar el service worker: ' + e.message, true)
    }
  }

  // Reconectar en silencio: si el navegador quiere confirmación, la banda de inicio
  // ofrece el botón, porque pedir el permiso exige un gesto del usuario.
  await revisaDormida()
  if (await reconectaCarpeta(false)) await sincroniza(false)
  else pintaSync(dormida ? 'error' : 'off')
  dibuja()

  await avisaPendientes()
  await guardaResumenParaSW()

  // Al volver a la app puede haber escrito el otro dispositivo: se relee la carpeta.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && hayCarpeta()) sincroniza(false)
  })
}

function pintaVersion () {
  if (!navigator.serviceWorker.controller) return
  const c = new MessageChannel()
  c.port1.onmessage = e => { const el = $('#version'); if (el) el.textContent = e.data }
  navigator.serviceWorker.controller.postMessage('version', [c.port2])
}

window.addEventListener('error', e => status('Error: ' + (e.message || 'desconocido'), true))
window.addEventListener('unhandledrejection', e => {
  const m = (e.reason && e.reason.message) || 'promesa rechazada'
  status('Error: ' + m, true)
})

document.addEventListener('DOMContentLoaded', arranca)
