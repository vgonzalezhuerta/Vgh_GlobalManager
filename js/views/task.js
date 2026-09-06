'use strict'

/* ---------- ficha ---------- */

registra('tarea', id => {
  const t = busca('tasks', id)
  if (!t) { status('Esa tarea ya no existe.', true); atras(); return }
  const area = busca('areas', t.areaId)
  cabecera(t.title, rutaDe(t), `<button class="icono" data-editar="1" aria-label="Editar">✏️</button>`)

  const et = etiquetasFecha(t)
  let html = `<div class="tarjeta"><div class="fila" style="cursor:default"><span class="cuerpo">
    ${et ? `<span class="meta">${et}</span>` : '<span class="meta">Sin fecha</span>'}
    ${t.status === 'done' && t.doneAt ? `<span class="meta">Hecha el ${esc(fmtFechaHora(t.doneAt))}</span>` : ''}
    ${t.lastDoneAt && t.status !== 'done' ? `<span class="meta">Última vez: ${esc(fmtFechaHora(t.lastDoneAt))}</span>` : ''}
  </span></div></div>`

  if (t.desc) html += `<h2 class="sec">Descripción</h2><div class="tarjeta"><div class="fila" style="cursor:default">
    <span class="cuerpo" style="white-space:pre-wrap">${esc(t.desc)}</span></div></div>`

  // Los datos de referencia y el historial son cosas distintas: el modelo del filtro no
  // cambia, y cuándo se cambió sí. Separarlos es lo que hace útil una tarea de mantenimiento.
  if ((t.fields || []).length) {
    html += '<h2 class="sec">Datos</h2><div class="tarjeta">' + t.fields.map(f =>
      `<div class="fila" style="cursor:default"><span class="cuerpo">
        <span class="meta">${esc(f.k)}</span><span class="tit">${esc(f.v)}</span></span></div>`).join('') + '</div>'
  }

  if (area && area.kind === 'gifts') {
    const p = t.personId && busca('people', t.personId)
    const ex = []
    if (p) ex.push(['Para', p.name])
    if (t.price) ex.push(['Precio', t.price + ' €'])
    if (ex.length) html += '<h2 class="sec">Regalo</h2><div class="tarjeta">' + ex.map(([k, v]) =>
      `<div class="fila" style="cursor:default"><span class="cuerpo"><span class="meta">${esc(k)}</span>
      <span class="tit">${esc(v)}</span></span></div>`).join('') + '</div>'
    if (t.url) html += `<div class="botones"><a class="boton" href="${esc(t.url)}" target="_blank" rel="noopener">Abrir enlace</a></div>`
  }

  if ((t.photos || []).length) {
    html += '<h2 class="sec">Fotos</h2><div class="fotos" id="fotos-ficha">' +
      t.photos.map((f, i) => `<div class="foto" data-i="${i}"></div>`).join('') + '</div>'
  }

  if ((t.log || []).length) {
    html += `<h2 class="sec">Historial · ${t.log.length}</h2><ul class="log">` + t.log.map(l => `<li>
      <div class="cuando">${esc(fmtFechaHora(l.at))}</div>
      ${l.note ? `<div style="white-space:pre-wrap">${esc(l.note)}</div>` : '<div class="cuando">Hecha</div>'}
      ${(l.photos || []).length ? `<div class="fotos" style="margin-top:6px" data-log="${l.at}">${
        l.photos.map((f, i) => `<div class="foto" data-i="${i}"></div>`).join('')}</div>` : ''}
    </li>`).join('') + '</ul>'
  }

  if (t.due && t.status !== 'done') {
    html += '<h2 class="sec">Recordatorio</h2>'
    if (recordatorioViejo(t)) {
      html += `<div class="banda">La fecha o la periodicidad han cambiado desde que creaste el
        recordatorio. Añade el nuevo y borra el viejo en Google Calendar: la app no puede
        tocar un evento que ya está en tu calendario.
        <button class="boton" id="t-cal">Añadir el nuevo</button></div>`
    } else if (recordatorioPuesto(t)) {
      html += `<div class="tarjeta"><div class="fila" style="cursor:default"><span class="cuerpo">
        <span class="tit">Añadido a Google Calendar</span>
        <span class="meta">${esc(fmtFechaHora(t.calendarPuesto))}</span></span></div></div>
        <div class="botones"><button class="boton" id="t-cal">Volver a añadir</button>
        <button class="boton" id="t-ics">Descargar .ics</button></div>`
    } else {
      html += `<div class="botones"><button class="boton principal" id="t-cal">Añadir a Google Calendar</button>
        <button class="boton" id="t-ics">.ics</button></div>
        <p class="pista">Se abre Google Calendar con el evento ya montado; solo tienes que guardarlo.</p>`
    }
  }

  html += `<div class="botones">
    ${t.status === 'done'
      ? '<button class="boton" id="t-reabrir">Reabrir</button>'
      : '<button class="boton principal" id="t-hecha">Marcar como hecha</button>'}
    <button class="boton" id="t-mover">Mover</button></div>
    <div class="botones"><button class="boton peligro" id="t-borrar">Borrar</button></div>`

  const app = pinta(html)
  $('[data-editar]').onclick = () => ve('formTarea', { id })

  const cont = app.querySelector('#fotos-ficha')
  if (cont) cont.querySelectorAll('.foto').forEach(el => {
    const f = t.photos[Number(el.dataset.i)]
    observaFoto(el, f)
    el.onclick = () => abreLightbox(t.photos, Number(el.dataset.i))
  })
  app.querySelectorAll('[data-log]').forEach(g => {
    const l = t.log.find(x => String(x.at) === g.dataset.log)
    g.querySelectorAll('.foto').forEach(el => {
      const f = l.photos[Number(el.dataset.i)]
      observaFoto(el, f)
      el.onclick = () => abreLightbox(l.photos, Number(el.dataset.i))
    })
  })

  app.querySelector('#t-mover').onclick = () => ve('mover', { ids: [t.id] })

  const cal = app.querySelector('#t-cal')
  if (cal) cal.onclick = () => { abreCalendario(t); dibuja() }
  const cics = app.querySelector('#t-ics')
  if (cics) cics.onclick = () => {
    descargaIcs([t], `${t.title.replace(/[^\wáéíóúñÁÉÍÓÚÑ ]+/g, '').slice(0, 40) || 'tarea'}.ics`)
    marcaRecordatorio(t)
    trasCambio()
    dibuja()
  }

  if (t.status === 'done') app.querySelector('#t-reabrir').onclick = () => { reabre(t); trasCambio(); dibuja() }
  else app.querySelector('#t-hecha').onclick = () => ve('completar', t.id)

  app.querySelector('#t-borrar').onclick = () => {
    const aviso = recordatorioPuesto(t) || recordatorioViejo(t)
      ? `¿Borrar «${t.title}»? El evento que creaste en Google Calendar hay que borrarlo allí.`
      : `¿Borrar «${t.title}»?`
    if (!confirm(aviso)) return
    borra('tasks', t.id)
    trasCambio()
    status('Tarea borrada.')
    atras()
  }
})

