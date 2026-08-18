# Spec: Titularidad — cómo sé que el dueño de X es realmente el dueño de X

**Estado:** 🟡 Parcial — **F1 ✅ 2026-08-17**, QA **APROBADO 2026-08-18** (el recorte + la
declaración; QA en vivo y build verdes — ver `docs/qa/AnalisisQA.md` § *QA /qa-spec — TITULARIDAD
F1*) · F2 y F3 escritas y **gateadas por volumen**
**Prioridad:** Alta — es **puerta de ida en reputación**. Hoy hay 0 reclamos y 0 altas en
producción (9 días), así que el costo de decidirlo ahora es cero y el de decidirlo después es
irreversible: un reclamo falso aprobado desvía llamadas de un negocio real a un competidor.
**Gate:** F1 ninguno · F2 (transferencia y disputa en la app) y F3 (prueba documental) gatean en
**volumen** — ver § *Gates de F2 y F3*
**Bloquea:** nada
**Depende de:** [`AUTH`](../done/AUTH.md) (F2 reclamo/alta/cola · F3 contenido del dueño) ·
[`MONETIZACION`](../done/MONETIZACION.md) (el KYC de Mercado Pago es parte del argumento de la
escalera) · `lib/negocio/contenido.ts` (dueño único del COALESCE dueño→base)

---

## Problema

Aprobar un reclamo entrega el contenido de la ficha de un negocio. **La única verificación que
existe es que Fer lee cada solicitud a mano**: el formulario pide nombre, teléfono y rol
(`applicantName` / `applicantPhone` / `applicantRole` + comentario libre, `lib/claims/validacion.ts`)
y no hay ninguna prueba documental ni ningún canal que confirme el vínculo con el local. El control
real es *«suena razonable»*, y alcanzó porque los reclamos son poquísimos y los mira una persona que
conoce el rubro.

Eso deja tres agujeros concretos:

1. **El activo peligroso está en el peldaño gratis.** Un reclamo aprobado permite editar `phone`,
   `website` y `socials` (`place_owner_content`, AUTH decisión 13). Un reclamo falso **desvía las
   llamadas y el tráfico web de un local real a un competidor**, con el nombre del negocio verdadero
   arriba. Es el único daño de la lista que le pega a un tercero que ni siquiera usa la app.
2. **Nadie declaró nada.** Ni `/reclamar/[placeId]` ni `/registrar-negocio` tienen **una sola línea
   legal** (verificado en `reclamo-form.tsx` y `alta-form.tsx`). Revocar un reclamo hoy se sostiene
   en nada escrito: el solicitante nunca afirmó ser el dueño, solo completó campos.
3. **No hay camino para el dueño nuevo.** Si el local cambia de manos, `crearReclamo` devuelve
   `YA_RECLAMADO` — *«Ese lugar ya tiene un dueño verificado»*— **y ahí termina**. El dueño legítimo
   que compró el negocio no tiene ninguna puerta, ni siquiera una que diga a dónde escribir.

### Lo que YA protege, para que no se re-litigue

- **Un alta de dueño nace invisible** (`lib/claims/acciones.ts:85-109`: `source='owner'`,
  `confidence` null, `publishOverride` false). El que da de alta un lugar falso **no publica nada**
  hasta que el admin apruebe; el costo de un alta basura es una fila en la cola, no una ficha falsa
  en la calle.
- **Revocar oculta, no borra** (AUTH F3): el contenido del dueño se aplica solo mientras el lugar
  tenga reclamo aprobado.
- **Un solo aprobado por lugar**: índice único parcial `place_claims_aprobado_idx`.
- **NO existe** ningún mecanismo de *«si muchos usuarios reportan que no existe, se da de baja»* —
  no hay tabla de reportes ni endpoint. Es folclore; no volver a citarlo.

---

## Objetivo

Que **la exigencia escale con lo que se desbloquea**: que cargar fotos siga costando lo que cuesta
hoy (nada) y que tocar el contacto de un negocio ajeno cueste más. Y que quede escrito —antes de que
haya volumen— **qué prueba se pide, quién gana una disputa, cómo se transfiere un local y dónde vive
la evidencia**, porque las cuatro son puerta de ida y ninguna se pudre esperando.

