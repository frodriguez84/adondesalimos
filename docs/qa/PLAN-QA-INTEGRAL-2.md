# Plan de QA integral #2 — antes del deploy

**Estado:** Escrito 2026-08-02 · **NO ejecutado**. Este archivo es el árbitro de las sesiones de
ejecución (mismo rol que un spec: si un caso no está acá, no se corre; si un hallazgo no se puede
explicar en el código, no se escribe).
**Autor:** sesión Opus de diseño (pedido de Fer, 2026-08-02). Insumos extraídos por 3 subagentes
read-only sobre los specs de las 7 features nuevas.
**Antecedente:** `docs/qa/PLAN_QA_INTEGRAL.md` (2026-07-26, IDs `INT-01..15`, 10 cruces PASS).
Este plan **no lo reemplaza**: lo extiende sobre lo que entró después y re-corre de él solo lo que
tocó algo que cambió (§ 7).

---

## 1. Qué es esto, y qué NO es

El QA integral del 2026-07-26 cerró con **cero bugs** — pero congeló la foto en el spec 8. Desde
esa fecha entraron **siete features**, cada una con su `/qa-spec` APROBADO **contra su propio
spec**. Ese es exactamente el punto ciego: nadie verificó qué pasa cuando se cruzan entre sí ni
contra los 5 roles.

| # | Feature | Cerrada | Superficie nueva |
|---|---------|---------|------------------|
| N1 | **FAVORITOS** F1+F2 | 2026-07-31 | `/mis-lugares`, `/api/favoritos`, `/api/listas`, `/api/listas/[id]`, botón en card/ficha/chat |
| N2 | **SUGERIR_EN_VOTACION** | 2026-07-31 | `/api/votaciones/[token]/opciones[/[optionId]]`, sheet en `/votacion/[token]` |
| N3 | **CHIPS_ROTACION** | 2026-07-31 | `app_settings['chips.schedule']` → orden de los 4 chips de la home |
| N4 | **ABIERTO_AHORA F1** | 2026-07-30 | chip «Para ahora» (dinámico, por franja horaria AR) |
| N5 | **Historial de `/mis-votaciones`** | 2026-08-01 | `/api/votaciones/historial` (20 + cursor), gate premium |
| N6 | **Premium apagado** | 2026-08-01 | `/api/billing/interes`, tabla `premium_interest`, copy nuevo en `/cuenta` y `/mi-negocio` |
| N7 | **135 alias de zona** | 2026-08-01 | autocompletar de búsqueda + prefijo del prompt del chat (+10,8% tokens) |

**Lo que este plan NO hace:** no re-corre el DoD de ningún spec (está todo en `AnalisisQA.md`), no
audita código, no arregla nada. Un bug encontrado se **registra**; el fix es sesión aparte y con OK
de Fer.

---

## 2. El orden que no se puede invertir

El QA en vivo **escribe en el Postgres de dev**, y esa base es la que se restaura en Neon
(DEPLOY F0). Ya pasó dos veces (las filas de `premium_interest` del QA de DEPLOY; las 20 votaciones
sembradas para el historial). Arrancar producción con datos de QA adentro no es cosmético:

- `premium_interest` con 2 filas falsas **dispara el gatillo de prender el cobro** (≥10 clicks de
  usuarios distintos — decisión 18 de DEPLOY).
- `place_impressions_daily` / `place_tag_impressions_daily` con impresiones de QA **envenenan la
  curaduría guiada por uso real**, que es el plan del ítem #3 del backlog ("curar los ~200 que la
  gente ve, no los 14.458").

```
  backup:db  →  QA (bloques A..E)  →  limpieza VERIFICADA POR CONTEO (bloque F)  →  dump  →  DEPLOY F0
```

**La limpieza es un bloque del plan con criterio de "listo" objetivo (§ 8), no una buena
intención.** DEPLOY F0 no arranca hasta que el bloque F cierre en verde.

---

## 3. Roles (5) — y cómo se obtiene cada uno con el cobro apagado

| # | Rol | Cómo se obtiene HOY |
|---|-----|---------------------|
| R1 | **Anónimo** | Sin sesión. Confirmar con `GET /api/auth/get-session`, **nunca** con `document.cookie` ni con la vista de headers de Playwright (redacta la cookie) — lección del falso positivo de INT-12 |
| R2 | **Free** | `pepe`/`juan`/`hugo@gmail.com` → `12345678`. Verificación de email: la hace Fer si falta |
| R3 | **Premium** | **Dos caminos, y los dos se usan.** (a) **Pagando de verdad** en el sandbox de MercadoPago — en dev el cobro **está prendido** (`NEXT_PUBLIC_MP_PUBLIC_KEY` cargada en `.env`); **el pago lo hace Fer, siempre**. (b) `UPDATE users SET plan='premium'` documentado y revertido, como atajo para los casos que no son sobre el cobro. Lo apagado es **producción** (§ 3 bis) |
| R4 | **Dueño** | Reclamo aprobado. `frodriguez.este@gmail.com` es dueño de **Kansas Grill & Bar** (`6323f392-d42f-4d27-8f3f-8b51e2b3cd44`). El eje de plan del lugar (`places.owner_plan` `free`/`paid`) se mueve con `UPDATE` y se revierte |
| R5 | **Admin** | `frodriguez.este@gmail.com` (== `ADMIN_EMAIL`). `/admin` → **404** para cualquier otro |

