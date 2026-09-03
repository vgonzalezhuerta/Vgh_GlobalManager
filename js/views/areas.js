'use strict'

const KINDS = {
  tasks: 'Tareas y mantenimiento',
  gifts: 'Regalos por persona',
  shopping: 'Lista de la compra'
}

// Cuántas tareas pendientes cuelgan de un área, contando todos los niveles.
const cuentaArea = id => pendientes().filter(t => t.areaId === id).length

registra('areas', () => {
  cabecera('Áreas')
  const as = vivos('areas').sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, 'es'))
  let html = ''
  if (!as.length) {
    html = `<div class="vacio"><strong>Aún no hay áreas</strong>
      Un área es el cajón grande: Casa, Coche, Regalos, Trabajo…</div>`
  } else {
    html = '<div class="tarjeta">' + as.map(a => {
      const n = cuentaArea(a.id)
      return `<button class="fila" data-ir="area" data-arg="${esc(a.id)}">
        <span class="emoji">${esc(a.icon || '📁')}</span>
        <span class="cuerpo"><span class="tit">${esc(a.name)}</span>
        <span class="meta">${esc(KINDS[a.kind] || KINDS.tasks)}</span></span>
        ${n ? `<span class="cuenta">${n}</span>` : ''}
      </button>`
    }).join('') + '</div>'
  }
  pinta(html)
  ponFab(() => ve('formArea', null))
})

registra('area', id => {
  const a = busca('areas', id)
  if (!a) { status('Esa área ya no existe.', true); atras(); return }
  if (a.kind === 'gifts') return pintaRegalos(a)
  if (a.kind === 'shopping') return pintaCompras(a)

  cabecera(`${a.icon || '📁'} ${a.name}`, KINDS[a.kind] || KINDS.tasks,
    `<button class="icono" data-editar="1" aria-label="Editar área">✏️</button>`)

  const proys = proyectosDe(id).sort((x, y) => (x.order || 0) - (y.order || 0) || x.name.localeCompare(y.name, 'es'))
  const directas = tareasDe(id, null, null)
  const hechas = vivos('tasks').filter(t => t.areaId === id && t.status === 'done').sort(ordenTareas)

  let html = ''
  if (proys.length) {
    html += '<h2 class="sec">Proyectos</h2><div class="tarjeta">' + proys.map(p => {
      const n = pendientes().filter(t => t.projectId === p.id).length
      return `<button class="fila" data-ir="proyecto" data-arg="${esc(p.id)}">
        <span class="emoji">🗂️</span>
        <span class="cuerpo"><span class="tit">${esc(p.name)}</span>
        ${p.notes ? `<span class="meta">${esc(p.notes)}</span>` : ''}</span>
        ${n ? `<span class="cuenta">${n}</span>` : ''}</button>`
    }).join('') + '</div>'
  }

  // No toda área necesita proyectos: las tareas pueden colgar directamente de aquí.
  if (directas.length) html += `<h2 class="sec">${proys.length ? 'Tareas del área' : 'Tareas'}</h2>` + listaTareas(directas)
  if (!proys.length && !directas.length && !hechas.length) {
    html += `<div class="vacio"><strong>Área vacía</strong>
      Añade tareas directamente, o agrúpalas en proyectos si son muchas.</div>`
  }
  if (hechas.length) {
    html += `<h2 class="sec">Hechas · ${hechas.length}</h2>` + listaTareas(hechas.slice(0, 20), { ruta: true })
  }
  html += `<div class="botones"><button class="boton" data-nuevoproy="1">+ Proyecto</button></div>`

  const app = pinta(html)
  app.querySelector('[data-nuevoproy]').onclick = () => ve('formProyecto', { areaId: id })
  $('[data-editar]').onclick = () => ve('formArea', id)
  ponFab(() => ve('nuevaTarea', { areaId: id }))
})

