# Spec: CORRECCION_DATOS — corregir los datos base de un lugar cuando Overture quedó viejo

**Estado:** ✅ Implementado (2026-08-09) — los 4 pasos en una sesión; QA **APROBADO** (26 casos `CORR-01..26` + 16 criterios de DoD por checkers independientes)
**Prioridad:** Media-alta — no rompe nada, pero hoy **no existe forma de arreglar un dato base
mal**, ni para el admin ni para el dueño con reclamo aprobado. El costo de no tenerlo no es una
ficha fea: es que el pin equivocado mueve al lugar en la búsqueda de **todos** (zona por
geometría, orden por distancia) y no hay palanca para tocarlo salvo un `UPDATE` a mano contra una
base **de producción** que el próximo re-import pisa en silencio.
**Gate:** Ninguno.
**Bloquea:** nada. Pero es prerrequisito honesto de cualquier re-import de Overture: hoy correr
`npm run import:overture` volvería a pisar cualquier corrección hecha a mano.
**Depende de:** [CATALOGO](../done/CATALOGO.md) (decisiones 4 y 19 — el import idempotente por
`overture_id`, las listas en `jsonb`) · [ZONAS](../done/ZONAS.md) (decisiones 12, 16, 17-18 —
`asignarLugar` como dueño único de la geometría) · [FICHA](../done/FICHA.md) (decisiones 7, 10,
11 — los field masks y el enum `google_match_status`, con su valor `manual`) ·
[AUTH](../done/AUTH.md) (decisiones 3, 8, 10, 12 — la cola de aprobación, `sesionAdmin`,
`esDuenoDe`, el `pin-picker` del alta) · [CURADURIA_POR_NOMBRE](../done/CURADURIA_POR_NOMBRE.md)
(decisiones 1 y 4 — `buscarLugaresPorNombre`, que **omite** `publishedWhere` a propósito) ·
[ADMIN_USUARIOS](../done/ADMIN_USUARIOS.md) (decisiones 7 y 13 — bitácora que no es fuente de
verdad, y no reordenar las tabs)

---

## Problema

El 2026-08-08 Fer buscó «Matienzo» y la ficha
([`7dbf6b2c-4b2a-4605-a425-df3ca24ce520`](/lugar/7dbf6b2c-4b2a-4605-a425-df3ca24ce520)) mostró la
**sede vieja**. Verificado contra la base el 2026-08-09:

```
name       Club Cultural Matienzo
address    Pringles 1249        locality  Buenos Aires
lat/lng    -34.5973293, -58.4262510
source     overture   confidence 0.77   operating_status open
```

El sitio oficial del club (`ccmatienzo.com.ar`) dice **Av. Juan B. Justo 2959**. El lugar **se
mudó** y la foto de Overture (release `2026-06-17.0`) tiene la dirección anterior. Prueba de que
es eso y no otra cosa: la **Accademia della Pizza que hoy ocupa Pringles 1249 no está en el
catálogo** — hay 6 sucursales cargadas y ninguna en esa dirección. El catálogo tiene al inquilino
viejo y le falta el nuevo.

**No es solo el texto de la ficha.** Las coordenadas también son las viejas, y de `lat/lng` salen
tres cosas que se ven en la búsqueda de todos:

1. La **zona**, por geometría. Hoy `place_zones` le da primaria `villa-crespo` y secundarias
   `botanico-alto-palermo`, `almagro-boedo`, `palermo-soho` — calculadas sobre el pin de Pringles.
2. El **orden por distancia** de «Cerca de mí» (`lib/search/query.ts`, la fórmula de haversine).
3. El **pin del mapa** de MapLibre.

**Y hoy no hay forma de arreglarlo, que es el hallazgo de verdad.** `place_owner_content` —la
única puerta que existe para pisar un dato de Overture— tiene `phone`, `website`, `socials`,
`opening_hours`, `description`, `menu_url` y `news`, y **no** tiene `address`, `lat`, `lng` ni
`name`. Ni el dueño con reclamo aprobado puede corregir su propia dirección. Y un `UPDATE` a mano
sobre `places` no sobrevive: `scripts/import-overture.ts` hace `onConflictDoUpdate` sobre
`overture_id` y **pisa las 13 columnas de Overture sin condición** — incluidas `name`, `address`,
`locality`, `lat` y `lng`.

**Descubierto al escribir este spec, y es peor que lo reportado:** ese lugar tiene
`google_match_status = 'matched'` con un `google_place_id` resuelto el 2026-08-09 00:38. El
matching (FICHA, decisión 8) busca con `locationRestriction` de **±300 m del pin propio** — o sea,
de Pringles 1249. El `google_place_id` que quedó guardado apunta a lo que Google tiene **en la
dirección vieja**, así que la ficha puede estar mostrando horarios, rating y foto **de otro
negocio**. Corregir el pin sin invalidar ese match dejaría el problema peor: dirección nueva con
datos de Google del local viejo (decisión 9).

## Objetivo

Que un dato base mal se pueda corregir, que la corrección **sobreviva al re-import**, y que quede
registrado quién la hizo y con qué fuente.

- **Admin edita directo**, desde `/admin`, buscando el lugar por nombre.
- **El dueño con reclamo aprobado propone**, desde `/mi-negocio/[placeId]`, y la propuesta **pasa
  por la cola de aprobación que ya existe**.
- El re-import **respeta campo por campo** lo que un humano corrigió, y **sigue actualizando todo
  lo demás**.

## Qué NO es esta feature