**Trampa conocida:** `frodriguez.este@gmail.com` es admin + dueño + (con el UPDATE) premium a la
vez. Sirve para el cruce de coexistencia; **no sirve para aislar un solo eje** — ahí van
pepe/juan/hugo. Nunca concluir "lo ve porque es premium" desde esa cuenta.

## 3 bis. Dos configuraciones de entorno, y no se mezclan

**El cobro está apagado en producción, no en dev.** El interruptor es la **ausencia** de
`NEXT_PUBLIC_MP_PUBLIC_KEY` (no hay flag en `app_settings`): en Vercel no se setea, en `.env` sí
está. Consecuencia directa para este plan: **la configuración con la que se corre el QA decide qué
mitad del producto se ve**, y una `NEXT_PUBLIC_` se **inlinea en el build** — cambiarla exige
reiniciar el dev server, o sea que no se alterna a mitad de un caso.

| Config | `NEXT_PUBLIC_MP_PUBLIC_KEY` | Qué se puede verificar | Casos |
|--------|------------------------------|------------------------|-------|
| **A — dev normal** (default) | cargada | El **camino de pago completo**: checkout, Brick, webhook, premium real, cancelación | INT2-31, INT2-41, todo lo demás |
| **B — espejo de prod** | vaciada + **restart del server (lo hace Fer)** | Lo que va a ver el usuario real el día 1: el copy de "todavía no abrimos los pagos", el botón «Avisame cuando abra», el conteo en `/admin` | INT2-13, INT2-32, INT2-42 |

**Regla:** la config B se corre **al final de la sesión 3**, en una pasada corta y agrupada, y se
restaura la variable al terminar. Correr B a mitad del plan obliga a dos reinicios y contamina los
casos de alrededor.

**Lo que esto arregla del diseño original:** `INT-07` (free agota trial → paga → recupera el chat)
**no está obsoleto** — corre entero en config A. Lo que sí es nuevo es su gemelo en config B
(INT2-42): el mismo free, con el checkout apagado, tiene que toparse con un embudo que cierre.

---

## 4. Bloque A — Flujos end-to-end del usuario real

El camino completo, no criterios sueltos. Cada flujo se corre **de una sentada, sin saltear pasos**,
y falla si se rompe la continuidad (no solo si una pantalla está mal).

### A1 — El camino del consumidor anónimo que se engancha (`INT2-01..05`)

| ID | Paso | Esperado |
|----|------|----------|
| INT2-01 | Home anónima → mirar los 4 chips + «Para ahora» | «Para ahora» **primero**, no descuenta de los 4 (decisión 8 de ABIERTO_AHORA). Anotar hora AR exacta y la franja que corresponde |
| INT2-02 | Buscar por **alias** de zona (ej. `unicenter`, `la bombonera`) — **click en el input ANTES de tipear** | El desplegable resuelve a la zona real; el chip de zona queda aplicado |
| INT2-03 | Abrir una ficha desde el resultado | Ficha carga; botón de guardar visible |
| INT2-04 | Tocar «Guardar» sin sesión (en la card **y** en la ficha) | Lleva a `/login?callbackUrl=…` en las dos superficies. **Nada se escribe**: `place_list_items` sin filas nuevas |
| INT2-05 | Registrarse/loguearse y volver | Vuelve a donde estaba (callbackUrl) y ahí sí guarda |

### A2 — El camino del grupo que decide (`INT2-06..11`)

| ID | Paso | Esperado |
|----|------|----------|
| INT2-06 | Free crea una votación con 5 opciones (el techo del creador, `MAX_OPCIONES`) | Se crea. Título con prefijo `[QA2]` (§ 8) |
| INT2-07 | Compartir el link; **anónimo** (otro contexto de browser) vota | Vota sin cuenta (cookie `voter_id`) |
| INT2-08 | El anónimo **sugiere** 2 lugares (su tope) y prueba un 3ro | 5+2 = 7 opciones OK; el 3ro → rechazado por `MAX_SUGERENCIAS_POR_VOTANTE` |
| INT2-09 | Un 2do dispositivo sugiere 1 más (llega a 8) y prueba una 9na | 8 = `MAX_OPCIONES_TOTAL`; la 9na rechazada. **Los dos techos son constantes distintas** — verificar que el rechazo cite el total, no el del creador |
| INT2-10 | Que la opción sugerida reciba votos y el creador la quite | Aviso de "N votos perdidos" **antes** de confirmar; al confirmar, cascada de `poll_votes` |
| INT2-11 | El creador cierra la votación y la busca en `/mis-votaciones` | Free: la ve en activas hasta cerrar; cerrada **no** entra al historial porque el free no tiene historial (decisión 5) → cruza con INT2-30 |

