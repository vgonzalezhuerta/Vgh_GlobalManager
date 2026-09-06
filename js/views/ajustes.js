'use strict'

registra('ajustes', () => {
  cabecera('Ajustes')
  const faltan = sinRecordatorio().length
  pinta(`
    <h2 class="sec">Carpeta de datos</h2>
    ${hayCarpeta()
      ? `<div class="tarjeta"><div class="fila" style="cursor:default"><span class="cuerpo">
          <span class="tit">Carpeta conectada</span>
          <span class="meta">${SYNC.ultima
            ? 'Último guardado: ' + esc(fmtFechaHora(SYNC.ultima)) + (SYNC.sucio ? ' · hay cambios sin volcar' : '')
            : 'Todavía no se ha guardado nada.'}</span></span></div></div>`
      : `<p class="pista">Sin carpeta, los datos solo están en este dispositivo.</p>`}
    <div class="botones">
      <button class="boton principal" id="a-carpeta">${hayCarpeta() ? 'Cambiar carpeta' : 'Elegir carpeta'}</button>
      <button class="boton" id="a-sync">Guardar ahora</button>
    </div>
    ${hayCarpeta() ? '<div class="botones"><button class="boton peligro" id="a-olvidar">Olvidar la carpeta</button></div>' : ''}
    <p class="pista">Elige la carpeta de Google Drive: en el móvil, la que monta el proveedor de
      archivos del sistema; en Windows, la de Google Drive para escritorio. Quien sincroniza es
      Drive, no la app. Usa la misma carpeta en los dos sitios.</p>

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
    <div class="botones">
      <button class="boton" id="a-ics">Exportar todo a .ics</button>
      ${faltan ? `<button class="boton" id="a-icsfaltan">Solo los ${faltan} que faltan</button>` : ''}
    </div>
    <p class="pista">El .ics se abre con Google Calendar y mete todos los eventos de una vez.
      Es la forma rápida de poner al día el calendario sin ir tarea por tarea.</p>

    <div class="linea">
      <input type="checkbox" id="a-notif" ${avisosOn() ? 'checked' : ''}>
      <span>Avisar de lo vencido al abrir la app</span>
    </div>
    <p class="pista">La web no puede lanzar un aviso a una hora concreta con la app cerrada, ni
      escribir en el calendario del móvil: eso lo hacen las apps nativas con un permiso de Android
      que a una página no se le da. Por eso el aviso de verdad es el evento de Google Calendar.</p>

    <h2 class="sec">Datos</h2>
    <div class="botones">
      <button class="boton" id="a-exporta">Exportar JSON</button>
      <button class="boton" id="a-importa">Importar JSON</button>
    </div>
    <p class="pista">${vivos('areas').length} áreas · ${vivos('projects').length} proyectos ·
      ${vivos('modules').length} módulos · ${pendientes().length} tareas pendientes ·
      ${vivos('people').length} personas</p>
    <div class="botones"><button class="boton" id="a-personas">Personas</button></div>

    <h2 class="sec">Aplicación</h2>
    ${estaInstalada()
      ? '<p class="pista">Está funcionando como app instalada.</p>'
      : promptInstalar
        ? `<div class="botones"><button class="boton principal" id="a-instalar">Instalar en este dispositivo</button></div>`
        : `<p class="pista">Chrome todavía no ofrece instalar esta página. Abajo está el porqué.</p>`}
    <div class="botones">
      <button class="boton" id="a-buscar">Buscar actualizaciones</button>
      ${hayNueva ? '<button class="boton principal" id="a-aplicar">Actualizar ahora</button>' : ''}
    </div>
    <p class="pista">Versión instalada: <span id="version">…</span>${
      ultimaBusqueda() ? ' · comprobado el ' + esc(fmtFechaHora(ultimaBusqueda())) : ''}${
      hayNueva ? ' · hay una versión nueva descargada, esperando a que la apliques' : ''}</p>

    <h2 class="sec">Diagnóstico de instalación</h2>
    <div id="a-diag"><p class="pista">Comprobando…</p></div>`)

  $('#a-carpeta').onclick = async () => {
    if (await eligeCarpeta()) { await revisaDormida(); dibuja() }
  }
  $('#a-sync').onclick = () => sincroniza(true).then(dibuja)
  const olv = $('#a-olvidar')
  if (olv) olv.onclick = async () => {
    if (!confirm('¿Olvidar la carpeta? Los datos siguen en ella y en este dispositivo; solo se deja de escribir ahí.')) return
    await olvidaCarpeta()
    await revisaDormida()
    pintaSync('off')
    status('Carpeta olvidada.')
    dibuja()
  }

  $('#a-hora').onchange = e => setHoraDefecto(e.target.value)
  $('#a-aviso').onchange = e => setAvisoDefecto(Number(e.target.value))

  $('#a-ics').onclick = () => {
    const n = descargaIcs(pendientes(), `globalmanager-${hoyISO()}.ics`)
    if (n) status(`${n} evento(s) en el archivo. Ábrelo con Google Calendar.`)
  }
  const icsf = $('#a-icsfaltan')
  if (icsf) icsf.onclick = () => {
    const cuales = sinRecordatorio()
    const n = descargaIcs(cuales, `globalmanager-pendientes-${hoyISO()}.ics`)
    if (!n) return
    // Se dan por puestos: la app no puede comprobar si el usuario llegó a importarlos,
    // pero dejarlos marcados como pendientes para siempre sería peor.
    for (const t of cuales) marcaRecordatorio(t)
    trasCambio()
    status(`${n} evento(s) en el archivo. Ábrelo con Google Calendar.`)
    dibuja()
  }

  $('#a-notif').onchange = async e => {
    if (e.target.checked) e.target.checked = await pidePermisoAvisos()
    else localStorage.setItem('gm_avisos', '0')
  }

  $('#a-personas').onclick = () => ve('personas')

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
        trasCambio()
        dibuja()
      } catch (e) { status('No se pudo importar: ' + e.message, true) }
    }
    inp.click()
  }

  const inst = $('#a-instalar')
  if (inst) inst.onclick = instala
  $('#a-buscar').onclick = buscaActualizacion
  const apl = $('#a-aplicar')
  if (apl) apl.onclick = aplicaActualizacion

  // El diagnóstico lee el manifiesto y el registro del service worker, así que llega
  // después de pintar.
  diagnostico().then(lineas => {
    const cont = $('#a-diag')
    if (!cont) return
    cont.innerHTML = '<div class="tarjeta">' + lineas.map(([que, ok, detalle]) =>
      `<div class="fila" style="cursor:default">
        <span class="emoji">${ok ? '✅' : '⚠️'}</span>
        <span class="cuerpo"><span class="tit">${esc(que)}</span>
        <span class="meta">${esc(detalle)}</span></span></div>`).join('') + '</div>'
  }).catch(e => {
    const cont = $('#a-diag')
    if (cont) cont.innerHTML = `<p class="pista">No se pudo completar el diagnóstico: ${esc(e.message)}</p>`
  })

  pintaVersion()
})