- **No es cambiar de fuente de datos.** El caso es un lugar que se mudó, no un problema de
  Overture como fuente. No se evalúa OSM (ya medido y descartado, `docs/product/cobertura-tags-2026-08-01.md`),
  ni Google como catálogo (prohibido persistirlo), ni un geocoder pago.
- **No es un editor completo de `places`.** Cinco columnas y nada más (decisión 3). `confidence`,
  `operating_status`, `publish_override`, `owner_plan`, `overture_category` y los contactos
  quedan afuera, cada uno con su dueño ya existente.
- **No toca la regla de visibilidad.** `lib/db/visibility.ts` no cambia una línea y `confidence`
  no se toca: corregir una dirección no publica ni despublica a nadie. Un lugar despublicado
  **sí** se puede corregir (decisión 15) — es justo uno de los que hay que arreglar.
- **No es una segunda puerta a `place_owner_content`.** Esa tabla no gana columnas y
  `resolverContenidoDueno` no cambia: sigue siendo el dueño único del COALESCE dueño→base para
  contacto y contenido. Esta feature escribe en `places`, que es otro eje.
- **No es un detector automático de lugares viejos.** Detecta un humano; el spec solo da la
  herramienta para arreglar. El detector está en § *v2*.
- **No borra ni crea lugares.** El local nuevo que ocupa Pringles 1249 (la Accademia della Pizza)
  **no** se da de alta acá: eso ya tiene camino propio (alta de dueño, AUTH decisión 12) y entrará
  solo en el próximo release de Overture.
