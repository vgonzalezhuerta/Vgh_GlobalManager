'use strict'

/* ---------- regalos por persona ---------- */

// Un área de regalos se lee por persona, no por fecha: la pregunta siempre es
// «¿qué le puedo regalar a X?».
function pintaRegalos (a) {
  cabecera(`${a.icon || '🎁'} ${a.name}`, 'Regalos por persona',
    `<button class="icono" data-editar="1" aria-label="Editar área">✏️</button>`)

  const todas = vivos('tasks').filter(t => t.areaId === a.id)
  const abiertas = todas.filter(t => t.status !== 'done')
  const gente = vivos('people').sort((x, y) => x.name.localeCompare(y.name, 'es'))

  let html = ''
  const grupos = gente.map(p => [p.name, abiertas.filter(t => t.personId === p.id)])
  grupos.push(['Sin destinatario', abiertas.filter(t => !t.personId || !busca('people', t.personId))])

  const conAlgo = grupos.filter(([, ts]) => ts.length)
  if (!conAlgo.length) {
    html += `<div class="vacio"><strong>Ninguna idea apuntada</strong>
      Añade regalos con el botón +. Las personas se crean en Ajustes.</div>`
  }
  for (const [nombre, ts] of conAlgo) {
    const total = ts.reduce((s, t) => s + (Number(t.price) || 0), 0)
    html += `<h2 class="sec">${esc(nombre)} · ${ts.length}${total ? ` · ${total.toFixed(2)} €` : ''}</h2>`
    html += listaTareas(ts.sort(ordenTareas))
  }

  const regalados = todas.filter(t => t.status === 'done').sort((x, y) => (y.doneAt || 0) - (x.doneAt || 0))
  if (regalados.length) html += `<h2 class="sec">Ya regalados · ${regalados.length}</h2>` +
    listaTareas(regalados.slice(0, 25))

  if (!gente.length) html += `<div class="botones"><button class="boton" data-gente="1">Crear personas</button></div>`

  const app = pinta(html)
  $('[data-editar]').onclick = () => ve('formArea', a.id)
  const g = app.querySelector('[data-gente]')
  if (g) g.onclick = () => ve('personas')
  ponFab(() => ve('nuevaTarea', { areaId: a.id }))
}

/* ---------- lista de la compra ---------- */

// Aquí completar no archiva por semanas: se acumularía basura. Se marca, se ve tachado
// al final y hay un botón para vaciar lo comprado de una vez.
function pintaCompras (a) {
  cabecera(`${a.icon || '🛒'} ${a.name}`, 'Lista de la compra',
    `<button class="icono" data-editar="1" aria-label="Editar área">✏️</button>`)

  const todas = vivos('tasks').filter(t => t.areaId === a.id)
  const abiertas = todas.filter(t => t.status !== 'done').sort(ordenTareas)
  const hechas = todas.filter(t => t.status === 'done').sort((x, y) => (y.doneAt || 0) - (x.doneAt || 0))

  // Agrupar por tienda ahorra el viaje de vuelta.
  const tiendas = new Map()
  for (const t of abiertas) {
    const k = t.store || ''
    if (!tiendas.has(k)) tiendas.set(k, [])
    tiendas.get(k).push(t)
  }

  let html = ''
  if (!abiertas.length && !hechas.length) {
    html += '<div class="vacio"><strong>Lista vacía</strong>Añade lo que falte con el botón +.</div>'
  }
  const claves = Array.from(tiendas.keys()).sort((x, y) => (x === '' ? 1 : y === '' ? -1 : x.localeCompare(y, 'es')))
  for (const k of claves) {
    if (claves.length > 1 || k) html += `<h2 class="sec">${esc(k || 'Sin tienda')} · ${tiendas.get(k).length}</h2>`
    html += listaTareas(tiendas.get(k))
  }
  if (hechas.length) {
    html += `<h2 class="sec">En el carro · ${hechas.length}</h2>` + listaTareas(hechas)
    html += `<div class="botones"><button class="boton peligro" id="c-vaciar">Vaciar lo comprado</button></div>`
  }

  const app = pinta(html)
  $('[data-editar]').onclick = () => ve('formArea', a.id)
  const v = app.querySelector('#c-vaciar')
  if (v) v.onclick = () => {
    if (!confirm(`¿Quitar ${hechas.length} artículo(s) ya comprados?`)) return
    for (const t of hechas) borra('tasks', t.id)
    trasCambio(null)
    status('Lista limpia.')
    dibuja()
  }
  ponFab(() => ve('nuevaTarea', { areaId: a.id }))
}

/* ---------- personas ---------- */

registra('personas', () => {
  cabecera('Personas', 'para las listas de regalos')
  const gente = vivos('people').sort((a, b) => a.name.localeCompare(b.name, 'es'))
  let html = `<label class="campo"><span>Añadir persona</span>
    <div style="display:flex;gap:8px"><input id="p-nombre" placeholder="Nombre">
    <button class="boton principal" id="p-add" style="width:auto;padding:0 18px">+</button></div></label>`
  html += gente.length
    ? '<div class="tarjeta">' + gente.map(p => {
      const n = pendientes().filter(t => t.personId === p.id).length
      return `<div class="fila" style="cursor:default"><span class="cuerpo">
        <span class="tit">${esc(p.name)}</span>
        <span class="meta">${n} idea(s) pendiente(s)</span></span>
        <button class="boton peligro" data-borrar="${esc(p.id)}" style="width:44px;flex:0 0 44px">✕</button></div>`
    }).join('') + '</div>'
    : '<div class="vacio">Todavía no hay nadie.</div>'

  const app = pinta(html)
  const add = () => {
    const name = $('#p-nombre').value.trim()
    if (!name) { status('Escribe un nombre.', true); return }
    if (gente.some(p => p.name.toLowerCase() === name.toLowerCase())) { status('Ya está en la lista.', true); return }
    upsert('people', { id: uid(), name })
    trasCambio(null)
    dibuja()
  }
  $('#p-add').onclick = add
  $('#p-nombre').onkeydown = e => { if (e.key === 'Enter') add() }
  app.querySelectorAll('[data-borrar]').forEach(b => {
    b.onclick = () => {
      const p = busca('people', b.dataset.borrar)
      if (!confirm(`¿Borrar a ${p.name}? Sus ideas de regalo se quedan sin destinatario.`)) return
      borra('people', p.id)
      trasCambio(null)
      dibuja()
    }
  })
})
