# GlobalManager

App instalable en el móvil para llevar tareas, mantenimientos, regalos y compras.
Sin backend y sin build: es HTML, CSS y JavaScript servidos tal cual. Los datos viven en una
carpeta de **tu** Google Drive y los recordatorios se crean en **tu** Google Calendar, sin
claves de API ni proyecto de Google Cloud.

Tres niveles de organización — **área → proyecto → módulo** — y las tareas pueden colgar
de cualquiera de ellos: un área puede tener tareas directamente, sin proyectos ni módulos.

---

## Puesta en marcha

No hay que crear ningún proyecto en Google Cloud, ni pedir claves, ni dar permisos de API.
La app usa las apps de Google que ya tienes instaladas.

### 1. Publicar la app en GitHub Pages

Hace falta **https**: sin él, Chrome no deja instalar la app ni registrar el service worker.

1. En el repositorio: **Settings → Pages**.
2. *Source*: **Deploy from a branch**. *Branch*: `main`, carpeta `/ (root)`. **Save**.
3. A los dos minutos la app está en `https://<tu-usuario>.github.io/vgh_globalmanager/`.

### 2. Instalarla en el móvil

**Ajustes → Aplicación → Instalar en este dispositivo.** La app trae su propio botón porque
Chrome cambia de sitio esa opción según la versión, y cuando no cumple algún requisito no
lo dice: simplemente no aparece.

Si el botón no está, justo debajo hay un **diagnóstico** que marca cuál de los cinco
requisitos falla. Los motivos habituales:

| Lo que ves | Qué pasa |
|---|---|
| *Origen seguro* en rojo | Estás en `http://` o en `file://`. Solo se instala desde `https://`, y GitHub Pages ya lo da |
| *Service worker activo* en rojo | La página no cargó del todo, o Pages devolvió un 404 |
| *Chrome ofrece instalar* en rojo con todo lo demás en verde | Suele bastar con volver a entrar en la página. **En pestaña de incógnito Chrome nunca instala**, y si ya la tenías instalada tampoco lo ofrece |

También puedes seguir usando el menú **⋮** de Chrome → *Instalar aplicación* / *Añadir a
pantalla de inicio*.

### 2b. Buscar actualizaciones

**Ajustes → Aplicación → Buscar actualizaciones.** Si hay una versión nueva se descarga y
queda esperando; el botón **Actualizar ahora** la aplica y recarga. La app también mira una
vez al día al abrirse, y avisa en la pantalla de inicio cuando encuentra algo.

La versión nueva **no entra sola** a propósito: si lo hiciera, la página seguiría corriendo
el JavaScript viejo con los archivos ya cambiados debajo.

Si la app se queda atascada en una versión vieja, en la misma sección hay **Forzar recarga
completa**: borra la copia guardada y el service worker y la descarga otra vez. **Tus datos
no se tocan** — siguen en la carpeta de Drive y en el dispositivo.

> Esto es el talón de Aquiles de cualquier PWA: si una versión sale con el service worker
> mal configurado, la app instalada puede quedarse anclada a ella sin forma de salir desde
> dentro. Por eso la página se pide siempre a la red (con la caché solo como red de
> seguridad para el modo sin conexión) y se comprueba si hay versión nueva en cada arranque.
> Desde una versión anterior a la v4, la salida es cerrar y abrir dos veces, o borrar los
> datos del sitio en los ajustes de Chrome.

### 3. Elegir la carpeta

**Ajustes → Elegir carpeta.** Elige una carpeta dentro de tu Google Drive:

- **Android**: la carpeta de Drive que monta el proveedor de archivos del sistema.
- **Windows**: la misma carpeta dentro de la unidad de Google Drive para escritorio.

La app crea ahí un `global.json` y guarda las fotos al lado. **Quien sincroniza es Google
Drive, no la app**: ella solo lee y escribe archivos en una carpeta. Es el mismo mecanismo
que ya usa Bitácora.

Elige la **misma carpeta** en el móvil y en el PC y los dos verán lo mismo.

> De vez en cuando el navegador vuelve a pedir permiso sobre la carpeta —normal después de
> cerrarlo y abrirlo—. La pantalla de inicio enseña un botón para reconectarla; no se
> pierde nada.

---

## Apuntar deprisa y clasificar después

En la pantalla **Hoy**, arriba del todo, hay una caja: escribes y pulsas Enter. La tarea cae
en la **Entrada**, sin área ni fecha ni nada más. El foco se queda ahí, así que puedes
soltar varias seguidas sin tocar nada.

Cuando tengas un rato, **Entrada → 📥** en cualquier tarea abre la lista de destinos —áreas,
proyectos y módulos, con la sangría dibujando el árbol— y de un toque queda colocada. Con el
botón **☑** de la cabecera entras en modo selección: marcas varias, *Todas* si quieres, y las
mueves todas juntas.

