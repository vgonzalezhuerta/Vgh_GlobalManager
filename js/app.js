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
  // Un repintado que no ha pedido el usuario —el aviso de instalación de Chrome, una
  // sincronización que termina, una versión nueva— no puede tragarse lo que está
  // escribiendo. Se guarda el campo con el foco y se devuelve tal cual después.
  const act = document.activeElement
  const foco = act && act.id && 'value' in act && $('#app').contains(act)
    ? { id: act.id, valor: act.value, ini: act.selectionStart, fin: act.selectionEnd }
    : null

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

  if (foco) {
    const el = document.getElementById(foco.id)
    if (el && 'value' in el) {
      el.value = foco.valor
      el.focus()
      // selectionStart no existe en los campos de fecha, hora ni número.
      try { if (foco.ini != null) el.setSelectionRange(foco.ini, foco.fin) } catch (e) {}
    }
  }
}

// Cada pantalla decide qué hace el botón flotante; si no pone nada, no se ve.
const ponFab = fn => { actual().fab = fn }

const repinta = () => dibuja()

function cabecera (titulo, sub, acciones = '') {
  $('#titulo').innerHTML = esc(titulo) + (sub ? `<span class="sub">${esc(sub)}</span>` : '')
  $('#acciones').innerHTML = acciones
}

/* ---------- accesos directos y compartir ---------- */

// Enfocar la caja de apuntar cuesta más de lo que parece: llamando a focus() dentro del
// arranque Chrome lo descarta sin avisar, y encima el aviso de instalación repinta la
// pantalla un par de segundos después. Se intenta unas cuantas veces y se deja en paz en
// cuanto prende o el usuario toca otra cosa.
function enfocaCaptura () {
  const cuando = [120, 350, 800, 1500, 2200]
  cuando.forEach(ms => setTimeout(() => {
    const caja = $('#h-rapida')
    if (!caja || document.activeElement === caja) return
    // Si el usuario ya está escribiendo en otro sitio, no se le roba el foco.
    const act = document.activeElement
    if (act && act !== document.body && 'value' in act) return
    caja.focus()
  }, ms))
}

/* ---------- accesos directos y compartir ---------- */

// Android entra por aquí de tres formas: el icono normal, un acceso directo del menú de
// pulsación larga (?ir=…) y «Compartir con GlobalManager» (title/text/url). La URL se
// limpia después para que recargar no repita la acción.
function atiendeURL () {
  const q = new URLSearchParams(location.search)
  const limpia = () => { try { history.replaceState({}, '', location.pathname) } catch (e) {} }

  const titulo = (q.get('title') || '').trim()
  const texto = (q.get('text') || '').trim()
  const url = (q.get('url') || '').trim()
  if (titulo || texto || url) {
    // Chrome en Android mete el enlace en `text` tantas veces como en `url`.
    const enlace = url || (texto.match(/https?:\/\/\S+/) || [''])[0]
    // El texto compartido suele traer ya el enlace dentro; añadirlo otra vez lo duplicaba.
    let cuerpo = texto === enlace ? '' : texto
    if (cuerpo && enlace && !cuerpo.includes(enlace)) cuerpo += '\n\n' + enlace
    if (!cuerpo && enlace && titulo) cuerpo = enlace
    // Un enlace pelado como título se lee fatal; sin el protocolo, al menos se entiende.
    const desdeEnlace = enlace.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const nombre = titulo || cuerpo.split('\n')[0].slice(0, 80) || desdeEnlace || 'Compartido'
    anadeRapida(nombre, { desc: cuerpo, url: enlace || null })
    trasCambio()
    PILA = [{ nombre: 'entrada', arg: null }]
    status('Añadido a la Entrada.')
    limpia()
    return
  }

  const ir = q.get('ir')
  if (!ir) return
  if (ir === 'apuntar') { enfocaRapida = true; PILA = [{ nombre: 'hoy', arg: null }] }
  else if (PANTALLAS[ir]) PILA = [{ nombre: ir, arg: ir === 'nuevaTarea' ? {} : null }]
  limpia()
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
  atiendeURL()
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

  // El acceso directo «Apuntar» enfoca aquí y no al pintar: el arranque vuelve a dibujar
  // después de mirar la carpeta y el foco se perdía en ese segundo repintado. Y va en un
  // setTimeout porque llamando a focus() dentro de la secuencia de arranque no prende: la
  // página todavía no tiene el foco del navegador y Chrome lo descarta sin avisar.
  if (enfocaRapida) {
    enfocaRapida = false
    enfocaCaptura()
  }

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
