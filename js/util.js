'use strict'

const $ = s => document.querySelector(s)
const $$ = s => Array.from(document.querySelectorAll(s))

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Nadie escribe tildes en el buscador del móvil, así que se comparan sin ellas.
const sinTildes = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
const ahora = () => Date.now()

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fmtFecha (iso) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES[m - 1]} ${a}`
}

function fmtFechaHora (ms) {
  const d = new Date(ms)
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Días desde hoy hasta la fecha ISO. Negativo si ya pasó.
function diasHasta (iso) {
  if (!iso) return null
  const [a, m, d] = iso.split('-').map(Number)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  return Math.round((new Date(a, m - 1, d) - hoy) / 86400000)
}

function sumaISO (iso, n, unidad) {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  if (unidad === 'day') f.setDate(f.getDate() + n)
  else if (unidad === 'week') f.setDate(f.getDate() + n * 7)
  else if (unidad === 'month') f.setMonth(f.getMonth() + n)
  else if (unidad === 'year') f.setFullYear(f.getFullYear() + n)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

const UNIDADES = { day: ['día', 'días'], week: ['semana', 'semanas'], month: ['mes', 'meses'], year: ['año', 'años'] }

function fmtPeriodo (rep) {
  if (!rep) return ''
  const [uno, varios] = UNIDADES[rep.unit] || ['', '']
  const cada = rep.n === 1 ? `cada ${uno}` : `cada ${rep.n} ${varios}`
  return rep.from === 'done' ? `${cada} desde que se hace` : cada
}

function debounce (fn, ms) {
  let t
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }
}

let statusT
function status (msg, error) {
  const el = $('#status')
  if (!el) return
  el.textContent = msg
  el.className = 'status visible' + (error ? ' error' : '')
  clearTimeout(statusT)
  if (!error) statusT = setTimeout(() => { el.className = 'status' }, 3200)
}

const limpiaStatus = () => { const el = $('#status'); if (el) el.className = 'status' }

// Lanza las tareas de n en n. Drive se atraganta con más.
async function enCola (items, n, fn) {
  const salida = []
  let i = 0
  const obreros = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const j = i++
      try { salida[j] = await fn(items[j], j) } catch (e) { salida[j] = null }
    }
  })
  await Promise.all(obreros)
  return salida
}

function reintenta (fn, veces = 3) {
  return (async () => {
    let ultimo
    for (let i = 0; i < veces; i++) {
      try { return await fn() } catch (e) {
        ultimo = e
        await new Promise(r => setTimeout(r, 400 * Math.pow(2, i)))
      }
    }
    throw ultimo
  })()
}