- **No manda mails** (decisión 14).

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **La corrección se escribe en `places`, y al re-import se le enseña a no pisarla.** Decidido por Fer el 2026-08-08. **Se descartó guardarla en `place_owner_content`**: la ficha la vería pero **el mapa y la búsqueda no** — `lib/search/query.ts` lee `places.lat/lng/name/address` directo y **nunca** llama a `resolverContenidoDueno` (verificado: las tres proyecciones de la query, líneas 300, 381 y 460, y la fórmula de distancia de la 73). Arreglarlo por ahí obligaría a meter el COALESCE dentro del motor de búsqueda y de la asignación de zonas, que es el módulo más sensible de la app. Con la marca, el costo se muda al script de import, que corre pocas veces al año. **También se descartó el parche a mano** (`UPDATE` en dev + Neon): arregla un caso, se pierde en silencio en el próximo import y no escala |
| 2 | **La marca es POR CAMPO, no por lugar: `places.locked_fields`.** Es la pregunta abierta que más cambia el resultado, y se cierra por campo con un caso concreto: corregir la dirección de Matienzo no debería congelar su `name`, porque si el club se rebrandea, Overture lo va a traer bien y nosotros nos lo perderíamos para siempre. Un flag por lugar convierte cada corrección en un **opt-out permanente del catálogo**: el lugar más tocado sería el más desactualizado, que es exactamente al revés de lo que queremos. **Precedente en el repo de esta misma semántica:** `google_match_status = 'manual'` — *"lo fijó un humano. El resolver NUNCA lo pisa"* (`lib/lugar/enrichment.ts:66-71`). Acá es lo mismo, con granularidad de columna |
| 3 | **Cinco campos corregibles: `name`, `address`, `locality`, `lat`, `lng`.** Son los que Overture pisa **y** que ningún otro dueño ya resuelve. Quedan **afuera a propósito**: `phones` / `websites` / `socials` / `emails` (ya los pisa el dueño vía `place_owner_content` para lo único que importa, que es la ficha) · `confidence` y `operating_status` (los escribe Overture y los lee `visibility.ts`; tocarlos a mano es editar la regla de publicación desde la puerta de atrás, y para publicar a mano ya está `publish_override`) · `overture_category` (es trazabilidad del import para re-mapear sin volver a S3, no un dato de producto). `locality` entra —aunque parezca cosmético— porque **es una de las tres entradas del `textQuery` del matching con Google** (`lib/google/places.ts`, `MatchInput`) |
| 4 | **El import cambia en un solo lugar: el `set` del `onConflictDoUpdate`.** Cada columna corregible pasa de `excluded.x` a `CASE WHEN 'x' = ANY(places.locked_fields) THEN places.x ELSE excluded.x END`. Las 8 columnas no corregibles siguen igual, y todo lo demás del script —el filtro de categoría, los batches de 500, `reemplazarTagsDeImport`, el reporte— no se toca. Para que sea testeable sin pegarle a S3, ese objeto `set` se extrae a **`scripts/overture/upsert.ts`** (la carpeta ya existe, con `categories.ts` y `normalize.ts`) y el script lo importa. **No se hace un segundo camino de escritura**: es el mismo upsert, con la condición adentro |
| 5 | **`locked_fields` es `text[]`, no `jsonb` — divergencia declarada.** El CLAUDE.md dice que las listas del catálogo van en `jsonb`, pero ese criterio nació de una restricción concreta y ajena (las listas de Overture cruzan el driver de DuckDB serializadas a JSON, lección de CATALOGO), no de una preferencia de estilo. Acá el consumidor es un `ON CONFLICT DO UPDATE` de Postgres puro que necesita un test de pertenencia barato: `= ANY(places.locked_fields)` es una operación de array, sin I/O y sin parseo, contra ~26.057 filas × 5 columnas en cada corrida. Default `'{}'`, `not null` |
| 6 | **Un solo módulo escribe una corrección: `lib/negocio/correcciones.ts`.** Es el dueño único, y hace las cinco cosas **en una sola transacción**: (a) escribe los campos en `places`; (b) agrega los campos tocados a `locked_fields` (unión, nunca reemplazo — corregir la dirección hoy no puede desproteger el nombre corregido el mes pasado); (c) inserta la fila de bitácora; (d) re-asigna las zonas si se movió el pin (decisión 8); (e) invalida el match con Google si corresponde (decisión 9). Si aparece un `update(places).set({ address: … })` fuera de este módulo, el spec está mal implementado. El schema de validación (zod) vive al lado y reusa `AMBA_BBOX` para acotar el pin, igual que ya hace `lib/claims/validacion.ts:39-40` |
| 7 | **La bitácora y la cola son la misma tabla: `place_data_edits`. NO es fuente de verdad del estado.** El estado vigente se sigue leyendo de `places`, siempre; esta tabla se escribe y se lee para mostrar y para revisar, **nunca para decidir un gate** — mismo criterio que `plan_grants` (ADMIN_USUARIOS, decisión 7). Una sola tabla porque una propuesta de dueño y una edición de admin son **el mismo evento en distinto estado**: la del admin nace `approved` con `decided_by` puesto; la del dueño nace `pending`. **Forma:** `id uuid pk` · `place_id uuid not null → places(id) on delete cascade` · `requested_by uuid null → users(id) on delete set null` (`null` = admin actuando sin fila de usuario asociada) · `origen` enum `'admin' \| 'owner'` · `status` enum reusando `claim_status` (`pending`/`approved`/`rejected`) · `campos jsonb` con `{ campo: { antes, despues } }` de los campos tocados · `fuente text not null` (decisión 13) · `decided_by text null` (email del admin — mismo criterio que `place_claims.decided_by` y `app_settings_history.changed_by`: no hay tabla de roles que referenciar) · `decided_at`, `admin_notes`, `created_at`. Índices: `(place_id, created_at desc)` y uno **parcial** sobre `status='pending'`, que es lo único que lee la cola. **Guarda el `antes`** porque sin eso una corrección equivocada no se puede deshacer leyendo nada |
| 8 | **Mover el pin re-asigna la zona EN EL MOMENTO, no espera a `zones:assign`.** No es una optimización, es corrección: `place_zones` es lo que lee la búsqueda, así que entre la corrección y la próxima corrida manual del script el lugar aparecería en la zona equivocada — que es el bug que vinimos a arreglar, solo que con otra dirección. Y **no cuesta código nuevo**: `asignarZonasDeLugar` (`lib/zones/persistir.ts`) ya existe para esto y su propio docstring dice que sirve para *"el alta **o edición** de un lugar de dueño"* — la edición nunca había llegado. Acepta `tx`, así que entra en la transacción de la decisión 6. `zones:assign` sigue existiendo para el barrido masivo y **sigue siendo idempotente**: recalcula lo mismo desde el pin corregido |
| 9 | **⚠️ Corregir el pin o el nombre INVALIDA el match con Google.** El hallazgo de § *Problema*: el `google_place_id` se resolvió con `locationRestriction` a ±300 m del pin **viejo**, así que apunta a lo que hay en la dirección vieja. Si no se invalida, la ficha corregida muestra horarios, rating y foto de otro negocio — y `planDeMatching` con status `matched` devuelve `usar-existente`, o sea que **nunca se re-resuelve solo**. Regla: si cambió `lat`/`lng` **o** `name`, se pone `google_place_id = null`, `google_match_status = 'pending'`, `google_matched_at = null`, y la próxima apertura de la ficha re-matchea sola con Text Search **IDs-Only, que es $0** (FICHA, decisión 7). **Excepción: si el status es `manual`, no se toca** — ese valor significa que un humano fijó ese id a propósito y el automatismo no lo pisa. Cambiar solo `address` o `locality` **no** dispara el reset: si el pin no se movió, el match sigue apuntando al lugar correcto y re-resolver sería gasto sin motivo |
| 10 | **Si Overture después se pone al día, no pasa nada automático: se reporta y lo libera un humano.** El re-import ya recorre las filas corregidas, así que sabe gratis si el valor que trae coincide con el que tenemos. Al final imprime *"N campos fijados que Overture ya trae iguales"* con la lista, y `/admin` → Lugares ofrece **«Soltar»** por campo (saca el campo de `locked_fields`, deja fila de bitácora, no toca el valor). **Se descartó liberar solo** aunque los valores coincidan: parece gratis y no lo es — con `lat`/`lng` "igual" exige una tolerancia inventada, y el día que Overture traiga un dato *casi* igual y peor, el candado se abriría sin que nadie lo decidiera. Con unidades de correcciones por año, automatizar la liberación es resolver un problema que no existe. La marca **no vence por tiempo** |
| 11 | **Dos superficies con reglas distintas: admin edita directo, el dueño propone.** Decidido por Fer el 2026-08-08 y el porqué no es burocracia: `description` o `menu_url` solo tocan la ficha de quien los escribe, pero **el pin mueve al lugar en la búsqueda de todos**, y correr el pin a una zona de más tráfico es el incentivo clásico de spam en un directorio. El admin es el árbitro y hoy no tiene **ninguna** forma de tocar esto |
| 12 | **El dueño propone `address`, `locality`, `lat` y `lng`. El `name` es solo de admin** (confirmado por Fer, 2026-08-09). El nombre es la clave de dos cosas a la vez: el buscador (`lib/search/nombre.ts`, el índice GIN sobre `immutable_unaccent(lower(name))`) y el matching con Google. Renombrar una ficha ajena es el vector clásico de secuestro de listado, y el caso que originó el spec es una dirección, no un nombre. Un local que se rebrandea de verdad se arregla por admin, que es una conversación por año. En § *v2* queda anotado |
| 13 | **Fuente obligatoria, en las dos superficies.** Texto libre de 3 a 500 caracteres, validado **en la función** y no solo en la UI (el endpoint es un boundary). Es lo que hace que la bitácora sirva: *"quién"* con un solo admin vale poco, *"con qué lo verificó"* vale mucho — Fer resolvió el caso Matienzo en un minuto porque miró `ccmatienzo.com.ar`, y esa URL es el dato que hay que guardar. Para el dueño es además el único material que el admin tiene para aprobar o rechazar |
| 14 | **Sin mail, en ninguna dirección** (mismo criterio que ADMIN_USUARIOS, decisión 11). El dueño ve el estado donde ya está mirando: `/mi-negocio/[placeId]` muestra **«En revisión»** con lo propuesto, o el motivo del rechazo. Agregar un transaccional acá es plantilla, copy y una decisión más (qué decir en el rechazo) por un evento que hoy ocurre cero veces por mes: hay **1 reclamo aprobado en toda la base** |
| 15 | **El buscador de admin es `buscarLugaresPorNombre`, tal cual, sin moverlo.** Ya existe (`lib/curation/query.ts`), ya usa el dueño único del match por nombre, ya devuelve exactamente lo que esta pantalla necesita (`id`, `name`, `address`, `zonaNombre`, `publicado`) y —lo que lo vuelve el encaje correcto y no solo el conveniente— **omite `publishedWhere` a propósito**: un lugar despublicado es justo uno de los que hay que corregir. Se reusa desde el módulo nuevo sin `git mv`: mover un archivo que la curaduría usa hoy es un cambio no pedido. Si aparece un tercer consumidor, ahí sí se promueve a `lib/admin/` |
| 16 | **`/admin`: la cola existente + una 7ª tab «Lugares»** (confirmado por Fer, 2026-08-09). Las correcciones **pendientes** entran en la tab **«Cola de aprobación»**, leyendo literal la decisión de Fer: revisar una corrección es el mismo trabajo que revisar un reclamo, con el mismo criterio y la misma persona. El **buscador + editor + bitácora** van en una tab nueva **«Lugares», séptima y última**, sin mover las seis de arriba — mismo criterio que la decisión 13 de ADMIN_USUARIOS: corregir un dato base es más raro todavía que dar una cortesía, y mover una tab le rompe la memoria muscular a la única persona que usa la pantalla. **Se descartó** meterlo en la tab «Curaduría» (esa cola está optimizada para pasar rápido por muchos lugares etiquetando; esto es una edición rara, cuidadosa y auditada — una pantalla, dos trabajos sin relación) y **se descartó** un botón «Editar» de admin sobre la ficha pública (mete UI de admin en una página pública y rompe el patrón de que todo lo de admin vive en `/admin`) |
| 17 | **Una sola propuesta pendiente por lugar.** Segunda propuesta con una en cola ⇒ `{ ok: false, code: 'YA_PENDIENTE' }`, mismo código y mismo criterio que `crearReclamo` (`lib/claims/acciones.ts`): mandarla de nuevo no la apura, y dos propuestas vivas sobre las mismas columnas es una carrera de escrituras esperando pasar. Se hace con un **índice único parcial** sobre `place_id where status='pending'` — el mismo patrón que `place_claims_aprobado_idx`, con el gotcha de los índices parciales ya conocido del proyecto |
| 18 | **La dirección de Google en vivo: SÍ al field mask, y solo en el editor de admin** (confirmado por Fer, 2026-08-09). **El costo marginal está verificado en US$0 y esto es lo que faltaba chequear:** `formattedAddress` pertenece al SKU *Place Details **Essentials***, y la doc de Google dice textual *«You are then billed at the highest SKU applicable to your request. That means if you select fields in both the Essentials and the Pro SKUs, you are billed based on the Pro SKU»*. El mask de hoy **ya mezcla tres tiers** (`photos` = Essentials IDs-Only · `googleMapsUri` = Pro · `regularOpeningHours`/`currentOpeningHours`/`rating`/`userRatingCount`/`priceLevel` = Enterprise) y se factura **una sola vez a Enterprise**: agregar un campo Essentials no mueve el tier. O sea que la decisión 11 de FICHA (*"se factura una vez, al tier más alto pedido"*) queda **confirmada contra la doc**, no solo asumida. **Nada de Enterprise + Atmosphere sigue entrando** — la prohibición de la decisión 12 de FICHA no se toca. Mask nuevo: `id,formattedAddress,regularOpeningHours,currentOpeningHours,rating,userRatingCount,priceLevel,googleMapsUri,photos`, y el test que hoy falla ante un campo de más se actualiza a la constante nueva (sigue siendo exacto, no se afloja a un `contains`) |
| 19 | **La dirección de Google es SEÑAL, no fuente — y la señal es ASIMÉTRICA.** ⚠️ Precisión agregada el 2026-08-09, después de que Fer preguntara si esto sirve para saber si Overture tiene razón: **no sirve para eso, y la asimetría hay que tenerla escrita porque la pantalla no la muestra sola.** El match se resuelve con `locationRestriction` de ±300 m del pin **nuestro**, así que Google contesta sobre la dirección que ya tenemos ⇒ **que coincida no prueba nada** (puede ser el listado de Google también viejo, o directamente otro negocio de la misma cuadra), mientras que **que difiera sí es señal** de que algo está mal. El detalle entero, con los desenlaces posibles del caso Matienzo, está en § *v2*. Donde el campo **sí** rinde limpio es **después** de corregir: invalidado el match (decisión 9), el re-match sale del pin **nuevo**, y ahí *«Google dice: …»* funciona como **verificación de que la corrección aterrizó sobre un negocio real**. Por eso el copy dice *"es una pista, no la fuente"* y **no existe** un botón que escriba ese string en `places.address`: ese botón **es** persistir contenido de Google, que es exactamente la línea que trazó FICHA (*"solo se persiste `google_place_id`"*). El valor corregido tiene que venir de una fuente propia y verificable —el sitio del local, como hizo Fer con `ccmatienzo.com.ar`— que además es mejor dato: Google también puede estar viejo. Y se llega **sin un segundo llamador a Google**: el editor consume `GET /api/lugar/[id]/google`, el endpoint que ya existe, ya respeta `google.details_monthly_cap` y ya cuenta el uso en `google_api_usage`. La ficha pública **no** renderiza el campo (dos direcciones contradictorias confunden al visitante y no arreglan el pin, que es lo que estaba mal) |
| 20 | **⚠️ `npm run backup:db` antes de implementar y antes del QA.** La migración es aditiva, pero el QA de esta feature **escribe sobre `places`** — la tabla del catálogo, en la misma base de dev donde viven los ~3.967 tags de curaduría que no están en git ni en el seed. Y es la primera feature del proyecto que edita el catálogo: la regla del CLAUDE.md aplica con más razón, no con menos |

