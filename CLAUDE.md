# GlobalManager — contexto del proyecto

App instalable (PWA) para llevar tareas, mantenimientos, regalos y compras. Sin backend y
sin build. Los datos van al Google Drive del usuario y los recordatorios a su Google
Calendar.

## Restricciones que NO se pueden romper

Condicionan casi cada decisión. Antes de proponer un cambio, comprobar que no choca con
ninguna:

1. **Se usa desde Chrome en Android**, instalada desde la pantalla de inicio. El
   escritorio es el segundo escenario, no el primero.
2. **Sin bundler, sin npm, sin frameworks.** Varios archivos servidos tal cual desde
   GitHub Pages. Se edita, se sube y funciona.
3. **Tiene que funcionar sin conexión.** El modelo entero vive en IndexedDB y Drive es
   solo el punto de encuentro entre dispositivos. Ninguna pantalla puede exigir red.
4. **Las credenciales no van al repositorio.** El id de cliente OAuth se pega en Ajustes
   y se queda en `localStorage`. `.gitignore` bloquea `global.json` y los `*.jpg`.
5. **Los permisos de Google son los mínimos**: `drive.file` (solo lo que crea la app) y
   `calendar.events`. No ampliarlos sin una razón que no tenga alternativa.
6. **Español en toda la interfaz**, incluidos los mensajes de error.

## Cómo están los datos

Una carpeta `GlobalManager` en el Drive del usuario:

```
GlobalManager/
├─ global.json      todo el modelo: áreas, proyectos, módulos, personas y tareas
└─ foto_*.jpg       una foto por archivo, referenciada por su fileId
```

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
- **`google.js`** — Google Identity Services. Entrega un token de una hora y **no da token
  de refresco**: se renueva en silencio con `prompt: ''` mientras el permiso siga
  concedido. Abrir el diálogo exige un gesto del usuario, y por eso conectar es un botón
  de Ajustes y no algo que pase en el arranque.
- **`drive.js`** — carpeta, `global.json`, subida de fotos pendientes y `sincroniza()`.
- **`calendar.js`** — crea, mueve y borra los eventos; `rrule()` y los recordatorios que
  quedaron pendientes.
- **`photos.js`** — reducción a 1600 px, miniaturas de 400 px en IndexedDB, carga perezosa
  con `IntersectionObserver` y visor.
- **`notify.js`** — permisos, aviso agrupado al abrir y registro de `periodicsync`.
- **`app.js`** — pila de navegación, botón atrás, arranque y errores globales.
- **`views/`** — `comun.js` (fila de tarea compartida), `home.js`, `areas.js`, `task.js`,
  `listas.js` (regalos, compras y personas), `buscar.js`, `ajustes.js`.

### Sincronización

Se guarda primero en local y se sube después; `SYNC.sucio` marca que hay algo pendiente.
`sincroniza()` baja el archivo, **fusiona registro a registro quedándose con el
`updatedAt` mayor**, y antes de subir vuelve a comprobar la versión del archivo por si
otro dispositivo escribió entretanto. Es lo máximo que se puede hacer sin servidor: si se
edita la misma tarea en dos sitios sin sincronizar en medio, gana la última.

### El botón atrás

En Android, sin entradas de historial, atrás cerraba la app desde cualquier pantalla. Se
lleva una pila propia (`PILA`) y se mantiene **una** entrada de historial mientras no
estemos en la raíz: esa entrada es la que recoge el toque. Toda pantalla nueva se registra
con `registra()` y se abre con `ve()`, nunca escribiendo en `PILA` a mano.

### Periodicidad

`repeat.from` distingue dos cosas que no son la misma:

- `due` — cada N unidades desde la fecha prevista. Se traduce a `RRULE` y Calendar la
  repite solo. Si la tarea está muy atrasada, `completa()` avanza la fecha hasta pasar de
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
