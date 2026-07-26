# Backlog — A Dónde Salimos

Cola de trabajo. Una línea por ítem + link al spec cuando exista. El **detalle de diseño**
vive en `docs/specs/`, no acá.

Convención: `- [ ]` pendiente · `- [x]` hecho (con fecha) · `→ spec:` link si tiene spec.

---

## Próximo

Volcado de producto **completo** (tanda 5, 2026-07-19). Cola de specs en orden — el detalle
del porqué de este orden está en `docs/product/IDEAS.md` § Estado de la conversación.

- [ ] **Paso 0 — scaffold de Next.js** (no es un spec; hoy no hay `package.json`)
- [x] **Catálogo + import de Overture** — schema, tags semilla, `confidence`/`operating_status`, atribución → spec: `docs/specs/done/CATALOGO.md`. **Cerrado ✅ 2026-07-20** (siembra 96 tags). [Resumen](../archive/SPECS_ARCHIVO.md#catalogo)
- [x] **Zonas** — 46 polígonos (los 4 de Palermo particionados a mano), zona primaria + buffer 400 m → spec: `docs/specs/done/ZONAS.md`. **Cerrado ✅ 2026-07-20**. [Resumen](../archive/SPECS_ARCHIVO.md#zonas)
- [x] **Búsqueda + filtros** — home/search, motor en Postgres, chips de Ocasión en DB, mapa MapLibre → spec: `docs/specs/done/BUSQUEDA.md`. **Las 3 fases cerradas ✅ 2026-07-20**. [Resumen](../archive/SPECS_ARCHIVO.md#busqueda)
- [x] **Ficha** — `/lugar/[id]`, primer uso de Google en vivo → spec: `docs/specs/done/FICHA.md`. **Las 3 fases cerradas ✅ 2026-07-20** (F1 ficha propia · F2 Google en vivo · F3 foto/atribución). [Resumen](../archive/SPECS_ARCHIVO.md#ficha)
- [x] **Auth + roles + reclamo de negocio** — better-auth (patrón StressPlan), reclamo/alta con cola en `/admin`, panel "Mi negocio", fotos a R2, horarios propios → spec: `docs/specs/done/AUTH.md`. **Las 4 fases cerradas ✅ 2026-07-22** (F1 auth base · F2 reclamo + alta + cola · F3 panel + contenido · F4 horarios propios). [Resumen](../archive/SPECS_ARCHIVO.md#auth)
  - [ ] **Botón de Google OAuth (F1, diferido)** — la config de better-auth ya lo soporta condicional por env (`GOOGLE_CLIENT_*`); falta la UI del botón + exponer el flag al cliente. Se difirió a pedido (2026-07-20): foco en email/password robusto primero. Sin creds no se testea. **Único DoD de AUTH sin cerrar** (deferral aceptado, ver spec § DoD)
- [x] **Votación en grupo** — el loop viral: shortlist de 2-5 lugares, voto anónimo por cookie, resultados en vivo, cierre/desempate del creador, expiración lazy 72 h; premium modelado y apagado → spec: `docs/specs/done/VOTACION.md`. **Las 3 fases cerradas ✅ 2026-07-22** (F1 crear+gate · F2 votar+vivo · F3 cierre+panel). [Resumen](../archive/SPECS_ARCHIVO.md#votacion)
- [x] **Monetización (MercadoPago)** — mucho reuso de StressPlan. **Enciende el premium que VOTACION dejó modelado** (`users.plan`) y el `owner_plan` de AUTH → spec: `docs/specs/done/MONETIZACION.md`. **Las 4 fases cerradas ✅ 2026-07-25** (F1 instrumentación + precios · F2 cobro MP · F3 destaque · F4 desglose). [Resumen](../archive/SPECS_ARCHIVO.md#monetizacion)

## Mejoras futuras (fuera de v1)

- [ ] **🎯 SESIÓN DEDICADA — Chat IA: calidad de búsqueda y voz (tuning de prompt, F1).**
      Descubierto en el QA en vivo de F2 (2026-07-26, Fer testeando). Son todos comportamientos del
      **modelo (Haiku 4.5)**, no de la UI ni del motor. Juntar en una sesión propia, con contexto
      limpio, porque es iterativo.

      **Síntomas observados:**
      1. **Sobre-filtrado que pierde resultados reales (el más grave).** "Lugares para ir con
         hermanos y primos… una sala de escape… en Caballito/Almagro/Boedo" → el chat dijo "no hay
         escape rooms". **Pero SÍ hay** (Caballito 3, Almagro-Boedo 1, publicadas y bien tagueadas:
         `club-de-juegos`+`escape-room`). **Causa raíz** (diagnosticada en DB, no adivinada): el
         modelo sumó un tag de ambiente (`grupos-grandes`, por "hermanos y primos") al `escape-room`;
         como entre facetas es **AND** y **ninguna escape room tiene tags de ambiente**, dio 0. El
         motor hizo lo correcto; el modelo pidió mal. Se agrava porque la guía "CÓMO ELEGIR LOS TAGS"
         del system prompt **no menciona escape rooms/juegos** → el modelo queda sin andarivel.
      2. **Narra su uso de tools** ("Uh, me tiró resultados de Palermo… Probemos de nuevo"), contra
         la guía del prompt.
      3. **Slang no rioplatense** ("te late") y **frases inventadas** ("te doy un toque ahí") —
         mitigado ya (ver sub-items) pero no 100% en modelo chico.

      **Plan (idea de Fer, 2026-07-26):** ANTES de evaluar cambiar de modelo, **revisar cómo se
      estructuran los prompts en StressPlan** (usa el mismo Haiku 4.5 y NO tiene estos problemas) y
      portar esa estructura al chat. Recién si con esa estructura sigue fallando, evaluar **Sonnet 5**
      (swap por `app_settings`, decisión 3 del spec, sin deploy). Fixes concretos candidatos: guía de
      escape-room/juegos en el prompt; regla fuerte de "si nombran una actividad puntual, filtrá por
      ESE tag + zona y NO sumes ambiente"; considerar loguear el input de la tool (`buscar_lugares`)
      para debug basado en evidencia, no en conjeturas.
      - [x] **Voz/slang** (2026-07-25/26): reforzado el system prompt para evitar "boludo" y slang
        no rioplatense. Se **quitó** la mención de "te late" del prompt (priming: nombrar la palabra
        prohibida la inducía) y se pasó a **lista blanca positiva** de muletillas porteñas + regla de
        no inventar modismos ("te doy un toque ahí"). "che" sí, "boludo" no. `lib/ai/prompts.ts` § TONO.
        **Ojo (Haiku):** la instrucción negativa no es 100% confiable en un modelo chico; si la voz
        importa mucho, evaluar Sonnet 5 (swap por `app_settings`, decisión 3, sin deploy).
      - [x] **Concatenación entre rondas de tool** (2026-07-26): el texto de cada ronda se pegaba al
        de la anterior sin separador. Se inserta `\n\n` antes del primer texto de una ronda posterior
        en `lib/ai/chat.ts`. Verificado en vivo: párrafos separados.
      - [x] **Sobre-filtrado — estructura de prompt portada de StressPlan** (2026-07-26): la estructura
        que StressPlan usa con el MISMO Haiku 4.5 es **pares contrastivos ✗/✓ por cada regla dura** +
        imperativos en mayúscula + bloque de recencia al final. Portado a `lib/ai/prompts.ts`: (a) el
        bullet de `tags` explicita la trampa del AND; (b) se sumó juegos/escape-room a la guía de TIPO
        y ACTIVIDAD (antes no existían → el modelo improvisaba); (c) **REGLA CLAVE** nueva con el ✗/✓
        exacto del caso escape-room + `grupos-grandes` ("hermanos y primos" = quiénes van, no una vibra
        a filtrar); (d) búsqueda vacía → **reintento en silencio** aflojando ambiente antes de decir "no
        hay", sin narrar el intento fallido (ataca también el síntoma #2); (e) bloque **ÚLTIMO CHEQUEO
        ANTES DE BUSCAR** al final (recencia). Además, log `chat_tool_call` en `lib/ai/chat.ts` (input
        de la tool + nº de resultados, sin PII) para debug basado en evidencia. Typecheck + tests
        verdes. **Verificado en vivo (2026-07-26, Playwright/ngrok):** el repro exacto ("sala de escape
        con hermanos y primos por Caballito/Almagro/Boedo") que antes daba 0 ahora devuelve las 4
        escape rooms reales (Caballito ×3, Almagro/Boedo ×1) con sus cards. El sobre-filtrado quedó
        resuelto sin cambiar de modelo → **NO hizo falta Sonnet 5** para este síntoma.
      - [x] **A/B de modelo Haiku 4.5 vs Sonnet 5 — narración de tools y voz** (2026-07-26): variable
        controlada = solo el modelo (swap por `app_settings`, MISMO prompt en ambos). 3 casos idénticos
        en conversaciones frescas, verificados en vivo (Playwright/ngrok, cuenta premium con cupo 30).
        **Resultado:**
        - **Caso narración** ("Somos como 20… cumpleaños en Palermo"): **Haiku NARRA el retry**
          ("parecería que no hay lugares tagueados para grupos grandes… Pero te hago una búsqueda más
          abierta…"). **Sonnet NO narra**: tira las 5 opciones directo y cierra con "así te afino la
          búsqueda".
        - **Caso voz** ("che, ¿me tirás algo tranqui para charlar por Villa Crespo?"): **Haiku vuelve a
          narrar** ("Uh, con ese filtro no salió nada. Probemos sin 'tranqui'…"). **Sonnet hace un pivot
          elegante** sin exponer el mecanismo ("No hay mucho bar puramente en Villa Crespo, pero sí
          buenos cafés para charlar tranqui…") + voz más rica ("piolas", "ahí nomás", "¿Te sirve?").
        - **Regresión escape-room** (no debía romperse): **ambos ✅** devuelven las 4 salas reales sin
          narrar (la búsqueda acierta al primer tiro → no hay retry que narrar).
        **Diagnóstico:** la narración se dispara SOLO cuando la 1ª búsqueda vuelve vacía y el modelo
        reintenta; la instrucción negativa "reintentá en silencio" (✗/✓ del prompt) **no es confiable en
        Haiku** — es el límite que la decisión 3 del spec previó. Sonnet respeta la instrucción y además
        maneja la voz sin desliz. **Costo:** Sonnet ≈ **3×** por token (Haiku $1/$5, Sonnet $3/$15 in/out
        por millón, `lib/ai/logging.ts`); el system prompt cacheado abarata el input, el delta lo domina
        el output. **Recomendación:** Sonnet mejora claramente los DOS síntomas abiertos (no-narración +
        voz) sin romper la regresión; si la voz/prolijidad es prioridad de producto, el swap lo justifica
        (se cambia con un UPDATE, sin deploy). Alternativa si se quiere seguir en Haiku por costo: NO hay
        palanca de prompt confiable para la narración en modelo chico — quedaría suprimir el retry
        automático (menos cobertura de sobre-filtrado) o tolerar la narración. **Decisión de costo/producto
        pendiente de Fer** — modelo revertido a Haiku tras el test.
- [ ] **Chat IA — copy del gate premium sin cupo acoplado a la fecha de reset (F2, nota 2026-07-25).**
      El banner "Se renueva el 1º del mes que viene" es **correcto hoy**: el cupo se cuenta por mes
      calendario (`chat_usage_monthly` keyed por `YYYY-MM`, `lib/ai/cupo.ts`), reset el 1º —
      **desacoplado** de la fecha de cobro de MercadoPago (que cae cualquier día). Riesgo latente: si
      el reset dejara de ser calendario, el copy mentiría. Opción de robustez: wording sin fecha dura
      (p.ej. "el mes que viene tenés tus mensajes de nuevo"). No urge; es solo si se quiere desacoplar
      el texto de la implementación.
- [ ] **🐛 BUG — La búsqueda por zona trae lugares de zonas NO adyacentes** (reportado por Fer,
      2026-07-25; bug de **datos de ZONAS** —spec 2, done— que aflora en BUSQUEDA. **Merece
      sesión propia**). **Repro:** `z=almagro-boedo t=parrilla` → 20 resultados, **9 con su
      primaria en otra zona**: Caballito ×5, Botánico y Alto Palermo ×2, Recoleta ×1, La Boca y
      Barracas ×1.

      **No es el buffer de 400 m** (ZONAS dec.5, intencional y acotado a *bordes* adyacentes):
      Almagro no linda con La Boca/Barracas. **Diagnóstico (read-only, 2026-07-25):** `place_zones`
      tiene asignaciones **geométricamente imposibles** — p.ej. "Parrilla el Nuevo Miguelito"
      (primaria Caballito) figura a la vez en *La Boca y Barracas + Almagro y Boedo + Caballito*,
      tres zonas que no se tocan. **Descartado bug de unidades del buffer**: medido
      `polygon_search / polygon` = 1.5–1.8× (400 m real, correcto).

      **A investigar (aguas arriba de la query — la búsqueda filtra fiel por `place_zones`):**
      (a) geometría de algún polígono fuente en `data/zones/*.geojson` — `la-boca-barracas` tiene
      un bbox de ~**12 km** de ancho, sospechoso; (b) `scripts/zones/assign.ts` (point-in-polygon
      con turf contra `polygon_search`): ¿swap lng/lat en algún caso?, ¿acumula sin resetear entre
      corridas?; (c) `polygon_search` con self-intersection o MultiPolygon que
      `turf.booleanPointInPolygon` interpreta mal. **Dónde mirar:** `scripts/zones/build.ts`
      (buffer), `scripts/zones/assign.ts` (asignación), `data/zones/*.geojson`, tabla `place_zones`.
      **Pendiente de cuantificar** la escala (cuántos lugares con asignación cruzada). Impacto: la
      calidad de resultados en toda CABA, no solo en bordes.
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
- [ ] **Descuento escalonado multi-local en el plan de dueño (B2B)** — base por lugar
      (2do local -X%, 3ro -Y%, etc.) para el dueño de varios locales. Puerta abierta el
      2026-07-24; el modelo por-lugar del spec 7 lo permite sumar después sin romperse. Ver
      `docs/product/IDEAS.md` § Monetización (B2B).
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
- [x] **Identidad visual: aplicar el logo y la paleta definitivos** (2026-07-21). **Hecho ✅
      2026-07-23** en el mini-spec HOME_IDENTIDAD ([resumen](../archive/SPECS_ARCHIVO.md#home_identidad)).
      Ya están
      diseñados y fijados en **`docs/product/IDENTIDAD.md`** (hex, significado del logo,
      contrastes WCAG medidos y jerarquía propuesta). Se aplican como tarea propia, no
      mezclados con un spec. La UI usa tokens (`globals.css`), así que el grueso es cambiar
      variables — pero hay **tres focos fuera de los tokens**: `lib/email/index.ts` (hex
      hardcodeado, y el CTA debe ser color plano: Outlook ignora gradientes), los pins del
      mapa en `map-view.tsx` / `pin-picker.tsx` (`#e11d48`), y los 4 colores del logo de
      Google en `ficha-google.tsx`, que **no se tocan**. Falta además una **versión monocroma
      del wordmark** (el gradiente no sobrevive a 28-32 px ni al mail) y sumar el logo a la
      home, que hoy es un `h1` de texto.
- [x] **Home: ¿landing o buscador de una? + pulido del estado vacío** (duda de UI/UX,
      2026-07-23). **Hecho ✅ 2026-07-23** en el mini-spec HOME_IDENTIDAD
      ([resumen](../archive/SPECS_ARCHIVO.md#home_identidad)): buscador de una confirmado, estado
      vacío convertido en mini-landing (hero + headline rotativo). **Track de UX, NO un spec de
      features — separado de Monetización.**

      **La duda.** Al entrar a `adondesalimos.com.ar`, ¿el usuario cae directo al buscador o
      hay una landing? Hoy es buscador de una (BUSQUEDA decisión 1: *home = search*).

      **Recomendación (Claude, a validar con Fer): mantener buscador de una, sin landing
      separada.** Razones: (1) la promesa es velocidad —una landing con hero/CTA mete un click
      entre el usuario y lo que vino a hacer; (2) el punto de entrada **viral no es el home**
      sino `/votacion/[token]` y las fichas compartidas, así que el home casi nunca es la
      primera impresión del que llega nuevo. **La vuelta:** el **estado vacío** del home
      (primera visita, `tieneBusqueda` = false) hace de **mini-landing** — hero cálido, frase de
      valor, los **chips de Ocasión como gancho**, un hint de cómo funciona; se colapsa apenas
      se busca. Ya calza con la arquitectura (el home renderiza distinto sin búsqueda). Una
      landing de marketing completa queda para cuando se vaya a prod/SEO — anotada como opción,
      no decidida.

      **Voz del hero (importante, corregido por Fer 2026-07-23): argentino rioplatense, NO
      neutro.** El "¿Qué se te antoja?" que se había propuesto **no se usa acá** — suena a
      doblaje. Las que van: **"¿Qué sale?"**, **"¿Qué pinta?"** o simplemente **"¿Qué
      hacemos?"**. Idea linda: **rotar las tres** como headline del hero (aleatorio o por
      día/hora), le da vida. (Distinto de rotar los *chips* mismos, que es otro ítem de abajo.)
      Regla general que sale de esto: **todo el copy de la app va en argentino rioplatense,
      evitar el español neutro** — principio de voz, no solo para este texto.

      **Pulido (para que no parezca amateur, acotado, NO rediseño).** Foco en ese estado vacío
      + **aplicar la identidad visual ya definida** (`docs/product/IDENTIDAD.md` + la pieza
      original `docs/product/assets/logo-identidad.png`, ver ítem de identidad arriba). Concreto:
      - **Sumar el logo a la home** — hoy es un `h1` de texto pelado; va el wordmark real (pin +
        "¿A DÓNDE SALIMOS?"). OJO: hace falta la **versión monocroma del wordmark** para el
        header chico (el gradiente colapsa a 28-32 px) — ver aviso en `IDENTIDAD.md`.
      - **Swap de paleta**: lo que corre hoy (negro `#0F0F0F` + ámbar `#F59E0B`) es **placeholder
        de dev copiado de StressPlan**. La paleta real es la de `IDENTIDAD.md`: acción primaria
        **naranja `#FF8A00`** (reemplaza al ámbar, mismo contraste ⇒ casi solo swap de variables
        en `globals.css`), fondo **`#0D0D1F`** (azulado), y rosa/violeta/turquesa/amarillo para
        categorías. Los tres focos fuera de los tokens (mails, pins del mapa, logo de Google que
        NO se toca) están listados en `IDENTIDAD.md`.
      - Jerarquía tipográfica del hero, chips como protagonistas, spacing.

      Se solapa con la tarea de identidad — conviene hacerlos **juntos como una sola pasada**:
      el mini-spec sería *"home + identidad"* (estado vacío con onda + logo + swap de paleta).
- [ ] **Header de marca global — llevar el wordmark fuera del Home** (UX/marca, 2026-07-23,
      surgido en la QA de HOME_IDENTIDAD). Tras aplicar la paleta se verificó que **está bien
      aplicada en toda la app** (naranja `#FF8A00` + fondo azulado, botones por token, cero
      ámbar residual). Pero la **marca** (el wordmark) vive **solo en el Home**: navegando a la
      ficha, `/cuenta`, `/votacion/[token]` o "Mi negocio" no hay presencia de marca, y por eso
      "se siente" menos aplicado aunque el color sí cambió. El lever correcto **no es recolorear
      controles** (IDENTIDAD prohíbe gradiente en botones — compite con el contenido), sino un
      **header compartido con el `Wordmark`** (`components/shared/wordmark.tsx`, ya existe) en
      las páginas clave. **Track de UX, mini-spec propio** (decisión de Fer 2026-07-23: no
      mezclarlo con HOME_IDENTIDAD). A diseñar: dónde sí y dónde no, y cómo convive con los
      headers propios de cada página (la ficha ya tiene su barra volver/compartir; la votación
      su "VOTACIÓN / Inicio"). No hardcodear: reusar el componente y los tokens.
- [ ] **`EXISTS` con `${places.id}` sin calificar en `lib/search/query.ts`** (AUTH F2,
      2026-07-21). Los subqueries de `filtrosDeTags` y `filtroDeZonas` interpolan
      `${places.id}`, que Drizzle renderiza como `"id"` **sin el nombre de la tabla**. Hoy
      funciona por descarte: ni `place_tags` ni `place_zones` tienen columna `id`, así que el
      identificador resuelve a `places.id`. Si alguna de las dos ganara un `id`, la búsqueda
      empezaría a devolver **cero resultados en silencio** — que es exactamente lo que pasó en
      `lib/claims/query.ts` contra `place_claims` (ver `docs/qa/AnalisisQA.md` § AUTH F2, H-1).
      Cambiar a `leftJoin` sobre subconsulta del query builder, con test de regresión propio.
- [ ] **Las fotos del dueño no se ocultan al revocar el reclamo** (AUTH F3, 2026-07-21).
      🔸 **Tiene una decisión de producto abierta adelante — ver `docs/product/IDEAS.md`
      § Usuarios y roles.** No implementar hasta que esté resuelta.

      **Estado hoy.** AUTH-13 pide "contenido de dueño oculto". El contenido de
      `place_owner_content` ya se oculta (el COALESCE está condicionado a tener claim
      aprobado), pero `place_photos` sigue mostrándose: `fotosDeDueno` lee por `place_id` y no
      pregunta si hay dueño. **Decisión consciente, no bug** — ver `docs/qa/AnalisisQA.md` §
      AUTH F3, H-2.

      **Alcance real.** Solo afecta a lugares `source='overture'` con confidence sobre el
      umbral: siguen publicados por la regla normal y conservan las fotos del ex-dueño. Un
      `source='owner'` revocado pierde el `publish_override` y su ficha da 404, así que no lo
      ve nadie. **Hoy no hay dueños reales ⇒ exposición cero.**

      **Trampa técnica: hay que tocar DOS lugares o ninguno.** Deciden sobre fotos
      `fotoPrincipal` (`lib/lugar/ficha.ts`) y el chequeo `tieneFotoDueno` de
      `getPlaceForEnrichment` (`lib/lugar/matching.ts`). Si se gatea solo el primero, la ficha
      cae a Google pero el endpoint de enriquecimiento **sigue viendo las filas** en
      `place_photos`, cree que hay foto de dueño y no le pide la foto a Google ⇒ la ficha
      queda **sin ninguna foto**. Peor que ahora. Media corrección rompe más de lo que arregla.

      **Recomendación: hacerlo depender del motivo de la revocación, no revocar y listo.**
      Hoy `decidirClaim` trata igual dos casos que no lo son: revocar **por abuso** (se hizo
      pasar por dueño, subió fotos ofensivas) donde las fotos tienen que desaparecer ya, y
      revocar **por corrección** (el local cambió de manos, se equivocó el admin) donde las
      fotos son una contribución real al catálogo y borrarlas es tirar el valor que el free
      generoso vino a comprar. Lo más barato que resuelve las dos: **un checkbox "quitar las
      fotos" en el rechazo de `/admin`**, default apagado, que borra filas + objetos de R2
      reusando `limpiarFotosDeUsuario`. Evita la trampa de arriba por completo —no gatea nada,
      borra— y le da al admin la única información que el código no puede deducir: por qué
      revocó.
- [ ] **Reordenar las fotos del panel** (AUTH F3, 2026-07-21). `place_photos.sort` existe y
      la ficha usa la primera como portada, pero el editor no deja arrastrar: hoy el orden es
      el de subida y para cambiar la portada hay que borrar y volver a subir. Drag & drop o
      un botón "poner de portada".
- [ ] **Las fotos se guardan tal cual las sube el dueño** (AUTH F3, 2026-07-21; encuadre
      corregido el mismo día). Hasta 5 MB por foto, sin redimensionar ni recomprimir. Una
      foto de celular son ~4000 px y 3-5 MB; el slot de la ficha es `aspect-[4/3]` dentro de
      `max-w-md` menos el padding = **416 px CSS**, o sea ~1250 px físicos en una pantalla 3x.
      Se guarda 10-20x más grande de lo que se muestra. **FICHA ya había resuelto esto para el
      otro lado**: `PHOTO_MAX_WIDTH = 1200` en `lib/google/places.ts` pide la foto de Google
      justo a esa medida. Las del dueño no siguen ese criterio.

      ⚠️ **El costo NO es de infraestructura** (la primera versión de este ítem decía
      "storage y transferencia que se pagan por nada" — mal en las dos puntas). El **egress de
      R2 es gratis**, que es la razón por la que el spec eligió R2 (decisión 16), y el storage
      es plata que no existe: 100 lugares pagos × 15 fotos × 4 MB ≈ 6 GB ≈ **menos de USD 0,10
      por mes**. Recomprimir para ahorrar eso no se justifica.

      **El costo real lo paga el usuario, y por eso el ítem vale igual**: bajar 4 MB por foto
      con datos móviles, en el momento exacto en que la app tiene que ser rápida (alguien
      parado en la calle decidiendo dónde entrar). Y del lado del dueño, subir 5 MB con mala
      señal es donde el upload tarda o falla.

      **Recomendación: redimensionar en el browser antes de subir** (canvas →
      `toBlob('image/webp')`, tope ~1600 px de lado mayor). Arregla **las dos puntas de una**:
      el dueño sube 200 KB en vez de 5 MB y el que mira la ficha baja 200 KB. `sharp`
      server-side solo arregla la mitad —la bajada— y encima suma una dependencia nativa
      pesada al build de Vercel. Dejar el límite de 5 MB y la validación server-side como
      están: el cliente no es un boundary de seguridad, solo un optimizador.
- [ ] **El bbox de AMBA está escrito dos veces** (AUTH F2, 2026-07-21). `BBOX` en
      `scripts/import-overture.ts` (qué se importa) y `AMBA_BBOX` en `lib/claims/validacion.ts`
      (hasta dónde puede llegar el pin de un alta) son el mismo rectángulo. Hoy no divergen,
      pero si se amplía la cobertura hay que tocar los dos. Unificarlo es un cambio aparte: el
      script corre con `dotenv` y no debería depender de `lib/claims`.
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
- [ ] **Filtro fantasma: un tag activo con 0 lugares queda inquitable y cero-ea la búsqueda**
      (BUSQUEDA, observado 2026-07-23 durante la QA de HOME_IDENTIDAD). Repro: entrar a
      `/?t=fiesta-tematica` (tag `active=true`, facet *actividad*, **0 lugares**; es uno de los
      4 tags del chip "Salir a bailar", junto con `boliche`/`dj`/`salsa-bachata` que sí tienen
      lugares). Síntomas: la búsqueda devuelve **0 resultados**, el badge de "Filtros" cuenta 1,
      pero **no hay chip removible ni entrada en el sheet** para sacarlo — solo se saca editando
      la URL a mano.

      **Causa raíz — motor y catálogo no coinciden.** `filtrosDeTags` (`lib/search/query.ts`)
      filtra por `eq(tags.active, true)` sin mirar el conteo de lugares, así que honra el tag y
      arma su `EXISTS` (que con 0 lugares no matchea a nadie ⇒ 0 resultados). El catálogo
      (`getFacetCatalog`, decisión 27) **esconde** los tags con 0 lugares, así que
      `etiquetaDeTag` devuelve `null` y `ChipsActivos` hace `if (!label) continue` (no dibuja
      chip) y el `FiltersSheet` no lo lista. Lo que el motor aplica, la UI no lo puede mostrar
      ni sacar. Vía el chip "Salir a bailar" queda enmascarado (los otros 3 tags traen
      resultados); el caso pelado en la URL lo destapa. **Contradice la decisión 15 del spec
      ("lo que se aplica se ve") y el invariante de que la URL es el estado y todo lo que está
      en ella se puede revertir.**

      **Recomendación: garantizar que TODO tag en `params.tags` tenga chip removible.**
      `ChipsActivos` debería dibujar un chip para cualquier slug de la URL aunque el catálogo no
      le dé label —cayendo al nombre del tag o al slug crudo— en vez de saltearlo. Es el arreglo
      robusto (la URL manda; nada aplicado puede quedar sin forma de sacarse). Alternativa más
      débil: alinear `filtrosDeTags` con el catálogo y descartar también los tags con 0 lugares
      —evita el 0 resultados pero deja el badge fantasma en 1—. La primera resuelve las dos
      puntas. Cambio quirúrgico en `search-shell.tsx` (`ChipsActivos`), con test de regresión
      (tag en URL sin lugares ⇒ chip removible presente).
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

- [x] **Spec 7 MONETIZACION — F4 (Desglose de estadísticas) — CIERRA EL SPEC 7** (2026-07-25): la
      segunda feature que **vende** el B2B, montada sobre el teaser que AUTH dejó ("N visitas este
      mes"). `desgloseEstadisticas` (`lib/negocio/query.ts`) **gateado server-side por
      `owner_plan='paid'`**: con `free` devuelve `null` y el dueño se queda con el teaser pelado
      (sin enriquecerlo, dec.24). Con `paid`: vistas de ficha e impresiones **vs mes anterior**
      (mismo criterio de mes calendario que `visitasDelMes`, que quedó intacto), taps por tipo (los
      5 kinds, 0 incluido), top de filtros que lo encontraron (nombres de tags), y la transparencia
      del destaque "**destacada en X de las Y búsquedas**" (`featured_impressions / impressions`,
      dec.20). Presentacional en `components/negocio/desglose-panel.tsx`. **Sin migración**: reusa las
      3 tablas agregadas de F1. **QA en vivo** MONE-15 ✅ (paid ve el desglose completo; volver a
      `free` devuelve el teaser exacto, ocultar ≠ borrar) + test del gate server-side + checker
      independiente. **427 tests verdes** (3 nuevos). [QA](../qa/AnalisisQA.md) § F4. Con F4 quedan
      **las 4 fases del spec 7 cerradas** — el modelo de negocio entero está encendido.
- [x] **Spec 7 MONETIZACION — F3 (Destaque en búsqueda)** (2026-07-25): la primera de las dos
      features que **venden** el plan B2B. `buscarDestacados` reusa `construirWhere` (candidatos =
      `owner_plan='paid'` ∩ el where completo → "solo si matchea" sale gratis) y rota por
      `featured_impressions` ascendente con desempate `md5(place_id‖fecha)` (menor-mostrado-primero,
      auto-balanceado, sin migración: la columna ya la creó F1). Bloque de hasta 3 con badge
      "Destacado" arriba de la primera página (lista, no mapa), dedupe contra el orgánico;
      `registrarDestacados` cuelga del mismo `after()` de las impresiones. **Divergencia explícita**:
      los destacados suman a `impressions` además de `featured_impressions` para que el ratio
      "destacada en X de Y" de F4 no dé `X>Y`. **QA en vivo**: MONE-09/10/11/12 ✅ + invariantes
      (mapa no destaca, "Ver N" no infla). **423 tests verdes** (5 nuevos). [QA](../qa/AnalisisQA.md) § F3.
- [x] **Spec 7 MONETIZACION — F2 (Cobro con MercadoPago)** (2026-07-24): enciende el premium
      B2C y el plan B2B por lugar sin tocar los helpers de gating — la suscripción solo **mueve**
      `users.plan` / `places.owner_plan` (decisión 8). `lib/billing/*` portado de StressPlan
      (cliente `fetch` server-only, **preapproval SIN plan** dec.10, `validateWebhookSignature`
      tal cual, renovación idempotente con guard UNIQUE + `FOR UPDATE`, lazy check + gracia 3d).
      Endpoints `checkout`/`cancel`/`webhook` (firma 401, GET defensivo, idempotente); Checkout
      Bricks sobre `BottomSheet`; tabs de suscripción en `/cuenta` (B2C) y `/mi-negocio/[placeId]`
      (B2B); hooks de revocación (AUTH-13) y `beforeDelete` que cancelan el preapproval (dec.28);
      `/admin` con Suscripciones read-only. **QA en vivo (sandbox)**: MONE-01/02/03/04/17/18 ✅;
      MONE-05/06/07/08 por tests de integración/unit. **418 tests verdes**. Hallazgo del QA en
      vivo: el mensaje de tarjeta rechazada filtraba lenguaje de sandbox ("titular APRO") —
      corregido a copy de producción con test que lo blinda. [QA](../qa/AnalisisQA.md) § F2.
- [x] **Spec 7 MONETIZACION — F1 (Instrumentación + precios)** (2026-07-24): la primera fase,
      antes que el cobro, porque instrumenta histórico que no se reconstruye. **Migración completa**
      del § Modelo de una (criterio AUTH F3): `subscriptions` + `subscription_payments` (nacen sin
      uso, se llenan en F2), `place_taps_daily`, `place_tag_impressions_daily`, `featured_impressions`
      en `place_impressions_daily`, `app_settings_history` (`drizzle/0008`). **Taps**: `<TapLink>`
      (beacon `sendBeacon`, best-effort) en los 7 anchors de la ficha → `POST /api/lugar/[id]/tap`
      (rate limit 60/h) → upsert agregado por `(place, día, kind)`. **Tags por búsqueda**:
      `registrarTagsDeBusqueda` en el mismo `after()` del batch de impresiones (search route + home);
      el texto libre y la zona no se registran. **Instrumentación agregada pura** — sin user_id,
      cookie ni IP (test de columnas en las dos tablas). **Precios en DB**: `lib/billing/settings.ts`
      (getters runtime + `editarPrecio` transaccional con historial), `PATCH /api/admin/settings`
      (gate `ADMIN_EMAIL`), sección Precios editable + historial en `/admin`; seed idempotente
      `billing.precio_b2b_ars=15000` / `billing.precio_b2c_ars=7000`. `.env.example` con las 3 env
      de MP. QA de cierre: typecheck + **393 tests** + build verde (server parado), QA MONE-13/14/16
      + migración/seed/env en `docs/qa/AnalisisQA.md`. Pendiente: F2 cobro · F3 destaque · F4 desglose
- [x] **Mini-spec HOME_IDENTIDAD — home + identidad** (2026-07-23): se aplicó la identidad real y
      se le dio onda al home para que un link compartido no parezca a medio hacer. **Paleta** por
      tokens (`globals.css`): naranja `#FF8A00` (reemplaza el ámbar), fondo azulado `#0D0D1F`,
      neutros con tinte azul y tokens de categoría (rosa/violeta/turquesa/amarillo). **Tres focos
      fuera de tokens** + un 4º hallado en QA: email (CTA plano), pins del mapa a rosa `#FF2D75`,
      logo de Google **intacto**, y la estrella del rating de `text-amber-500` → `text-amarillo`.
      **Wordmark** (`components/shared/wordmark.tsx`, pin SVG con gradiente + texto) reemplaza el
      `h1`. **Estado vacío = mini-landing**: hero con headline rotativo rioplatense
      (`rotating-headline.tsx`, client-side para evitar hydration mismatch) que colapsa con
      búsqueda. **Favicon/app-icon** del logomark aislado con transparencia real
      (`docs/product/assets/logo_2.png` → `app/icon.png` + `app/favicon.ico`), cierra el 404.
      QA de cierre: typecheck + **381 tests** + build verde (server parado) + `/qa-spec`
      **APROBADO** (11 criterios, 3 checkers independientes) + QA en vivo con Playwright
      (home vacío/con búsqueda, votación, rotación sin warnings, pins rosa, ficha, favicon 200).
      Cierra los ítems de BACKLOG "identidad visual" y "home: pulido". Dejó anotados como tracks
      aparte: header de marca global y el filtro fantasma de tags con 0 lugares.
      [Resumen](../archive/SPECS_ARCHIVO.md#home_identidad)
- [x] **Spec 6 — VOTACION · las 3 fases + cierre del spec** (2026-07-22): votación en grupo, el
      loop viral. **F1** schema (`polls`/`poll_options`/`poll_votes` + `users.plan`), gate "1
      activa" server-side con `FOR UPDATE` del usuario, token aleatorio, `/votacion/nueva` con
      búsqueda embebida, rate limit propio. **F2** `/votacion/[token]` pública (server-render sin
      Google, OG estático), voto anónimo por cookie `voter_id` httpOnly (identidad por
      dispositivo, no IP), upsert `(poll_id, voter_token)`, conteo en vivo por polling,
      expiración lazy sin cron. **F3** `PATCH` cerrar (elegir ganador)/cancelar solo del creador,
      `/mis-votaciones` (free = activa · premium = historial, gate en la query), botón "IA arma
      shortlist" gateado y no-op. QA de cierre: typecheck + **381 tests** (50 nuevos) +
      `/qa-spec` **APROBADO** (VOT-01..15, 3 checkers independientes) + QA en vivo con Playwright
      (voto/conteo/sin-Google/solo-lectura) + `next build` verde (server parado). Premium modelado
      y **apagado** (lo enciende el spec 7). Spec movido a `done/`.
      [Resumen](../archive/SPECS_ARCHIVO.md#votacion)
- [x] **Spec 5 — AUTH · las 4 fases + cierre del spec** (F1 2026-07-20 · F2/F3 2026-07-21 · F4
      2026-07-22): auth con better-auth y reclamo de negocio. **F1** auth base (email+password,
      `requireEmailVerification: true`, Resend, `/cuenta`, rate limit, sin columna `role`).
      **F2** `place_claims` (un dueño por lugar), `/registrar-negocio` (búsqueda del catálogo
      completo + alta con pin MapLibre + zona por turf), `/reclamar/[id]`, `/admin` con la cola,
      aprobar/rechazar/revocar + `publish_override` + mails. **F3** `place_owner_content`
      (COALESCE dueño → base), tags `source='owner'`, fotos a R2 (`lib/storage/r2.ts`, caps con
      `FOR UPDATE`), `owner_plan` + gating server-side, huecos en la ficha, teaser de stats.
      **F4** horarios propios (`lib/negocio/horarios.ts`, editor semanal, prioridad dueño →
      Google, abierto/cerrado en TZ AR con cruce de medianoche; sin migración, field mask de
      Google intacto). QA de cierre: typecheck + **331 tests** + build verde + escaneo de
      secretos (0 fugas) + QA en vivo con Playwright — `/qa-spec` **APROBADO** (ver
      `docs/qa/AnalisisQA.md` § AUTH F2/F3/F4 y § QA /qa-spec — AUTH). **Único DoD diferido:**
      UI del botón de Google OAuth (deferral aceptado de F1). Spec movido a `done/`. [Resumen](../archive/SPECS_ARCHIVO.md#auth)
- [x] **Spec 4 — FICHA · Fase 3 + cierre del spec** (2026-07-20): foto de Google y atribución.
      `parseFotoCandidata` (una sola foto) + `fetchFotoUri` (media endpoint con
      `skipHttpRedirect=true` ⇒ `photoUri` efímero, la key nunca sale al browser) en
      `lib/google/places.ts`; `enrichment.ts` con el paso de foto (**cuota `photos` antes del
      media call**, y **foto de dueño ⇒ cero request a Google** vía `EXISTS` server-side en
      `getPlaceForEnrichment`); `ficha-google.tsx` reescrito como **shell de un solo fetch**
      (foto + header como `children` + datos ⇒ un único Place Details por apertura); crédito al
      autor sobre la foto + link al original + **logo de Google** sobre los datos. QA de fase:
      typecheck + **217 tests** + QA en vivo con Playwright (FICHA-10 prioridad de foto y
      FICHA-11 atribución) — ver `docs/qa/AnalisisQA.md` § FICHA F3. **Las 3 fases cerradas ⇒
      spec movido a `done/`.** Build final pendiente de correr con el dev server parado.
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
