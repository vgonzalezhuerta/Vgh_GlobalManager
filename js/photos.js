'use strict'

// Las fotos se reducen antes de subirlas: una foto de móvil son 4 MB y en la ficha se
// ve a 400 px. Se guarda una versión de 1600 px en Drive y una miniatura en IndexedDB.
const MAX_LADO = 1600
const MAX_MINI = 400

const urls = new Map()   // fileId|local -> objectURL de la miniatura

function pideFoto () {
  return new Promise(ok => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.multiple = true
    inp.onchange = () => ok(Array.from(inp.files || []))
    inp.click()
  })
}

function cargaImagen (blob) {
  return new Promise((ok, err) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); ok(img) }
    img.onerror = () => { URL.revokeObjectURL(url); err(new Error('No se pudo leer la imagen.')) }
    img.src = url
  })
}

async function reduce (blob, lado, calidad) {
  const img = await cargaImagen(blob)
  const f = Math.min(1, lado / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * f))
  const h = Math.max(1, Math.round(img.height * f))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  c.getContext('2d').drawImage(img, 0, 0, w, h)
  const out = await new Promise(ok => c.toBlob(ok, 'image/jpeg', calidad))
  return { blob: out || blob, w, h }
}

// Devuelve el descriptor que se guarda en la tarea. Mientras no haya id de Drive
// viaja con `local`, y `subePendientes()` lo cambia cuando la sube.
async function anadeFoto (blob) {
  const clave = `foto_${uid()}.jpg`
  const grande = await reduce(blob, MAX_LADO, 0.82)
  const mini = await reduce(grande.blob, MAX_MINI, 0.72)
  await guardaFotoPendiente(clave, grande.blob)
  await idbSet('thumbs', clave, mini.blob)
  return { local: clave, name: clave, w: grande.w, h: grande.h }
}

const claveFoto = f => f.fileId || f.local

async function miniatura (f) {
  const k = claveFoto(f)
  if (urls.has(k)) return urls.get(k)
  let blob = await idbGet('thumbs', k)
  if (!blob && f.fileId) {
    // No está cacheada: se baja el original y se guarda la miniatura para la próxima vez.
    try {
      const orig = await reintenta(() => bajaFoto(f.fileId), 2)
      blob = (await reduce(orig, MAX_MINI, 0.72)).blob
      await idbSet('thumbs', k, blob)
    } catch (e) { return null }
  }
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urls.set(k, url)
  return url
}

// Pinta las miniaturas cuando su contenedor se acerca a la pantalla: en una lista larga
// bajar todas las fotos de golpe son cientos de lecturas antes de ver nada.
const observador = 'IntersectionObserver' in window
  ? new IntersectionObserver(es => {
    for (const e of es) {
      if (!e.isIntersecting) continue
      observador.unobserve(e.target)
      const f = e.target._foto
      if (f) miniatura(f).then(u => { if (u) e.target.style.backgroundImage = `url(${u})` })
    }
  }, { rootMargin: '200px' })
  : null

function observaFoto (el, f) {
  el._foto = f
  if (observador) observador.observe(el)
  else miniatura(f).then(u => { if (u) el.style.backgroundImage = `url(${u})` })
}

async function abreLightbox (fotos, i = 0) {
  const cap = $('#lightbox')
  let idx = i
  const pinta = async () => {
    const f = fotos[idx]
    cap.querySelector('.lb-img').style.backgroundImage = ''
    cap.querySelector('.lb-n').textContent = `${idx + 1} / ${fotos.length}`
    // El original no se cachea: son megas por foto y el visor se abre de una en una.
    let blob = f.local ? await idbGet('subidas', f.local) : null
    if (!blob && f.fileId) { try { blob = await reintenta(() => bajaFoto(f.fileId), 2) } catch (e) {} }
    if (!blob) blob = await idbGet('thumbs', claveFoto(f))
    if (blob) cap.querySelector('.lb-img').style.backgroundImage = `url(${URL.createObjectURL(blob)})`
    else status('No se pudo abrir la foto. ¿Hay conexión?', true)
  }
  cap.hidden = false
  cap.querySelector('.lb-prev').onclick = () => { idx = (idx - 1 + fotos.length) % fotos.length; pinta() }
  cap.querySelector('.lb-next').onclick = () => { idx = (idx + 1) % fotos.length; pinta() }
  cap.querySelector('.lb-cerrar').onclick = () => { cap.hidden = true }
  pinta()
}