registra('proyecto', id => {
  const p = busca('projects', id)
  if (!p) { status('Ese proyecto ya no existe.', true); atras(); return }
  const a = busca('areas', p.areaId)
  cabecera(p.name, a ? a.name : '',
    `<button class="icono" data-editar="1" aria-label="Editar proyecto">✏️</button>`)

  const mods = modulosDe(id).sort((x, y) => (x.order || 0) - (y.order || 0) || x.name.localeCompare(y.name, 'es'))
  const directas = tareasDe(p.areaId, id, null)

  let html = p.notes ? `<div class="tarjeta"><div class="fila" style="cursor:default"><span class="cuerpo">${esc(p.notes)}</span></div></div>` : ''
  if (mods.length) {
    html += '<h2 class="sec">Módulos</h2><div class="tarjeta">' + mods.map(m => {
      const n = pendientes().filter(t => t.moduleId === m.id).length
      return `<button class="fila" data-ir="modulo" data-arg="${esc(m.id)}">
        <span class="emoji">🔧</span>
        <span class="cuerpo"><span class="tit">${esc(m.name)}</span>
        ${m.notes ? `<span class="meta">${esc(m.notes)}</span>` : ''}</span>
        ${n ? `<span class="cuenta">${n}</span>` : ''}</button>`
    }).join('') + '</div>'
  }
  if (directas.length) html += `<h2 class="sec">${mods.length ? 'Tareas del proyecto' : 'Tareas'}</h2>` + listaTareas(directas)
  if (!mods.length && !directas.length) {
    html += `<div class="vacio"><strong>Proyecto vacío</strong>
      Añade tareas, o divídelo en módulos si tiene partes con vida propia.</div>`
  }
  html += `<div class="botones"><button class="boton" data-nuevomod="1">+ Módulo</button></div>`

  const app = pinta(html)
  app.querySelector('[data-nuevomod]').onclick = () => ve('formModulo', { areaId: p.areaId, projectId: id })
  $('[data-editar]').onclick = () => ve('formProyecto', { id })
  ponFab(() => ve('nuevaTarea', { areaId: p.areaId, projectId: id }))
})

registra('modulo', id => {
  const m = busca('modules', id)
  if (!m) { status('Ese módulo ya no existe.', true); atras(); return }
  const p = busca('projects', m.projectId)
  cabecera(m.name, p ? p.name : '',
    `<button class="icono" data-editar="1" aria-label="Editar módulo">✏️</button>`)

  const ts = tareasDe(m.areaId, m.projectId, id)
  const hechas = vivos('tasks').filter(t => t.moduleId === id && t.status === 'done').sort(ordenTareas)
  let html = m.notes ? `<div class="tarjeta"><div class="fila" style="cursor:default"><span class="cuerpo">${esc(m.notes)}</span></div></div>` : ''
  html += ts.length ? listaTareas(ts) : '<div class="vacio"><strong>Sin tareas</strong>Añade la primera con el botón +.</div>'
  if (hechas.length) html += `<h2 class="sec">Hechas · ${hechas.length}</h2>` + listaTareas(hechas.slice(0, 20))

  pinta(html)
  $('[data-editar]').onclick = () => ve('formModulo', { id })
  ponFab(() => ve('nuevaTarea', { areaId: m.areaId, projectId: m.projectId, moduleId: id }))
})

/* ---------- formularios de la jerarquía ---------- */

const ICONOS = ['🏠', '🚗', '🎁', '🛒', '💼', '🌱', '🐕', '🏥', '💰', '📚', '✈️', '🔧', '🎸', '📁']

