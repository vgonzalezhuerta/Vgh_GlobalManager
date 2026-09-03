'use strict'

// Google Calendar es el despertador de la app: su notificación llega con el móvil en
// el bolsillo y además aparece en el PC. Las notificaciones web solo pueden avisar con
// la app abierta o cuando el navegador decide despertarla, así que lo importante va aquí.
const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const zona = () => (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid')

const horaDefecto = () => localStorage.getItem('gm_hora') || '09:00'
const setHoraDefecto = h => localStorage.setItem('gm_hora', h || '09:00')

const FREQ = { day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' }

// Solo la periodicidad contada desde la fecha prevista se puede escribir como RRULE.
// «Cada 6 meses desde que se hace» no es expresable: depende de cuándo se haga, así
// que ese caso va como evento único y se recoloca al completar la tarea.
function rrule (rep) {
  if (!rep || !rep.n || rep.from === 'done') return null
  const f = FREQ[rep.unit]
  if (!f) return null
  return [`RRULE:FREQ=${f};INTERVAL=${rep.n}`]
}

function evento (t) {
  const hora = t.time || horaDefecto()
  const [h, m] = hora.split(':').map(Number)
  const fin = new Date(`${t.due}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
  fin.setMinutes(fin.getMinutes() + 30)
  const pad = n => String(n).padStart(2, '0')
  const finISO = `${fin.getFullYear()}-${pad(fin.getMonth() + 1)}-${pad(fin.getDate())}T${pad(fin.getHours())}:${pad(fin.getMinutes())}:00`

  const cuerpo = [rutaDe(t), t.desc, (t.fields || []).map(f => `${f.k}: ${f.v}`).join('\n')]
    .filter(Boolean).join('\n\n')

  const ev = {
    summary: t.title,
    description: cuerpo,
    start: { dateTime: `${t.due}T${pad(h)}:${pad(m)}:00`, timeZone: zona() },
    end: { dateTime: finISO, timeZone: zona() },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: avisoDefecto() }] },
    extendedProperties: { private: { gmTaskId: t.id } }
  }
  const r = rrule(t.repeat)
  if (r) ev.recurrence = r
  return ev
}

// Crea o actualiza el evento de una tarea. Sin fecha no hay evento, y si la tarea la
// pierde se borra el que hubiera.
async function sincronizaEvento (t, interactivo = false) {
  if (!clientId()) throw new Error('Falta el id de cliente OAuth. Ponlo en Ajustes.')
  if (!t.due || !t.calendar) {
    if (t.calendarEventId) await borraEvento(t, interactivo)
    return null
  }
  const cuerpo = JSON.stringify(evento(t))
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo }

  if (t.calendarEventId) {
    try {
      const r = await gjson(`${CAL}/${encodeURIComponent(t.calendarEventId)}`,
        Object.assign({}, opts, { method: 'PATCH' }), interactivo)
      return r.id
    } catch (e) {
      // 404/410: el usuario lo borró desde Calendar. Se crea uno nuevo en vez de fallar.
      if (!/40[49]|410/.test(e.message)) throw e
      t.calendarEventId = null
    }
  }
  const r = await gjson(CAL, opts, interactivo)
  t.calendarEventId = r.id
  upsert('tasks', t)
  return r.id
}

async function borraEvento (t, interactivo = false) {
  if (!t.calendarEventId) return
  try {
    await gfetch(`${CAL}/${encodeURIComponent(t.calendarEventId)}`, { method: 'DELETE' }, interactivo)
  } catch (e) {
    // Si ya no está, el objetivo se cumple igual.
    if (!/40[49]|410/.test(e.message)) throw e
  }
  t.calendarEventId = null
  upsert('tasks', t)
}

// Se llama tras guardar una tarea. No bloquea la interfaz ni tumba el guardado si
// Calendar falla: la tarea ya está a salvo en el dispositivo.
function sincronizaEventoSuave (t) {
  if (!t.calendar && !t.calendarEventId) return
  // Sin id de cliente no hay nada que hacer y no es un error: la app funciona en local
  // y la pantalla de inicio ya avisa de que falta configurarlo.
  if (!clientId()) return
  sincronizaEvento(t, false)
    .then(id => { if (id) status('Recordatorio en Google Calendar actualizado.') })
    .catch(e => status('Tarea guardada, pero el recordatorio no: ' + e.message, true))
}

// Tareas marcadas para Calendar que nunca llegaron a tener evento: creadas sin conexión,
// o antes de configurar el id de cliente. Sin esto se quedarían sin recordatorio para
// siempre y en silencio.
const sinRecordatorio = () => pendientes().filter(t => t.calendar && t.due && !t.calendarEventId)

async function creaRecordatoriosPendientes () {
  const faltan = sinRecordatorio()
  if (!faltan.length) { status('No falta ningún recordatorio.'); return 0 }
  let hechos = 0
  for (const t of faltan) {
    try { await sincronizaEvento(t, false); hechos++ } catch (e) {
      status(`Se han creado ${hechos} de ${faltan.length}: ` + e.message, true)
      return hechos
    }
  }
  status(hechos === 1 ? 'Creado 1 recordatorio.' : `Creados ${hechos} recordatorios.`)
  if (clientId()) sincroniza(false)
  return hechos
}
