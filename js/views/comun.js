'use strict'

// Pintado compartido de tareas. Home, área, módulo, regalos y compras enseñan la misma
// fila; si se toca aquí, cambia en todas a la vez.

function etiquetasFecha (t) {
  const out = []
  const d = diasHasta(t.due)
  if (d !== null) {
    if (d < 0) out.push(`<span class="etq tarde">${-d} d de retraso</span>`)
    else if (d === 0) out.push('<span class="etq hoy">hoy</span>')
    else if (d === 1) out.push('<span class="etq">mañana</span>')
    else out.push(`<span class="etq">${esc(fmtFecha(t.due))}</span>`)
  }
  if (t.repeat) out.push(`<span class="etq per">${esc(fmtPeriodo(t.repeat))}</span>`)
  if (t.priority === 2) out.push('<span class="etq pri2">urgente</span>')
  if (recordatorioViejo(t)) out.push('<span class="etq tarde">📅 desfasado</span>')
  else if (recordatorioPuesto(t)) out.push('<span class="etq">📅</span>')
  if ((t.photos || []).length) out.push(`<span class="etq">📷 ${t.photos.length}</span>`)
  return out.join('')
}

function metaTarea (t, conRuta) {
  const partes = []
  if (conRuta) { const r = rutaDe(t); if (r) partes.push(esc(r)) }
  const area = busca('areas', t.areaId)
  if (area && area.kind === 'gifts' && t.personId) {
    const p = busca('people', t.personId)
    if (p) partes.push('para ' + esc(p.name))
  }
  if (t.price) partes.push(esc(t.price) + ' €')
  if (t.qty) partes.push('x' + esc(t.qty))
  if (t.store) partes.push(esc(t.store))
  return partes.join(' · ')
}

function filaTarea (t, opts = {}) {
  const et = etiquetasFecha(t)
  const meta = metaTarea(t, opts.ruta)
  return `<button class="fila ${t.status === 'done' ? 'hecha' : ''}" data-tarea="${esc(t.id)}">
    <span class="check" data-check="${esc(t.id)}" role="checkbox"
      aria-pressed="${t.status === 'done'}" aria-label="Completar">✓</span>
    <span class="cuerpo">
      <span class="tit">${esc(t.title)}</span>
      ${meta ? `<span class="meta">${meta}</span>` : ''}
      ${et ? `<span class="meta">${et}</span>` : ''}
    </span>
  </button>`
}

const listaTareas = (ts, opts) => ts.length
  ? `<div class="tarjeta">${ts.map(t => filaTarea(t, opts)).join('')}</div>`
  : ''

// Los botones se cablean después de escribir el HTML. El check para y no deja que el
// toque llegue a la fila, que abriría la ficha.
function conecta (cont) {
  cont.querySelectorAll('[data-check]').forEach(el => {
    el.onclick = ev => {
      ev.stopPropagation()
      const t = busca('tasks', el.dataset.check)
      if (!t) return
      if (t.status === 'done') { reabre(t); dibuja(); return }
      // Una tarea periódica o con fotos merece anotar qué se hizo; el resto se marca y ya.
      if (t.repeat || (t.log || []).length) ve('completar', t.id)
      else { completa(t); trasCambio(t); dibuja() }
    }
  })
  cont.querySelectorAll('[data-tarea]').forEach(el => {
    el.onclick = () => ve('tarea', el.dataset.tarea)
  })
  cont.querySelectorAll('[data-ir]').forEach(el => {
    el.onclick = () => ve(el.dataset.ir, el.dataset.arg || null)
  })
}

// Un cambio en una tarea toca dos cosas más: la carpeta y el resumen que lee el service
// worker para avisar. Ninguna debe tumbar el guardado, que ya está hecho en el dispositivo.
function trasCambio () {
  guardaResumenParaSW()
  sincroniza(false)
}

function pinta (html) {
  const app = $('#app')
  app.innerHTML = html
  conecta(app)
  return app
}
