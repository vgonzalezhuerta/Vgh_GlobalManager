'use strict'

// Ninguna API de navegador puede escribir en el calendario del móvil: eso lo hacen las
// apps nativas con un permiso de Android que a una página web no se le da. Lo que sí se
// puede es abrir Google Calendar con el evento ya montado para que el usuario confirme
// de un toque, y exportar un .ics que Calendar importa entero.
const zona = () => (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid')
const FREQ = { day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' }
const DURACION = 30

// Solo la periodicidad contada desde la fecha prevista se puede escribir como RRULE.
// «Cada 6 meses desde que se hace» depende de cuándo se haga, así que va como evento
// suelto que se vuelve a proponer cada vez que se completa la tarea.
function rrule (rep) {
  if (!rep || !rep.n || rep.from === 'done') return null
  const f = FREQ[rep.unit]
  return f ? `RRULE:FREQ=${f};INTERVAL=${rep.n}` : null
}

const pad = n => String(n).padStart(2, '0')

function momentos (t) {
  const [h, m] = (t.time || horaDefecto()).split(':').map(Number)
  const [a, me, d] = t.due.split('-').map(Number)
  const ini = new Date(a, me - 1, d, h, m, 0)
  const fin = new Date(ini.getTime() + DURACION * 60000)
  const sello = f => `${f.getFullYear()}${pad(f.getMonth() + 1)}${pad(f.getDate())}T${pad(f.getHours())}${pad(f.getMinutes())}00`
  return { ini: sello(ini), fin: sello(fin) }
}

function cuerpoEvento (t) {
  return [rutaDe(t), t.desc, (t.fields || []).map(f => `${f.k}: ${f.v}`).join('\n')]
    .filter(Boolean).join('\n\n')
}

// Enlace de plantilla de Google Calendar. En Android lo recoge la app de Calendar y
// abre la pantalla de evento nuevo ya rellena.
function enlaceEvento (t) {
  const { ini, fin } = momentos(t)
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: t.title,
    dates: `${ini}/${fin}`,
    details: cuerpoEvento(t),
    ctz: zona()
  })
  const r = rrule(t.repeat)
  if (r) p.set('recur', r)
  return 'https://calendar.google.com/calendar/render?' + p.toString()
}

/* ---------- .ics ---------- */

const escIcs = s => String(s == null ? '' : s)
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// El formato obliga a partir las líneas de más de 75 octetos, con un espacio al empezar
// la continuación. Sin esto, una descripción larga rompe el archivo.
function pliega (linea) {
  const b = new TextEncoder().encode(linea)
  if (b.length <= 75) return linea
  const trozos = []
  let i = 0
  while (i < linea.length) {
    let corte = i
    let bytes = 0
    const tope = trozos.length ? 74 : 75
    while (corte < linea.length && bytes + new TextEncoder().encode(linea[corte]).length <= tope) {
      bytes += new TextEncoder().encode(linea[corte]).length
      corte++
    }
    trozos.push((trozos.length ? ' ' : '') + linea.slice(i, corte))
    i = corte
  }
  return trozos.join('\r\n')
}

// Las horas van «flotantes», sin zona ni Z: significan la hora local de quien lo importa,
// que es justo lo que se quiere en un recordatorio personal, y evita tener que meter un
// bloque VTIMEZONE entero en el archivo.
function ics (tareas) {
  const ahoraUTC = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GlobalManager//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const t of tareas) {
    if (!t.due) continue
    const { ini, fin } = momentos(t)
    l.push('BEGIN:VEVENT')
    l.push(`UID:gm-${t.id}@globalmanager`)
    l.push(`DTSTAMP:${ahoraUTC}`)
    l.push(`DTSTART:${ini}`)
    l.push(`DTEND:${fin}`)
    l.push(`SUMMARY:${escIcs(t.title)}`)
    const c = cuerpoEvento(t)
    if (c) l.push(`DESCRIPTION:${escIcs(c)}`)
    const r = rrule(t.repeat)
    if (r) l.push(r)
    l.push('BEGIN:VALARM', `TRIGGER:-PT${avisoDefecto()}M`, 'ACTION:DISPLAY',
      `DESCRIPTION:${escIcs(t.title)}`, 'END:VALARM')
    l.push('END:VEVENT')
  }
  l.push('END:VCALENDAR')
  return l.map(pliega).join('\r\n') + '\r\n'
}

function descargaIcs (tareas, nombre) {
  const conFecha = tareas.filter(t => t.due)
  if (!conFecha.length) { status('No hay ninguna tarea con fecha que exportar.', true); return 0 }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics(conFecha)], { type: 'text/calendar;charset=utf-8' }))
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return conFecha.length
}

/* ---------- qué recordatorio se ha puesto ya ---------- */

// La app no puede saber si el usuario llegó a guardar el evento, ni modificarlo después.
// Lo que sí puede es recordar con qué fecha y periodicidad se abrió el enlace: si eso
// cambia, hay que avisar de que el evento del calendario se quedó viejo.
const selloEvento = t => `${t.due || ''}|${t.time || horaDefecto()}|${t.repeat ? `${t.repeat.n}${t.repeat.unit}${t.repeat.from}` : ''}`

const recordatorioPuesto = t => !!t.calendarPuesto && t.calendarSello === selloEvento(t)
const recordatorioViejo = t => !!t.calendarPuesto && t.calendarSello !== selloEvento(t)

function marcaRecordatorio (t) {
  t.calendarPuesto = ahora()
  t.calendarSello = selloEvento(t)
  upsert('tasks', t)
}

function abreCalendario (t) {
  if (!t.due) { status('La tarea necesita una fecha para crear el recordatorio.', true); return }
  window.open(enlaceEvento(t), '_blank', 'noopener')
  marcaRecordatorio(t)
  trasCambio(null)
}

// Con fecha y sin recordatorio puesto, o con uno que se quedó viejo.
const sinRecordatorio = () => pendientes().filter(t => t.due && !recordatorioPuesto(t))
