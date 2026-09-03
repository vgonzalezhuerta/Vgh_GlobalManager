'use strict'

// Las fotos se reducen antes de guardarlas: una foto de móvil son 4 MB y en la ficha se
// ve a 400 px. En la carpeta queda una versión de 1600 px y en IndexedDB la miniatura.
const MAX_LADO = 1600
const MAX_MINI = 400

const urls = new Map()   // nombre de archivo -> objectURL de la miniatura

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

// La foto se apunta en «subidas» con el nombre que tendrá en la carpeta. Si la carpeta
// está a mano se vuelca ya; si no, espera ahí a la próxima sincronización.
async function anadeFoto (blob) {
  const name = `foto_${uid()}.jpg`
  const grande = await reduce(blob, MAX_LADO, 0.82)
  const mini = await reduce(grande.blob, MAX_MINI, 0.72)
  await idbSet('subidas', name, grande.blob)
  await idbSet('thumbs', name, mini.blob)
  if (hayCarpeta()) volcaFotosPendientes().catch(() => {})
  return { name, w: grande.w, h: grande.h }
}

async function miniatura (f) {
  if (urls.has(f.name)) return urls.get(f.name)
  let blob = await idbGet('thumbs', f.name)
  if (!blob) {
    // No está cacheada: se lee de la carpeta y se guarda la miniatura para la próxima vez.
    const orig = await leeFoto(f.name)
    if (!orig) return null
    blob = (await reduce(orig, MAX_MINI, 0.72)).blob
    await idbSet('thumbs', f.name, blob)
  }
  const url = URL.createObjectURL(blob)
  urls.set(f.name, url)
  return url
}

// Se pide cada miniatura cuando su hueco se acerca a la pantalla: en una lista larga,
// leer todas las fotos de la carpeta de golpe deja la app en blanco un buen rato.
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
  let actual = null
  const pinta = async () => {
    const f = fotos[idx]
    const img = cap.querySelector('.lb-img')
    img.style.backgroundImage = ''
    cap.querySelector('.lb-n').textContent = `${idx + 1} / ${fotos.length}`
    // El original no se cachea: son megas por foto y se mira de una en una.
    const blob = await leeFoto(f.name) || await idbGet('thumbs', f.name)
    if (!blob) { status('No se encuentra la foto en la carpeta.', true); return }
    if (actual) URL.revokeObjectURL(actual)
    actual = URL.createObjectURL(blob)
    img.style.backgroundImage = `url(${actual})`
  }
  const cierra = () => {
    cap.hidden = true
    if (actual) { URL.revokeObjectURL(actual); actual = null }
  }
  cap.hidden = false
  cap.querySelector('.lb-prev').onclick = () => { idx = (idx - 1 + fotos.length) % fotos.length; pinta() }
  cap.querySelector('.lb-next').onclick = () => { idx = (idx + 1) % fotos.length; pinta() }
  cap.querySelector('.lb-cerrar').onclick = cierra
  pinta()
}