### A3 — El camino del dueño de negocio (`INT2-12..16`)

| ID | Paso | Esperado |
|----|------|----------|
| INT2-12 | Dueño entra a `/mi-negocio/[Kansas]` con `owner_plan='free'` | Ve su panel; los 3 campos pagos y las fotos 4-15 **no** disponibles |
| INT2-13 | Toca «Avisame cuando abra» (pitch B2B) | 1 fila en `premium_interest` con `place_id` = Kansas. **Doble click → sigue 1 fila** (índice único parcial) |
| INT2-14 | Sube a `owner_plan='paid'` por UPDATE, carga descripción/carta/novedad | Se guardan en `place_owner_content` (nunca en columnas de `places`) |
| INT2-15 | Anónimo abre la ficha de Kansas | Ve los 3 extras + el botón de guardar funcionando sobre un lugar pago |
| INT2-16 | Vuelve a `owner_plan='free'` y recarga la ficha como anónimo | Extras ocultos, filas intactas → cruza con la transición T3 |

---

## 5. Bloque B — Gates y aislamiento sobre las superficies nuevas

**Por qué este bloque existe:** INT-12 e INT-14 (2026-07-26) barrieron los gates de **entonces**.
Desde julio aparecieron 6 endpoints que nunca pasaron por ese barrido, dos de ellos con `[id]`
ajeno en la URL. Es el bloque de **seguridad** y el de mayor prioridad después de A.

### B1 — Barrido del anónimo sobre lo nuevo (`INT2-17`, regresión ampliada de INT-12)

Sin sesión (confirmada por `get-session`), contra cada uno:

