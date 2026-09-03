'use strict'

// Google Identity Services entrega un token de acceso de una hora y no da token de
// refresco al navegador. La renovación silenciosa (`prompt: ''`) funciona mientras el
// usuario mantenga el permiso concedido; si Google decide pedir consentimiento otra
// vez hay que abrir el diálogo, y eso solo se puede hacer desde un toque del usuario.
let tokenClient = null
let token = null          // { value, expira }
let cargandoGIS = null

const conectado = () => !!(token && token.expira > Date.now() + 60000)

function cargaGIS () {
  if (window.google && google.accounts) return Promise.resolve()
  if (cargandoGIS) return cargandoGIS
  cargandoGIS = new Promise((ok, err) => {
    const s = document.createElement('script')
    s.src = CFG.GIS
    s.async = true
    s.onload = () => ok()
    s.onerror = () => err(new Error('No se pudo cargar el inicio de sesión de Google. ¿Hay conexión?'))
    document.head.appendChild(s)
  })
  return cargandoGIS
}

async function cliente () {
  if (!clientId()) throw new Error('Falta el id de cliente OAuth. Ponlo en Ajustes.')
  await cargaGIS()
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: CFG.SCOPES,
      callback: () => {}
    })
  }
  return tokenClient
}

// `interactivo` decide si se puede abrir el diálogo de Google. En el arranque va a
// false para no asaltar al usuario con una ventana que además el navegador bloquearía
// por no venir de un gesto suyo.
function pideToken (interactivo) {
  return new Promise(async (ok, err) => {
    let c
    try { c = await cliente() } catch (e) { return err(e) }
    c.callback = resp => {
      if (resp && resp.access_token) {
        token = { value: resp.access_token, expira: Date.now() + (Number(resp.expires_in) || 3600) * 1000 }
        localStorage.setItem('gm_visto', '1')
        ok(token.value)
      } else {
        const e = resp && resp.error
        err(new Error(e === 'access_denied'
          ? 'Has denegado el acceso a Google.'
          : 'Google no ha dado el permiso' + (e ? ` (${e})` : '') + '.'))
      }
    }
    try {
      c.requestAccessToken({ prompt: interactivo ? 'consent' : '' })
    } catch (e) { err(e) }
  })
}

async function accessToken (interactivo) {
  if (conectado()) return token.value
  // Solo intentamos la renovación silenciosa si el usuario ya concedió el permiso
  // alguna vez en este navegador; si no, no hay nada que renovar.
  if (!interactivo && !localStorage.getItem('gm_visto')) throw new Error('Sin conectar con Google.')
  return pideToken(interactivo)
}

function desconecta () {
  if (token && window.google && google.accounts) {
    try { google.accounts.oauth2.revoke(token.value) } catch (e) {}
  }
  token = null
  localStorage.removeItem('gm_visto')
}

// Envoltorio de fetch con el token puesto. Un 401 se reintenta una vez con token
// nuevo, porque el token puede caducar justo entre dos llamadas.
async function gfetch (url, opts = {}, interactivo = false, _reintento = false) {
  const t = await accessToken(interactivo)
  const h = Object.assign({}, opts.headers, { Authorization: 'Bearer ' + t })
  const r = await fetch(url, Object.assign({}, opts, { headers: h }))
  if (r.status === 401 && !_reintento) {
    token = null
    return gfetch(url, opts, interactivo, true)
  }
  if (r.status === 403 || r.status === 429) {
    // Cuota de Google: esperar y reintentar una vez, no insistir en bucle.
    if (!_reintento) {
      await new Promise(x => setTimeout(x, 1500))
      return gfetch(url, opts, interactivo, true)
    }
  }
  if (!r.ok) {
    let detalle = ''
    try { const j = await r.json(); detalle = (j.error && (j.error.message || j.error.status)) || '' } catch (e) {}
    throw new Error(`Google respondió ${r.status}${detalle ? ': ' + detalle : ''}`)
  }
  return r
}

const gjson = (url, opts, interactivo) => gfetch(url, opts, interactivo).then(r => r.json())
