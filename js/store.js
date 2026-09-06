'use strict'

// El modelo entero vive en memoria y se persiste en IndexedDB tras cada cambio.
// Drive es solo el punto de encuentro entre dispositivos: la app funciona sin él.
const COLS = ['areas', 'projects', 'modules', 'people', 'tasks']

const vacio = () => ({
  schemaVersion: CFG.SCHEMA,
  areas: [], projects: [], modules: [], people: [], tasks: []
})

let S = vacio()
// Estado de sincronización: la fecha del archivo que leímos y si hay cambios sin volcar.
let SYNC = { mtime: null, sucio: false, ultima: null }

/* ---------- IndexedDB ---------- */

let _db
function db () {
  if (_db) return _db
  _db = new Promise((ok, err) => {
    const r = indexedDB.open('globalmanager', 1)
    r.onupgradeneeded = () => {
      const d = r.result
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta')
      if (!d.objectStoreNames.contains('thumbs')) d.createObjectStore('thumbs')
      if (!d.objectStoreNames.contains('subidas')) d.createObjectStore('subidas')
    }
    r.onsuccess = () => ok(r.result)
    r.onerror = () => err(r.error)
  })
  return _db
}

async function idbGet (store, k) {
  const d = await db()
  return new Promise((ok, err) => {
    const r = d.transaction(store).objectStore(store).get(k)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => err(r.error)
  })
}

async function idbSet (store, k, v) {
  const d = await db()
  return new Promise((ok, err) => {
    const t = d.transaction(store, 'readwrite')
    t.objectStore(store).put(v, k)
    t.oncomplete = () => ok()
    t.onerror = () => err(t.error)
  })
}

async function idbDel (store, k) {
  const d = await db()
  return new Promise((ok, err) => {
    const t = d.transaction(store, 'readwrite')
    t.objectStore(store).delete(k)
    t.oncomplete = () => ok()
    t.onerror = () => err(t.error)
  })
}

async function idbKeys (store) {
  const d = await db()
  return new Promise((ok, err) => {
    const r = d.transaction(store).objectStore(store).getAllKeys()
    r.onsuccess = () => ok(r.result)
    r.onerror = () => err(r.error)
  })
}

/* ---------- persistencia local ---------- */

async function cargaLocal () {
  try {
    const m = await idbGet('meta', 'modelo')
    if (m) S = normaliza(m)
    const s = await idbGet('meta', 'sync')
    if (s) SYNC = Object.assign(SYNC, s)
  } catch (e) {
    status('No se pudo leer la copia local. Se arranca en blanco.', true)
  }
}

const guardaLocal = debounce(async () => {
  try {
    await idbSet('meta', 'modelo', S)
    await idbSet('meta', 'sync', SYNC)
  } catch (e) {
    status('No se pudo guardar en el dispositivo: ' + e.message, true)
  }
}, 250)

function normaliza (m) {
  const out = vacio()
  out.schemaVersion = m.schemaVersion || CFG.SCHEMA
  for (const c of COLS) out[c] = Array.isArray(m[c]) ? m[c] : []
  return out
}

/* ---------- escritura del modelo ---------- */

function toca (obj) {
  obj.updatedAt = ahora()
  return obj
}

function upsert (col, obj) {
  toca(obj)
  const arr = S[col]
  const i = arr.findIndex(x => x.id === obj.id)
  if (i < 0) arr.push(obj); else arr[i] = obj
  SYNC.sucio = true
  guardaLocal()
  return obj
}

// Se marca borrado en vez de quitarlo: si no, al fusionar con otro dispositivo
// el registro volvería a aparecer.
function borra (col, id) {
  const x = S[col].find(o => o.id === id)
  if (!x) return
  x.deleted = true
  toca(x)
  SYNC.sucio = true
  guardaLocal()
}

const vivos = col => S[col].filter(x => !x.deleted)
const busca = (col, id) => S[col].find(x => x.id === id && !x.deleted)