/* ---------- completar ---------- */

registra('completar', id => {
  const t = busca('tasks', id)
  if (!t) { atras(); return }
  cabecera('Completar', t.title)
  let fotos = []
  pinta(`
    <label class="campo"><span>¿Qué se ha hecho? (opcional)</span>
      <textarea id="c-nota" placeholder="Filtro cambiado, referencia XYZ-12, comprado en…"></textarea></label>
    <label class="campo"><span>Fotos del antes/después (opcional)</span></label>
    <div class="fotos" id="c-fotos"><div class="foto mas" id="c-mas">＋</div></div>
    ${t.repeat ? `<p class="pista">Es periódica (${esc(fmtPeriodo(t.repeat))}): no se archiva,
      se recoloca la próxima fecha y esto queda en el historial.</p>` : ''}
    <div class="botones"><button class="boton principal" id="c-ok">Hecha</button>
      <button class="boton" id="c-cancel">Cancelar</button></div>`)

  const pintaFotos = () => {
    const g = $('#c-fotos')
    g.innerHTML = fotos.map((f, i) =>
      `<div class="foto" data-i="${i}"><button class="quita" data-q="${i}">✕</button></div>`).join('') +
      '<div class="foto mas" id="c-mas">＋</div>'
    g.querySelectorAll('.foto[data-i]').forEach(el => observaFoto(el, fotos[Number(el.dataset.i)]))
    g.querySelectorAll('[data-q]').forEach(b => {
      b.onclick = ev => { ev.stopPropagation(); fotos.splice(Number(b.dataset.q), 1); pintaFotos() }
    })
    $('#c-mas').onclick = anade
  }
  const anade = async () => {
    try {
      const fs = await pideFoto()
      for (const f of fs) fotos.push(await anadeFoto(f))
      pintaFotos()
    } catch (e) { status('No se pudo añadir la foto: ' + e.message, true) }
  }
  $('#c-mas').onclick = anade

  $('#c-ok').onclick = () => {
    completa(t, $('#c-nota').value.trim(), fotos)
    trasCambio()
    status(t.repeat ? `Hecha. Próxima: ${fmtFecha(t.due)}.` : 'Hecha.')
    atras()
  }
  $('#c-cancel').onclick = atras
})