De código entra **solo el recorte + la declaración** (F1). Lo demás se decide entero y se implementa
cuando el volumen lo pida.

---

## Qué NO es esta feature

- **No pide prueba documental todavía.** La verificación sigue siendo Fer leyendo cada reclamo
  (decisión 3). F3 está escrita, no implementada.
- **No verifica por canal** (código al teléfono, mail del dominio, código en el Instagram). **Está
  medido y descartado el 2026-08-17 contra producción** — ver § *Lo medido*. No re-medirlo.
- **No cambia la regla de visibilidad del catálogo** (`lib/db/visibility.ts`). Aprobar mueve una
  entrada de la regla, no la regla (AUTH decisión 3).
- **No toca las fotos, las tags ni los horarios**: siguen en el peldaño gratis, sin un paso más.
- **No es moderación de contenido.** Que un dueño aprobado escriba una descripción mala es otro
  problema; acá el problema es que sea el dueño.
- **No construye un sistema de roles ni de reputación.** La propiedad sigue derivándose de un claim
  aprobado (AUTH decisión 8).

---

## Lo medido — los números que cierran dos caminos

📊 Contra **producción (Neon)**, read-only, el **2026-08-17**. Están acá porque **tumbaron dos
caminos antes de escribirlos** y para que ninguna sesión los re-mida:

| Qué se midió | Resultado | Qué cierra |
|---|---|---|
| Teléfonos del catálogo que son **móviles** | **1.324 de 15.730 (8,4%)** — 11.865 son fijos de AMBA | El código por WhatsApp/SMS parecía cubrir 82,8%; mirando el **formato**, no |
| Móviles **en los 200 lugares más vistos** | **13 (6,5%)** | El canal cubre 6,5% de lo que importa. **Objeción de Fer, confirmada con números** |
| Redes | 18.035 filas: **17.744 Facebook**, **725 Instagram** | *«Publicá un código en tu IG»* no existe como canal |
| Dominio propio | **40,7%** (de 9.322 «webs», 1.597 son linktr / IG / wa.me disfrazadas) | El mail `@dominio-del-negocio` tampoco escala |
| `locality` distintas vs top 200 | 390 localidades, pero **164 de los 200 más vistos son CABA** | **Hay que resolver CABA, no 390 municipios** |
| Dirección presente en publicados | **97,8%** | El cruce «domicilio del documento ↔ `places.address`» es viable, y es la única verificación gratis que podemos hacer |
| Abuso real hoy | **0 reclamos, 0 altas** (9 días, 3 usuarios) | Ventana libre para decidir: nada que migrar |

**Un dato viejo falla cerrado, no abierto**: si el teléfono del catálogo murió, el dueño legítimo no
puede probar (fricción) pero el impostor tampoco pasa. El riesgo de los datos viejos es de
**cobertura**, no de seguridad — por eso la respuesta no podía ser «una puerta mejor», tenía que ser
«menos cosas detrás de la puerta».

---

## El marco regulatorio — confirmado contra fuente, 2026-08-17

⚠️ Verificado con búsqueda web en la sesión de autoría. El relevamiento previo se hizo de memoria y
**tenía un error** (abajo, en negrita).

- **ARCA** (ex-AFIP, renombrada en 2024) **no autoriza a abrir un local**: es el fisco. Quien
  autoriza es la **habilitación comercial**.
- **CABA**: el trámite es **100% digital por TAD** (Ley 6101), ante la **AGC**. Hay dos modalidades
  y **lo que el dueño tiene en la mano varía**: en **Express** (bajo riesgo, hasta 500 m² desde
  2025) se emite una **Declaración Responsable Automática**, no un certificado clásico. En
  **Estándar** interviene un matriculado. ⇒ si algún día se pide el documento, pedirlo como
  *«certificado de habilitación **o** la declaración responsable / constancia del trámite en TAD»*.
  Pedir «el certificado» a secas deja afuera al rubro más común.
