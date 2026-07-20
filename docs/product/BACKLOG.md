# Backlog — A Dónde Salimos

Cola de trabajo. Una línea por ítem + link al spec cuando exista. El **detalle de diseño**
vive en `docs/specs/`, no acá.

Convención: `- [ ]` pendiente · `- [x]` hecho (con fecha) · `→ spec:` link si tiene spec.

---

## Próximo

Volcado de producto **completo** (tanda 5, 2026-07-19). Cola de specs en orden — el detalle
del porqué de este orden está en `docs/product/IDEAS.md` § Estado de la conversación.

- [ ] **Paso 0 — scaffold de Next.js** (no es un spec; hoy no hay `package.json`)
- [ ] **Catálogo + import de Overture** — schema, tags semilla, `confidence`/`operating_status`, atribución → spec: `docs/specs/planned/CATALOGO.md` (escrito 2026-07-19; siembra 96 tags — suma corregida y confirmada por Fer)
- [ ] **Zonas** — 46 polígonos (los 4 de Palermo particionados a mano), zona primaria + buffer 400 m → spec: `docs/specs/planned/ZONAS.md` (escrito 2026-07-19)
- [ ] **Búsqueda + filtros** — home/search, motor en Postgres, chips de Ocasión en DB, mapa MapLibre → spec: `docs/specs/planned/BUSQUEDA.md` (escrito 2026-07-19; 3 fases)
- [~] **Ficha** — `/lugar/[id]`, primer uso de Google en vivo → spec: `docs/specs/active/FICHA.md`. **F1 (ficha propia) ✅ 2026-07-20 · F2 (Google en vivo) ✅ 2026-07-20**; F3 (foto/atribución) pendiente — la key ya está en `.env`; F3 necesita además una fila manual en `place_photos` para el camino dueño→Google
- [ ] **Auth + roles + reclamo de negocio**
- [ ] **Votación en grupo**
- [ ] **Monetización (MercadoPago)** — mucho reuso de StressPlan

## Mejoras futuras (fuera de v1)

- [ ] **Filtro "Abierto ahora"** — el tag existe en la taxonomía pero no se muestra en v1:
      el catálogo no tiene horarios (Overture no trae; Google no deja cachear). Se activa
      cuando haya masa de horarios propios de dueños. Decidido en el spec BUSQUEDA (2026-07-19).
- [ ] **Favoritos / listas guardadas** — free: 1 lista ("Mis lugares") · premium: listas
      múltiples con nombre. Decidido fuera de v1 el 2026-07-19 (tanda 5) para no agrandar
      el alcance. Ver `docs/product/IDEAS.md` § Monetización.
