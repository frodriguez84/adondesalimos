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
- [ ] **Ficha** — `/lugar/[id]`, primer uso de Google en vivo → spec: `docs/specs/planned/FICHA.md` (escrito 2026-07-19; 3 fases, presupuesto acotado a ~$54/mes con topes en DB)
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
      Decidir si en v1 se oculta la faceta o se deja visible y vacía.
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
- [ ] **Regla compuesta de rescate de la cola** (confidence bajo + teléfono + redes ⇒ real) —
      quedó 💡 sin decidir. Hay 7.064 lugares bajo el umbral esperando; con el corte en la
      query, probarla es gratis.

## Hecho

- [x] **Spec 2 — ZONAS** (2026-07-20): 46 zonas de AMBA como GeoJSON versionados (CABA de
      BA Data, conurbano del IGN, cero OSM), `zones`/`zone_aliases`/`place_zones`, y la
      asignación precomputada con turf sin PostGIS. 23.857 lugares con zona (91,6%).
      QA APROBADO — ver [SPECS_ARCHIVO](../archive/SPECS_ARCHIVO.md#zonas).
- [x] **Spec 1 — CATALOGO** (2026-07-20): schema del catálogo, taxonomía de 105 tags,
      import de Overture (26.057 lugares), helper de visibilidad y `/legales`.
      QA APROBADO — ver [SPECS_ARCHIVO](../archive/SPECS_ARCHIVO.md#catalogo).