## Alcance del código (lo que se toca, y nada más)

| Archivo | Qué cambia |
|---------|-----------|
| `lib/db/schema.ts` | **`places.lockedFields`** (`text[]`, not null, default `'{}'`) · tabla **`placeDataEdits`** + enum `place_edit_origin` (reusa `claimStatusEnum`) + tipos inferidos (decisiones 2, 5, 7) |
| `drizzle/00XX_*.sql` | Migración **aditiva**: un `ADD COLUMN … DEFAULT '{}' NOT NULL` (sin reescritura de tabla en PG ≥ 11) + `CREATE TABLE` + los dos índices, uno **parcial** (decisión 17) |
| `lib/negocio/correcciones.ts` | **Nuevo.** El dueño único (decisión 6): `corregirDatos`, `proponerCorreccion`, `decidirCorreccion`, `soltarCampo` + los schemas zod. Devuelven `Resultado<T>`, el tipo que ya usan `lib/claims/acciones.ts` y `lib/billing/subscriptions.ts` — no se inventa uno nuevo |
| `lib/negocio/query.ts` | Lecturas para las dos pantallas: la propuesta pendiente de un lugar y su bitácora. Se extiende el módulo que ya existe |
| `scripts/overture/upsert.ts` | **Nuevo.** El objeto `set` del upsert, con el `CASE … = ANY(places.locked_fields)` en las 5 columnas corregibles (decisión 4). Extraído para poder testearlo sin pegarle a S3 |
| `scripts/import-overture.ts` | Importa ese `set` en vez de tenerlo inline, y suma al reporte la línea de campos fijados que Overture ya trae iguales (decisión 10). **Nada más del script cambia** |
| `lib/google/places.ts` | `PLACE_DETAILS_FIELD_MASK` gana **`formattedAddress`** (decisión 18). Ninguna otra línea |
| `lib/google/types.ts` · `lib/lugar/enrichment.ts` | `formattedAddress` viaja en `GoogleEnriquecimiento`. La ficha pública lo ignora (decisión 19) |
| `app/api/admin/lugares/route.ts` | **Nuevo.** `GET ?q=` (buscador) — mismo patrón que `app/api/admin/curaduria/route.ts`: gate `sesionAdmin` inline, mismo shape de 403, sin rate limit |
| `app/api/admin/lugares/[placeId]/route.ts` | **Nuevo.** `PATCH` (corregir) y `POST` de `soltar`. Adaptador HTTP fino: la validación de negocio vive en `correcciones.ts` |
| `app/api/admin/correcciones/[id]/route.ts` | **Nuevo.** `POST { accion: 'approve' \| 'reject', motivo? }`, gemelo del endpoint que ya decide claims |
| `app/api/mi-negocio/[placeId]/ubicacion/route.ts` | **Nuevo.** `POST` de la propuesta del dueño. Gate `esDuenoDe` (AUTH, decisión 11), sin tocarlo |
| `app/admin/lugares-client.tsx` | **Nuevo.** Buscador + editor + «Google dice» + bitácora + «Soltar» |
| `app/admin/cola-client.tsx` | Suma la lista de correcciones pendientes junto a los reclamos (decisión 16) |
| `app/admin/tabs.tsx` · `app/admin/page.tsx` | Séptima entrada en `TABS`; dos lecturas más en el `Promise.all` |
| `app/mi-negocio/[placeId]/editor-client.tsx` | Sección «Dónde estás» con el pin y el estado de la propuesta |
| `components/negocio/pin-picker.tsx` | **Se reusa tal cual** — ya existe desde el alta (AUTH, decisión 12) |

