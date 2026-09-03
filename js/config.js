'use strict'

// El id de cliente OAuth no se escribe aquí: se pega en Ajustes desde el propio móvil
// y se queda en localStorage. Así el repo no lleva credenciales y cada dispositivo
// puede apuntar a un proyecto distinto si hace falta.
const CFG = {
  SCOPES: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/calendar.events'
  ].join(' '),
  CARPETA: 'GlobalManager',
  ARCHIVO: 'global.json',
  SCHEMA: 1,
  GIS: 'https://accounts.google.com/gsi/client',
  // Drive en el móvil sirve los archivos de uno en uno: más de dos lecturas
  // simultáneas y empiezan a caducar.
  MAX_PARALELO: 2
}

const clientId = () => (localStorage.getItem('gm_client_id') || '').trim()
const setClientId = v => localStorage.setItem('gm_client_id', (v || '').trim())

// Minutos de aviso por defecto en el evento de Google Calendar.
const avisoDefecto = () => Number(localStorage.getItem('gm_aviso') || 540)
const setAvisoDefecto = m => localStorage.setItem('gm_aviso', String(m))
