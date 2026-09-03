'use strict'

const CFG = {
  ARCHIVO: 'global.json',
  SCHEMA: 1,
  // Drive en Android sirve los archivos de uno en uno: con más lecturas simultáneas
  // empiezan a caducar.
  MAX_PARALELO: 2
}

// Hora a la que se propone el evento cuando la tarea no lleva una propia.
const horaDefecto = () => localStorage.getItem('gm_hora') || '09:00'
const setHoraDefecto = h => localStorage.setItem('gm_hora', h || '09:00')

// Minutos de antelación del aviso dentro del evento.
const avisoDefecto = () => Number(localStorage.getItem('gm_aviso') || 540)
const setAvisoDefecto = m => localStorage.setItem('gm_aviso', String(m))