/* ---------- fusión entre dispositivos ---------- */

// Unión por id quedándose con la versión más reciente de cada registro.
// Es el único criterio posible sin servidor, y con una app personal basta:
// dos dispositivos rara vez tocan la misma tarea en el mismo minuto.
function fusiona (local, remoto) {
  const out = vacio()
  out.schemaVersion = Math.max(local.schemaVersion || 1, remoto.schemaVersion || 1)
  for (const c of COLS) {
    const mapa = new Map()
    for (const x of (remoto[c] || [])) mapa.set(x.id, x)
    for (const x of (local[c] || [])) {
      const y = mapa.get(x.id)
      if (!y || (x.updatedAt || 0) >= (y.updatedAt || 0)) mapa.set(x.id, x)
    }
    out[c] = Array.from(mapa.values())
  }
  return out
}

/* ---------- consultas ---------- */

const proyectosDe = areaId => vivos('projects').filter(p => p.areaId === areaId)
const modulosDe = projectId => vivos('modules').filter(m => m.projectId === projectId)

// Las tareas llevan siempre areaId, y proyecto y módulo opcionales. Así «todas las
// tareas de un área» es un filtro plano sin importar a qué nivel estén colgadas.
function tareasDe (areaId, projectId, moduleId, opts = {}) {
  let t = vivos('tasks').filter(x => x.areaId === areaId)
  if (projectId !== undefined) t = t.filter(x => (x.projectId || null) === (projectId || null))
  if (moduleId !== undefined) t = t.filter(x => (x.moduleId || null) === (moduleId || null))
  if (!opts.hechas) t = t.filter(x => x.status !== 'done')
  return t.sort(ordenTareas)
}

// Sin fecha al final: hay tareas que no la tienen y no deben empujar a las que sí.
function ordenTareas (a, b) {
  if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1
  if (!a.due && !b.due) return (b.priority || 0) - (a.priority || 0) || a.title.localeCompare(b.title, 'es')
  if (!a.due) return 1
  if (!b.due) return -1
  return a.due < b.due ? -1 : a.due > b.due ? 1 : (b.priority || 0) - (a.priority || 0)
}

const pendientes = () => vivos('tasks').filter(t => t.status !== 'done')

// Sin área = sin clasificar. Apuntar primero y decidir después es la única forma de que
// capturar una tarea no cueste más que la propia tarea.
const entrada = () => pendientes().filter(t => !t.areaId).sort(ordenTareas)

// Vencidas y de hoy, que es lo que se avisa.
function paraAvisar () {
  return pendientes().filter(t => t.due && diasHasta(t.due) <= 0).sort(ordenTareas)
}

function proximas (dias = 14) {
  return pendientes().filter(t => {
    const d = diasHasta(t.due)
    return d !== null && d > 0 && d <= dias
  }).sort(ordenTareas)
}

const sinFecha = () => pendientes().filter(t => !t.due && t.areaId).sort(ordenTareas)

function rutaDe (t) {
  if (!t.areaId) return 'Entrada'
  const a = busca('areas', t.areaId)
  const p = t.projectId && busca('projects', t.projectId)
  const m = t.moduleId && busca('modules', t.moduleId)
  return [a && a.name, p && p.name, m && m.name].filter(Boolean).join(' · ')
}

/* ---------- completar una tarea ---------- */

