# GlobalManager — contexto del proyecto

App instalable (PWA) para llevar tareas, mantenimientos, regalos y compras. Sin backend y
sin build. Los datos van a una carpeta de Google Drive que elige el usuario, y los
recordatorios a su Google Calendar. **Sin claves de API ni proyecto de Google Cloud.**

## Restricciones que NO se pueden romper

Condicionan casi cada decisión. Antes de proponer un cambio, comprobar que no choca con
ninguna:

1. **Se usa desde Chrome en Android**, instalada desde la pantalla de inicio. El
   escritorio es el segundo escenario, no el primero.
2. **Sin bundler, sin npm, sin frameworks.** Varios archivos servidos tal cual desde
   GitHub Pages. Se edita, se sube y funciona.
3. **Tiene que funcionar sin conexión.** El modelo entero vive en IndexedDB y la carpeta
   es solo el punto de encuentro entre dispositivos. Ninguna pantalla puede exigir red.
4. **Nada de OAuth, claves de API ni proyecto de Google Cloud.** Fue una etapa anterior y
   se quitó a propósito: obligaba al usuario a montar una consola de Google para una app
   personal. Si algo parece necesitarlo, es que hay otro camino.
5. **La carpeta se lee con la File System Access API** (`showDirectoryPicker`). No
   sustituir por subida de archivos ni por almacenamiento del navegador: el usuario quiere
   sus archivos en su carpeta de Drive. `.gitignore` bloquea `global.json` y los `*.jpg`.
6. **Español en toda la interfaz**, incluidos los mensajes de error.

## Cómo están los datos

La carpeta que elige el usuario dentro de su Google Drive:

```
<carpeta elegida>/
├─ global.json      todo el modelo: áreas, proyectos, módulos, personas y tareas
└─ foto_*.jpg       una foto por archivo, referenciada por su nombre
```

Quien sincroniza entre dispositivos es Google Drive. La app solo lee y escribe archivos.

El esquema completo está en `FORMATO-datos.md`; si se cambia el formato, actualizar ese
documento en el mismo commit.

Tres niveles: **área → proyecto → módulo**. Una tarea lleva siempre `areaId` y, opcionales,
`projectId` y `moduleId`. No toda área necesita proyectos: las tareas pueden colgar
directamente de ella. Guardar siempre `areaId` es lo que permite que «todas las tareas del
área» sea un filtro plano sin recorrer el árbol.

## Arquitectura

Los scripts se cargan en orden en `index.html` y comparten el ámbito global. **`app.js` va
antes que las vistas**, porque cada vista se registra al cargarse llamando a `registra()`.

- **`config.js`** — constantes y los ajustes que viven en `localStorage` (id de cliente,
  hora y antelación del aviso).
- **`util.js`** — `esc()`, fechas, `sumaISO()`, `sinTildes()`, `enCola()`, `reintenta()`,
  `status()`.
- **`store.js`** — el modelo `S`, IndexedDB, `upsert()`/`borra()` (borrado por marca),
  las consultas, `completa()` y `fusiona()`.
- **`carpeta.js`** — `showDirectoryPicker()`, el handle recordado en IndexedDB,
  `sincroniza()` y el volcado de fotos pendientes. `pickerBusy` impide dos selectores a la
  vez (Chrome falla). Volver a pedir el permiso abre un diálogo y **eso exige un gesto del
  usuario**: por eso al arrancar solo se consulta (`reconectaCarpeta(false)`) y reconectar
  es un botón.
- **`calendar.js`** — enlace de plantilla de Google Calendar, generación de `.ics` y el
  sello que detecta un recordatorio desfasado.
- **`photos.js`** — reducción a 1600 px, miniaturas de 400 px en IndexedDB, carga perezosa
  con `IntersectionObserver` y visor.
- **`notify.js`** — permisos, aviso agrupado al abrir y registro de `periodicsync`.
- **`instalar.js`** — captura de `beforeinstallprompt`, botón propio de instalación,
  diagnóstico de por qué Chrome no la ofrece, y el ciclo de actualización.
- **`app.js`** — pila de navegación, botón atrás, arranque y errores globales.
- **`views/`** — `comun.js` (fila de tarea compartida), `home.js`, `areas.js`, `task.js`,
  `listas.js` (regalos, compras y personas), `buscar.js`, `ajustes.js`.

### Sincronización

Se guarda primero en local; `SYNC.sucio` marca que hay algo pendiente y `SYNC.mtime`
recuerda la fecha del archivo que leímos. `sincroniza()` lee `global.json`, y si cambió
desde la última vez es que escribió el otro dispositivo: **fusiona registro a registro
quedándose con el `updatedAt` mayor** antes de escribir. Solo escribe si el resultado
difiere de lo que había, porque reescribir por reescribir hace que Drive vuelva a subir el
archivo en todos los dispositivos.

