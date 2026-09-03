'use strict'

// Los datos van a una carpeta que elige el usuario, leída con la File System Access API.
// En Android es la carpeta de Google Drive que monta el proveedor de archivos del
// sistema; en Windows, la unidad de Drive para escritorio. Quien sincroniza es el propio
// Drive: la app solo lee y escribe archivos. Es el mismo mecanismo de Bitácora.
let rootHandle = null
let sincronizando = false
// Chrome falla si se abren dos selectores a la vez.
let pickerBusy = false

const haySelector = () => typeof window.showDirectoryPicker === 'function'
const hayCarpeta = () => !!rootHandle

async function permiso (h, pedir) {
  const o = { mode: 'readwrite' }
  try {
    if ((await h.queryPermission(o)) === 'granted') return true
    // Volver a pedirlo abre un diálogo, y eso exige un gesto del usuario: por eso al
    // arrancar solo se consulta, y reconectar es un botón.
    if (!pedir) return false
    return (await h.requestPermission(o)) === 'granted'
  } catch (e) { return false }
}

async function eligeCarpeta () {
  if (!haySelector()) {
    status('Este navegador no deja elegir carpetas. Usa Chrome, o exporta e importa el JSON a mano.', true)
    return false
  }
  if (pickerBusy) return false
  pickerBusy = true
  try {
    const h = await window.showDirectoryPicker({ id: 'globalmanager', mode: 'readwrite' })
    if (!await permiso(h, true)) { status('No has dado permiso de escritura sobre la carpeta.', true); return false }
    rootHandle = h
    await idbSet('meta', 'root', h)
    await sincroniza(true)
    return true
  } catch (e) {
    if (e.name !== 'AbortError') status('No se pudo abrir la carpeta: ' + e.message, true)
    return false
  } finally { pickerBusy = false }
}

// `pedir` distingue el arranque (solo consulta) del toque del usuario (puede preguntar).
async function reconectaCarpeta (pedir) {
  if (rootHandle) return true
  let h
  try { h = await idbGet('meta', 'root') } catch (e) { return false }
  if (!h) return false
  if (!await permiso(h, pedir)) return false
  rootHandle = h
  return true
}

// Hay carpeta recordada pero el navegador quiere que el usuario confirme otra vez.
async function carpetaDormida () {
  if (rootHandle) return false
  try {
    const h = await idbGet('meta', 'root')
    return !!h
  } catch (e) { return false }
}

async function olvidaCarpeta () {
  rootHandle = null
  SYNC.mtime = null
  await idbDel('meta', 'root')
}

/* ---------- archivos ---------- */

async function leeArchivo (nombre) {
  const fh = await rootHandle.getFileHandle(nombre)
  return fh.getFile()
}

async function escribeArchivo (nombre, blob) {
  const fh = await rootHandle.getFileHandle(nombre, { create: true })
  const w = await fh.createWritable()
  await w.write(blob)
  await w.close()
  return (await fh.getFile()).lastModified
}

const blobModelo = () => new Blob([JSON.stringify(S)], { type: 'application/json' })

/* ---------- sincronización ---------- */

// Leer, fusionar y escribir. `mtime` recuerda la última versión que vimos: si el archivo
// cambió, es que ha escrito el otro dispositivo y hay que fusionar antes de pisarlo.
async function sincroniza (interactivo = false) {
  if (sincronizando) return
  if (!await reconectaCarpeta(interactivo)) {
    pintaSync(await carpetaDormida() ? 'error' : 'off')
    if (interactivo) status('Elige la carpeta en Ajustes.', true)
    return
  }
  sincronizando = true
  pintaSync('sync')
  try {
    let texto = null
    let f = null
    try {
      f = await leeArchivo(CFG.ARCHIVO)
      if (f.lastModified !== SYNC.mtime) texto = await f.text()
    } catch (e) {
      // Todavía no existe: es la primera vez que se usa esta carpeta.
      if (e.name !== 'NotFoundError') throw e
    }

    if (texto) {
      let remoto
      try { remoto = JSON.parse(texto) } catch (e) {
        throw new Error('El global.json de la carpeta está corrupto. Haz una copia y bórralo para empezar de nuevo.')
      }
      S = normaliza(fusiona(S, normaliza(remoto)))
    }

    // Solo se escribe si el resultado difiere de lo que hay: reescribir por reescribir
    // hace que Drive vuelva a subir el archivo en todos los dispositivos.
    const salida = JSON.stringify(S)
    if (!f || SYNC.sucio || (texto !== null && salida !== texto)) {
      SYNC.mtime = await escribeArchivo(CFG.ARCHIVO, new Blob([salida], { type: 'application/json' }))
    } else if (f) {
      SYNC.mtime = f.lastModified
    }

    SYNC.sucio = false
    SYNC.ultima = ahora()
    guardaLocal()
    await volcaFotosPendientes()
    pintaSync('ok')
    if (interactivo) status('Guardado en la carpeta.')
    if (typeof repinta === 'function') repinta()
  } catch (e) {
    pintaSync('error')
    status('No se pudo guardar en la carpeta: ' + e.message, true)
  } finally {
    sincronizando = false
  }
}

/* ---------- fotos ---------- */

// Una foto hecha sin la carpeta a mano espera en IndexedDB con el nombre que tendrá.
async function volcaFotosPendientes () {
  const nombres = await idbKeys('subidas')
  if (!nombres.length) return
  await enCola(nombres, CFG.MAX_PARALELO, async n => {
    const blob = await idbGet('subidas', n)
    if (!blob) { await idbDel('subidas', n); return }
    await reintenta(() => escribeArchivo(n, blob))
    await idbDel('subidas', n)
  })
}

async function leeFoto (nombre) {
  const pendiente = await idbGet('subidas', nombre)
  if (pendiente) return pendiente
  if (!await reconectaCarpeta(false)) return null
  try { return await leeArchivo(nombre) } catch (e) { return null }
}

function pintaSync (estado) {
  const el = $('#sync')
  if (!el) return
  el.dataset.estado = estado
  el.title = {
    sync: 'Guardando…', ok: 'Al día', error: 'La carpeta no responde', off: 'Sin carpeta elegida'
  }[estado] || ''
}