**Sin cambios en:** `lib/db/visibility.ts` · `lib/negocio/contenido.ts` · `lib/search/query.ts` ·
`lib/search/nombre.ts` · `lib/zones/asignar.ts` · `lib/zones/persistir.ts` · `lib/geo/amba.ts` ·
`lib/curation/query.ts` · `lib/claims/*` · `place_owner_content`.

## Orden de implementación (un tramo, cuatro pasos)

Sin fases formales. El orden importa porque el paso 2 es el que da valor y los otros lo rodean:

1. **Schema + migración** (con `backup:db` antes, decisión 20).
2. **`correcciones.ts` + el `set` del import + sus tests.** Se verifica entero sin una línea de
   UI, y es donde están todas las reglas. **Acá ya se puede arreglar Matienzo** con un test de
   integración; lo de abajo es para que no haga falta un test la próxima vez.
3. **La superficie de admin** (endpoints, 7ª tab, cola).
4. **La superficie del dueño.** Va última a propósito: hoy hay **1 reclamo aprobado en toda la
   base**, así que es la parte con menos uso inmediato y la primera que se puede diferir si el
   tramo se estira.

## Copy (rioplatense)

- Tab: **«Lugares»**. Buscador: placeholder **«Buscá el lugar por nombre»**. Sin resultados:
  **«No encontramos ningún lugar con ese nombre.»**