Es lo máximo que se puede hacer sin servidor: si se edita la misma tarea en dos sitios sin
sincronizar en medio, gana la última.

### El botón atrás

En Android, sin entradas de historial, atrás cerraba la app desde cualquier pantalla. Se
lleva una pila propia (`PILA`) y se mantiene **una** entrada de historial mientras no
estemos en la raíz: esa entrada es la que recoge el toque. Toda pantalla nueva se registra
con `registra()` y se abre con `ve()`, nunca escribiendo en `PILA` a mano.

### Instalación

Chrome esconde «Instalar aplicación» en sitios distintos según la versión y, si falla algún
requisito, no lo dice: la opción simplemente no sale. Por eso `instalar.js` captura
`beforeinstallprompt` (con `preventDefault()`, sin él Chrome enseña su propio aviso y luego
ya no se puede lanzar a mano) y ofrece un botón propio, más un diagnóstico de los cinco
requisitos. En incógnito Chrome nunca instala: si algo no cuadra al depurar, mirar eso
primero.

### Recordatorios

**Ninguna API de navegador puede escribir en el calendario del móvil.** Las apps nativas lo
hacen con `CalendarContract` y un permiso de Android que a una página no se le da. Lo que
hay:

- `enlaceEvento(t)` abre Google Calendar con el evento montado y el usuario lo guarda.
- `ics(tareas)` genera un archivo importable, con horas **flotantes** (sin zona ni `Z`)
  para no tener que meter un bloque `VTIMEZONE` entero.
- `selloEvento(t)` guarda con qué fecha, hora y periodicidad se abrió el enlace. Si eso
  cambia, `recordatorioViejo(t)` lo detecta y la ficha avisa: la app no puede modificar ni
  borrar un evento que ya está en el calendario, así que lo dice en vez de callarse.

No prometer en la interfaz que la app toca el calendario del usuario. No lo hace.

### Periodicidad

`repeat.from` distingue dos cosas que no son la misma:

- `due` — cada N unidades desde la fecha prevista. Se traduce a `RRULE`, va en el enlace
  y en el `.ics`, y Calendar la repite solo. Si la tarea está muy atrasada, `completa()` avanza la fecha hasta pasar de
  hoy en vez de dejarla otra vez en el pasado.
- `done` — cada N unidades desde que se marca. Es la de mantenimiento. **No es expresable
  como `RRULE`**, así que va como evento único que se recrea al completar.

Completar una tarea periódica no la archiva: escribe en `log`, mueve `due` y la deja
abierta.

### Notificaciones

No existe forma de programar una notificación futura con la app cerrada: la API que lo
permitía nunca llegó a producción y el push de verdad necesita un servidor. Lo que hay:

- **Google Calendar** es el aviso fiable, y por eso el evento no es un extra.
- Aviso agrupado al abrir la app (`avisaPendientes()`), una vez al día.
- `periodicsync` en el service worker, que el navegador dispara cuando le parece. Lee un
  resumen ligero que la app deja en `meta.avisos`, porque ahí no hay token ni modelo.

No prometer en la interfaz avisos que el navegador no puede dar.

## Al terminar cualquier cambio

1. **Sube `VERSION` en `sw.js`** (`globalmanager-vN` → `vN+1`). Sin eso la app instalada
   sigue sirviendo la versión cacheada y el cambio no llega. Es el error más fácil de
   cometer aquí. Ese número es el único que se escribe: la insignia de Ajustes se lo
   pregunta al service worker con `postMessage('version')`.

   El service worker **no llama a `skipWaiting()` al instalarse**: la versión nueva espera
   a que el usuario pulse «Actualizar ahora», que le manda el mensaje `'actualiza'`. Si
   entrase sola, la página seguiría corriendo el JavaScript viejo con los archivos ya
   cambiados debajo.
2. Si añades o quitas un archivo, mételo también en `SHELL` de `sw.js`.
3. Comprueba que el JS sigue siendo válido (`node --check`) y que no se han roto los datos
   existentes.
4. No dejes `console.log` de depuración; los errores se enseñan con `status(msg, true)`.

## Estilo del código

- Sin punto y coma al final de línea, comillas simples, `const`/`let`.
- Comentarios en español y solo donde explican un *por qué* que no se ve en el código (una
  limitación de la API de Google, un fallo de Chrome, una decisión de diseño). No comentar
  lo que el código ya dice.
- Los textos de interfaz se escapan con `esc()` antes de meterlos en plantillas.
- Errores: nunca fallar en silencio. `try/catch` y `status()` con un mensaje que diga qué
  hacer. La excepción es lo que no es un error para el usuario —por ejemplo, no poder
  crear un evento porque todavía no hay id de cliente—, que se calla.