- **PBA**: la habilitación la da **cada municipio**, con su propio certificado. No hay un trámite
  único que sirva para los 40 partidos de AMBA.
- ⚠️ **Lo que NO prueba titularidad, aunque suene oficial:**
  - **Constancia de inscripción de ARCA**: es **pública** — se baja gratis con solo el CUIT, sin
    clave fiscal.
  - **Formulario 960 «Data Fiscal»**: está **exhibido a la vista del público en el local por
    obligación**, fotografiable por cualquier cliente.
  - **⚠️ Constancia de Ingresos Brutos de AGIP (CABA): también es pública** — se baja en
    `lb.agip.gob.ar/ConstanciaIB/` con **solo el CUIT** y muestra los domicilios.
    **Esto corrige el relevamiento anterior**, que la listaba como candidata. Y no es un detalle
    menor: **164 de los 200 más vistos son CABA**, así que se cae justo la mitad que importa.
    **ARBA (PBA) sí califica**: pide **CIT** (clave).
- **No podemos verificar la autenticidad de ningún PDF** — no hay API de ARCA ni de AGC. El valor de
  pedir un documento oficial **no es que sea infalsificable: es que mueve el acto de «mentir en un
  formulario» a «falsificar un instrumento público»**, que sí es un delito con nombre propio.
  Disuade sin que nosotros verifiquemos nada.
- **Ley 25.326 de Protección de Datos Personales: vigente.** Hay proyectos de reemplazo alineados a
  GDPR (anteproyecto de la AAIP; proyecto 1751-D-2026), **ninguno sancionado**. Que la reforma vaya
  hacia GDPR refuerza la decisión 8: no acumular documentos hoy es también no tener que migrar
  mañana.

---

## Decisiones cerradas

Las 1-3 las tomó Fer el **2026-08-17** en la sesión de decisión de cola; las 4-12 son diseño de este
spec, cerradas en la sesión de autoría del mismo día.

