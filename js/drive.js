'use strict'

// Con el permiso `drive.file` la app solo ve los archivos que ella misma ha creado.
// Eso basta y evita pedir acceso a todo el Drive: la carpeta se busca y se crea una
// vez, y desde cualquier dispositivo con el mismo id de cliente se vuelve a encontrar.
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

let carpetaId = null

async function carpeta (interactivo) {
  if (carpetaId) return carpetaId
  const guardada = localStorage.getItem('gm_carpeta')
  if (guardada) {
    // Puede haber sido borrada desde Drive; si no responde, se crea otra.
    try {
      const m = await gjson(`${API}/files/${guardada}?fields=id,trashed`, {}, interactivo)
      if (!m.trashed) { carpetaId = m.id; return carpetaId }
    } catch (e) {}
  }
  const q = encodeURIComponent(`name='${CFG.CARPETA}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const lista = await gjson(`${API}/files?q=${q}&fields=files(id,name)&pageSize=10`, {}, interactivo)
  if (lista.files && lista.files.length) carpetaId = lista.files[0].id
  else {
    const nueva = await gjson(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: CFG.CARPETA, mimeType: 'application/vnd.google-apps.folder' })
    }, interactivo)
    carpetaId = nueva.id
  }
  localStorage.setItem('gm_carpeta', carpetaId)
  return carpetaId
}

async function archivoModelo (interactivo) {
  if (SYNC.fileId) return SYNC.fileId
  const dir = await carpeta(interactivo)
  const q = encodeURIComponent(`name='${CFG.ARCHIVO}' and '${dir}' in parents and trashed=false`)
  const lista = await gjson(`${API}/files?q=${q}&fields=files(id,version)&pageSize=10`, {}, interactivo)
  if (lista.files && lista.files.length) {
    SYNC.fileId = lista.files[0].id
    return SYNC.fileId
  }
  return null
}

async function versionRemota (id, interactivo) {
  const m = await gjson(`${API}/files/${id}?fields=version,modifiedTime`, {}, interactivo)
  return m.version
}

async function bajaModelo (id, interactivo) {
  const r = await gfetch(`${API}/files/${id}?alt=media`, {}, interactivo)
  return r.json()
}

function multipart (meta, blob) {
  const lim = '=-=' + uid()
  const cuerpo = new Blob([
    `--${lim}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(meta),
    `\r\n--${lim}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${lim}--\r\n`
  ])
  return { cuerpo, tipo: `multipart/related; boundary=${lim}` }
}

async function creaArchivo (nombre, blob, interactivo) {
  const dir = await carpeta(interactivo)
  const { cuerpo, tipo } = multipart({ name: nombre, parents: [dir] }, blob)
  return gjson(`${UPLOAD}/files?uploadType=multipart&fields=id,version,name`, {
    method: 'POST', headers: { 'Content-Type': tipo }, body: cuerpo
  }, interactivo)
}

async function sobrescribe (id, blob, interactivo) {
  return gjson(`${UPLOAD}/files/${id}?uploadType=media&fields=id,version`, {
    method: 'PATCH', headers: { 'Content-Type': blob.type || 'application/json' }, body: blob
  }, interactivo)
}

/* ---------- sincronización del modelo ---------- */

let sincronizando = false

// Bajar, fusionar y subir en una sola pasada. Antes de subir se comprueba la versión
// del archivo: si otro dispositivo escribió entretanto, se vuelve a fusionar en vez de
// pisar sus cambios.
async function sincroniza (interactivo = false) {
  if (sincronizando) return
  if (!clientId()) { if (interactivo) status('Falta el id de cliente OAuth. Ponlo en Ajustes.', true); return }
  if (!navigator.onLine) { if (interactivo) status('Sin conexión: los cambios se subirán al volver.', true); return }
  sincronizando = true
  pintaSync('sync')
  try {
    let id = await archivoModelo(interactivo)

    if (id) {
      const v = await versionRemota(id, interactivo)
      // Si la versión no ha cambiado y no hay nada pendiente, no se toca nada.
      if (String(v) !== String(SYNC.version)) {
        const remoto = await bajaModelo(id, interactivo)
        S = normaliza(fusiona(S, normaliza(remoto)))
      } else if (!SYNC.sucio) {
        SYNC.ultima = ahora()
        guardaLocal()
        pintaSync('ok')
        return
      }
      const vAntes = await versionRemota(id, interactivo)
      if (String(vAntes) !== String(v)) {
        // Ha escrito alguien mientras fusionábamos: nos quedamos con lo suyo también.
        S = normaliza(fusiona(S, normaliza(await bajaModelo(id, interactivo))))
      }
      const res = await sobrescribe(id, blobModelo(), interactivo)
      SYNC.version = res.version
    } else {
      const res = await creaArchivo(CFG.ARCHIVO, blobModelo(), interactivo)
      SYNC.fileId = res.id
      SYNC.version = res.version
    }

    SYNC.sucio = false
    SYNC.ultima = ahora()
    guardaLocal()
    await subePendientes(interactivo)
    pintaSync('ok')
    if (interactivo) status('Sincronizado con Google Drive.')
    if (typeof repinta === 'function') repinta()
  } catch (e) {
    pintaSync('error')
    status('No se pudo sincronizar: ' + e.message, true)
  } finally {
    sincronizando = false
  }
}

const blobModelo = () => new Blob([JSON.stringify(S)], { type: 'application/json' })

/* ---------- fotos ---------- */

// Las fotos hechas sin conexión se quedan en IndexedDB y se suben cuando se pueda.
// La tarea las referencia por su clave local hasta que tienen id de Drive.
async function guardaFotoPendiente (clave, blob) {
  await idbSet('subidas', clave, blob)
}

async function subePendientes (interactivo) {
  const claves = await idbKeys('subidas')
  if (!claves.length) return
  await enCola(claves, CFG.MAX_PARALELO, async clave => {
    const blob = await idbGet('subidas', clave)
    if (!blob) { await idbDel('subidas', clave); return }
    const res = await reintenta(() => creaArchivo(clave, blob, interactivo))
    // Cambiar la clave local por el id de Drive en todas las tareas que la citen.
    for (const t of S.tasks) {
      let cambio = false
      for (const f of (t.photos || [])) if (f.local === clave) { f.fileId = res.id; delete f.local; cambio = true }
      for (const l of (t.log || [])) for (const f of (l.photos || [])) if (f.local === clave) { f.fileId = res.id; delete f.local; cambio = true }
      if (cambio) { t.updatedAt = ahora(); SYNC.sucio = true }
    }
    await idbDel('subidas', clave)
    await idbSet('thumbs', res.id, await idbGet('thumbs', clave))
    await idbDel('thumbs', clave)
  })
  guardaLocal()
  if (SYNC.sucio && SYNC.fileId) {
    const res = await sobrescribe(SYNC.fileId, blobModelo(), interactivo)
    SYNC.version = res.version
    SYNC.sucio = false
    guardaLocal()
  }
}

async function bajaFoto (fileId) {
  const r = await gfetch(`${API}/files/${fileId}?alt=media`, {}, false)
  return r.blob()
}

function pintaSync (estado) {
  const el = $('#sync')
  if (!el) return
  el.dataset.estado = estado
  el.title = { sync: 'Sincronizando…', ok: 'Al día', error: 'Error al sincronizar', off: 'Sin conectar' }[estado] || ''
}
