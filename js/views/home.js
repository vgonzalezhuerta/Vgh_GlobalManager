'use strict'

// `carpetaDormida()` es asíncrona y pintar no lo es, así que el estado se consulta al
// arrancar y tras cada intento de reconectar, y aquí solo se lee.
let dormida = false
const revisaDormida = async () => { dormida = await carpetaDormida() }

registra('hoy', () => {
  cabecera('Hoy', fechaLarga())
  const tarde = pendientes().filter(t => t.due && diasHasta(t.due) < 0).sort(ordenTareas)
  const hoy = pendientes().filter(t => t.due && diasHasta(t.due) === 0).sort(ordenTareas)
  const prox = proximas(14)
  const suelto = sinFecha().slice(0, 12)

  let html = banda()
  if (!tarde.length && !hoy.length && !prox.length && !suelto.length) {
    html += `<div class="vacio"><strong>Nada pendiente</strong>
      Crea un área y empieza a apuntar tareas.</div>`
  } else {
    if (tarde.length) html += `<h2 class="sec">Con retraso · ${tarde.length}</h2>` + listaTareas(tarde, { ruta: true })
    if (hoy.length) html += '<h2 class="sec">Hoy</h2>' + listaTareas(hoy, { ruta: true })
    if (prox.length) html += '<h2 class="sec">Próximos 14 días</h2>' + listaTareas(prox, { ruta: true })
    if (suelto.length) {
      html += '<h2 class="sec">Sin fecha</h2>' + listaTareas(suelto, { ruta: true })
      const total = sinFecha().length
      if (total > suelto.length) html += `<p class="pista">y ${total - suelto.length} más sin fecha, en sus áreas.</p>`
    }
  }
  pinta(html)
  ponFab(() => ve('nuevaTarea', {}))
  cableaBanda()
})

function fechaLarga () {
  const d = new Date()
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`
}

// Una sola banda de aviso y por orden de importancia: sin id de cliente no hay nada
// que sincronizar, así que eso va primero.
function banda () {
  if (!hayCarpeta()) {
    return dormida
      ? `<div class="banda">El navegador necesita que confirmes otra vez el permiso sobre la
          carpeta. Es normal después de cerrar y abrir.
          <button class="boton" data-banda="reconectar">Reconectar la carpeta</button></div>`
      : `<div class="banda">Los datos solo están en este dispositivo. Elige la carpeta de Google
          Drive para compartirlos con el PC.
          <button class="boton" data-banda="ajustes">Elegir carpeta</button></div>`
  }
  if (!('Notification' in window)) return ''
  if (Notification.permission === 'default' && localStorage.getItem('gm_avisos') !== '0') {
    return `<div class="banda">¿Quieres que la app te avise de lo vencido al abrirla?
      <button class="boton" data-banda="avisos">Activar notificaciones</button></div>`
  }
  return ''
}

function cableaBanda () {
  const b = $('[data-banda]')
  if (!b) return
  b.onclick = async () => {
    const q = b.dataset.banda
    if (q === 'ajustes') ve('ajustes')
    else if (q === 'reconectar') {
      const ok = await reconectaCarpeta(true)
      await revisaDormida()
      if (ok) { status('Carpeta reconectada.'); await sincroniza(true) } else status('Sigue sin permiso sobre la carpeta.', true)
      dibuja()
    } else pidePermisoAvisos().then(ok => { if (ok) { status('Notificaciones activadas.'); dibuja() } })
  }
}