| # | Decisión |
|---|----------|
| 1 | **La exigencia escala con lo que se desbloquea, y el peldaño sin verificar se recorta.** Sin verificación quedan **fotos, tags y horarios**. **`phone`, `website` y `socials` salen del peldaño gratis**: son el activo peligroso —un reclamo falso desvía llamadas y tráfico web a un competidor— y sacarlos **no le agrega un solo paso al dueño legítimo que solo quiere cargar fotos**, que es el caso normal |
| 2 | **Alcance: decidir entero, implementar solo el recorte.** Las cuatro decisiones (prueba, escalera, conflictos, transferencia) se escriben porque son puerta de ida y **no se pudren**; de código entra únicamente F1, que no depende de volumen |
| 3 | **La prueba documental NO se pide todavía.** La verificación queda como está (Fer lee cada reclamo) y en su lugar van **declaración afirmativa + copy disuasorio** en `/reclamar/[placeId]` y `/registrar-negocio` — hoy ninguna de las dos tiene una sola línea legal |
| 4 | **La declaración va ANTES que la advertencia, y la advertencia es de consecuencia real, no penal.** Cicatriz de [`DEPLOY`](../active/DEPLOY.md) decisión 21 (el aviso de beta): *«no nos cubre legalmente de nada; escrito así es peor que no ponerlo»*. **Reclamar falsamente en una app no es un delito tipificado por sí solo** —lo son la falsificación de instrumento público o el fraude, según el caso—, así que un cartel que dice «esto es un delito» afirma algo inexacto y el que sabe lo detecta. Lo que sostiene revocar y dar de baja es que **la persona afirmó algo concreto**: el checkbox. La advertencia va después, enumerando lo que de verdad pasa (se revoca · se pierde la cuenta · queda registrado) |
| 5 | **La declaración es un boundary del server, no un cartel.** `declaracion: z.literal(true)` en el schema compartido de `lib/claims/validacion.ts` ⇒ un POST sin ella es 400. Un checkbox que solo vive en el cliente no es una declaración, es una decoración |
| 6 | **Queda registrado QUÉ se declaró, no solo QUE se declaró**: `place_claims.declaracion_version` (text nullable). El texto va a cambiar; sin versión, dentro de un año no se puede decir a qué se comprometió alguien que reclamó hoy. La versión la fija una constante en el módulo del copy (`DECLARACION_VERSION`), y **es el único lugar donde se toca**. Nullable porque los claims viejos no la tienen — y hoy son 0 en producción, así que el backfill es literalmente nada |
| 7 | **El recorte aplica solo a lugares `source='overture'`.** En un alta (`source='owner'`) el lugar **nació del dueño**, el contacto nunca fue de nadie más y el admin ya lo leyó al aprobar. El activo peligroso es **pisar el contacto de un negocio ajeno preexistente**, no cargar el propio. Si el recorte aplicara al alta, un typo en el propio teléfono quedaría congelado para siempre sin camino de arreglo |
| 8 | **La evidencia no se guarda: se mira y se registra el veredicto.** Si algún día se pide un documento, el dueño lo **muestra** por un canal que no persiste (videollamada / WhatsApp) y el admin escribe en `admin_notes` **el veredicto y el tipo de documento** —*«verificado con habilitación AGC a nombre de la razón social del local, 2026-09-01»*—, **sin CUIT, sin nº de DNI, sin archivo adjunto**. Cero pasivo nuevo bajo Ley 25.326 y minimización de datos por construcción. Plan B **solo si el volumen lo obliga**: bucket privado en R2, separado del de fotos públicas, con borrado tras la decisión. **Nunca en la base**: ahí el dato queda en todos los `pg_dump` y no tiene borrado. **No acumular es reversible; acumular no** |
| 9 | **Una disputa no la gana el primero.** Con 2+ pendientes sobre el mismo lugar, el admin **no aprueba por orden de llegada**: contacta a ambos por el teléfono declarado y decide **con el motivo escrito en `admin_notes`**. FIFO premiaría exactamente al impostor rápido —el dueño real suele llegar tarde porque no sabe que la app existe—. Y una disputa **no traba el lugar para siempre**: siempre hay salida manual del admin |
| 10 | **La disputa es el primer disparador de la prueba documental** (F3), y se le pide **al que está en disputa, no a todos**. Es la decisión 1 aplicada al otro eje: la exigencia sube cuando sube el riesgo, y una disputa es la señal más barata y más honesta de riesgo que tenemos |
| 11 | **Transferencia: un reclamo sobre un lugar ya reclamado NO se rechaza.** Entra como **transferencia**, se le avisa por mail al dueño actual y tiene una **ventana para responder**; si no responde, el admin transfiere. El silencio no es consentimiento, pero sí es señal —y hoy la alternativa es que el dueño nuevo no tenga **ningún** camino. Implementación en F2; hasta entonces el mensaje de `YA_RECLAMADO` ofrece el canal manual |
| 12 | **La prueba la dispara lo que se desbloquea, NO el plan pago.** Peldaño verificado = un documento que ligue persona/razón social al **domicilio del local**, cruzado contra `places.address` (viable al **97,8%**). Atarla al plan sería **cobrar por verificar identidad a quien ya la probó con la tarjeta**: el que contrata el B2B pasó el **KYC de Mercado Pago**, que es un tercero verificando identidad mucho mejor que nosotros. Y dejaría sin prueba justo al free que quiere tocar el contacto, que es el activo peligroso |

### El menú de documentos (F3, para cuando se pida)

