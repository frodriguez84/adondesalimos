# Plan de QA integral — A Dónde Salimos

**Estado:** Escrito 2026-07-26 · **ejecutado** (10 cruces en vivo, todos PASS; INT-02/03/06
cubiertos por código/mecanismo) — resultados en `docs/qa/AnalisisQA.md` § *QA integral — cruces
rol × feature*. **Cero bugs.**
**Autor de la matriz:** sesión Opus de QA (#2 de la cola post-spec-8, triaje 2026-07-26).

---

## Qué es esto (y qué NO es)

Cada spec (1-8) ya pasó su `/qa-spec` **APROBADO** contra su propio DoD — está todo en
`docs/qa/AnalisisQA.md`. Ese trabajo verifica **cada feature contra sí misma**, con el rol
"natural" de esa feature (búsqueda con un anónimo, cobro con un comprador, panel con un dueño).

**Lo que ningún `/qa-spec` individual verificó es el CRUCE de features: rol × feature en las
combinaciones que caen ENTRE dos specs.** Ejemplos que ninguna QA previa tocó:

- Una cuenta que es **premium B2C** (chat) **y** **dueño paid** (destaque) a la vez — los dos
  ejes de pago conviven en `users.plan` y `places.owner_plan`, pero nunca se probaron juntos.
- El **chat IA** (spec 8, el más nuevo) cruzado con el **destaque pago** (spec 7): ¿la IA le da
  ventaja al que paga? ¿cuenta impresiones para las estadísticas B2B?
- La **transición de plan** (premium → free) cruzada con el **gate "1 votación activa"** de
  VOTACION: qué pasa con las activas de más cuando alguien deja de ser premium.
- Lo que un **anónimo** ve en la **ficha** de un lugar **pago** vs uno free (campos pagos, fotos).
- **Aislamiento entre dueños**: que el dueño del lugar A no pueda tocar el panel del lugar B.

Este plan enumera esos cruces, los prioriza, y define cómo ejecutarlos en vivo. **No re-corre**
lo que cada spec ya cerró; cuando un cruce toca una celda ya cubierta, se referencia el QA
existente en vez de repetirlo.

**Datos sanos:** el "bug de zonas" (prioridad #1 del triaje) se cerró como NO-bug el 2026-07-26
(`place_zones` correcta, 12.122/12.122 filas ≤400 m — ver memoria `zona-no-adyacente-no-era-bug`
y `AnalisisQA.md` § *Investigación — zona no adyacente*). La matriz corre sobre datos sanos.

---

## Roles (6)

| # | Rol | Cómo se obtiene | Estado de setup |
|---|-----|-----------------|-----------------|
| R1 | **Anónimo** | Sin sesión | Directo |
| R2 | **Usuario free** | Cuenta logueada, `users.plan='free'`, no dueño | Requiere email verificado en DB (lo hace Fer) |
| R3 | **Premium B2C** | `users.plan='premium'` | `frodriguez.este@gmail.com` es premium real; o UPDATE a mano + revertir |
| R4 | **Dueño free** | Reclamo aprobado, `places.owner_plan='free'` en su lugar | Fer aprueba el claim / ya existe |
| R5 | **Dueño paid** | Reclamo aprobado + `places.owner_plan='paid'` | Kansas Grill & Bar (frodriguez.este); flag a mano + revertir |
| R6 | **Admin** | Email == `ADMIN_EMAIL` | `frodriguez.este@gmail.com` |

**Nota clave sobre `frodriguez.este@gmail.com`:** es simultáneamente **admin + dueño (Kansas) +
premium real**. Eso lo hace la cuenta ideal para el **cruce de coexistencia de flags** (Grupo A),
pero también obliga a tener cuidado: no confundir "lo ve porque es admin" con "lo ve porque es
premium/dueño". Los cruces que aíslan un solo eje usan cuentas separadas (pepe/juan/hugo).

**Cuentas de prueba** (memoria `usuarios-prueba-qa`): `pepe`/`juan`/`hugo@gmail.com` →
`12345678` (free, email a verificar por Fer); `frodriguez.este@gmail.com` (admin+dueño+premium).

---

## Features (9)

| # | Feature | Spec | Superficie |
|---|---------|------|-----------|
| F1 | Búsqueda / filtros | BUSQUEDA | `/`, `/api/search*` |
| F2 | Ficha | FICHA | `/lugar/[id]` |
| F3 | Zonas | ZONAS | selector + geometría |
| F4 | Votación | VOTACION | `/votacion/*` |
| F5 | Chat IA | CHAT_IA | `/chat`, `/api/chat*` |
| F6 | Monetización / destaque | MONETIZACION | `/cuenta`, `/mi-negocio`, destaque en `/` |
| F7 | Mi-negocio | AUTH F3 + MONE | `/mi-negocio/[placeId]` |
| F8 | Estadísticas | AUTH F4 + MONE F4 | teaser + desglose en el panel |
| F9 | Admin | AUTH + MONE | `/admin` |

---

## Matriz rol × feature

Leyenda: **✅ cubierto** por el `/qa-spec` citado (no se re-corre) · **🎯 cruce** prioritario a
ejecutar (con su ID INT-NN) · **—** no aplica / gate esperado (se verifica como negación) ·
**➖ trivial** (mismo comportamiento que un rol ya probado, sin cruce nuevo).

| | F1 Búsqueda | F2 Ficha | F3 Zonas | F4 Votación | F5 Chat | F6 Moneti/destaque | F7 Mi-negocio | F8 Estadísticas | F9 Admin |
|---|---|---|---|---|---|---|---|---|---|
| **R1 Anónimo** | ✅ BUSQ | 🎯 INT-10/11 | ✅ ZONAS | 🎯 INT-12 (vota sí / crea no) | — INT-12 (login) | ➖ (ve destacados) | — INT-12 | — | — INT-12 |
| **R2 Free** | ✅ | ✅ | ✅ | ✅ VOT-03 | ✅ CHAT-02 trial | 🎯 INT-13 (upgrade) | — INT-13/14 | ✅ teaser | — INT-13 |
| **R3 Premium B2C** | ➖ | ➖ | ➖ | ✅ VOT-04 | ✅ CHAT-03 | 🎯 INT-01/06/08 | ➖ | ➖ | ➖ |
| **R4 Dueño free** | ➖ | 🎯 INT-10 | ➖ | ➖ | 🎯 INT-02 | ✅ MONE-12 | ✅ AUTH F3 | ✅ teaser | — |
| **R5 Dueño paid** | 🎯 INT-04 (destaque) | 🎯 INT-10 | ➖ | ➖ | 🎯 INT-02/04/05 | ✅ MONE-09..12 | 🎯 INT-14 (aislamiento) | ✅ MONE-15 | — |
| **R6 Admin** | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ MONE-F2-ADMIN | 🎯 INT-15 | 🎯 INT-15 | ✅ AUTH-12 |

---

## Cruces prioritarios (el trabajo real)

Cada cruce lleva: **hipótesis** · **repro** · **esperado** · **por qué ningún spec lo tocó**.
Los resultados se registran en `AnalisisQA.md` § *QA integral* con estos mismos IDs.

### Grupo A — Coexistencia de los dos ejes de pago (el cruce más rico)

Hay **dos** flags de pago independientes: `users.plan` (premium B2C, gatea el chat y votaciones
ilimitadas) y `places.owner_plan` (paid B2B por lugar, gatea destaque + campos pagos + 15 fotos
+ desglose). **Ningún spec probó una cuenta con los dos prendidos, ni verificó que sean
ortogonales.**

- **INT-01 — Premium B2C + dueño paid en la misma cuenta.** *Hipótesis:* los dos ejes conviven
  sin interferir. *Repro:* cuenta premium (`users.plan='premium'`) que además es dueño aprobado
  de un lugar `owner_plan='paid'` → usa el chat (cupo premium), ve su local destacado en la
  búsqueda, y ve el desglose pago en `/mi-negocio`. *Esperado:* las tres cosas funcionan a la
  vez; bajar UNO de los flags no apaga el otro. *Por qué:* MONE probó cada flag por separado;
  CHAT probó premium sin dueño. La coexistencia es zona de nadie.

- **INT-02 — `owner_plan='paid'` NO da acceso al chat.** *Hipótesis:* el chat se gatea SOLO por
  `users.plan`, nunca por `owner_plan`. *Repro:* dueño paid con `users.plan='free'` entra a
  `/chat`. *Esperado:* trial de 3 mensajes como cualquier free / gate premium — pagar el B2B no
  regala el chat. *Por qué:* confirma en vivo que los ejes no se filtran uno al otro (el spec de
  chat dice `owner_plan` no participa — CHAT_IA-QA-05 lo probó en `lib/ai/`, pero no en vivo con
  un dueño paid real).

- **INT-03 — Premium B2C que NO es dueño no ve nada de B2B.** *Repro:* premium sin claim entra a
  `/mi-negocio/[cualquier id]`. *Esperado:* rechazo (no es dueño); su `/cuenta` tiene el tab
  premium pero cero superficie B2B. *Por qué:* negación del cruce inverso de INT-01.

### Grupo B — Chat IA (spec 8) × specs 6-7

- **INT-04 — El chat no le da ventaja al que paga (sin sesgo pago).** *Hipótesis:* el chat usa
  `searchPlaces` (orgánico puro), nunca `buscarDestacados`; el orden no mira `owner_plan`.
  *Repro:* con un local `owner_plan='paid'` que matchea, pedir en el chat algo que lo incluya y
  comparar con la búsqueda normal (donde SÍ saldría destacado). *Esperado:* en el chat el local
  pago no encabeza por pagar; sale por relevancia como cualquiera. *Confirmado en código*
  ([tools.ts:102](../../lib/ai/tools.ts#L102) llama solo `searchPlaces`; `buscarDestacados` es
  otra función, [query.ts:456](../../lib/search/query.ts#L456)) — **verificar en vivo**. *Por
  qué:* el destaque (MONE F3) nació antes que el chat (spec 8); nadie verificó que el chat lo
  ignore.

- **INT-05 — El chat NO cuenta impresiones ni taps.** *Hipótesis:* un lugar mostrado como card
  en el chat no suma en `place_impressions_daily` ni en las estadísticas que vende el B2B.
  *Repro:* abrir el desglose de un local, pedirlo por el chat, reabrir el desglose → sin cambio
  en impresiones. *Esperado (a documentar):* el chat no registra — `lib/ai/tools.ts` no importa
  `registrarImpresiones`. *Decisión abierta:* ¿es correcto que las vistas del chat no cuenten
  para el dueño? Es un **cruce de diseño F5×F8**, no necesariamente un bug — registrar el
  hallazgo y dejar la decisión a Fer.

- **INT-06 — Loop premium REAL: MP → chat shortlist → votación.** *Hipótesis:* un premium que
  pagó por MercadoPago (no flag a mano) puede usar el botón shortlist. *Repro:* con premium real
  (`frodriguez.este`), `/votacion/nueva` → "Que la IA arme la shortlist" → chat → "Usar esta
  shortlist" → votación creada. *Esperado:* end-to-end como CHAT-13, pero cerrando que el premium
  venga del pago, no de un UPDATE. *Por qué:* CHAT F3 probó el flujo con premium; no ató el
  origen del premium al cobro de MONE F2.

- **INT-07 — Free agota trial → paga premium → recupera el chat.** *Repro:* free con
  `chat_trial_used=3` (gate agotado) que pasa a premium → vuelve a `/chat`. *Esperado:* pasa del
  gate "usaste tus mensajes de prueba" al cupo mensual premium. *Por qué:* cruce F5×F6 de la
  transición trial→pago; cada estado se probó suelto, la transición no.

### Grupo C — Votación × transición de plan

- **INT-08 — Downgrade con votaciones activas de más.** *Hipótesis:* el gate "1 activa" cuenta
  `status='open' AND expires_at>now()` sin mirar cuántas creó siendo premium. *Repro:* premium
  crea 2-3 votaciones activas → baja a free (cancelación/vencimiento) → intenta crear otra.
  *Esperado a verificar:* las activas existentes **no se cierran** (ocultar≠borrar), pero el gate
  free rechaza una nueva mientras haya ≥1 activa. *Riesgo:* que el conteo se confunda o que el
  downgrade deje al usuario en un estado inconsistente. *Por qué:* VOTACION probó free (1 activa)
  y premium (ilimitado) por separado; la **transición** entre ambos con activas colgando es
  terreno virgen.

### Grupo D — Ficha × monetización B2B (lo que ve el público)

- **INT-10 — Anónimo ve los extras pagos en la ficha de un local paid.** *Hipótesis:* la ficha
  pública refleja `owner_plan`: paid muestra campos pagos (`description`/`menu_url`/`news`) y
  hasta 15 fotos; free no. *Repro:* como anónimo abrir la ficha de Kansas con `owner_plan='paid'`
  y contenido pago cargado, luego un local free. *Esperado:* el paid muestra los extras, el free
  no los muestra (aunque la fila exista). *Por qué:* AUTH F3 probó el `COALESCE` dueño→base y
  MONE el gating server-side, pero nadie verificó **desde el ojo del anónimo** que la ficha
  pública distinga plan.

- **INT-11 — Bajar de paid a free oculta los extras en la ficha (ocultar≠borrar).** *Repro:*
  local paid con extras → bajar a `owner_plan='free'` → recargar la ficha como anónimo.
  *Esperado:* desaparecen campos pagos y fotos 4-15; la fila sigue en DB. *Por qué:* la regla
  "ocultar≠borrar en los dos ejes" (CLAUDE.md § contenido del dueño) se afirmó pero no se probó
  end-to-end sobre la **ficha pública**.

### Grupo E — Gates de rol e aislamiento (matriz de acceso negado)

- **INT-12 — Barrido de gates del anónimo.** *Repro:* sin sesión visitar `/chat`, `/votacion/nueva`,
  `/mi-negocio/[id]`, `/admin`, y **votar** en una votación abierta. *Esperado:* `/chat` → CTA
  login (no redirect, decisión 20); `/votacion/nueva` → puede armar pero crear exige login (o el
  gate que corresponda — **verificar**); `/mi-negocio` y `/admin` → redirect/rechazo; **votar sí**
  funciona sin cuenta (VOT-05). Un solo barrido que confirma consistencia.

- **INT-13 — Free (no dueño) contra superficies ajenas.** *Repro:* free logueado entra a
  `/mi-negocio/[id ajeno]` y `/admin`. *Esperado:* ambos rechazan. *Por qué:* nadie probó el
  panel B2B ni el admin **con un free logueado** (distinto del anónimo — la sesión existe pero el
  rol no alcanza).

- **INT-14 — Aislamiento entre dueños (cross-tenant).** *Hipótesis:* el dueño del lugar A no
  puede ver ni editar el panel del lugar B. *Repro:* dueño de A entra a `/mi-negocio/[placeId de
  B]`, e intenta `POST` de contenido/fotos contra B. *Esperado:* `esDuenoDe` rechaza lectura y
  escritura. *Por qué:* **seguridad, nunca probada explícitamente** — AUTH probó que el dueño ve
  SU panel, no que NO vea el ajeno. Cruce crítico.

- **INT-15 — Alcance del admin sobre paneles ajenos.** *Repro:* admin (`frodriguez.este`) entra a
  `/mi-negocio/[id de un lugar que no es suyo]`. *Esperado a verificar:* ¿el admin ve todo por
  `/admin` pero el panel `/mi-negocio` sigue siendo por-dueño (rechaza), o el admin lo ve? Definir
  la expectativa y registrarla. *Por qué:* "el admin ve todo" (IDEAS § roles) vs el gate
  `esDuenoDe` de `/mi-negocio` — puede haber tensión no resuelta.

---

## Protocolo de ejecución

1. **Entorno:** dev server lo levanta **Fer** en el puerto 5178; se verifica contra
   `https://adondesalimos.ngrok.app` (NO localhost), con **Playwright MCP**. Claude nunca levanta
   el server (memoria `no-levantar-server`).
2. **Setup de estado de prueba:** los flags de QA (`owner_plan='paid'`, `users.plan='premium'`,
   `chat_trial_used`, expirar votaciones) se ponen con `UPDATE` documentado y **se revierten al
   cerrar** — mismo criterio que todas las QA de fase previas. **La verificación de email de las
   cuentas free y los pagos reales de MP los hace Fer** (memorias `usuarios-prueba-qa`,
   `pagos-qa-en-vivo-los-hace-el-usuario`).
3. **Pagos:** Claude llega hasta la pantalla de pago y para; la tarjeta la pone Fer.
4. **No tocar código** salvo que un cruce revele un bug real **y Fer lo apruebe** — el fix es
   sesión aparte (regla del handoff). Los gaps bloqueantes se registran igual.
5. **Registro:** cada cruce ejecutado va a `docs/qa/AnalisisQA.md` § *QA integral (cruces
   rol × feature)* con su ID `INT-NN`, ✅/❌/⚠️ y evidencia. Los hallazgos que sean decisión de
   producto (ej. INT-05) van también a `BACKLOG.md`.
6. **Limpieza:** todo artefacto de prueba (flags, votaciones, conversaciones, filas de uso) se
   revierte o se anota como dejado a propósito, como en las QA previas.

## Orden de ejecución sugerido

1. **Sin setup especial** (arranque inmediato): INT-12 (gates anónimo), INT-04 + INT-05 (chat sin
   sesgo/impresiones, con premium real), INT-10 (ficha paid vs free como anónimo).
2. **Con flags a mano + revertir:** INT-01/02/03 (coexistencia), INT-11 (ocultar en ficha),
   INT-14/15 (aislamiento), INT-13 (free contra superficies ajenas).
3. **Transiciones (más frágiles):** INT-06/07 (chat × pago), INT-08 (votación × downgrade).

---

## Fuera de alcance (referenciado, no re-corrido)

- Cada spec contra su propio DoD → ya en `AnalisisQA.md` (CATALOGO, ZONAS, BUSQUEDA, FICHA, AUTH,
  VOTACION, HOME_IDENTIDAD, MONETIZACION, CHAT_IA — todos APROBADO).
- El "bug de zonas" → cerrado como NO-bug (§ *Investigación — zona no adyacente*).
- El tuning de prompt del chat (calidad de búsqueda/voz) → sesión dedicada aparte (BACKLOG).
- Producción (hosting/Neon/SEO/términos) → fuera de la cola por decisión de Fer.
