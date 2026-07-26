# Costos de IA y precio del plan premium — análisis FX

**Estado:** Referencia viva · última medición **2026-07-26** · re-medir cuando cambie el
modelo del chat, el cupo, o el dólar cruce el disparador de abajo.

> Documento de análisis, no un spec. Vive aparte para no inflar los specs de CHAT_IA /
> MONETIZACION. El **porqué** de que el chat use Sonnet 5 está en `docs/specs/active/CHAT_IA.md`
> (decisión 3) y en `docs/product/BACKLOG.md` § SESIÓN DEDICADA — Chat IA.

## Fuente de verdad del dólar

**`dolarito.ar` — dólar OFICIAL.** Es la referencia que usa Fer para consultar el precio del
día. Cualquier cálculo o automatización de precio (ver idea del banner en BACKLOG) parte de ese
valor, no del blue ni del MEP.

Al 2026-07-26: **1 USD = ARS 1.520** (oficial). Tendencia estructural del peso: siempre se
devalúa contra el dólar (verificado: ARS 1.031 ene-2025 → 1.451 dic-2025 → 1.520 jul-2026;
devaluación Milei dic-2023 +118%). **El costo de la API está en USD y es fijo; el ingreso en
ARS se licúa con el tiempo.** Ese es el problema que este doc resuelve.

## Costo real por mensaje (medido, no estimado)

Fuente: columnas `tokens_in`/`tokens_out` de `chat_messages` (decisión 24) × precios de
`lib/ai/logging.ts`. Precios por millón de tokens: **Sonnet 5 $3 in / $15 out**, **Haiku 4.5
$1 in / $5 out**. `tokens_in` es input fresco (el system prompt cacheado se lee aparte a 0,1×).

| Modelo | Costo real/mensaje | Para planear (con margen) |
|--------|-------------------|---------------------------|
| **Sonnet 5** (default vigente) | ~$0,016–0,018 | **$0,02** |
| Haiku 4.5 (fallback / válvula) | ~$0,005 | $0,005 |

Sonnet ≈ **3,6× Haiku** por mensaje (más tokens de salida + tarifa más alta).

## El piso: cubrir los 30 mensajes de un premium

Regla de negocio: free = 3 mensajes **de por vida** (no recurrente); premium = **30/mes**.
El costo relevante es el cupo premium a full usage (peor caso).

- 30 mensajes Sonnet = 30 × $0,02 = **$0,60 USD/mes**.
- A 1.520: **ARS 912** para cubrir el cupo completo de un premium.
- Precio premium actual: **ARS 7.000/mes = $4,61 USD** (de `/cuenta`).
- **Cobertura hoy: 7,7×.** La IA es el **13%** del ticket a full usage, ~4% en uso realista
  (los premium rara vez queman los 30).

**Conclusión: hoy el ideal de Fer ("que el plan cubra los 30 mensajes") está cumplido con
muchísimo aire.** El costo de IA NO es el driver del precio — es el 4-13% del ticket.

## Qué pasa si el precio ARS queda clavado y el dólar sube

El costo USD no se mueve; el ingreso en dólares se achica:

| Dólar (ARS/USD) | ARS 7.000 valen | Cubrir 30 msg | IA = % del ticket | Cobertura |
|-----------------|-----------------|---------------|-------------------|-----------|
| 1.520 (hoy)     | $4,61           | ARS 912       | 13%               | 7,7×      |
| 2.000           | $3,50           | ARS 1.200     | 17%               | 5,8×      |
| 3.000           | $2,33           | ARS 1.800     | 26%               | 3,9×      |
| 5.000           | $1,40           | ARS 3.000     | 43%               | 2,3×      |
| **11.667**      | $0,60           | ARS 7.000     | **100%**          | 1,0× (break-even) |

ARS 7.000 deja de cubrir los 30 mensajes recién a un dólar de **~11.667** (7,7× el de hoy).
Pero mucho antes — dólar 3.000-5.000, plausible en 1-2 años — la IA se come 26-43% del ticket,
y ahí **también** pesan MercadoPago (~6% + IVA), Google Places de las fichas y el hosting (todo
o parte en USD). Cubrir la IA es el **piso del piso**; el precio de verdad tiene que cubrir todo
eso + margen.

## Recomendación: preciar en USD, cobrar en ARS

Playbook estándar de SaaS en Argentina. Resuelve el miedo de fondo ("que no quede por debajo"):

1. **Anclá el precio en USD**, no en ARS. Ej: *premium = $5 USD/mes* (≈ ARS 7.600 hoy; el
   ARS 7.000 actual ya es ~$4,6, casi eso).
2. **Cobrás el equivalente en ARS al dólar de `dolarito.ar`**, y actualizás el número de pesos
   cuando el dólar se mueva > ~10-15% (o trimestral, lo que pase primero).
3. Así la cobertura queda **constante para siempre** (IA ~13% pase lo que pase con el dólar),
   porque precio y costo se mueven juntos. Nunca quedás por debajo.

### Regla de piso operable

> **precio_ARS ≥ 5 × (30 × $0,02 × dólar_oficial)  =  dólar_oficial × 3**

El `× 5` mantiene la IA en ≤ 20% del ticket (proxy de margen; es un piso, no el precio objetivo,
que se fija por valor de mercado). Simplificando, **piso ≈ dólar × 3**:

| Dólar oficial | Piso sugerido (× 3) | ¿ARS 7.000 alcanza? |
|---------------|---------------------|---------------------|
| 1.520 (hoy)   | ARS 4.560           | sí, cómodo          |
| 2.333         | ARS 7.000           | **justo — disparador para revisar** |
| 3.000         | ARS 9.000           | ❌ subir precio     |

**Disparador de revisión: dólar ~2.333** (a este ritmo, quizá ~1 año). No es que ahí perdés
plata — es la señal temprana de que el margen se empieza a comer, mucho antes del break-even.

## Válvula de escape

Si el dólar se dispara de golpe y no querés/no llegás a subir el precio: **swap del chat a
Haiku 4.5** (÷ ~3,6 el costo) es un `UPDATE` a `app_settings.ai.chat_model`, sin deploy. Con
Haiku el piso de 30 msgs a 1.520 baja de ARS 912 a ~ARS 250. Trade-off: Haiku narra el retry y
desliza la voz (por eso el default es Sonnet — ver CHAT_IA decisión 3). Es paracaídas, no destino.

## Pendiente relacionado

Idea de automatizar esta revisión en `/admin` (banner que consulta `dolarito.ar` y sugiere el
precio según la regla de piso): ver `docs/product/BACKLOG.md` § Mejoras futuras.
