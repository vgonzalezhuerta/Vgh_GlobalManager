# Formato de `global.json`

Un solo archivo dentro de la carpeta `GlobalManager` del Drive del usuario. Si se cambia
el formato, hay que actualizar este documento en el mismo commit.

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
  "calendar": true,         // el usuario quiere recordatorio
  "calendarEventId": "abc123",
  "fields": [ { "k": "Modelo", "v": "ecoTEC plus VMW 246" } ],
  "photos": [ { "fileId": "1AbC…", "name": "foto_x.jpg", "w": 1600, "h": 1200 } ],
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

`from: "due"` se traduce a un `RRULE` y Calendar repite el evento solo. `from: "done"` no
es expresable como `RRULE` —depende de cuándo se haga— así que va como evento único y la
app lo recrea al completar la tarea.

### `photos`

Cada foto es un archivo aparte en la misma carpeta de Drive.

```jsonc
{ "fileId": "1AbC…", "name": "foto_x.jpg" }   // ya subida
{ "local": "foto_x.jpg", "name": "foto_x.jpg" } // hecha sin conexión, pendiente de subir
```

Mientras no tiene `fileId`, el blob espera en el almacén `subidas` de IndexedDB.
`subePendientes()` la sube y cambia `local` por `fileId` en todas las tareas que la citen.

## Almacenes de IndexedDB

| Almacén | Contenido |
|---|---|
| `meta` | `modelo` (copia local completa), `sync` (id y versión del archivo de Drive), `avisos` (resumen que lee el service worker) |
| `thumbs` | Miniaturas de 400 px, indexadas por `fileId` o clave local |
| `subidas` | Fotos hechas sin conexión, a la espera de subir |