- Editor de admin: **«Datos base»**, con el aviso **«Esto lo ve todo el mundo: el pin también
  mueve al lugar en la búsqueda.»**
- Campo de fuente: **«¿De dónde lo sacaste? (queda registrado)»**, placeholder
  **«ccmatienzo.com.ar»**.
- Bloque de Google: **«Google dice: Av. Juan B. Justo 2959»** + **«Es una pista, no la fuente.
  Verificalo y escribilo vos.»**
- Confirmación al guardar con el pin movido: **«Moviste el pin. El lugar va a cambiar de zona y
  de orden en "Cerca de mí".»** Botón: **«Guardar la corrección»**.
- Campo fijado: badge **«Corregido a mano»** + **«Soltar»**. Al soltar: **«Vuelve a actualizarse
  con Overture.»**
- Panel del dueño: **«Dónde estás»** · **«Proponer un cambio»** · **«Lo revisamos antes de que se
  vea. Suele tardar poco.»**
- Estado pendiente: **«En revisión: Av. Juan B. Justo 2959»**. Rechazada: **«No lo tomamos:
  \<motivo\>»**.
- Ya hay una en cola: **«Ya tenés un cambio en revisión para este lugar.»**

## Edge cases

- **El pin corregido cae fuera de toda zona.** Cero filas en `place_zones` es un estado válido
  (ZONAS, decisión 17): la card se muestra sin zona. No es un error y no bloquea el guardado.
- **El pin corregido cae fuera del bbox de AMBA.** Rechazado en la validación, mismo criterio que
  el alta. Un lugar de AMBA no se muda a Córdoba: si pasa de verdad, es un lugar para despublicar,
  no para corregir.
- **Corregir un lugar despublicado.** Se puede, a propósito (decisión 15). No lo publica.
- **Overture deja de traer el lugar en un release futuro.** El import no borra nada, así que la
  fila y su corrección quedan como están. Fuera de scope, igual que hoy.
- **Se corrige un campo y después el admin lo suelta.** `locked_fields` pierde el campo, el valor
  corregido **queda** hasta el próximo import, que recién ahí lo pisa. Es lo esperado: soltar es
  *"volvé a seguir a Overture"*, no *"revertí ahora"*.
- **El dueño propone, y antes de que se apruebe el admin corrige el mismo campo a mano.** La
  propuesta sigue pendiente y su `antes` queda viejo. Al aprobarla se aplica igual y la bitácora
  muestra las dos filas en orden. No se agrega detección de conflicto: con este volumen, dos
  personas tocando el mismo lugar el mismo día no pasa, y el `antes` de cada fila deja rastro.
- **Se revoca el reclamo del dueño con una propuesta pendiente.** Queda pendiente y el admin la
  puede rechazar. No se cancela sola: `decidirClaim` no se toca (decisión 6 lo deja afuera del
  alcance a propósito).
- **`google_match_status = 'blocked'`** (match malo, marcado a mano). Corregir el pin **no** lo
  saca de `blocked`: ese valor dice *"no reintentar nunca"* y lo puso un humano. Se respeta.
- **Doble click en «Guardar»**. La segunda escritura es idempotente en `places` y en
  `locked_fields` (unión), pero **sí** deja una segunda fila de bitácora con `antes = despues`.
  Se acepta: la bitácora es un log de eventos, no un set.

## Criterios de done (DoD)

- [ ] `grep -rn "update(places)" lib/ app/ scripts/` no devuelve **ninguna** escritura de
      `name`/`address`/`locality`/`lat`/`lng` fuera de `lib/negocio/correcciones.ts` y del upsert
      del import (decisión 6) — el criterio central del spec, verificable por grep
- [ ] Corregir un campo lo agrega a `locked_fields` y **conserva los que ya estaban** (unión, no
      reemplazo) — con test
- [ ] **La prueba de fuego:** con `SET_UPSERT_PLACES` importado desde `scripts/overture/upsert.ts`,
      un upsert con datos de Overture distintos sobre un lugar con `locked_fields = {address,lat,lng}`
      **deja los tres intactos** y **sí actualiza** `phones`, `confidence` y `overture_category`
      — test de integración contra la base, sin S3
- [ ] Mover el pin re-asigna `place_zones` **en la misma transacción**, y correr `zones:assign`
      después **no cambia ni una fila** de ese lugar (decisión 8) — verificado con `SELECT`
- [ ] Mover el pin de un lugar con `google_match_status='matched'` lo deja en `pending` con
      `google_place_id` en `null`; con `'manual'` **no lo toca**; cambiar solo `address` **no lo
      toca** (decisión 9) — con test para los tres casos
- [ ] Fuente vacía o de menos de 3 caracteres ⇒ rechazado **en la función**, no solo en la UI
      (decisión 13) — con test