| Documento | ¿Califica? | Por qué |
|---|---|---|
| Habilitación comercial **CABA** (TAD/AGC) — certificado **o** Declaración Responsable | ✅ | Liga razón social ↔ domicilio. Pedir las dos formas: en Express no hay certificado clásico |
| Habilitación comercial **PBA** (municipal) | ✅ | Ídem, con formato distinto por partido |
| **Ingresos Brutos ARBA** (PBA) | ✅ | Requiere **CIT** ⇒ no lo baja cualquiera |
| **Domicilios de local** del Sistema Registral de ARCA | ✅ | Requiere **clave fiscal** y liga el CUIT a **ese** local |
| Contrato de locación · factura de servicios del local | ✅ | Ligan persona ↔ domicilio, aunque no sean oficiales |
| **Constancia de inscripción de ARCA** | ❌ | **Pública**: se baja con solo el CUIT |
| **Constancia de IIBB de AGIP** (CABA) | ❌ | **Pública**: se baja con solo el CUIT, y muestra los domicilios |
| **Formulario 960 «Data Fiscal»** | ❌ | **Exhibido a la vista en el local** por obligación: lo fotografía cualquier cliente |

---

## Fases

| Fase | Alcance | Gate | Verificable con |
|------|---------|------|-----------------|
| **F1 — El recorte + la declaración** | Contacto fuera del peldaño gratis (server + editor) · checkbox de declaración con versión en los dos formularios · copy | **Ninguno** — entra ahora | Un dueño de un lugar de Overture ve los tres campos apagados y un `PATCH` con teléfono es 403; un POST sin declaración es 400 |
| **F2 — Transferencia y disputa en la app** | Reclamo sobre lugar reclamado entra como transferencia · mail + ventana al dueño actual · la cola de `/admin` muestra la disputa | **≥ 5 reclamos** o el primer caso real de transferencia | Un segundo dueño reclama, el primero recibe el mail y el admin ve ambos lados |
| **F3 — La escalera documental** | Se pide documento para desbloquear contacto y para resolver disputas · veredicto en `admin_notes` (decisión 8) | **≥ 20 reclamos/mes** o la primera disputa real | Un reclamo con contacto pedido queda en «falta verificación» hasta que el admin registre el veredicto |

### Gates de F2 y F3

Los dos gates son de **volumen**, y el número importa menos que el principio: **hoy hay 0 reclamos**,
así que cualquier mecanismo que se construya ahora se diseña contra casos imaginados. F2 y F3 se
escriben ahora (son puerta de ida) y se implementan cuando exista **un caso real que las valide**.
Mismo criterio que la F2 de [`ABIERTO_AHORA`](../active/ABIERTO_AHORA.md), gateada en 50 lugares con
horarios propios.

---

## F1 — el tramo que se implementa

### El recorte

**Qué sale del peldaño gratis:** `phone`, `website` y `socials` de `place_owner_content`, **solo en
lugares con `places.source = 'overture'`** (decisión 7).

**Dónde vive la regla.** En `lib/negocio/contenido.ts`, que **ya es el dueño único** de «qué del
dueño se aplica y qué no» (CLAUDE.md § *Una regla, un dueño*). Se extiende ahí, con la misma forma
que el gate de plan que ya vive en ese módulo — **no se escribe una segunda versión** en la query ni
en el endpoint:

```ts
/** Los tres campos que el peldaño verificado va a habilitar (TITULARIDAD decisión 1). */
export const CAMPOS_DE_CONTACTO = ['phone', 'website', 'socials'] as const

/**
 * ¿Este lugar deja editar el contacto sin verificación? Solo los que nacieron del
 * dueño (decisión 7): en un lugar de Overture, pisar el contacto desvía las
 * llamadas de un negocio real.
 */
export function puedeEditarContacto(source: PlaceSource): boolean {
  return source === 'owner'
}
```

**Tres puntos de aplicación, y el server manda:**

1. **`lib/negocio/acciones.ts` (`guardarContenido`)** — el boundary de verdad. Con
   `puedeEditarContacto` en falso, un campo de contacto **con contenido** es
   `fallo('CONTACTO_VERIFICADO', …)`; **vacío se ignora**, exactamente como ya hace el gate de plan
   —no es un intento de editar, es el form mandando su estado—. Y en ese caso los valores que se
   escriben en `place_owner_content` son los **que ya estaban**, no los del payload: el recorte no
   puede borrar lo que un dueño cargó antes de que existiera.
2. **`app/mi-negocio/[placeId]/editor-client.tsx`** — los tres inputs quedan **visibles y
   `disabled`** (decisión de UI, abajo), mostrando el dato que hoy se muestra.