| Endpoint / ruta | Esperado |
|---|---|
| `/mis-lugares` | Redirect a login |
| `POST /api/favoritos` · `DELETE /api/favoritos` | 401 |
| `POST /api/listas` · `PATCH|DELETE /api/listas/[id]` | 401 |
| `GET /api/favoritos?ids=…` | **200 con `{guardados: [], listas: []}` — decidido 2026-08-02, y ya es lo que hace el código** ([route.ts:71](../../app/api/favoritos/route.ts#L71), decisión 7 de FAVORITOS). Es lectura de estado, no una acción: la respuesta honesta de un anónimo es "no tengo nada guardado", y así la UI pinta corazones vacíos sin distinguir error de vacío. **Lo que se verifica es que no filtre nada**: los dos arrays vacíos, aunque los `ids` pedidos estén guardados por otra persona |
| `GET /api/votaciones/historial` | **401** (verificado en el QA de N5) |
| `POST /api/billing/interes` | 401 — el interés exige sesión (`user_id` NOT NULL) |
| `POST /api/votaciones/[token]/opciones` | **200 — este SÍ debe funcionar anónimo.** Es el único de la lista que no es un gate: es la feature |

### B2 — Cross-tenant sobre recursos ajenos (`INT2-18..20`, regresión ampliada de INT-14)

| ID | Caso | Esperado |
|----|------|----------|
| INT2-18 | juan (free) hace `PATCH` y `DELETE` sobre `/api/listas/[id de una lista de hugo]` | 403/404. **Verificar en DB que el nombre de la lista de hugo no cambió** — el 403 en pantalla no alcanza |
| INT2-19 | Un votante hace `DELETE /api/votaciones/[token]/opciones/[optionId]` sobre una sugerencia **de otro dispositivo** | Rechazado (solo el creador o el autor sin votos) |
| INT2-20 | Un votante intenta borrar una opción **original del creador** (`origin='creator'`) | 403 — las originales no se quitan ni por el creador |

### B3 — Free contra lo premium (`INT2-21..22`)

| ID | Caso | Esperado |
|----|------|----------|
| INT2-21 | Free hace `GET /api/votaciones/historial` | **403** (no 401: la sesión existe, el plan no alcanza) |
| INT2-22 | Free hace `POST /api/listas` (2da lista) | 403. Y el cupo **cuenta la lista default aunque todavía no exista** — un free con 0 listas creadas sigue sin poder crear una segunda |

---

## 6. Bloque C — Cruces rol × feature de las 7 nuevas

### Matriz (qué se corre y qué se descarta)

Leyenda: **🎯** cruce a ejecutar · **✅** ya cubierto por el `/qa-spec` de la feature (no se re-corre)
· **➖ descartado** con motivo.

| | N1 Favoritos | N2 Sugerir | N3 Chips rot. | N4 Para ahora | N5 Historial | N6 Premium apagado | N7 Alias |
|---|---|---|---|---|---|---|---|
| **R1 Anónimo** | 🎯 INT2-04 | ✅ SUG (es su rol natural) | 🎯 INT2-01 | 🎯 INT2-01 | ➖ gate (INT2-17) | ➖ gate (INT2-17) | 🎯 INT2-02 |
| **R2 Free** | 🎯 INT2-22 | ➖ igual que anónimo¹ | ➖ igual que anónimo² | ➖ igual² | 🎯 INT2-21/30 | 🎯 INT2-31 | ➖ igual² |
| **R3 Premium** | 🎯 INT2-23/24 | ➖ igual que anónimo¹ | ➖ igual² | ➖ igual² | 🎯 INT2-25 | 🎯 INT2-32 | ➖ igual² |
| **R4 Dueño** | ➖ ortogonal³ | ➖ ortogonal³ | ➖ igual² | 🎯 INT2-26 | ➖ ortogonal³ | 🎯 INT2-13 | ➖ igual² |
| **R5 Admin** | ➖ sin superficie | ➖ sin superficie | 🎯 INT2-27 | ➖ sin superficie | ➖ sin superficie | 🎯 INT2-28 | ➖ sin superficie |

**Por qué se descartan (el descarte es parte del diseño, no un olvido):**
¹ Sugerir **no lee la sesión**: el gate es la cookie `voter_id` + `allow_suggestions`. Un free
logueado recorre exactamente el mismo código que un anónimo → probarlo dos veces no agrega señal.
² Chips, «Para ahora» y alias son **globales y anónimos por naturaleza**: ningún módulo de los tres
(`rotacion.ts`, `ahora.ts`, `canon.ts`) recibe `userId` ni consulta `users.plan`. El rol no puede
cambiar el resultado; lo que sí lo cambia es el **reloj** (bloque E).
³ Favoritos, sugerir e historial se gatean por `users.plan`; el rol dueño vive en `places.owner_plan`.
La **ortogonalidad de los dos ejes ya se probó** (INT-01/INT-02, PASS). Re-cruzarla es re-correr.

### Cruces de la matriz, con hipótesis

| ID | Cruce | Hipótesis / qué puede romper |
|----|-------|------------------------------|
| INT2-23 | **Premium × favoritos en las 3 superficies** (card, ficha, chat) | El estado de guardado es **consistente** entre búsqueda, ficha y chat. El chat lo pide por lote (`GET /api/favoritos?ids=…`) y las otras dos en el server render — tres caminos distintos al mismo dato es donde aparece el desfasaje |
| INT2-24 | **Cupo de 10 listas** con la default incluida | Crear listas hasta el tope: el error llega en la 10ma, no en la 11va (la default ocupa un lugar del cupo) |
| INT2-25 | **Historial premium con 21+ votaciones** | La 1ra página trae 20 + "Ver más"; el cursor `(created_at, id)` **no repite ni saltea** en el borde. Verificar la fila 20↔21 explícitamente |
| INT2-26 | **«Para ahora» × ficha de dueño con horarios propios** | El chip filtra por **tags curados de franja** (`cena`, `trasnoche`…), no por horarios reales — F2 está gateada en ≥50 lugares con horarios propios y hoy hay 1. **Esperado:** un lugar puede salir en «Para ahora» y decir "Cerrado ahora" en su ficha. Es coherente con el diseño, pero es lo primero que un usuario va a reportar como bug → **documentar la expectativa, no marcarlo ❌** |
| INT2-27 | **Admin × `chips.schedule`** | Confirmar por dónde se edita hoy (¿`/admin` o `UPDATE` a mano?) y que un valor inválido **degrada en silencio al orden por `sort`** sin romper la home. Un setting corrupto en prod no puede tumbar la portada |
| INT2-28 | **Admin × contador de interés premium** | El tab de suscripciones muestra el conteo real de `premium_interest` y separa B2C (`place_id IS NULL`) de B2B. Es el dato que **dispara los US$20/mes** — si cuenta mal, cuenta plata mal |

### Cruces de métrica (el patrón que ya dio INT-05)

| ID | Cruce | Por qué importa |
|----|-------|-----------------|
| INT2-29 | **¿Qué cuenta cada superficie?** Guardar desde el chat suma `saves` en `place_impressions_daily`, pero el chat **no** suma `impressions` (INT-05, confirmado en julio). Buscar desde el **sheet de sugerencias** de una votación **sí** cuenta impresiones (decisión 5 de SUGERIR) | Es el dato que se le vende al dueño. Hoy conviven tres criterios distintos sin que nadie los haya mirado juntos. **No es necesariamente un bug** — el entregable de este caso es una **tabla de "qué superficie cuenta qué"** y una decisión de Fer al backlog, igual que INT-05 |

---

## 7. Bloque D — Transiciones de estado

Donde aparecieron los bugs históricamente. Cada una: llevar el sistema al estado A, transicionar,
y verificar **en pantalla y en DB**.

| ID | Transición | Qué verificar |
|----|-----------|---------------|
| INT2-30 | **premium → free** (el gordo) | Con el premium teniendo: 4 listas de favoritos · 3 votaciones activas · 25 en historial. Al bajar: (a) las listas no-default quedan **ocultas, no borradas** (`place_lists` conserva las filas); (b) las 3 activas **siguen abiertas**, pero crear una 4ta → 409 `LIMITE_ACTIVA` (regresión de INT-08, ahora con historial encima); (c) `/api/votaciones/historial` → 403 y la pantalla deja de mostrarlo; (d) los lugares guardados en listas ocultas **no se pierden** al volver a subir |
| INT2-31 | **free agota el trial del chat → paga → recupera** (config A) | Regresión de INT-07, que **sigue vigente**: en dev el checkout funciona. **El pago lo hace Fer.** Lo nuevo respecto de julio: el premium recién comprado ahora desbloquea también el **historial de `/mis-votaciones`** y las **10 listas** de favoritos — verificar que las tres superficies se prendan con el mismo pago |
| INT2-32 | **Premium sin suscripción × botón de cancelar** | **Estado real en producción**, no artefacto de QA: con el cobro apagado, el único camino a premium en prod es un `UPDATE` a mano de Fer (beta tester, regalo, dueño que lo pidió). Ese usuario **no tiene fila en `subscriptions`**, y `POST /api/billing/cancel` devuelve **404 `SIN_SUSCRIPCION`** ([cancelacion.ts:33-38](../../lib/billing/cancelacion.ts#L33)). *A verificar:* si `/cuenta` le muestra el botón "Cancelar", tocarlo lo deja en un callejón sin salida. *Esperado a definir según lo que se vea:* o la UI no ofrece cancelar sin suscripción, o el 404 se explica con un copy que no asuste |
| INT2-33 | **Revocar reclamo del dueño** | Revocar el claim de Kansas: la ficha vuelve a Overture (contenido oculto **sin borrar**), las fotos dejan de mostrarse. **Los `place_tags source='owner'` se dejan de aplicar** (decidido 2026-08-02, § 12.3): a diferencia del texto de la ficha, los tags deciden **en qué búsquedas aparece el lugar**, y un reclamo revocado —que puede ser fraude— no puede seguir sesgando el catálogo. *Ojo:* hoy no hay a qué volver, porque el guardado del dueño **borró** los tags originales → INT2-40. La fila de `premium_interest` con ese `place_id` queda huérfana → decidir si se limpia |
| INT2-40 | **🔴 Guardar contenido del dueño × tags de curaduría** | **Hallazgo del diseño, ya confirmado en código y en datos — el caso más caro del plan.** `guardarContenido` hace `tx.delete(placeTags).where(eq(placeTags.placeId, placeId))` **sin filtrar por `source`** ([negocio/acciones.ts:117](../../lib/negocio/acciones.ts#L117)) y reemplaza todo por lo tildado en el form. El docstring contempla borrar los de `import` (decisión 14: para SU lugar el dueño es mejor fuente que Overture) — pero **la curaduría no existía cuando se escribió esa regla**: hay **3.967 tags `source='admin'` sobre 1.202 lugares**, que **no están en git ni en el seed** y cuestan ~US$17 de re-corrida. *Repro:* lugar curado + reclamo aprobado + el dueño toca "Guardar" en el editor → sus tags `admin` desaparecen. *Verificar además:* que el editor **no muestre** los tags de curaduría como tildados, con lo cual el dueño los borra **sin enterarse**, con un click en un formulario que él cree que solo edita su teléfono |
| INT2-41 | **Cancelación real de una suscripción** (config A) | Cierre del ciclo de INT2-31: cancelar la sub que se compró → preapproval cancelado en MP + acceso hasta fin de período (cancelación diferida, decisión 15 de MONETIZACION). **Es también la limpieza obligatoria** de INT2-31: una sub viva en el dump la reactiva cualquier reconciliación lazy |
| INT2-42 | **Espejo de prod: el embudo del premium apagado** (config B) | El gate del trial ofrece "Hacerme premium" → `/cuenta`, y en config B `/cuenta` **no vende**. Verificar que el embudo cierre: el CTA lleva a algo que **existe** (el botón «Avisame cuando abra»), no a un checkout muerto ni a una promesa que la pantalla no puede cumplir. Correr junto a INT2-13 y INT2-32 en la única pasada de config B |
| INT2-34 | **owner_plan paid → free** | Regresión liviana de INT-11 (PASS en julio) **más lo nuevo**: fotos 4-15 ocultas y el **destaque en búsqueda apagado**. Se corre solo si INT2-16 no lo cubrió entero |
| INT2-35 | **Tope global de chat agotado** (`ai.chat_monthly_cap`) | Bajar el cap a un valor por debajo del uso del mes → el chat **degrada** con mensaje claro, no rompe. Restaurar el valor al terminar. Ojo: el cap va a 500 en Neon (decisión 8 de DEPLOY) |

---

## 8. Bloque E — Sensibilidad al reloj

Tres features leen la hora AR por `partesEnAR` (`lib/negocio/horarios.ts`, día 0 = lunes, TZ fija).
**Un QA a las 15:00 de un martes no ve lo mismo que a la 1:00 de un sábado**, y falsear el reloj del
sistema fue descartado (BACKLOG, 2026-07-30).

| ID | Caso | Franja requerida | Cómo se resuelve |
|----|------|------------------|------------------|
| INT2-36 | «Para ahora» aplica los tags de la franja actual | Cualquiera — anotar hora y franja esperada | Se corre en la sesión normal |
| INT2-37 | Franja de **madrugada**: `trasnoche` **y** `hasta-tarde`, resultado = **unión** (~176), no intersección | 00:00–05:59 AR | **Ya está en el backlog como AHORA-02 pendiente.** Fer lo mira una noche; no bloquea |
| INT2-38 | Regla de `chips.schedule` que **cruza medianoche** (viernes 22:00–05:00 alcanza el sábado 01:00) | Sábado 01:00, o **editar la regla en vez del reloj** | **Recomendado: editar la regla** para que matchee la hora de la sesión, verificar, y restaurar el setting. Cubre la lógica sin esperar a la madrugada |
| INT2-39 | `chips.schedule` **inválido** (JSON roto, `dias:"lunes"`, `desde:"25:99"`, slug inexistente) | Cualquiera | Poner cada variante, confirmar que la home **no se rompe** y degrada al orden por `sort`, con un solo log en servidor. Restaurar el valor bueno |

**Regla de registro:** todo caso de este bloque anota **hora y día AR exactos** en la evidencia. Sin
eso el resultado no es reproducible ni refutable.

---

## 9. Bloque F — Limpieza verificable por conteo (criterio de "listo")

### Convención de marcado (se aplica **desde el primer caso**, no al final)

| Artefacto | Marca |
|-----------|-------|
| Votaciones creadas en el QA | `title` empieza con `[QA2]` |
| Listas de favoritos creadas | nombre empieza con `QA2 ·` |
| Todo lo demás | se identifica por `user_id` de las cuentas de QA + `created_at >= <timestamp de arranque>` |

**Anotar el timestamp de arranque del QA en la sección de `AnalisisQA.md` antes del primer caso.**
Es lo que hace la limpieza verificable; sin él, "lo que sembró el QA" es una conjetura.

### Snapshot ANTES / DESPUÉS

Antes del primer caso y después de la limpieza, correr el **mismo** `SELECT` y comparar. El criterio
de "listo" es **diff = 0** en las tablas de escritura de usuario:

```sql
-- Snapshot (correr idéntico antes y después)
select 'place_lists'                as t, count(*) from place_lists
union all select 'place_list_items',       count(*) from place_list_items
union all select 'polls',                  count(*) from polls
union all select 'poll_options',           count(*) from poll_options
union all select 'poll_votes',             count(*) from poll_votes
union all select 'premium_interest',       count(*) from premium_interest
union all select 'chat_conversations',     count(*) from chat_conversations
union all select 'chat_messages',          count(*) from chat_messages
union all select 'place_claims',           count(*) from place_claims
union all select 'place_owner_content',    count(*) from place_owner_content
union all select 'place_photos',           count(*) from place_photos
union all select 'subscriptions',          count(*) from subscriptions
union all select 'users',                  count(*) from users;
```

**Tablas agregadas** (no se borra "la fila del QA", se borran **los días del QA**) — el motivo está
en § 2: estas filas envenenan la curaduría por uso real, que es el próximo ítem del backlog.

```sql
delete from place_impressions_daily      where date >= '<día 1 del QA>';
delete from place_tag_impressions_daily  where date >= '<día 1 del QA>';
delete from place_taps_daily             where date >= '<día 1 del QA>';
```

**Decisión de Fer requerida** (§ 11): `ai_api_usage`, `chat_usage_monthly` y `google_api_usage` son
acumuladores **mensuales**, no diarios — borrarlos pierde el histórico real del mes. Recomendación:
**dejarlos** y anotar en el QA cuánto sumó la sesión, salvo que Fer prefiera arrancar prod en cero.

### Checklist de reversión de flags

Todo `UPDATE` de setup se anota al hacerlo y se revierte al cerrar: `users.plan` de las cuentas de
QA · `places.owner_plan` de Kansas · `app_settings['chips.schedule']` · `app_settings['ai.chat_monthly_cap']`
· estado del claim de Kansas · sesión del browser cerrada (`POST /api/auth/sign-out`).

**El bloque F cierra en verde solo si:** snapshot ANTES == snapshot DESPUÉS · los tres `delete` de
agregados corrieron · todos los flags revertidos y verificados con `SELECT` · `npm run backup:db`
corrido **después** de la limpieza (ese es el dump que viaja a Neon).

---

## 10. Método de ejecución (obligatorio, no sugerencias)

1. **La ejecución NO se paraleliza.** El MCP de Playwright es un browser único con cookies
   compartidas y la base es una sola: dos agentes logueados producen falsos positivos. Una sesión,
   un caso a la vez.
2. **Click en el input ANTES de tipear**, siempre. Tipear sobre un campo que ya es `activeElement`
   no dispara `onFocus` y React no prende el estado — así se fabricó un hallazgo falso el 2026-08-01
   (`LECCIONES_APRENDIDAS.md` § *tipear no es enfocar*). Vale para todo lo que dependa de `onFocus`,
   `onBlur` o `onMouseEnter`.
3. **Un síntoma que no se puede explicar en el código todavía NO es un hallazgo.** Antes de escribir
   un ❌: ir al archivo, encontrar la línea que lo produce, y solo entonces reportarlo. En un QA de
   ~50 casos el riesgo de hallazgo inventado escala con el cansancio.
4. **El estado "anónimo" se confirma con `GET /api/auth/get-session`.** Nunca con `document.cookie`
   (no ve httpOnly) ni con la vista de headers de Playwright (redacta la cookie).
5. **LOS PAGOS LOS HACE FER, SIEMPRE.** Claude llega hasta la pantalla de datos de la tarjeta y
   para — nunca completa un checkout, ni siquiera en el sandbox. **En dev el cobro está prendido**
   (§ 3 bis), así que este plan **sí** tiene casos de pago: INT2-31 (comprar) e INT2-41 (cancelar).
   Los dos requieren a Fer en el teclado; el resto del caso lo sigue Claude.
6. **No tocar código.** Un bug real se registra con su ID y sigue el QA; el fix es sesión aparte con
   OK de Fer.
7. **Entorno:** el dev server lo levanta **Fer** en el puerto 5178; se verifica contra
   `https://adondesalimos.ngrok.app`, nunca `localhost`.
8. **Registro:** cada caso va a `docs/qa/AnalisisQA.md` § *QA integral #2* con su ID `INT2-NN` y
   ✅/❌/⚠️ + evidencia. Los hallazgos que sean decisión de producto van también a `BACKLOG.md`.

---

## 11. Sesiones de ejecución — orden y estimación

**42 IDs.** Se corren en 3 sesiones + un caso suelto. El orden no es arbitrario: **B antes que C**
porque un agujero de aislamiento cambia la prioridad de todo lo demás, y **F al final, siempre**.

| # | Sesión | Bloques | IDs | Config | Por qué en este orden |
|---|--------|---------|-----|--------|----------------------|
| 1 | **Caminos + gates** (~2-3 h) | A + B | INT2-01..22 | A | Los flujos end-to-end siembran los datos (votaciones, listas, contenido) que los bloques siguientes necesitan. Los gates se barren con esos datos frescos. **INT2-40 se corre acá**, junto a INT2-14: es el mismo gesto (el dueño guarda el editor) |
| 2 | **Cruces + reloj** (~2 h) | C + E | INT2-23..29, 36, 38, 39 | A | Reusa lo sembrado en la sesión 1. Requiere los `UPDATE` de plan — anotarlos |
| 3 | **Transiciones + pago + limpieza** (~2-3 h) | D + F | INT2-30..35, 41 → **pasada corta en config B**: INT2-13, 32, 42 → snapshot | A → **B** | Las transiciones **destruyen** el estado sembrado (bajar planes, revocar claims): van últimas. **Fer en el teclado** para INT2-31/41 (pago y cancelación) y para el restart del server al cambiar de config. La limpieza cierra y habilita el dump |
| — | **Suelto** | E | INT2-37 | A | Madrugada (00:00–05:59). Lo mira Fer cuando le toque; **no bloquea el deploy** |

**Antes de cerrar la sesión 3: restaurar `NEXT_PUBLIC_MP_PUBLIC_KEY` en `.env`.** Si el dump viaja
sin ese paso no pasa nada (la variable no está en la base), pero el dev server queda en modo prod y
la sesión siguiente arranca viendo un producto que no es el que está desarrollando.

**Antes de la sesión 1:** `npm run backup:db` (la curaduría no está en git) y anotar el timestamp de
arranque. **Después de la sesión 3:** backup nuevo → ese es el dump de DEPLOY F0.

---

## 12. Decisiones — cerradas por Fer el 2026-08-02

1. **`GET /api/favoritos?ids=…` para un anónimo → 200 con arrays vacíos.** Es un endpoint de
   **lectura de estado**, no una acción: la respuesta honesta de un anónimo es "no tengo nada
   guardado", y devolverla como 200 evita que la UI tenga que distinguir *error* de *vacío* para
   pintar exactamente lo mismo (corazones sin llenar). Las **acciones** (`POST`/`DELETE`) sí son
   401 — ahí el anónimo tiene que ir a login. **No hay nada que cambiar: el código ya lo hace así**
   y con el porqué escrito ([route.ts:71](../../app/api/favoritos/route.ts#L71), decisión 7 de
   FAVORITOS). Queda como expectativa documentada, no como trabajo.
2. **Los acumuladores mensuales se dejan** (`ai_api_usage`, `chat_usage_monthly`,
   `google_api_usage`). Son histórico real del mes y borrarlos rompe el tablero de costos de
   `/admin`, que es la única defensa contra una factura sorpresa. El QA anota cuánto sumó su
   sesión. (Los agregados **diarios** sí se borran — § 9: esos envenenan la curaduría por uso real.)
3. **Los tags `source='owner'` dejan de aplicarse al revocar un reclamo.** Es el mismo criterio
   que el resto del contenido del dueño (*ocultar ≠ borrar*), pero con una razón más fuerte: el
   texto de la ficha solo afecta a quien ya la abrió, mientras que **los tags deciden en qué
   búsquedas aparece el lugar**. Un reclamo revocado —y se revoca justamente cuando alguien no era
   quien decía ser— no puede seguir sesgando el catálogo. **Lo que este QA verifica es la
   expectativa, no la implementación**: si el código hoy no lo hace, es un hallazgo → BACKLOG, no
   un fix a mitad del QA. **Y no puede implementarse antes de arreglar INT2-40**, porque hoy no hay
   a qué volver: el guardado del dueño ya borró los tags originales.
4. **INT2-32 quedó reencuadrado, no descartado** — ver la transición en § 7. El estado "premium sin
   haber pagado" **sí va a existir en producción**: con el cobro apagado, un `UPDATE` a mano de Fer
   es el único camino para un beta tester o un dueño que lo pida. Lo que hay que definir es qué ve
   esa persona en `/cuenta` cuando `POST /api/billing/cancel` le va a devolver 404
   `SIN_SUSCRIPCION`.

### Lo que queda abierto (decisión de producto, no de QA)

- **Qué hacer con INT2-40** (los tags de curaduría que borra el editor del dueño): el fix es chico
  y quirúrgico —que el `delete` preserve `source='admin'`— pero es **código, y va en sesión
  aparte**. La pregunta de producto detrás: cuando el dueño y la curaduría se contradicen sobre un
  tag, ¿quién gana? Recomendación: **el dueño gana sobre lo que él tildó** (es su lugar), **la
  curaduría sobrevive en lo que él no tocó** (es trabajo de la casa, pago, y no está en git).

---

## 13. Fuera de alcance (referenciado, no re-corrido)

- El DoD de cada spec contra sí mismo → ya en `AnalisisQA.md` (los 9 numerados + las 7 nuevas).
- **INT-01..15 que no cambiaron**: INT-10/11 (ficha paid vs free), INT-15 (admin sobre panel ajeno),
  INT-01..05 (coexistencia de ejes de pago y chat sin sesgo). Siguen válidos; nada de lo que entró
  después los toca. Se re-corren **solo** INT-08 (dentro de INT2-30), INT-12 (ampliado, INT2-17) e
  INT-14 (ampliado, INT2-18..20).
- **INT-07** (free paga y recupera el chat) **sigue vigente** y se re-corre como INT2-31: lo apagado
  es producción, no dev (§ 3 bis). Su gemelo en config B es INT2-42.
- ABIERTO_AHORA **F2** (abierto real por horarios de dueño): gateada en ≥50 lugares con horarios
  propios; hoy hay 1.
- Performance, carga y concurrencia real (locks `FOR UPDATE` de favoritos y sugerencias están
  cubiertos por tests, no en vivo).
- DEPLOY F0 y siguientes: arrancan **después** de que el bloque F cierre en verde.
