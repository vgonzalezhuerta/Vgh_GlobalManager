# Formato de `global.json`

Un solo archivo dentro de la carpeta de Google Drive que elige el usuario. Si se cambia el
formato, hay que actualizar este documento en el mismo commit.

```jsonc
{
  "schemaVersion": 1,
  "areas":    [ /* … */ ],
  "projects": [ /* … */ ],
  "modules":  [ /* … */ ],
  "people":   [ /* … */ ],
  "tasks":    [ /* … */ ]
}
```

## Campos comunes a todos los registros

| Campo | Tipo | Para qué |
|---|---|---|
| `id` | string | Identificador único, generado por la app |
| `updatedAt` | número | Milisegundos epoch de la última escritura. **Es el árbitro de la fusión** |
| `deleted` | bool | Marca de borrado. El registro se queda en el archivo |

Los borrados no quitan el registro: sin la marca, al fusionar con otro dispositivo que
todavía lo tenga, volvería a aparecer.

## `areas`

```jsonc
{
  "id": "l3k9x2",
  "name": "Casa",
  "icon": "🏠",
  "kind": "tasks",     // "tasks" | "gifts" | "shopping"
  "order": 0,
  "updatedAt": 1772539200000
}
```

`kind` decide el formulario y cómo se lee la lista:

- `tasks` — árbol de proyectos y módulos, fechas, periodicidad, historial.
- `gifts` — agrupado por persona, con precio y enlace.
- `shopping` — agrupado por tienda, con cantidad y botón de vaciar lo comprado.

## `projects` y `modules`

```jsonc
{ "id": "...", "areaId": "...", "name": "Caldera", "notes": "Vaillant, sótano", "order": 0 }
{ "id": "...", "areaId": "...", "projectId": "...", "name": "Circuito de agua", "notes": "" }
```

Los módulos llevan `areaId` además de `projectId`: así una consulta por área no tiene que
recorrer los proyectos para saber qué le pertenece.

## `people`

```jsonc
{ "id": "...", "name": "Marta" }
```

Solo se usan en las áreas de tipo `gifts`.

## `tasks`

```jsonc
{
  "id": "...",
  "areaId": "...",
  "projectId": null,        // null = cuelga directamente del área
  "moduleId": null,         // null = cuelga del proyecto (o del área)
  "title": "Revisar presión y purgar",
  "desc": "Presión entre 1,2 y 1,8 bar en frío.",
  "due": "2027-03-03",      // null si no tiene fecha
  "time": "09:00",          // hora del evento de Calendar
  "repeat": { "n": 6, "unit": "month", "from": "done" },
  "status": "open",         // "open" | "done"
  "doneAt": null,           // solo en las no periódicas ya archivadas
  "lastDoneAt": 1772540000000,
  "priority": 1,            // 0 normal, 1 alta, 2 urgente
  "calendarPuesto": 1772540000000,          // cuándo se abrió el enlace de Calendar
  "calendarSello": "2027-03-03|09:00|6monthdone",
  "fields": [ { "k": "Modelo", "v": "ecoTEC plus VMW 246" } ],
  "photos": [ { "name": "foto_x.jpg", "w": 1600, "h": 1200 } ],
  "log": [ { "at": 1772540000000, "note": "Purgado el radiador", "photos": [] } ],

  // solo en áreas "gifts"
  "personId": null, "price": null, "url": null,
  // solo en áreas "shopping"
  "qty": null, "store": null
}
```

### `fields` frente a `log`

Es la distinción que hace útil una tarea de mantenimiento:

- `fields` son **datos de referencia** que no cambian: el modelo del filtro, la presión
  correcta, la referencia del recambio. Se consultan cada vez.
- `log` es el **historial**: qué se hizo, cuándo, con qué notas y fotos. Crece con cada
  vez que se completa la tarea.

### `repeat`

| Campo | Valores |
|---|---|
| `n` | entero > 0 |
| `unit` | `day`, `week`, `month`, `year` |
| `from` | `due` (desde la fecha prevista) o `done` (desde que se completa) |

`from: "due"` se traduce a un `RRULE` que viaja en el enlace y en el `.ics`, y Calendar
repite el evento solo. `from: "done"` no es expresable como `RRULE` —depende de cuándo se
haga— así que va como evento único que se vuelve a proponer al completar la tarea.

### `calendarPuesto` y `calendarSello`

La app no puede modificar un evento que ya está en el calendario, ni saber si el usuario
llegó a guardarlo. Lo que sí puede es recordar **con qué datos** se abrió el enlace:
`calendarSello` es `due|time|periodicidad`. Si el sello actual no coincide con el guardado,
el evento del calendario se quedó viejo y la ficha lo marca como desfasado.

### `photos`

Cada foto es un archivo aparte en la misma carpeta, referenciado por su `name`.

Al hacer una foto, el blob se guarda en el almacén `subidas` de IndexedDB con el nombre que
tendrá. Si la carpeta está disponible se vuelca enseguida; si no, espera ahí a la próxima
sincronización. Leer una foto mira primero `subidas` y después la carpeta.

## Almacenes de IndexedDB

| Almacén | Contenido |
|---|---|
| `meta` | `modelo` (copia local completa), `root` (el handle de la carpeta elegida), `sync` (fecha del archivo leído), `avisos` (resumen que lee el service worker) |
| `thumbs` | Miniaturas de 400 px, indexadas por el nombre del archivo |
| `subidas` | Fotos a la espera de escribirse en la carpeta |
