# Spec: CURADURIA — carga asistida de Ambiente/Momento/Actividad (spec 9)

**Estado:** 🔵 Planned — decisiones cerradas con Fer (2026-07-27), en cola de implementación
**Prioridad:** Alta — #5 de la cola post-spec-8 (IDEAS § Estado de la conversación). Ambiente
(0,9%) y Momento (0,6%) son EL diferencial del producto y están casi vacíos; 8 de los 9 chips
de Ocasión objetivo siguen apagados por esto.
**Gate:** Ninguno (usa la `ANTHROPIC_API_KEY` que ya existe de CHAT_IA).
**Bloquea:** los 8 chips de Ocasión apagados (se prenden solos al cargar tags — BUSQUEDA
decisión 25) y la recuración de chips V1 → objetivo.
**Depende de:** CATALOGO (taxonomía, `place_tags.source`, decisión 17 del re-import) ·
BUSQUEDA (chips, decisiones 25/27, § Medición de cobertura) · AUTH F3 (decisiones 14/15 —
el dueño como fuente) · PULIDO (tabs de `/admin`) · CHAT_IA (cliente Anthropic, patrón de
model id en `app_settings`) · BACKLOG § cobertura rala / Actividad pegada / chips apagados.

---

## Problema

La taxonomía de 96 tags se diseñó como la ventaja sobre Google ("bar tranqui con juegos de
mesa en Villa Crespo"), pero el catálogo real casi no la usa: el import de Overture solo llena
Tipo (100%) y Cocina (37,7%) razonablemente. Medido sobre 18.993 publicados (BUSQUEDA §
Medición de cobertura): **Ambiente 0,9% · Momento 0,6% · Actividad 12,6% y pegada a un solo
Tipo** (12 de 13 tags conviven con exactamente un Tipo, porque el tag-map deriva ambos de la
misma categoría — "bar + música en vivo" da 0 y no es un bug del motor).

Consecuencias visibles: 8 de los 9 chips de Ocasión objetivo devuelven cero y no se muestran;
el sheet de filtros lista 5 tags de Ambiente y 2 de Momento; cruzar facetas da vacío.

El canal que existe (dueños taggeando al reclamar, AUTH F3) hoy cubre **1 lugar** de ~19.650
publicados. Curar a mano el catálogo entero (~30 s/lugar) son ~160 horas de una sola persona:
no pasa nunca. Y no hay señal de tráfico real para priorizar: la app no está en producción —
`place_impressions_daily` hoy mide el QA de Fer, no usuarios.

## Objetivo

**Prender los 9 chips de Ocasión objetivo en las 46 zonas**, con curaduría asistida por IA:

1. Un **batch offline** (script, sin usuario esperando) selecciona los mejores ~40 lugares de
   cada zona y un LLM **sugiere** tags de Ambiente/Momento/Actividad leyendo la evidencia
   pública del lugar (web/redes de Overture + su propio sitio), **citando de dónde sacó cada
   sugerencia**.
2. Una **cola de confirmación en `/admin`** (tab nueva "Curaduría") donde Fer acepta, corrige
   o rechaza por lugar, a 5-10 segundos por lugar. Nada entra al catálogo sin confirmación
   humana.

El objetivo se mide en producto, no en porcentaje: los chips se prenden solos cuando sus tags
tienen lugares (BUSQUEDA decisión 25, es un conteo) — este spec no toca ni el motor ni los
chips, solo llena los datos.

## Qué NO es esta feature

- **No usa datos de Google, ni como insumo del LLM.** Un tag derivado de `price_level`, un
  review o cualquier campo de Google es un dato de Google persistido (ToS). El batch tiene
  prohibido leer `lib/google/*` y `google_place_id`. Insumos permitidos: columnas de Overture
  (licencia permisiva) y la web pública del propio lugar.
- **No carga Precio como objetivo.** Sin fuente automatizable, queda fuera. Único gesto: un
  campo opcional en la cola ($ $$ $$$ $$$$, default "no sé") para cuando Fer conozca el lugar
  y le salga gratis al pasar. La faceta sigue oculta y reaparece sola cuando tenga datos
  (BUSQUEDA decisión 27).
- **No auto-aplica tags.** El LLM sugiere; solo la confirmación de Fer escribe `place_tags`.
- **No toca el motor de búsqueda, los chips ni el tag-map.** Los chips se prenden solos; el
  tag-map no se revisa acá (Actividad se despega con datos por lugar, no cambiando el mapeo).
- **No corre por request de usuario.** Es offline: sin cupo tipo CHAT_IA, pero con reporte de
  tokens/costo por corrida.
- **No cura los ~19.650**: cuota por zona (ver decisión 2). El resto del catálogo sigue
  navegable por Tipo/Cocina como hoy y lo completan dueños y tandas futuras.

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **El objetivo es producto, no porcentaje: los 9 chips objetivo prendidos en las 46 zonas.** BUSQUEDA ya dejó identificados los 13 slugs con cero lugares que los apagan; la métrica de cierre es una query (chips con resultados por zona), no una opinión |
| 2 | **Parejo territorial (Fer, 2026-07-27): cuota igual por zona para las 46 — CABA y conurbano reciben la misma atención.** Nada de "top 10 zonas": mucha gente sale por el conurbano y no es catálogo de segunda. Cuota en `app_settings` (`curation.zone_quota`, default **40**) — ajustable sin deploy. Universo ≈ 46 × 40 ≈ **1.840 lugares**. Medido 2026-07-27: 15.661 publicados con Tipo relevante a chips; la zona más flaca (Las Cañitas, 60) banca la cuota; Quilmes (504) supera a San Telmo (234) |
| 3 | **Selección dentro de la zona: publicados (vía `publishedWhere`), con Tipo relevante a los chips, orden por `confidence` desc priorizando los que tienen web/redes/teléfono** (~98% las tienen, medido — y además son el insumo del LLM). **Excluye lugares con reclamo aprobado**: el dueño es mejor fuente que nosotros para su lugar (AUTH decisión 14) |
| 4 | **Batch offline con LLM** (script en `scripts/`, mismo molde operativo que el import). Insumos: `name`, `overture_category`, tags existentes, `websites`/`socials`/`phones` de Overture + fetch del sitio propio del lugar. Model id en `app_settings` (`ai.curation_model`, seed **Haiku 4.5**) — mismo patrón que `ai.chat_model`; manda el runtime. Costo estimado de la corrida completa: ~US$10-15 con Haiku (~US$40 si se sube a Sonnet), una sola vez |
| 5 | **Toda sugerencia lleva evidencia (Fer, 2026-07-27): cita textual + URL de la fuente** ("sugiero `happy-hour` porque el sitio dice *2x1 de 18 a 20*"). Si el LLM infiere sin fuente citable (solo nombre/categoría), la sugerencia se marca `sin evidencia` y la UI la distingue — se puede aceptar igual, pero se sabe qué se está aceptando. El costo extra de citar es ~US$1-2 en todo el batch |
| 6 | **Facetas que sugiere el LLM: Ambiente, Momento y Actividad** — las tres ralas. Actividad entra para despegarla del Tipo (el mismo Instagram que evidencia `happy-hour` evidencia `musica-en-vivo`) y cae gratis en el mismo prompt. Tipo y Cocina no se tocan (ya vienen del import); Zona no aplica |
| 7 | **Las sugerencias persisten en tabla propia (`place_tag_suggestions`) con estado** (`pending`/`accepted`/`rejected`): la cola lee de ahí, queda auditoría de qué sugirió el modelo vs qué confirmó el humano, y una corrida nueva no pisa lo ya revisado |
| 8 | **Aceptar escribe `place_tags` con `source='admin'`** — sobrevive al re-import (CATALOGO decisión 17 preserva tags no-import). Rechazar no toca `place_tags`. Corregir = tildar/destildar tags de las 3 facetas en la misma pantalla (mismo espíritu que el editor del dueño, AUTH decisión 15). Si un dueño reclama después y guarda tags, su set reemplaza al nuestro — aceptado, es mejor fuente |
| 9 | **La cola vive en `/admin`, tab nueva "Curaduría"** (quinta tab del patrón PULIDO, mismo gate único `sesionAdmin`). Flujo por zona: elegís zona → lugares con sugerencias pendientes, uno por vez — evidencia al lado de cada tag, aceptar todo / corregir / rechazar, siguiente. Teclado-first: la velocidad de tildado ES el producto de esta herramienta |
| 10 | **Fetch de la web del lugar: best-effort y educado.** Instagram suele bloquear scraping anónimo: se intenta, y si no responde se cae al sitio propio + metadata de Overture (la sugerencia sale igual, con la evidencia que haya). Sin autenticarse, sin evadir bloqueos, con rate limit propio hacia afuera |
| 11 | **Piloto antes de la corrida completa: 2 zonas, una conocida y una no** (propuestas: Villa Crespo + Quilmes). Valida calidad del prompt, formato de evidencia y velocidad real de confirmación con Fer; recién después se corre el resto. Lo aprendido ajusta el prompt sin re-migrar nada |
| 12 | **DoD de cobertura honesto:** si un chip no llega a resultados en una zona porque el dato base no existe (ej. una zona sin boliches para *Salir a bailar*), se documenta en el reporte final y no bloquea el cierre. La cuota curada por zona sí es exigible; la simetría perfecta de chips no |

## Modelo de datos (migración aditiva)

**`place_tag_suggestions`** — `id` serial pk · `place_id` fk → places (cascade) · `tag_id` fk
→ tags (cascade) · `status` enum `pending`/`accepted`/`rejected` (default `pending`) ·
`evidence` text null (la cita textual; null = sin evidencia) · `source_url` text null ·
`model_used` text · `created_at` / `reviewed_at` timestamps. Unique (`place_id`,`tag_id`);
índice por `status`. El batch upsertea solo filas nuevas — nunca pisa una ya revisada.

Settings nuevos en `app_settings`: `curation.zone_quota` (default 40) ·
`ai.curation_model` (seed Haiku 4.5; manda el runtime, como `ai.chat_model`).

## Fases

| Fase | Qué entrega | Verificable con |
|------|-------------|-----------------|
| **1 — Batch** | Migración + script: selección por cuota/zona, fetch educado, LLM con evidencia, upsert de sugerencias, reporte de tokens/US$ | Corrida piloto en 2 zonas; sugerencias en DB con evidencia y URL |
| **2 — Cola en `/admin`** | Tab "Curaduría": flujo por zona, evidencia visible, aceptar/corregir/rechazar, campo Precio opcional | Piloto confirmado por Fer de punta a punta; tags en ficha y búsqueda |
| **3 — Corrida completa** | Las 46 zonas procesadas y confirmadas por tandas; medición final | 9 chips prendidos; reporte de cobertura por zona en el QA |

## Criterios de done (DoD)

- [ ] Migración de `place_tag_suggestions` + settings aplica limpio (`db:migrate`); seed
      idempotente de los 2 settings nuevos
- [ ] El batch respeta la cuota por zona, selecciona por decisión 3, **excluye lugares con
      reclamo aprobado** y **no importa nada de `lib/google/`** ni lee `google_place_id`
      (verificable por test o revisión del módulo)
- [ ] Toda sugerencia persiste con `evidence` + `source_url`, o marcada sin evidencia; una
      corrida nueva no pisa filas `accepted`/`rejected`
- [ ] El script reporta al final: lugares procesados, sugerencias generadas, tokens in/out y
      costo estimado en USD
- [ ] Tab "Curaduría" en `/admin` detrás del gate existente (no-admin → 404); aceptar escribe
      `place_tags` con `source='admin'`; rechazar no toca `place_tags`; corregir permite
      tildar/destildar las 3 facetas; Precio opcional con default "no sé"
- [ ] Un tag aceptado aparece en la ficha y filtra en la búsqueda sin deploy; el chip que
      depende de él se prende solo cuando hay lugares (verificado con al menos un chip en una
      zona piloto)
- [ ] Piloto (2 zonas) revisado con Fer antes de habilitar la corrida completa
- [ ] Corrida completa: cuota curada en las 46 zonas; los 9 chips objetivo con resultados;
      reporte final de cobertura por zona (chips × zona, con los huecos de dato base
      documentados) registrado en el QA
- [ ] Re-import no pisa lo curado (cubierto por CATALOGO decisión 17 — verificar que el test
      existente contempla `source='admin'`)

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| CUR-01 | Correr el batch en una zona piloto | Sugerencias en `place_tag_suggestions` con evidencia citada y URL; reporte de costo al final |
| CUR-02 | `/admin` → tab Curaduría como no-admin | 404, gate intacto |
| CUR-03 | Aceptar una sugerencia | Fila en `place_tags` con `source='admin'`; el tag se ve en la ficha y filtra en la búsqueda |
| CUR-04 | Rechazar una sugerencia | `place_tags` intacta; la sugerencia no reaparece en la cola ni en la próxima corrida |
| CUR-05 | Completar los tags de un chip en una zona | El chip pasa de apagado a visible sin deploy (decisión 25 de BUSQUEDA) |
| CUR-06 | Lugar con reclamo aprobado | El batch lo saltea; no le aparecen sugerencias |
| CUR-07 | Lugar sin web/redes | La sugerencia sale igual marcada "sin evidencia" y la UI la distingue |
| CUR-08 | Re-correr el batch sobre una zona ya revisada | Las filas `accepted`/`rejected` no se pisan; solo se agregan sugerencias nuevas |