- [ ] Segunda propuesta de dueño con una pendiente ⇒ `YA_PENDIENTE`, sin fila nueva (decisión 17)
      — con test
- [ ] El dueño **no puede** proponer `name`: el schema lo rechaza aunque venga en el body
      (decisión 12) — con test sobre el endpoint
- [ ] `PLACE_DETAILS_FIELD_MASK` es **exactamente** la constante de la decisión 18 y el test que
      la guarda sigue siendo una igualdad exacta; **cero** campos de Atmosphere (`reviews`,
      `editorialSummary`) — el test existente de FICHA sigue pasando
- [ ] La ficha pública **no** renderiza `formattedAddress` (decisión 19) y **no existe** ningún
      botón que escriba un valor de Google en `places.address` — verificable por lectura
- [ ] Ninguna consulta de gating lee `place_data_edits`: `grep -rn "placeDataEdits" lib/` solo
      aparece en `schema.ts`, `correcciones.ts` (escritura) y `negocio/query.ts` (lectura para
      mostrar) — decisión 7
- [ ] La migración es aditiva (un `ADD COLUMN` con default + `CREATE TABLE` + índices, ningún
      `ALTER` destructivo) y `npm run db:migrate` corre limpio
- [ ] La tab **Lugares** existe, es la séptima, y las seis anteriores mantienen su orden
      (decisión 16)
- [ ] `GET /api/admin/lugares`, `PATCH /api/admin/lugares/[placeId]` y
      `POST /api/admin/correcciones/[id]` responden **403 sin sesión de admin**, con el mismo
      shape de error que las rutas de admin existentes; `POST /api/mi-negocio/[placeId]/ubicacion`
      responde 403 a quien no es dueño aprobado
- [ ] **El caso que originó el spec, arreglado de punta a punta:** Matienzo queda en
      `Av. Juan B. Justo 2959` con su pin, su zona primaria recalculada desde el pin nuevo, su
      match de Google invalidado, y `locked_fields = {address,lat,lng}`
- [ ] `npm run backup:db` corrido antes del QA (decisión 20) · typecheck + tests + build en verde
      (el build con el dev server parado)

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| CORR-01 | `/admin` → tab **Lugares** | Existe, es la séptima; las otras seis no se movieron |
| CORR-02 | Buscar «Matienzo» | Aparece con su dirección actual y su zona; un nombre inexistente da el vacío con copy |
| CORR-03 | Buscar un lugar **despublicado** (confidence baja) | Aparece igual, etiquetado como no publicado (decisión 15) |
| CORR-04 | Guardar sin completar la fuente | No deja; el `PATCH` forzado también lo rechaza |
| CORR-05 | Corregir la dirección de Matienzo a `Av. Juan B. Justo 2959` + mover el pin | Guarda; la confirmación avisa que cambia de zona y de orden |
| CORR-06 | `SELECT` sobre `places` tras CORR-05 | `address`, `lat`, `lng` nuevos; `locked_fields = {address,lat,lng}`; `name` **no** está en la lista |
| CORR-07 | `SELECT` sobre `place_zones` tras CORR-05 | Las filas se recalcularon desde el pin nuevo, con una sola primaria |
| CORR-08 | `npm run zones:assign` después de CORR-07 | **Cero** filas cambiadas para ese lugar (decisión 8) |
| CORR-09 | `SELECT google_*` tras CORR-05 | `google_place_id` en `null` y status `pending` (decisión 9) |
| CORR-10 | Abrir la ficha de Matienzo | Dirección nueva; el bloque de Google vuelve a resolver solo y muestra datos del local **nuevo** |
| CORR-11 | Buscar «Cerca de mí» parado en Juan B. Justo | Matienzo ordena por la distancia nueva; el pin del mapa está donde va |
| CORR-12 | Corregir **solo** `address` de otro lugar `matched` | El match de Google **no** se invalida (decisión 9) |
| CORR-13 | Un lugar con `google_match_status='manual'`, moverle el pin | El `google_place_id` queda intacto |
| CORR-14 | Editor de admin de un lugar matcheado | Muestra «Google dice: …» y **no** hay botón de copiar (decisión 19) |
| CORR-15 | Consola de facturación de Google tras 10 aperturas de ficha | Los eventos siguen en Place Details **Enterprise**, misma cantidad que antes, y **cero** en Atmosphere (decisión 18) |
| CORR-16 | Bitácora del lugar de CORR-05 | Quién, cuándo, la fuente tipeada, y el **antes** de cada campo |
| CORR-17 | «Soltar» el campo `address` | Sale de `locked_fields`, queda fila de bitácora, el valor **no** cambia |
| CORR-18 | Correr el import (o el test de integración de la prueba de fuego) | Los campos fijados sobreviven; los no fijados se actualizan; el reporte lista los fijados que Overture ya trae iguales |
| CORR-19 | Dueño en `/mi-negocio/[placeId]` → «Proponer un cambio» | Puede mover el pin y editar la dirección; **no** hay campo de nombre |
| CORR-20 | Tras CORR-19 | El panel dice «En revisión»; `places` **no** cambió (`SELECT`) |
| CORR-21 | Segunda propuesta del mismo dueño | «Ya tenés un cambio en revisión para este lugar.» |
| CORR-22 | `/admin` → Cola de aprobación | La corrección pendiente aparece junto a los reclamos, con el antes/después y la fuente |
| CORR-23 | Aprobar la propuesta | Se aplica a `places`, re-asigna zonas, invalida el match, y el panel del dueño lo muestra aplicado |
| CORR-24 | Rechazar una propuesta con motivo | `places` intacto; el dueño ve «No lo tomamos: \<motivo\>» |
| CORR-25 | `POST /api/mi-negocio/[placeId]/ubicacion` sobre un lugar **ajeno** | 403; `SELECT` confirma que no se escribió nada |
| CORR-26 | `POST` de dueño forzado con `name` en el body | Rechazado por el schema; el nombre no cambia (decisión 12) |