registra('formArea', id => {
  const a = id ? busca('areas', id) : null
  cabecera(a ? 'Editar área' : 'Nueva área')
  pinta(`
    <label class="campo"><span>Nombre</span>
      <input id="f-nombre" value="${esc(a ? a.name : '')}" placeholder="Casa, Coche, Regalos…"></label>
    <label class="campo"><span>Icono</span>
      <select id="f-icono">${ICONOS.map(i =>
        `<option ${a && a.icon === i ? 'selected' : ''}>${i}</option>`).join('')}</select></label>
    <label class="campo"><span>Tipo</span>
      <select id="f-kind">${Object.entries(KINDS).map(([k, v]) =>
        `<option value="${k}" ${a && a.kind === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
    <p class="pista">El tipo cambia el formulario y la lista: los regalos se agrupan por persona
      y las compras se marcan y se vacían de golpe.</p>
    <div class="botones">
      <button class="boton principal" id="f-ok">Guardar</button>
      ${a ? '<button class="boton peligro" id="f-borrar">Borrar</button>' : ''}
    </div>`)

  $('#f-ok').onclick = () => {
    const name = $('#f-nombre').value.trim()
    if (!name) { status('El área necesita un nombre.', true); return }
    const obj = a || { id: uid(), order: vivos('areas').length }
    Object.assign(obj, { name, icon: $('#f-icono').value, kind: $('#f-kind').value })
    upsert('areas', obj)
    trasCambio()
    atras()
  }
  if (a) $('#f-borrar').onclick = () => borraRama('areas', a, `¿Borrar «${a.name}» con todo lo que contiene?`)
})

registra('formProyecto', arg => {
  const p = arg.id ? busca('projects', arg.id) : null
  const areaId = p ? p.areaId : arg.areaId
  cabecera(p ? 'Editar proyecto' : 'Nuevo proyecto')
  pinta(`
    <label class="campo"><span>Nombre</span>
      <input id="f-nombre" value="${esc(p ? p.name : '')}" placeholder="Caldera, Reforma baño…"></label>
    <label class="campo"><span>Notas</span>
      <textarea id="f-notas" placeholder="Datos que conviene tener a mano">${esc(p ? p.notes : '')}</textarea></label>
    <div class="botones">
      <button class="boton principal" id="f-ok">Guardar</button>
      ${p ? '<button class="boton peligro" id="f-borrar">Borrar</button>' : ''}
    </div>`)

  $('#f-ok').onclick = () => {
    const name = $('#f-nombre').value.trim()
    if (!name) { status('El proyecto necesita un nombre.', true); return }
    const obj = p || { id: uid(), areaId, order: proyectosDe(areaId).length }
    Object.assign(obj, { name, notes: $('#f-notas').value.trim() })
    upsert('projects', obj)
    trasCambio()
    atras()
  }
  if (p) $('#f-borrar').onclick = () => borraRama('projects', p, `¿Borrar el proyecto «${p.name}» con sus módulos y tareas?`)
})

registra('formModulo', arg => {
  const m = arg.id ? busca('modules', arg.id) : null
  const areaId = m ? m.areaId : arg.areaId
  const projectId = m ? m.projectId : arg.projectId
  cabecera(m ? 'Editar módulo' : 'Nuevo módulo')
  pinta(`
    <label class="campo"><span>Nombre</span>
      <input id="f-nombre" value="${esc(m ? m.name : '')}" placeholder="Quemador, Circuito de agua…"></label>
    <label class="campo"><span>Notas</span>
      <textarea id="f-notas" placeholder="Modelo, referencias, medidas…">${esc(m ? m.notes : '')}</textarea></label>
    <div class="botones">
      <button class="boton principal" id="f-ok">Guardar</button>
      ${m ? '<button class="boton peligro" id="f-borrar">Borrar</button>' : ''}
    </div>`)

  $('#f-ok').onclick = () => {
    const name = $('#f-nombre').value.trim()
    if (!name) { status('El módulo necesita un nombre.', true); return }
    const obj = m || { id: uid(), areaId, projectId, order: modulosDe(projectId).length }
    Object.assign(obj, { name, notes: $('#f-notas').value.trim() })
    upsert('modules', obj)
    trasCambio()
    atras()
  }
  if (m) $('#f-borrar').onclick = () => borraRama('modules', m, `¿Borrar el módulo «${m.name}» y sus tareas?`)
})

// Borrar un área o un proyecto sin arrastrar lo que cuelga de él dejaría tareas
// huérfanas invisibles pero contando en el archivo.
function borraRama (col, obj, pregunta) {
  if (!confirm(pregunta)) return
  // Los eventos que el usuario guardó en Google Calendar se quedan ahí: la app no puede
  // borrarlos, así que al menos hay que decirlo.
  const proys = col === 'areas' ? proyectosDe(obj.id) : col === 'projects' ? [obj] : []
  const mods = col === 'modules' ? [obj] : proys.flatMap(p => modulosDe(p.id))
  const tareas = vivos('tasks').filter(t =>
    (col === 'areas' && t.areaId === obj.id) ||
    (col === 'projects' && t.projectId === obj.id) ||
    (col === 'modules' && t.moduleId === obj.id))

  for (const t of tareas) borra('tasks', t.id)
  for (const m of mods) borra('modules', m.id)
  if (col === 'areas') for (const p of proys) borra('projects', p.id)
  borra(col, obj.id)
  trasCambio()
  status('Borrado.')
  // La pantalla de la que veníamos ya no existe: se vuelve a la raíz de áreas.
  PILA = [{ nombre: 'areas', arg: null }]
  sincronizaHistorial()
  dibuja()
}