3. **La ficha no cambia.** `resolverContenidoDueno` sigue haciendo su COALESCE: si un dueño cargó su
   teléfono antes de este recorte, se sigue mostrando. **El recorte es sobre escribir, no sobre
   mostrar** — apagar lo ya cargado sería quitarle un dato correcto a un dueño legítimo por una
   regla que no existía cuando lo cargó.

**Por qué apagados y no ocultos:** ocultarlos manda al dueño a buscar dónde estaba el campo y
termina en soporte igual, pero sin haber entendido nada. Verlos apagados, con el dato actual y una
línea que explica **por qué** y **a dónde escribir**, comunica el porqué y es el gancho natural de
F3. El `disabled` es UI: el server los rechaza igual (el cliente no es boundary).

### La declaración

**Un solo lugar la define** — el copy y su versión viven juntos, y `CamposSolicitante`
(`components/negocio/campos.tsx`) ya es el componente compartido por los dos formularios, así que el
checkbox entra **una vez** y aparece en los dos.

**El copy** (argentino rioplatense, decisión 4 — la declaración primero, la consecuencia después):

> ☐ **Declaro que soy el dueño de este negocio o que estoy autorizado a gestionarlo.**
>
> Revisamos cada solicitud a mano. Si resulta que no era así, damos de baja el reclamo y la
> cuenta, y queda registrado quién lo pidió y cuándo.

Nada de «esto constituye un delito»: es inexacto y el que sabe lo detecta (decisión 4).

**Schema** — en el `solicitante` compartido de `lib/claims/validacion.ts`, que ya alimenta a
`reclamoSchema` y `altaSchema`:

```ts
const solicitante = z.object({
  // …lo de AUTH…
  /** Decisión 5: sin esto no hay reclamo. Un checkbox solo-cliente no es una declaración. */
  declaracion: z.literal(true),
})
```

**Persistencia** — `crearReclamo` y `crearAlta` escriben `declaracionVersion: DECLARACION_VERSION`
en la fila del claim (decisión 6).

### Migración

Una columna, aditiva y nullable — **no hay backfill porque no hay filas** (0 claims en producción):

```sql
ALTER TABLE place_claims ADD COLUMN declaracion_version text;
```

### Lo que la cola de `/admin` gana

La ficha del claim en `/admin` muestra **si el solicitante declaró y qué versión** — es el dato que
sostiene la revocación, y sin verlo el admin no sabe con qué texto se comprometió esa persona.

---

## Criterios de done (DoD)

**F1 — el único tramo que se implementa ahora:**

- [ ] `lib/negocio/contenido.ts` exporta `CAMPOS_DE_CONTACTO` y `puedeEditarContacto`, con tests
      unitarios. `grep -rn "source === 'owner'" lib/ app/` no muestra ninguna reimplementación de la
      regla fuera de ese módulo
- [ ] `guardarContenido` rechaza con `CONTACTO_VERIFICADO` un `PATCH` con `phone`, `website` o
      `socials` **no vacíos** sobre un lugar `source='overture'`; el mismo `PATCH` sobre un lugar
      `source='owner'` **guarda** (decisión 7)
- [ ] Un `PATCH` con los tres campos **vacíos** sobre un lugar de Overture **no falla** y **no borra**
      el contacto que el dueño hubiera cargado antes del recorte
- [ ] La ficha sigue mostrando el contacto del dueño ya cargado (el recorte es sobre escribir, no
      sobre mostrar): `resolverContenidoDueno` sin cambios de comportamiento y sus tests verdes
- [ ] El editor de `/mi-negocio/[placeId]` muestra los tres campos **disabled** con el dato actual y
      una línea que explica por qué y a dónde escribir, **solo** en lugares de Overture
- [ ] `POST /api/claims` devuelve **400** si falta `declaracion` — probado en los dos `kind`
      (`claim` y `new`)
- [ ] El checkbox aparece en `/reclamar/[placeId]` **y** en `/registrar-negocio`, definido **una sola
      vez** en `components/negocio/campos.tsx`