- [ ] **Rotación de los chips de Ocasión de la home** por día/hora (martes 18h → "After
      office"). En v1 son fijos. Requiere datos de uso reales.
- [ ] **Sugerir lugar en una votación** (que los votantes agreguen opciones). En v1 solo
      el creador arma la cancha.
- [ ] **Carga de lugares por consumidores** — requiere sistema de moderación/reportes.
- [ ] **Verificación automatizada de dueños** — en v1 la aprobación es manual en `/admin`.
- [ ] **Refresh anual del `google_place_id`** — Google recomienda refrescarlo a los 12 meses
      y vía Place Details *IDs Only* es gratis. Decidido fuera de v1 en el spec FICHA
      (2026-07-19): con el catálogo recién nacido no hay IDs viejos que refrescar.
- [ ] **Batch de matching Overture↔Google** — precalentar `google_place_id` de todo el
      catálogo en vez de resolverlo perezosamente al abrir cada ficha. Cuesta $0 (IDs Only)
      pero son ~27.000 requests para lugares que quizá nadie visite. Ver spec FICHA.
- [ ] **Slug SEO en la URL de la ficha** — hoy `/lugar/[id]` con uuid (fijado en BUSQUEDA).
      Un `/lugar/nombre-zona-xxxx` ayuda al descubrimiento orgánico.
- [ ] **`/admin` para corregir matches de Google** — en v1 se corrige por `UPDATE`
      documentado, igual que el umbral de confidence.
- [ ] **Medir la tasa de falsos positivos del matching a ciegas** (FICHA F2, 2026-07-20).
      Primer caso real: "Club Milanesa @ Av. Libertador 3883" matcheó a "El Club de la Milanesa
      – Paseo de la Infanta" (~160 m, misma marca), mientras esa dirección exacta en Google es
      "Williamsburg Infanta". Es el riesgo que la **decisión 8** aceptó (IDs-Only $0 ⇒ sin nombre
      ni distancia para comparar; salvaguardas solo de entrada, ±300 m). **Riesgo aceptado por
      Fer (2026-07-20): no se toca nada del código por ahora.** Antes de decidir si se achica el
      radio, hacer el spot-check de FICHA-03 (10 fichas) para saber si la tasa es 1% o 20%.
      Opciones si molesta: radio menor (pierde matches con pin corrido), Text Search Pro para
      verificar nombre/distancia (rompe el modelo $0, $32/1.000), o corrección manual
      (`google_match_status='blocked'|'manual'`, la red actual). Ver `docs/qa/AnalisisQA.md`
      § FICHA F2 (FICHA-03) y `docs/operations/LECCIONES_APRENDIDAS.md`.
- [ ] **Nombres imperfectos de Overture en la ficha** (FICHA F2, 2026-07-20). La ficha muestra
      "Club Milanesa" y el nombre real es "El Club de la Milanesa". El nombre sale **siempre de
      Overture, nunca de Google** — por ToS (no se persiste el nombre de Google), costo
      (`displayName` es tier Pro, ni se pide) y diseño (decisión 13). Se corrige con curaduría
      o con el reclamo del dueño (spec 5), no trayendo el nombre de Google. Calidad de dato de
      origen, no bug.
- [ ] **Horario de cierre del día en la ficha ("cierra 0:30")** (FICHA F2, 2026-07-20). El
      bloque de Google muestra abierto/cerrado (`openNow`) + la semana completa
      (`weekdayDescriptions`), no la hora de cierre de hoy que dibuja el mockup. Derivarla
      exige la zona horaria del lugar y parsear `periods`/`nextCloseTime` — no entró en F2
      porque `openNow` + la semana ya cumplen el criterio FICHA-07. Cosmético.
- [ ] **Íconos de marca en las redes de la ficha** (FICHA F1, 2026-07-20). Las redes se
      muestran como chips de texto ("Instagram", "Facebook", "X", "TikTok") porque
      `lucide-react` removió los íconos de marca. Cuando se quiera el ícono, traerlos como
      SVG propios o de otra librería. `clasificarRed` ya devuelve la plataforma; solo falta
      el mapeo a ícono. Cosmético, no bloquea.

- [ ] **`operating_status` no filtra nada todavía** — Overture entrega el campo NULL en el
      100% de los 26.057 lugares de AMBA, y el import los persiste como `'open'`. El filtro
      está implementado y testeado, pero hoy no descarta a nadie. Búsqueda **no debe asumir**
      que ya oculta lugares cerrados; revisar cuando Overture empiece a poblarlo o cuando
      entren lugares de dueño (spec 5). Ver `docs/qa/AnalisisQA.md` § CATALOGO, hallazgo H-2.
- [ ] **Zonas faltantes del conurbano — 2.200 lugares (8,4%) sin zona** (ZONAS, 2026-07-20).
      El canon de 46 no incluye partidos densos y céntricos: José C. Paz (153 lugares),
      Gregorio de Laferrere (147), General Rodríguez (131), González Catán (113),
      Hurlingham (101), Ezeiza (84), Isidro Casanova (84), Longchamps (83), Guernica,
      Grand Bourg, San Vicente, Marcos Paz. **El spec anticipaba que los sin zona serían
      "minoría en los bordes del bbox"; no es así — están en el medio del conurbano.**
      No es un bug de implementación: es un hueco del canon. Decidir si se agregan zonas
      (deja de ser 46 y hay que actualizar el spec) o si se acepta que esos lugares solo
      aparezcan por texto y GPS. Ver `data/zones/README.md` § Cobertura real.
      **No bloquea BÚSQUEDA** (spec 3): el selector lee la tabla `zones`, así que agregar
      zonas después no toca código de Búsqueda — se re-corre `zones:build` + `load` +
      `assign` y listo. Conviene decidirlo **con el buscador andando**, para saber si el
      8,4% molesta en la práctica o es invisible.
- [ ] **Villa Lugano, Villa Soldati y Villa Riachuelo cuelgan de `flores-floresta`**
      (ZONAS, 2026-07-20). El canon no tiene una zona del sur de CABA, así que esos tres
      barrios quedan en una zona cuyo nombre no los menciona. Es el reparto más discutible
      del mapa de CABA; dejarlos sin zona hubiera sido peor. Candidato a zona propia.
- [ ] **Afinar el polígono de Las Cañitas** (ZONAS, 2026-07-20). Es algo más ancho que la
      franja gastronómica de Báez e incluye parte del Campo de Polo y los cuarteles: 52
      lugares publicados por km² contra ~315 de Palermo Soho. Nombre y ubicación correctos,
      precisión mejorable. Curaduría, no código.
- [ ] **Volver a ARBA para los partidos si arreglan el servidor** (ZONAS, 2026-07-20).
      `limite-partidos-pba.zip` es CC BY 4.0 —licencia estándar y trazable, mejor que los
      TyC propios del IGN— pero hoy el servidor entrega 97.071 bytes de los 7.796.169
      declarados, de forma determinística. Se usó IGN como fallback.
- [ ] **La faceta Precio está vacía: 0 filas en `place_tags`** (BUSQUEDA, 2026-07-20). Los 4
      tags `precio-1..4` existen y no los usa ningún lugar. No es un bug del import: Overture
      no trae precio y `places` no tiene columna de la que derivarlo. Google sí expone
      `price_level`, pero es dato de Google — mostrable en vivo en la ficha, **no persistible
      ni filtrable** (ToS). Se llena solo con curaduría o con dueños (spec 5). Hasta entonces
      el filtro de Precio se muestra pero cualquier combinación que lo use da cero.
      **Decidido en F2 (2026-07-20): se oculta** — decisión 27 del spec, un tag con cero
      lugares no se lista y una faceta que queda vacía tampoco. Reaparece sola cuando haya
      datos, sin deploy. Lo que sigue abierto es **cargar los precios**, que es curaduría.
- [ ] **Actividad está pegada a un solo Tipo: cruzar las dos facetas da casi siempre cero**
      (BUSQUEDA, 2026-07-20). 12 de 13 tags de Actividad conviven con exactamente un Tipo
      (`musica-en-vivo` solo con `teatro-espacio-cultural`, `dj` solo con `boliche`…), porque
      `scripts/overture/tag-map.ts` mapea cada categoría de Overture a un Tipo y una Actividad
      a la vez. No es un bug del motor de búsqueda: la semántica AND funciona, los datos no la
      acompañan. Se despega con curaduría o dueños, o revisando el tag-map para asignar
      Actividad por otros criterios además de la categoría.
- [ ] **Cobertura rala de Ambiente (0,9%) y Momento (0,6%)** (BUSQUEDA, 2026-07-20). El import
      de Overture casi no las llena — la decisión 20 del spec lo anticipaba, la magnitud no.
      Son el diferencial del producto y hoy están casi vacías: es la carga de curaduría más
      grande pendiente. Ver la medición en el spec BUSQUEDA § *Medición de cobertura*.
- [ ] **`zone_aliases` tiene 4 filas: el autocompletar por alias casi no tiene con qué**
      (BUSQUEDA, 2026-07-20). Villa Ortúzar, Balvanera, San Nicolás y Villa Devoto son todos
      los alias de las 46 zonas. El mecanismo funciona (verificado en F2), pero cubre 4
      barrios. Cargar alias es curaduría barata y de alto impacto en la búsqueda: los barrios
      absorbidos por un merge de zona son los que la gente tipea. Ver la nota de BUSQ-05 en el
      spec. **Son 3, no 4** (BUSQUEDA F3, 2026-07-20): al verificarlos uno por uno se vio que
      *Villa Devoto* matchea por nombre de zona ("Villa Devoto y Villa del Parque"), así que su
      fila de alias es redundante. Los que agregan capacidad son Villa Ortúzar, Balvanera y
      San Nicolás.
- [ ] **Sugerencias del campo de texto sin trgm** (BUSQUEDA, 2026-07-20). F2 matchea tags y
      zonas con substring sin acentos sobre el catálogo en memoria (~150 items), en vez del
      trgm que pedía la decisión 14 — evita un fetch por tecla y a esa escala el trigrama no
      cambia lo que el usuario ve. Si el catálogo de tags crece un orden de magnitud, mover a
      un endpoint con `word_similarity`, que es lo que ya usa la búsqueda por nombre de lugar.
- [ ] **Los 8 chips de Ocasión objetivo siguen apagados** (BUSQUEDA F3, 2026-07-20). Están
      sembrados en `occasion_chips` y se prenden **solos** en cuanto sus tags tengan lugares
      (decisión 25: es un conteo, no `active`). Dependen de la carga de Ambiente/Momento/Precio
      — es el mismo trabajo de curaduría que ya está anotado arriba, y este es su primer
      beneficiario visible. Ver spec BUSQUEDA § *Curaduría V1 de chips*.
- [ ] **"Cenar afuera" devuelve 11.438 lugares en AMBA** (BUSQUEDA F3, 2026-07-20). Es el
      riesgo "devuelve 8.000 lugares" que IDEAS ya anotaba. En una zona concreta da 262-527,
      que es como se usa de verdad (la home pide zona primero), así que no bloquea. Se afina
      partiéndolo por Cocina cuando esa faceta tenga curaduría (hoy 37,7%).
- [ ] **Tocar un chip sin zona elegida busca en AMBA entera** (BUSQUEDA F3, 2026-07-20).
      `tieneBusqueda` se satisface con tags solos, así que un chip sin zona dispara una
      búsqueda de 18.993 paginada de a 20. No rompe nada y el resultado es honesto, pero
      contradice el espíritu de la decisión 2 ("zona es el gesto default"). Decidir si el chip
      abre el selector de zona en vez de buscar.
- [ ] **Sobreconteo de impresiones con `gps=1` + zonas en la URL** (BUSQUEDA F3, 2026-07-20).
      El server renderiza por zona (no tiene coordenadas) y el cliente reemplaza al obtener
      permiso: esos 20 lugares suman impresión habiéndose visto un instante. Caso de borde de
      una métrica agregada; se arregla no registrando en el server cuando `params.gps` está
      prendido y todavía no hay coordenadas.
- [ ] **[QA — sin verificar] El filtro de zona no restringe el resultado al cruzarlo con una
      actividad** (BUSQUEDA, observado 2026-07-20). Repro: `/?z=almagro-boedo&t=escape-room`
      (los dos filtros aplicados y visibles como chips activos) devuelve **3** escape rooms, no 1:
      *Escape Games Almagro* (zona primaria Almagro y Boedo ✓), *Club del Escape Palermo*
      (Palermo Soho ✗) y *Escape Juniors Caballito* (Caballito ✗). El motor dice hacer **AND
      entre facetas** (`construirWhere`, `lib/search/query.ts`), así que debería dar solo los de
      la zona. Palermo Soho y Caballito están a mucho más de 400 m de Almagro/Boedo, así que el
      buffer de búsqueda no lo explica. **Causa sin diagnosticar** — candidatos: el filtro de zona
      se cae al combinarse con tag, `filtroDeZonas` matchea filas de `place_zones` que no debería,
      o esos lugares tienen una asignación de zona incorrecta. **NO tocar hasta la sesión de QA
      de BÚSQUEDA** (decisión de Fer, 2026-07-20: no adelantarse). Encontrado de paso durante la
      QA en vivo de FICHA F2.
- [ ] **Regla compuesta de rescate de la cola** (confidence bajo + teléfono + redes ⇒ real) —
      quedó 💡 sin decidir. Hay 7.064 lugares bajo el umbral esperando; con el corte en la
      query, probarla es gratis.

## Hecho

- [x] **Spec 4 — FICHA · Fase 2** (2026-07-20): enriquecimiento en vivo de Google.
      `lib/google/places.ts` (módulo único, server-only, key solo ahí) con los field masks
      testeados (`places.id` en el resolver = $0; Enterprise sin Atmosphere en Details),
      `lib/google/usage.ts` (contadores por SKU con tope editable en `app_settings`),
      `lib/lugar/enrichment.ts` (orquestación **pura** del gasto: estados de match, reintento,
      corte por cuota antes de llamar), `GET /api/lugar/[id]/google` (rate limit propio, 204
      en todo camino sin datos, se pide desde el cliente) y `app/robots.ts` bloqueando `/api/`.
      QA de fase: typecheck + 204 tests + `npm run build` verde (key con 0 ocurrencias en
      `.next/static`) + QA en vivo con Playwright — ver `docs/qa/AnalisisQA.md` § FICHA F2.
      **F3 pendiente** (spec sigue en `active/`). La QA en vivo dejó un miss de matching
      documentado (FICHA-03, riesgo aceptado por Fer).
- [x] **Spec 4 — FICHA · Fase 1** (2026-07-20): `/lugar/[id]` renderiza la ficha completa
      con datos propios (Overture + ZONAS), **sin ninguna llamada a Google** — cierra el 404
      al tocar una card. Migración 0003 con el modelo de datos completo del spec
      (`google_match_status`/`matched_at`, `place_photos`, `google_api_usage`, `detail_views`,
      3 claves `google.*`), `getPlaceDetail` con gate de visibilidad, helpers puros
      (`lib/lugar/ficha.ts`), `generateMetadata` con OG solo-propio y `detail_views` en
      `after()`. QA de fase: typecheck + 165 tests + smoke en vivo — ver `docs/qa/AnalisisQA.md`
      § FICHA F1. **F2 y F3 pendientes** (spec sigue en `active/`).
- [x] **Spec 3 — BUSQUEDA** (2026-07-20): home/search en 3 fases — motor en Postgres
      (`unaccent`+`pg_trgm`, cursor keyset), selectores de zona y filtros con contador en vivo,
      chips de Ocasión en DB (17 sembrados), vista mapa MapLibre con tope de 200 pins e
      impresiones agregadas por día. QA APROBADO 12/12 (BUSQ-QA-09 verificado en vivo con
      Playwright) — ver [SPECS_ARCHIVO](../archive/SPECS_ARCHIVO.md#busqueda).
- [x] **Spec 2 — ZONAS** (2026-07-20): 46 zonas de AMBA como GeoJSON versionados (CABA de
      BA Data, conurbano del IGN, cero OSM), `zones`/`zone_aliases`/`place_zones`, y la
      asignación precomputada con turf sin PostGIS. 23.857 lugares con zona (91,6%).
      QA APROBADO — ver [SPECS_ARCHIVO](../archive/SPECS_ARCHIVO.md#zonas).
- [x] **Spec 1 — CATALOGO** (2026-07-20): schema del catálogo, taxonomía de 105 tags,
      import de Overture (26.057 lugares), helper de visibilidad y `/legales`.
      QA APROBADO — ver [SPECS_ARCHIVO](../archive/SPECS_ARCHIVO.md#catalogo).