/* ---------- formulario ---------- */

registra('nuevaTarea', arg => formularioTarea({ nuevo: true, ctx: arg || {} }))
registra('formTarea', arg => formularioTarea({ id: arg.id }))

function formularioTarea (opts) {
  const t = opts.id ? busca('tasks', opts.id) : null
  if (opts.id && !t) { atras(); return }

  const ctx = opts.ctx || {}
  // Sin área es un destino válido, no un error: la tarea se queda en la Entrada.
  let areaId = t ? (t.areaId || '') : (ctx.areaId || '')
  let projectId = t ? (t.projectId || '') : (ctx.projectId || '')
  let moduleId = t ? (t.moduleId || '') : (ctx.moduleId || '')
  let fotos = t ? (t.photos || []).slice() : []
  let campos = t ? (t.fields || []).slice() : []
  const rep = t && t.repeat ? Object.assign({}, t.repeat) : null

  cabecera(t ? 'Editar tarea' : 'Nueva tarea')

  const app = $('#app')
  const dibujaForm = () => {
    const area = busca('areas', areaId) || {}
    const kind = area.kind || 'tasks'
    const proys = proyectosDe(areaId)
    const mods = projectId ? modulosDe(projectId) : []
    const gente = vivos('people').sort((a, b) => a.name.localeCompare(b.name, 'es'))

    app.innerHTML = `
      <label class="campo"><span>Título</span>
        <input id="f-tit" value="${esc(t ? t.title : '')}" placeholder="Cambiar filtro de la caldera"></label>

      <label class="campo"><span>Área</span>
        <select id="f-area">
          <option value="" ${!areaId ? 'selected' : ''}>📥 Entrada · sin clasificar</option>
          ${vivos('areas').map(a =>
            `<option value="${esc(a.id)}" ${a.id === areaId ? 'selected' : ''}>${esc(a.icon || '')} ${esc(a.name)}</option>`).join('')}
        </select></label>

      ${proys.length ? `<label class="campo"><span>Proyecto (opcional)</span>
        <select id="f-proy"><option value="">— directamente en el área —</option>
          ${proys.map(p => `<option value="${esc(p.id)}" ${p.id === projectId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select></label>` : ''}

      ${mods.length ? `<label class="campo"><span>Módulo (opcional)</span>
        <select id="f-mod"><option value="">— directamente en el proyecto —</option>
          ${mods.map(m => `<option value="${esc(m.id)}" ${m.id === moduleId ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
        </select></label>` : ''}

      ${kind === 'gifts' ? `<div class="dos">
        <label class="campo"><span>Para</span>
          <select id="f-persona"><option value="">— nadie —</option>
            ${gente.map(p => `<option value="${esc(p.id)}" ${t && t.personId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select></label>
        <label class="campo"><span>Precio (€)</span>
          <input id="f-precio" type="number" step="0.01" inputmode="decimal" value="${esc(t ? t.price : '')}"></label>
        </div>
        <label class="campo"><span>Enlace</span>
          <input id="f-url" type="url" inputmode="url" value="${esc(t ? t.url : '')}" placeholder="https://…"></label>
        <p class="pista">Las personas se crean en Ajustes.</p>` : ''}

      ${kind === 'shopping' ? `<div class="dos">
        <label class="campo"><span>Cantidad</span>
          <input id="f-qty" value="${esc(t ? t.qty : '')}" placeholder="2 kg, 3 uds"></label>
        <label class="campo"><span>Tienda</span>
          <input id="f-store" value="${esc(t ? t.store : '')}"></label></div>` : ''}

      <div class="dos">
        <label class="campo"><span>Fecha (opcional)</span>
          <input id="f-due" type="date" value="${esc(t ? t.due : '')}"></label>
        <label class="campo"><span>Hora</span>
          <input id="f-time" type="time" value="${esc(t && t.time ? t.time : horaDefecto())}"></label>
      </div>

      <label class="campo"><span>Periodicidad (opcional)</span></label>
      <div class="tres" style="margin-bottom:8px">
        <input id="f-rep-n" type="number" min="0" inputmode="numeric" value="${rep ? rep.n : ''}" placeholder="—">
        <select id="f-rep-u">${Object.entries(UNIDADES).map(([k, v]) =>
          `<option value="${k}" ${rep && rep.unit === k ? 'selected' : ''}>${esc(v[1])}</option>`).join('')}</select>
        <select id="f-rep-f">
          <option value="due" ${!rep || rep.from === 'due' ? 'selected' : ''}>desde la fecha</option>
          <option value="done" ${rep && rep.from === 'done' ? 'selected' : ''}>desde que se hace</option>
        </select>
      </div>
      <p class="pista">«Desde que se hace» es lo que quieres en mantenimiento: cada 6 meses
        contados desde la última vez, no desde la fecha que tocaba.</p>

      <label class="campo"><span>Prioridad</span>
        <select id="f-pri">
          <option value="0" ${!t || t.priority === 0 ? 'selected' : ''}>Normal</option>
          <option value="1" ${t && t.priority === 1 ? 'selected' : ''}>Alta</option>
          <option value="2" ${t && t.priority === 2 ? 'selected' : ''}>Urgente</option>
        </select></label>

      <label class="campo"><span>Descripción</span>
        <textarea id="f-desc" placeholder="Cómo se hace, dónde está, qué hace falta…">${esc(t ? t.desc : '')}</textarea></label>

      <label class="campo"><span>Datos de referencia</span></label>
      <div id="f-campos"></div>
      <button class="boton" id="f-mascampo" style="width:auto;padding:8px 14px">+ Dato</button>
      <p class="pista">Para lo que no cambia: modelo del filtro, referencia, medidas, presión.</p>

      <label class="campo" style="margin-top:14px"><span>Fotos</span></label>
      <div class="fotos" id="f-fotos"></div>

      <div class="botones"><button class="boton principal" id="f-ok">Guardar</button>
        <button class="boton" id="f-cancel">Cancelar</button></div>`

    // Cambiar de área invalida proyecto y módulo elegidos.
    $('#f-area').onchange = e => { areaId = e.target.value; projectId = ''; moduleId = ''; dibujaForm() }
    if ($('#f-proy')) $('#f-proy').onchange = e => { projectId = e.target.value; moduleId = ''; dibujaForm() }
    if ($('#f-mod')) $('#f-mod').onchange = e => { moduleId = e.target.value }

    pintaCampos()
    pintaFotos()
    $('#f-mascampo').onclick = () => { campos.push({ k: '', v: '' }); pintaCampos() }
    $('#f-ok').onclick = guarda
    $('#f-cancel').onclick = atras
  }

  function pintaCampos () {
    const g = $('#f-campos')
    g.innerHTML = campos.map((c, i) => `<div class="dos" style="margin-bottom:8px">
      <input data-k="${i}" value="${esc(c.k)}" placeholder="Modelo">
      <div style="display:flex;gap:6px">
        <input data-v="${i}" value="${esc(c.v)}" placeholder="XYZ-12">
        <button class="boton peligro" data-qc="${i}" style="width:44px;flex:0 0 44px">✕</button>
      </div></div>`).join('')
    g.querySelectorAll('[data-k]').forEach(el => { el.oninput = () => { campos[Number(el.dataset.k)].k = el.value } })
    g.querySelectorAll('[data-v]').forEach(el => { el.oninput = () => { campos[Number(el.dataset.v)].v = el.value } })
    g.querySelectorAll('[data-qc]').forEach(b => {
      b.onclick = () => { campos.splice(Number(b.dataset.qc), 1); pintaCampos() }
    })
  }

  function pintaFotos () {
    const g = $('#f-fotos')
    g.innerHTML = fotos.map((f, i) =>
      `<div class="foto" data-i="${i}"><button class="quita" data-q="${i}">✕</button></div>`).join('') +
      '<div class="foto mas" id="f-mas">＋</div>'
    g.querySelectorAll('.foto[data-i]').forEach(el => observaFoto(el, fotos[Number(el.dataset.i)]))
    g.querySelectorAll('[data-q]').forEach(b => {
      b.onclick = ev => { ev.stopPropagation(); fotos.splice(Number(b.dataset.q), 1); pintaFotos() }
    })
    $('#f-mas').onclick = async () => {
      try {
        const fs = await pideFoto()
        for (const f of fs) fotos.push(await anadeFoto(f))
        pintaFotos()
      } catch (e) { status('No se pudo añadir la foto: ' + e.message, true) }
    }
  }

  function guarda () {
    const title = $('#f-tit').value.trim()
    if (!title) { status('La tarea necesita un título.', true); return }
    const n = Number($('#f-rep-n').value)
    const due = $('#f-due').value || null
    const repeat = n > 0 ? { n, unit: $('#f-rep-u').value, from: $('#f-rep-f').value } : null
    if (repeat && !due) { status('Una tarea periódica necesita una primera fecha.', true); return }

    const obj = t || { id: uid(), status: 'open', log: [], calendarPuesto: null, calendarSello: null }
    Object.assign(obj, {
      areaId: areaId || null,
      projectId: projectId || null,
      moduleId: moduleId || null,
      title,
      desc: $('#f-desc').value.trim(),
      due,
      time: $('#f-time').value || null,
      repeat,
      priority: Number($('#f-pri').value) || 0,
      fields: campos.filter(c => c.k.trim() || c.v.trim()),
      photos: fotos
    })
    const kind = (busca('areas', areaId) || {}).kind
    if (kind === 'gifts') Object.assign(obj, {
      personId: ($('#f-persona') || {}).value || null,
      price: ($('#f-precio') || {}).value || null,
      url: ($('#f-url') || {}).value.trim() || null
    })
    if (kind === 'shopping') Object.assign(obj, {
      qty: ($('#f-qty') || {}).value.trim() || null,
      store: ($('#f-store') || {}).value.trim() || null
    })

    upsert('tasks', obj)
    trasCambio()
    status(obj.due && !recordatorioPuesto(obj)
      ? 'Guardada. Añade el recordatorio desde la ficha.' : 'Guardada.')
    atras()
  }

  dibujaForm()
  ponFab(null)
}
