'use strict'

registra('ajustes', () => {
  cabecera('Ajustes')
  const t = pendientes().length
  const conectada = !!clientId()
  pinta(`
    <h2 class="sec">Google</h2>
    <label class="campo"><span>Id de cliente OAuth</span>
      <input id="a-cid" value="${esc(clientId())}" placeholder="…apps.googleusercontent.com"
        autocapitalize="off" autocorrect="off" spellcheck="false"></label>
    <p class="pista">Se guarda solo en este dispositivo. Cómo obtenerlo, en el README del repo.</p>
    <div class="botones">
      <button class="boton principal" id="a-guardar">Guardar id</button>
      <button class="boton" id="a-conectar">${conectada ? 'Conectar ahora' : 'Conectar'}</button>
    </div>
    <div class="botones">
      <button class="boton" id="a-sync">Sincronizar</button>
      <button class="boton peligro" id="a-salir">Desconectar</button>
    </div>
    <p class="pista">${SYNC.ultima
      ? 'Última sincronización: ' + esc(fmtFechaHora(SYNC.ultima)) + (SYNC.sucio ? ' · hay cambios sin subir' : '')
      : 'Todavía no se ha sincronizado.'}</p>

    <h2 class="sec">Recordatorios</h2>
    <div class="dos">
      <label class="campo"><span>Hora por defecto</span>
        <input id="a-hora" type="time" value="${esc(horaDefecto())}"></label>
      <label class="campo"><span>Avisar antes</span>
        <select id="a-aviso">${[
          [0, 'a la hora'], [30, '30 min'], [120, '2 h'], [540, '9 h'], [1440, '1 día'], [2880, '2 días']
        ].map(([m, l]) => `<option value="${m}" ${avisoDefecto() === m ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select></label>
    </div>
    <div class="linea">
      <input type="checkbox" id="a-notif" ${avisosOn() ? 'checked' : ''}>
      <span>Avisar de lo vencido al abrir la app</span>
    </div>
    <p class="pista">La web no puede lanzar un aviso a una hora concreta con la app cerrada.
      Para eso está el recordatorio de Google Calendar, que sí suena con el móvil guardado.</p>
    ${sinRecordatorio().length ? `<div class="banda">Hay ${sinRecordatorio().length} tarea(s) marcada(s)
      para Calendar sin evento creado, de cuando no había conexión o id de cliente.
      <button class="boton" id="a-recordatorios">Crear los que faltan</button></div>` : ''}

    <h2 class="sec">Datos</h2>
    <div class="botones">
      <button class="boton" id="a-exporta">Exportar JSON</button>
      <button class="boton" id="a-importa">Importar JSON</button>
    </div>
    <p class="pista">${vivos('areas').length} áreas · ${vivos('projects').length} proyectos ·
      ${vivos('modules').length} módulos · ${t} tareas pendientes · ${vivos('people').length} personas</p>
    <div class="botones"><button class="boton" id="a-personas">Personas</button></div>

    <h2 class="sec">Acerca de</h2>
    <p class="pista">GlobalManager · versión <span id="version">…</span></p>`)

  $('#a-guardar').onclick = () => {
    setClientId($('#a-cid').value)
    localStorage.removeItem('gm_carpeta')
    status(clientId() ? 'Id guardado. Pulsa Conectar.' : 'Id borrado: la app queda en modo local.')
    dibuja()
  }
  // El diálogo de Google solo se puede abrir desde un toque del usuario; de ahí que
  // conectar sea un botón y no algo que pase en el arranque.
  $('#a-conectar').onclick = async () => {
    try {
      await accessToken(true)
      status('Conectado con Google.')
      await sincroniza(true)
      dibuja()
    } catch (e) { status(e.message, true) }
  }
  $('#a-sync').onclick = () => sincroniza(true).then(dibuja)
  $('#a-salir').onclick = () => {
    desconecta()
    pintaSync('off')
    status('Desconectado. Los datos siguen en este dispositivo.')
    dibuja()
  }

  $('#a-hora').onchange = e => setHoraDefecto(e.target.value)
  $('#a-aviso').onchange = e => setAvisoDefecto(Number(e.target.value))
  $('#a-notif').onchange = async e => {
    if (e.target.checked) {
      const ok = await pidePermisoAvisos()
      e.target.checked = ok
    } else localStorage.setItem('gm_avisos', '0')
  }

  $('#a-personas').onclick = () => ve('personas')
  const rec = $('#a-recordatorios')
  if (rec) rec.onclick = () => creaRecordatoriosPendientes().then(dibuja)

  $('#a-exporta').onclick = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }))
    a.download = `globalmanager-${hoyISO()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }
  $('#a-importa').onclick = () => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'application/json,.json'
    inp.onchange = async () => {
      const f = inp.files[0]
      if (!f) return
      try {
        const j = JSON.parse(await f.text())
        if (!Array.isArray(j.tasks) && !Array.isArray(j.areas)) throw new Error('No parece un archivo de GlobalManager.')
        // Se fusiona, no se sustituye: importar no debe borrar lo que ya hay.
        S = normaliza(fusiona(S, normaliza(j)))
        SYNC.sucio = true
        guardaLocal()
        status('Importado y fusionado.')
        trasCambio(null)
        dibuja()
      } catch (e) { status('No se pudo importar: ' + e.message, true) }
    }
    inp.click()
  }

  pintaVersion()
})
