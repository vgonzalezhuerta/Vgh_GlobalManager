'use strict'

// La Entrada es la bandeja de lo apuntado deprisa. Su único trabajo es vaciarse, así que
// lo que tiene que ser rápido aquí no es completar tareas, es clasificarlas.
let seleccion = new Set()
let modoSeleccion = false

registra('entrada', () => {
  const ts = entrada()
  const n = seleccion.size
  cabecera('Entrada', ts.length ? `${ts.length} sin clasificar` : 'vacía',
    ts.length ? `<button class="icono" id="e-modo" aria-label="Seleccionar">${modoSeleccion ? '✕' : '☑'}</button>` : '')

  let html = ''
  if (!ts.length) {
    html = `<div class="vacio"><strong>Entrada vacía</strong>
      Lo que apuntes deprisa desde Hoy aparece aquí hasta que le des un sitio.</div>`
  } else if (modoSeleccion) {
    html = '<div class="tarjeta">' + ts.map(t => `
      <button class="fila" data-sel="${esc(t.id)}">
        <span class="check" aria-pressed="${seleccion.has(t.id)}">✓</span>
        <span class="cuerpo"><span class="tit">${esc(t.title)}</span>
        ${t.due ? `<span class="meta">${etiquetasFecha(t)}</span>` : ''}</span>
      </button>`).join('') + '</div>'
    html += `<div class="botones">
      <button class="boton" id="e-todas">${n === ts.length ? 'Ninguna' : 'Todas'}</button>
      <button class="boton principal" id="e-mover" ${n ? '' : 'disabled'}>Mover${n ? ` (${n})` : ''}</button>
    </div>`
  } else {
    // Fuera del modo selección, cada fila lleva su propio botón de clasificar: para una
    // tarea suelta, entrar en modo selección sobra.
    html = '<div class="tarjeta">' + ts.map(t => `
      <div class="fila" style="cursor:default">
        <span class="check" data-check="${esc(t.id)}" role="checkbox" aria-pressed="false" aria-label="Completar">✓</span>
        <button class="cuerpo" data-tarea="${esc(t.id)}"
          style="border:0;background:none;color:inherit;font:inherit;text-align:left;padding:0">
          <span class="tit">${esc(t.title)}</span>
          ${t.due ? `<span class="meta">${etiquetasFecha(t)}</span>` : ''}
        </button>
        <button class="boton" data-mover="${esc(t.id)}" style="width:44px;flex:0 0 44px;padding:6px"
          aria-label="Clasificar">📥</button>
      </div>`).join('') + '</div>'
    html += '<p class="pista">📥 clasifica una tarea. Con ☑ arriba puedes mover varias de golpe.</p>'
  }

  const app = pinta(html)
  const modo = $('#e-modo')
  if (modo) modo.onclick = () => { modoSeleccion = !modoSeleccion; seleccion.clear(); dibuja() }

  app.querySelectorAll('[data-mover]').forEach(b => {
    b.onclick = ev => { ev.stopPropagation(); ve('mover', { ids: [b.dataset.mover] }) }
  })
  app.querySelectorAll('[data-sel]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.sel
      if (seleccion.has(id)) seleccion.delete(id); else seleccion.add(id)
      dibuja()
    }
  })
  const todas = $('#e-todas')
  if (todas) todas.onclick = () => {
    if (seleccion.size === ts.length) seleccion.clear()
    else for (const t of ts) seleccion.add(t.id)
    dibuja()
  }
  const mover = $('#e-mover')
  if (mover) mover.onclick = () => { if (seleccion.size) ve('mover', { ids: Array.from(seleccion) }) }

  ponFab(() => ve('nuevaTarea', {}))
})

/* ---------- elegir destino ---------- */

registra('mover', arg => {
  const ids = arg.ids || []
  const tareas = ids.map(id => busca('tasks', id)).filter(Boolean)
  if (!tareas.length) { status('Esas tareas ya no existen.', true); atras(); return }

  cabecera(tareas.length === 1 ? 'Mover tarea' : `Mover ${tareas.length} tareas`,
    tareas.length === 1 ? tareas[0].title : '')

  const ds = destinos()
  const uno = tareas.length === 1 ? tareas[0] : null
  // La sangría dibuja el árbol sin tener que pintarlo de verdad: área, proyecto, módulo.
  const html = '<div class="tarjeta">' + ds.map((d, i) => {
    const aqui = uno && mismoSitio(uno, d.destino)
    return `<button class="fila" data-dest="${i}" ${aqui ? 'disabled style="opacity:.5"' : ''}>
      <span class="emoji" style="margin-left:${d.nivel * 18}px">${d.icono}</span>
      <span class="cuerpo"><span class="tit">${esc(d.etiqueta)}</span>
      ${aqui ? '<span class="meta">está aquí ahora</span>' : ''}</span>
    </button>`
  }).join('') + '</div>'

  const app = pinta(html + `<p class="pista">Mover no cambia la fecha, ni el historial, ni el
    recordatorio: solo dónde cuelga la tarea.</p>`)

  app.querySelectorAll('[data-dest]').forEach(b => {
    b.onclick = () => {
      const d = ds[Number(b.dataset.dest)]
      const n = reasigna(ids, d.destino)
      trasCambio()
      seleccion.clear()
      modoSeleccion = false
      status(n === 1 ? `Movida a ${d.etiqueta.split(' · ')[0]}.` : `${n} tareas movidas a ${d.etiqueta.split(' · ')[0]}.`)
      atras()
    }
  })
})