// Al completar una tarea periódica no se archiva: se anota en el historial y se
// recoloca la fecha. `from: 'done'` cuenta desde hoy, que es lo que hace falta en
// mantenimiento («cada 6 meses desde la última vez»), no desde la fecha prevista.
function completa (t, nota, fotos) {
  const entrada = { at: ahora(), note: nota || '', photos: fotos || [] }
  t.log = t.log || []
  t.log.unshift(entrada)
  t.lastDoneAt = entrada.at

  if (t.repeat && t.repeat.n > 0) {
    const base = t.repeat.from === 'done' ? hoyISO() : (t.due || hoyISO())
    let prox = sumaISO(base, t.repeat.n, t.repeat.unit)
    // Con `from: 'due'` y una tarea muy atrasada, sumar una vez deja la próxima
    // en el pasado: hay que avanzar hasta pasar de hoy.
    let vueltas = 0
    while (diasHasta(prox) < 0 && vueltas++ < 200) prox = sumaISO(prox, t.repeat.n, t.repeat.unit)
    t.due = prox
    t.status = 'open'
    t.doneAt = null
  } else {
    t.status = 'done'
    t.doneAt = entrada.at
  }
  upsert('tasks', t)
  return t
}

function reabre (t) {
  t.status = 'open'
  t.doneAt = null
  upsert('tasks', t)
}

/* ---------- captura rápida y reasignación ---------- */

// Lo mínimo para no perder la idea: un título. Todo lo demás se rellena al clasificarla.
function anadeRapida (titulo, extra = {}) {
  const t = Object.assign({
    id: uid(),
    areaId: extra.areaId || null,
    projectId: extra.projectId || null,
    moduleId: extra.moduleId || null,
    title: titulo.trim(),
    desc: extra.desc || '',
    due: extra.due || null,
    time: null,
    repeat: null,
    status: 'open',
    priority: 0,
    fields: [],
    photos: [],
    log: [],
    calendarPuesto: null,
    calendarSello: null
  }, extra.url ? { url: extra.url } : {})
  upsert('tasks', t)
  return t
}

// Mover no toca nada más de la tarea: ni fechas, ni historial, ni el recordatorio, que
// sigue siendo válido porque el evento no depende de dónde esté colgada.
function reasigna (ids, destino) {
  let n = 0
  for (const id of ids) {
    const t = busca('tasks', id)
    if (!t) continue
    t.areaId = destino.areaId || null
    t.projectId = destino.projectId || null
    t.moduleId = destino.moduleId || null
    upsert('tasks', t)
    n++
  }
  return n
}

// Todos los sitios donde puede colgar una tarea, aplanados para poder elegir de un toque.
function destinos () {
  const out = [{ etiqueta: 'Entrada · sin clasificar', nivel: 0, icono: '📥', destino: {} }]
  for (const a of vivos('areas').sort((x, y) => (x.order || 0) - (y.order || 0))) {
    out.push({ etiqueta: a.name, nivel: 0, icono: a.icon || '📁', destino: { areaId: a.id } })
    for (const p of proyectosDe(a.id)) {
      out.push({ etiqueta: p.name, nivel: 1, icono: '🗂️', destino: { areaId: a.id, projectId: p.id } })
      for (const m of modulosDe(p.id)) {
        out.push({ etiqueta: m.name, nivel: 2, icono: '🔧', destino: { areaId: a.id, projectId: p.id, moduleId: m.id } })
      }
    }
  }
  return out
}

const mismoSitio = (t, d) => (t.areaId || null) === (d.areaId || null) &&
  (t.projectId || null) === (d.projectId || null) &&
  (t.moduleId || null) === (d.moduleId || null)

/* ---------- semillas ---------- */

// Un usuario nuevo con la pantalla vacía no sabe por dónde empezar; estas tres
// áreas son justo los casos que pidió y se pueden borrar.
function siembra () {
  if (S.areas.length) return
  const base = { updatedAt: ahora() }
  S.areas.push(
    Object.assign({ id: uid(), name: 'Casa', icon: '🏠', color: '#3f7d5c', kind: 'tasks', order: 0 }, base),
    Object.assign({ id: uid(), name: 'Regalos', icon: '🎁', color: '#9a4f6d', kind: 'gifts', order: 1 }, base),
    Object.assign({ id: uid(), name: 'Compras', icon: '🛒', color: '#c07a2c', kind: 'shopping', order: 2 }, base)
  )
  SYNC.sucio = true
  guardaLocal()
}