Mover no cambia nada más: ni la fecha, ni la periodicidad, ni el historial, ni el
recordatorio que ya hubieras creado.

También puedes editar cualquier tarea y elegir *📥 Entrada · sin clasificar* como área, para
devolverla a la bandeja.

---

## Accesos directos y compartir (lo más parecido a un widget)

**Los widgets de pantalla de inicio de Android no son posibles en una PWA.** Un widget es un
`AppWidgetProvider` dentro de un APK: código nativo que el sistema ejecuta y dibuja. No hay
API de navegador para registrar uno. Lo que sí hay, y cubre casi lo mismo:

**Accesos directos.** Mantén pulsado el icono de GlobalManager en la pantalla de inicio y
sale un menú con *Apuntar tarea*, *Entrada*, *Hoy* y *Buscar*. Cada uno se puede arrastrar
fuera y queda como un icono suelto en la pantalla. *Apuntar tarea* abre la app con el cursor
ya en la caja de captura.

> **Si no aparecen:** Android graba los accesos directos dentro del WebAPK —el paquete que
> Chrome genera— **al instalar la app, no al actualizarla**. Si la instalaste antes de que
> existieran, el paquete instalado sigue sin ellos. Chrome acaba regenerándolo solo, pero
> tarda un día o más; **desinstalar y volver a instalar** lo arregla al momento. Los datos no
> se pierden: están en la carpeta de Drive y en el navegador, no en la app.
>
> El diagnóstico de Ajustes tiene dos líneas para comprobarlo: *Abierta como app instalada*
> (si dice «pestaña del navegador», lo que tienes es un acceso directo antiguo de tipo
> marcador, que nunca trae menú) y *Accesos directos declarados*.

**Compartir hacia la app.** Desde Chrome, una tienda, WhatsApp o donde sea: *Compartir →
GlobalManager*, y lo compartido entra como tarea en la Entrada con su enlace guardado. Para
apuntar un regalo con su página es más rápido que cualquier widget.

---

## Recordatorios: cómo funcionan aquí

Una app nativa como la del gimnasio escribe en tu calendario porque Android le da un
permiso de sistema (`CalendarContract`). **A una página web no se le da ese permiso**, y no
hay API de navegador equivalente. Así que la app hace lo que sí puede, que para el uso
diario cunde igual:

- **Añadir a Google Calendar** en la ficha de la tarea. Abre Google Calendar con el evento
  ya montado —título, fecha, hora, descripción, datos de referencia y, si toca, la
  repetición— y tú lo guardas de un toque. En Android lo recoge la app de Calendar; en
  Windows, la web.
- **Exportar a `.ics`** desde Ajustes, para meter muchos eventos de golpe en vez de ir uno
  a uno. También hay un botón para exportar solo los que faltan.

A cambio, hay dos cosas que la app **no puede** hacer, y que por eso avisa en vez de
callarse:

- Si cambias la fecha de una tarea, el evento del calendario se queda con la vieja. La
  ficha lo marca como **desfasado**: añades el nuevo y borras el viejo en Calendar.
- Si borras una tarea, su evento sigue en tu calendario. El diálogo de borrado te lo dice.

Una vez guardado, el aviso lo da Google Calendar: suena con el móvil en el bolsillo y la
app cerrada, y aparece también en el PC.

---

## Notificaciones propias: lo que se puede y lo que no

- **Aviso al abrir la app**: agrupa lo vencido y lo de hoy en una sola notificación.
- **`periodicsync`**: solo en la app instalada, y el navegador la dispara cuando le parece
  — como mucho cada pocas horas. Es una cortesía, no un despertador.
- **Lo que no existe**: programar una notificación para una hora concreta con la app
  cerrada. La API que lo permitía nunca llegó a producción, y el push de verdad necesita un
  servidor, que este proyecto no tiene. Para eso está el evento de Calendar.

---

## Sincronización entre móvil y PC

Todo se guarda primero en el dispositivo (IndexedDB) y después en la carpeta. La app
funciona entera aunque la carpeta no esté disponible; cuando vuelve, vuelca lo pendiente,
fotos incluidas.

El `global.json` de la carpeta es el punto de encuentro. Al sincronizar se lee, se
**fusiona** con lo local registro a registro quedándose con el más reciente, y se vuelve a
escribir solo si el resultado difiere de lo que había —reescribir por reescribir haría que
Drive volviese a subir el archivo en todos los dispositivos—. Los borrados dejan una marca
`deleted` en vez de desaparecer; si no, al fusionar volverían a aparecer.

Lo que esto no cubre: si editas **la misma tarea** en el móvil y en el PC sin sincronizar
en medio, gana la última guardada. Y si los dos escriben a la vez, Drive puede dejar una
copia en conflicto en la carpeta. Sin servidor no hay forma de hacerlo mejor, y para una
app personal el caso es raro.

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
