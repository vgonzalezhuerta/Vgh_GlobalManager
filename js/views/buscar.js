'use strict'

// Con muchas áreas y módulos, encontrar «el filtro ese» por el árbol es lento. Busca en
// título, descripción, datos de referencia y notas del historial.
registra('buscar', () => {
  cabecera('Buscar')
  const app = $('#app')
  app.innerHTML = `<label class="campo">
      <input id="b-q" placeholder="filtro, regalo, revisión…" autocomplete="off"></label>
    <div class="linea"><input type="checkbox" id="b-hechas"><span>Incluir hechas</span></div>
    <div id="b-res"></div>`

  const inp = $('#b-q')
  const busca_ = () => {
    const q = sinTildes(inp.value.trim())
    const cont = $('#b-res')
    if (q.length < 2) {
      cont.innerHTML = '<p class="pista">Escribe al menos dos letras.</p>'
      return
    }
    const conHechas = $('#b-hechas').checked
    const res = vivos('tasks').filter(t => {
      if (!conHechas && t.status === 'done') return false
      const bruto = [t.title, t.desc, rutaDe(t),
        (t.fields || []).map(f => f.k + ' ' + f.v).join(' '),
        (t.log || []).map(l => l.note).join(' ')].join(' ')
      const heno = sinTildes(bruto)
      return q.split(/\s+/).every(p => heno.includes(p))
    }).sort(ordenTareas).slice(0, 60)

    cont.innerHTML = res.length
      ? `<h2 class="sec">${res.length} resultado(s)</h2>` + listaTareas(res, { ruta: true })
      : '<div class="vacio">Nada coincide.</div>'
    conecta(cont)
  }

  inp.oninput = debounce(busca_, 180)
  $('#b-hechas').onchange = busca_
  busca_()
  inp.focus()
})
