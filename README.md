# GlobalManager

App instalable en el móvil para llevar tareas, mantenimientos, regalos y compras.
Sin backend y sin build: es HTML, CSS y JavaScript servidos tal cual. Los datos viven en
**tu** Google Drive y los recordatorios se crean en **tu** Google Calendar.

Tres niveles de organización — **área → proyecto → módulo** — y las tareas pueden colgar
de cualquiera de ellos: un área puede tener tareas directamente, sin proyectos ni módulos.

---

## Puesta en marcha

Son dos cosas: publicar la app y darle acceso a tu cuenta de Google. La primera es un
minuto; la segunda, unos diez, y solo se hace una vez.

### 1. Publicar la app en GitHub Pages

Hace falta **https**: sin él, Chrome no deja instalar la app ni registrar el service worker.

1. En el repositorio: **Settings → Pages**.
2. *Source*: **Deploy from a branch**. *Branch*: `main`, carpeta `/ (root)`. **Save**.
3. A los dos minutos la app está en `https://<tu-usuario>.github.io/vgh_globalmanager/`.

### 2. Crear el cliente OAuth de Google

Sin esto la app funciona igual, pero solo en el dispositivo donde la abras: ni comparte
datos con el PC ni crea recordatorios.

1. Entra en <https://console.cloud.google.com/> y crea un proyecto (por ejemplo
   `globalmanager`).
2. **APIs y servicios → Biblioteca**. Activa las dos:
   - **Google Drive API**
   - **Google Calendar API**
3. **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo**.
   - Rellena nombre de la app y correo de contacto.
   - En **Usuarios de prueba**, añade tu propia cuenta de Google. Esto es lo que te
     permite usarla sin pasar por la verificación de Google.
   - Deja la app en estado **Prueba / Testing**. `calendar.events` es un permiso
     sensible: publicarla en producción exigiría que Google la verificase, y para uso
     personal no hace ninguna falta.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - **Orígenes autorizados de JavaScript** (uno por línea; sin barra al final):
     - `https://<tu-usuario>.github.io`
     - `http://localhost:8099` — solo si vas a probar en el PC
   - No hace falta URI de redirección: el flujo de Google Identity Services no la usa.
5. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).

### 3. Meter el id en la app

Abre la app → **Ajustes** → pega el id en *Id de cliente OAuth* → **Guardar id** →
**Conectar**. Google pedirá permiso una vez. A partir de ahí:

- se crea una carpeta `GlobalManager` en tu Drive con un `global.json` dentro;
- los recordatorios aparecen en tu calendario principal.

Repite este paso en cada dispositivo (móvil y PC) con **el mismo id**: es lo que hace que
los dos vean la misma carpeta.

### 4. Instalarla en el móvil

Chrome en Android → menú **⋮** → **Instalar aplicación** / *Añadir a pantalla de inicio*.

---

## Permisos que pide, y por qué

| Permiso | Para qué | Qué **no** puede hacer |
|---|---|---|
| `drive.file` | Crear y leer la carpeta `GlobalManager` y sus archivos | Ver ningún otro archivo de tu Drive |
| `calendar.events` | Crear, mover y borrar los eventos de tus tareas | Leer eventos que no haya creado la app |

El id de cliente se guarda solo en el `localStorage` del navegador. No está en el
repositorio y no viaja a ningún sitio: no es un secreto, pero tampoco hace falta
publicarlo.

---

## Notificaciones: lo que se puede y lo que no

Conviene saberlo antes de esperar algo que no va a pasar.

- **Google Calendar**: es el aviso de verdad. Suena con el móvil en el bolsillo y la app
  cerrada, y aparece también en el PC. Por eso cada tarea con fecha crea un evento.
- **Notificación al abrir la app**: agrupa lo vencido y lo de hoy en un solo aviso.
- **`periodicsync`**: solo en la app instalada, y el navegador la dispara cuando le
  parece — como mucho cada pocas horas. Es una cortesía, no un despertador.
- **Lo que no existe**: programar una notificación para una hora concreta con la app
  cerrada. La API que lo permitía nunca llegó a producción, y las notificaciones push
  de verdad necesitan un servidor, que este proyecto no tiene.

---

## Sincronización entre móvil y PC

Todo se guarda primero en el dispositivo (IndexedDB) y después se sube. La app funciona
entera sin conexión; al volver la red, sube lo pendiente.

El archivo `global.json` de Drive es el punto de encuentro. Al sincronizar se baja, se
**fusiona** con lo local registro a registro quedándose con el más reciente, y se vuelve
a subir comprobando antes que nadie haya escrito entretanto. Los borrados dejan una marca
`deleted` en vez de desaparecer; si no, al fusionar volverían a aparecer.

Lo que esto no cubre: si editas **la misma tarea** en el móvil y en el PC sin sincronizar
en medio, gana la última guardada y la otra versión se pierde. Sin servidor no hay forma
de hacerlo mejor, y para una app personal el caso es raro.

---

## Periodicidad

Dos formas, y la diferencia importa:

- **Desde la fecha** — cada 6 meses el día 1, pase lo que pase. Se escribe como `RRULE`
  y Google Calendar la repite solo.
- **Desde que se hace** — cada 6 meses contados desde la última vez que la marcaste.
  Es la que quieres en mantenimiento. No se puede expresar como `RRULE` porque depende
  de cuándo la hagas, así que va como evento único y la app lo recoloca cada vez que
  completas la tarea.

Completar una tarea periódica no la archiva: anota lo que hiciste en el historial, mueve
la fecha y la deja abierta otra vez.

---

## Desarrollo

No hay nada que instalar ni que compilar. Para probar en el PC:

```sh
python3 -m http.server 8099
# http://127.0.0.1:8099/
```

`localhost` cuenta como origen seguro, así que el service worker y la instalación
funcionan igual que en producción.

**Al tocar cualquier archivo, sube `VERSION` en `sw.js`.** Si no, la app instalada sigue
sirviendo la versión cacheada y el cambio no llega al móvil.

El detalle de la arquitectura está en [`CLAUDE.md`](CLAUDE.md) y el esquema de datos en
[`FORMATO-datos.md`](FORMATO-datos.md).