## Esfuerzo estimado

Una sesión, del orden de `ADMIN_USUARIOS`. El backend es un módulo nuevo chico sobre piezas que
ya existen enteras (`asignarZonasDeLugar`, `buscarLugaresPorNombre`, `pin-picker`, `esDuenoDe`,
`Resultado<T>`), y el cambio del import es un `CASE` en cinco columnas. El grueso es UI: una tab
con buscador y editor, un bloque en la cola y una sección en el panel del dueño. El paso 4 (la
superficie del dueño) es lo primero que se difiere si hace falta.

## Relación con otros specs

- **Cierra un hueco de AUTH F3.** `place_owner_content` resolvió el contacto y el contenido, y
  dejó afuera la ubicación sin decirlo — porque en AUTH el dueño *no podía* estar mal ubicado: el
  único lugar con pin propio era el que él mismo daba de alta. El hueco aparece recién cuando
  Overture, no el dueño, es quien se equivoca.
- **Confirma la decisión 11 de FICHA contra la doc de Google** (decisión 18). Ese spec asumía que
  el field mask se factura una sola vez al tier más alto; ahora está verificado y citado. La
  prohibición de Atmosphere y la de persistir contenido de Google no se aflojan: la decisión 19 es
  esa misma línea aplicada a un campo nuevo.
- **Le pone una condición a CATALOGO.** El import deja de ser *"Overture manda en sus 13
  columnas"* y pasa a *"Overture manda salvo donde un humano dijo lo contrario"*. Al implementarlo
  hay que actualizar el docstring de `scripts/import-overture.ts` —que hoy lista qué se preserva
  (`google_place_id`, `publish_override`, tags con `source != 'import'`)— y el **CLAUDE.md**
  § *Lógica de negocio crítica*, con `lib/negocio/correcciones.ts` en la lista de *Una regla, un
  dueño*.
- **No toca** BUSQUEDA ni ZONAS, pero **los mueve**: una corrección de pin cambia zona, distancia
  y mapa. Por eso la re-asignación va en la misma transacción y no en un script diferido.

## v2 (fuera de scope, con su razón)

- **Detector automático de datos viejos — y ⚠️ el camino obvio NO funciona.** La idea natural es
  comparar `formattedAddress` contra la nuestra en cada apertura de ficha y guardar una marca de
  discrepancia. **Es circular y hay que decirlo antes de que alguien lo implemente:** el Text
  Search del matching busca con `locationRestriction` de **±300 m alrededor de nuestro propio
  pin**, así que Google solo puede contestar sobre la dirección **vieja**. En el caso Matienzo, Av.
  Juan B. Justo 2959 cae **fuera de esa caja** y no puede ser devuelto ni aunque Google lo tenga
  bien: los tres desenlaces posibles —el listado de Google también viejo, otro negocio cerca de
  Pringles, o nada— terminan en *"coincide, está todo bien"*. **Falso negativo justo en el caso que
  motivó el spec.**
  **Lo que sí detectaría una mudanza, y también sale $0:** dos Text Search **IDs-Only** por lugar
  —uno anclado a ±300 m como hoy, otro con bias amplio sobre AMBA— y **comparar los dos `id`**. Si
  difieren, el lugar se movió o el match nunca fue ese. Nunca se pide la dirección, así que nunca
  se sale del tier gratis. **Con la salvedad honesta**: buscar por nombre sobre todo AMBA trae
  ruido (hay varios "Matienzo"; con cadenas como las 6 Accademia della Pizza es peor), así que
  sirve como **bandera para revisión humana**, no como verdad. Antes de escribirlo hay que
  probarlo sobre ~20 lugares conocidos y medir la tasa de falsos positivos.
  **Y lo que NO hay que hacer: barrer el catálogo pidiendo direcciones.** Los números, verificados
  el 2026-08-09: Place Details Enterprise a $20/1.000 × 26.057 lugares ≈ **US$500** (ya
  descontadas las 1.000 gratis del mes), y por Text Search es peor —`places.formattedAddress` ahí
  es **Pro**, $32/1.000 ⇒ ≈ **US$834**—. El US$0 de la decisión 18 es **marginal**: vale sobre la
  llamada que ya se hace cuando un humano abre una ficha, no sobre un barrido. Hoy hay **30
  lugares matcheados de 26.057**, así que el detector gratis solo cubre lo que tiene tráfico — que
  es, igual, la misma filosofía del ítem 3 de la cola post-v2 (curar por uso real, no los 14.458).
- **Que el dueño proponga el `name`** (decisión 12). Entra el día que haya un rebranding real y
  más de un puñado de dueños; hasta entonces el admin lo resuelve en una conversación por año.
- **Corregir contactos desde acá.** `phones`/`websites`/`socials` ya tienen puerta para la ficha
  vía `place_owner_content`. El día que la búsqueda los use para algo, se evalúa.
- **Deshacer una corrección con un click** leyendo el `antes` de la bitácora. La tabla ya guarda
  todo lo necesario (decisión 7); es UI y una función más. No entra porque con unidades de
  correcciones por año, deshacer es *corregir de nuevo*.