- [ ] El copy dice la declaración **antes** que la consecuencia y **no afirma que sea un delito**
      (decisión 4)
- [ ] `place_claims.declaracion_version` se persiste en reclamo y en alta, con el valor de
      `DECLARACION_VERSION`; migración aditiva aplicada con `npm run db:migrate`
- [ ] La cola de `/admin` muestra la declaración y su versión en la ficha del claim
- [ ] `npm run typecheck` + tests verdes · `/qa-spec` APROBADO

**F2 y F3** — no se implementan en esta pasada (decisión 2). Su DoD se escribe al desgatearlas.

---

## QA manual (IDs propuestos)

| ID | Caso | Criterio |
|----|------|----------|
| TIT-01 | Dueño aprobado de un lugar `source='overture'` abre `/mi-negocio/[placeId]` | Teléfono, sitio web y redes se ven **apagados**, con el dato actual y la explicación. Fotos, tags y horarios siguen editables |
| TIT-02 | Ese mismo dueño manda un `PATCH` a mano con `phone` cargado | **403** `CONTACTO_VERIFICADO`. El dato en la base no cambió |
| TIT-03 | `PATCH` con `phone`/`website`/`socials` **vacíos** sobre ese lugar (el form mandando su estado) | **200**, y el contacto que estaba cargado **sigue igual** — no se borró |
| TIT-04 | Dueño aprobado de un lugar `source='owner'` (alta propia) edita su teléfono | **Guarda** (decisión 7) y la ficha lo muestra |
| TIT-05 | Ficha de un lugar de Overture cuyo dueño había cargado teléfono antes del recorte | Se **sigue mostrando** el teléfono del dueño: el recorte es sobre escribir |
| TIT-06 | `/reclamar/[placeId]` sin tildar la declaración | El submit no pasa; el mensaje señala el checkbox |
| TIT-07 | `POST /api/claims` armado a mano sin `declaracion`, en `kind:'claim'` y en `kind:'new'` | **400** en los dos |
| TIT-08 | Reclamo completo tildando la declaración | Se crea el claim con `declaracion_version` = `DECLARACION_VERSION` |
| TIT-09 | Alta de un lugar nuevo tildando la declaración | Ídem, y el lugar nace **invisible** como siempre (`AUTH` F2, sin regresión) |
| TIT-10 | Cola de `/admin` sobre ese claim | Muestra que declaró y con qué versión |
| TIT-11 | Lectura del copy de los dos formularios | La declaración va **antes** que la advertencia y **no** dice que sea un delito (decisión 4) |
| TIT-12 | Revocar el reclamo de un lugar de Overture con contacto de dueño cargado | La ficha vuelve al contacto de Overture (`AUTH` F3, sin regresión) |

---

## Relación con otros specs

- **[`AUTH`](../done/AUTH.md)** — este spec lo **extiende, no lo reemplaza**. Su decisión 5 («free
  del dueño generoso a propósito») queda **enmendada**: el contacto sale de ese peldaño. Todo lo
  demás de F2/F3 (reclamo, alta invisible, cola, COALESCE, revocación) sigue vigente tal cual.
- **[`MONETIZACION`](../done/MONETIZACION.md)** — la decisión 12 se apoya en su KYC de Mercado Pago:
  el que contrata el B2B ya probó identidad ante un tercero, y por eso el plan **no** dispara la
  prueba documental.
- **[`CORRECCION_DATOS`](../done/CORRECCION_DATOS.md)** — es el eje gemelo por el otro lado: allá el
  que corrige `name`/`address`/`lat`/`lng` es el **admin** y la marca es por campo
  (`places.locked_fields`); acá el que edita es el **dueño** y nunca toca las columnas base. Los dos
  responden a lo mismo: **quién tiene derecho a cambiar qué**.
- **[`DEPLOY`](../active/DEPLOY.md)** decisión 21 — de ahí sale la cicatriz del copy legal
  (decisión 4). No repetir el error del aviso de beta.
