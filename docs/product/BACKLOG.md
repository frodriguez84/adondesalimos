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

## Hecho

_(vacío)_
