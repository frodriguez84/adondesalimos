# Spec: INVITACION — la pantalla por donde entran los usuarios nuevos

**Estado:** ✅ Implementado (2026-08-14) — los 8 hallazgos abiertos de R2 + `PBETA-R4-02`
**Prioridad:** Alta — es el bloque **R2** de `PULIDO_BETA`, el recorrido *«me invitaron a votar»*.
No es el más roto: es el más **visto por gente que todavía no es usuaria**. Los 10 BLOQUEANTE ya se
arreglaron en F3; lo que queda son 8 hallazgos MOLESTO/COSMÉTICO que, juntos, son la diferencia
entre un link que se abre y uno que se ignora.
**Gate:** ninguno.
**Bloquea:** nada.
**Depende de:** VOTACION (decisiones 1, 8, 11, 13 y 15 — voto anónimo por cookie, voto cambiable,
expiración lazy a las 72 h, resultados en vivo, cerrada ⇒ solo-lectura), SUGERIR_EN_VOTACION (el
sheet de sumar y los dos techos de opciones), PULIDO_BETA (F1 — la auditoría que encontró los 8,
con su evidencia medida), FICHA (el `openGraph` de `/lugar/[id]`, que es el patrón que se reusa).

**Enmienda parcialmente la decisión 13 de [`VOTACION`](VOTACION.md)** (resultados en vivo
para todos) — ver decisión 6.

---

## Problema

`PULIDO_BETA` F1 auditó los 6 recorridos en vivo a 390×844. R2 —*abro un link de votación sin
cuenta y sin saber qué es la app*— fue el que más hallazgos dejó: **13**. Tres eran BLOQUEANTE y se
arreglaron en F3 (el 404 pelado, «nadie te dice quién te invitó», el callejón sin salida de la
votación cerrada); uno más lo cerró `FB-09` (el sheet sin forma de cerrarse). **Quedan 8**, todos
triados por Fer, y ninguno rompe nada: la pantalla funciona.

Lo que pasa es otra cosa, y por eso el bloque va junto y no de a uno: **R2 es la única pantalla de
la app que ve un desconocido antes de decidir si la app le interesa**. El resto del producto se le
muestra a alguien que ya entró. Acá el usuario llega desde un WhatsApp ajeno, con el pulgar
apurado, y la app se juega la primera impresión en dos momentos:

1. **Antes de abrir el link** — la tarjeta de preview que dibuja WhatsApp. Hoy no tiene imagen
   (`PBETA-R2-02`), o sea que se ve como un link pelado, que es exactamente la forma que tiene el
   spam en un grupo.
2. **Los primeros 5 segundos adentro** — donde el tercio superior de la pantalla lo ocupa un H1 de
   3 o 4 líneas que repite los nombres que ya están en las cards de abajo (`PBETA-R2-04`), la
   acción principal es un botón de 34 px de alto (`PBETA-R2-05`), y no se dice hasta cuándo se
   puede votar aunque **las votaciones venzan solas a las 72 h** (`PBETA-R2-06`).

Los 8, agrupados por lo que en realidad son:

| Grupo | IDs | Qué es |
|---|---|---|
| **A — el link se ve pelado** | `R2-02` · `R2-04` (+ `R4-02`) | La primera impresión, afuera y adentro de la app |
| **B — toques y layout** | `R2-05` · `R2-11` · `R2-10` | Se usa parado en la calle y con una mano |
| **C — lo que la pantalla no dice** | `R2-06` · `R2-07` · `R2-13` | Información que existe en la base y no llega al usuario |
| **D — decisión de producto** | `R2-12` | Los resultados se ven antes de votar |

La evidencia medida de cada uno está en `docs/qa/AnalisisQA.md` § *PULIDO_BETA F1 — R2* y no se
repite acá: **este spec decide qué se hace, no re-descubre el problema**.

### Dos que no son lo que parecen

- **`PBETA-R2-13` (el H1 no se actualiza cuando alguien suma un lugar) no se arregla: se
  disuelve.** Solo existe porque el H1 sin título propio *es* la lista de nombres. Arreglado
  `R2-04`, el H1 pasa a ser un texto fijo y no tiene con qué desactualizarse. Se tilda igual, con
  esa explicación — no se le escribe código propio.
- **`PBETA-R4-02` es de otro recorrido y entra igual.** Vive en `/votacion/nueva` (el lado
  emisor), pero su síntoma se paga acá: sin título del creador, el invitado ve el H1 feo. Se trae
  porque arreglar solo el fallback deja intacta la causa. **No al revés**: el fallback se arregla
  igual, porque las votaciones ya creadas sin título existen y ningún nudge las alcanza.

## Objetivo

Que el link que llega por WhatsApp **se vea como una app y no como spam**, y que el que lo abre
sepa en la primera pantalla cuánto tiempo tiene, que el voto es reversible, y cuál es su opinión
antes de enterarse de la del resto.

## Qué NO es esta feature

- **No es un rediseño de la pantalla de votación.** El layout, el orden de los bloques y el
  vocabulario visual quedan como están. Lo que se toca son tamaños, agrupación y copy.
- **No es una `og:image` por votación.** Se evaluó (una imagen generada con el título y la cantidad
  de lugares, por request del crawler) y se descartó para este bloque: es la pieza con más chance
  de romperse recién en producción, donde no se puede verificar antes del deploy. → `BACKLOG`.
- **No toca `PlaceCard`** (decisión 8). Es un componente compartido por 5 pantallas y `R2-11` es un
  problema de agrupación local de la votación.
- **No toca el anti-fraude ni la identidad del votante** (decisión 7 de `VOTACION`): la cookie
  sigue siendo evadible y sigue estando bien que lo sea.
- **No son los otros hallazgos de R4** (`R4-03`, `R4-04`, `R4-05`, `R4-06`). De ese recorrido entra
  **solo** `R4-02`, y entra por su efecto en R2.
- **No es una auditoría de accesibilidad.** Los 44 px de toque salen de un hallazgo medido, no de
  un checklist de a11y — eso sigue siendo un spec propio (`PULIDO_BETA` § *Fuera de alcance*).

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Va mini-spec y no fix directo**, aunque 6 de los 8 sean mecánicos. El bloque contiene una **enmienda a un spec cerrado** (decisión 13 de `VOTACION`) y dos decisiones de producto que Fer tomó explícitamente (decisiones 6 y 9): eso necesita quedar escrito donde se lo va a buscar, no en un mensaje de commit. Los hallazgos mecánicos viajan de arriba porque comparten archivo y verificación — medirlos dos veces en vivo sería el costo de separarlos |
| 2 | **La `og:image` es UNA, de marca, 1200×630, generada con `ImageResponse` de `next/og`** y declarada en la raíz (`app/layout.tsx`). Cierra las **dos** mitades de `R2-02` —la votación sin imagen y la home sin ninguna etiqueta `og:`/`twitter:`— con una sola pieza y **cero costo por request**. Se genera con código y no como PNG a mano: el `logo_2.png` original pesa 1,4 MB, y un binario que nadie sabe regenerar envejece peor que 40 líneas de JSX |
| 2 bis | ⚠️ **Vive en una ruta propia (`app/og/route.tsx` + `force-static`) y NO en `app/opengraph-image.tsx`**, que era el plan y es lo idiomático. **Medido el 2026-08-14**: para las imágenes **de archivo** Next arma la URL con la de su deploy —en `dev`, `localhost`— e **ignora `metadataBase`**, incluso si el mismo segmento declara la imagen a mano (probado: en la raíz el archivo le gana a lo declarado). Con eso el preview no se puede verificar desde afuera de la máquina —ni por ngrok ni mandándose el link, que es **cómo se verifica esto**— y en producción colgaría de la URL del deploy en vez del dominio propio. Como ruta común la URL sale de `metadataBase` (`BETTER_AUTH_URL`, la misma de los mails) y es la misma en los dos mundos. `force-static` conserva lo de generarse en build |
| 2 ter | **Una página que declara `openGraph` pisa el del padre ENTERO, imagen incluida.** También medido: con la imagen en la raíz, `/votacion/[token]` y `/lugar/[id]` seguían saliendo sin `og:image` porque las dos declaran su propio `openGraph`. Se resuelve heredando del `parent` de `generateMetadata` (`images: (await parent).openGraph?.images`) y **no** escribiendo la ruta a mano en cada una: sigue habiendo un solo archivo que define la imagen. La ficha entra por esto aunque no sea de R2 — el spec prometía que la alcanzaba gratis y no era cierto |
| 3 | **La home declara su `openGraph` explícito** en `app/layout.tsx` (title, description, `siteName`, `locale`, `type`) y **`twitter.card = 'summary_large_image'`**. Sin eso la imagen existe pero el preview la dibuja chica. Es la mitad de `R2-02` que no es la votación |
| 4 | **El fallback del H1 deja de ser la lista de nombres y pasa a `¿A dónde vamos?`** (`R2-04`). Una línea a 360 px, rioplatense, y dice de qué se trata sin repetir lo que ya dicen las cards. **Sigue siendo un solo dueño**: `tituloDe()` alimenta el H1 **y** el `og:title`, y no se parte en dos strings. Consecuencia asumida: el `<title>` del documento queda `¿A dónde vamos? — ¿A dónde salimos?`, dos preguntas seguidas. Se acepta a cambio de no tener dos reglas de título — en mobile esa cadena no la lee nadie, y la que sí se lee (la tarjeta de WhatsApp) queda `¿A dónde vamos?` + *«Votá entre Kalua Pizza Bar, Popolo Pizza, Doc Brown Brewery.»*, que es exactamente lo que hay que decir |
| 5 | **Hasta cuándo se puede votar se dice en relativo, no con fecha** (`R2-06`): «Cierra en 2 días» · «Cierra en 5 horas» · «Cierra en menos de una hora». **Deliberadamente sin huso horario**: una fecha absoluta obligaría a pasar por la hora de AR y sumaría un segundo consumidor a `partesEnAR` (`lib/negocio/horarios.ts`) para una pregunta que no lo necesita — lo que el invitado quiere saber es *si le da el tiempo*, y eso es una resta. El dueño es **`lib/votaciones/estado.ts`**, que ya es el dueño de lo temporal de una votación y es puro y testeable sin base |
| 6 | ⚠️ **Antes de votar no se ve el desglose por opción, pero sí el total** (`R2-12`). **Enmienda PARCIAL a la decisión 13 de `VOTACION`.** El que empuja el re-compartir («vamos 2 a 2, voten») ya votó, así que conserva los resultados en vivo intactos: la decisión 13 sigue rigiendo para todos los que la usan. El único que queda sin desglose es justo el que hay que proteger del arrastre — el que llega último y, viendo que uno ya ganó, vota eso o no vota. **El total sí se muestra siempre** («5 votos en total») porque es la señal de que la votación está viva, y esa señal no ancla ninguna opción. **Cerrada, vencida o cancelada ⇒ se ve todo**, con o sin voto propio (decisión 15 de `VOTACION`, intacta) |
| 7 | **La frase que abarata el click va arriba y antes de votar** (`R2-07`), no en el pie después de votar. Va junto al plazo de la decisión 5, en una sola línea: *«Cierra en 2 días · Podés cambiar tu voto cuando quieras»*. Y **se saca del pie**, donde hoy aparece recién con el voto puesto: repetirla en los dos lados sería decir dos veces lo mismo en una pantalla que ya sobra de texto arriba |
| 8 | **La card de la votación es el `<li>`, no `PlaceCard`** (`R2-11`). El chip de origen, la card, la barra y el botón de votar pasan a vivir dentro de **un solo recuadro** con borde y fondo de card; `PlaceCard` entra adentro **sin borde ni fondo propios** (vía `className`, que ya acepta y mergea). **No se le agrega un slot de pie a `PlaceCard`**: lo comparten 5 pantallas y ninguna otra lo necesitaría — sería una abstracción especulativa para un solo uso |
| 9 | **`PBETA-R4-02` entra como nudge liviano, no como campo obligatorio.** El rótulo pasa de `Título (opcional)` a decir para qué sirve, con una bajada que nombra al destinatario real (*es lo primero que ve el grupo al abrir el link*). **Sigue siendo opcional**: el creador es el lado escaso del loop viral y trabar su pantalla para arreglar la del invitado sería cobrarle al que ya está adentro |
| 10 | **Los toques llegan a 44 px escribiendo las clases a mano, no adoptando el primitivo `Button`** (`R2-05`). El primitivo ya está en 44 desde `PBETA-R1-08` y acá no aplicó por una razón concreta: «Votar» tiene dos estados y el de *no votado* es un botón con borde y fondo transparente, que **`Button` no tiene** (sus variantes son `default`, `secondary`, `ghost`, `destructive`). Agregarle una variante `outline` para un solo uso es exactamente la abstracción especulativa que la convención prohíbe. Se sube el alto y se documenta el porqué en el código |
| 11 | **`R2-13` se cierra por consecuencia, no por código** (ver § *Dos que no son lo que parecen*). Si al verificar el H1 todavía se desactualiza, entonces el arreglo de `R2-04` está incompleto y el bug es ese, no este |

### Copy propuesto (ajustable)

| Dónde | Hoy | Propuesto |
|---|---|---|
| H1 sin título propio | `¿A dónde salimos? Kalua Pizza Bar · Popolo Pizza · Doc Brown Brewery` | `¿A dónde vamos?` |
| Plazo + voto reversible (nuevo, arriba) | — | `Cierra en 2 días · Podés cambiar tu voto cuando quieras` |
| Pie de conteo | `5 votos en total · Podés cambiar tu voto mientras esté abierta` | `5 votos en total` |
| Desglose antes de votar | `3 votos · 75%` + barra | *(nada — la card sola con su botón)* |
| Rótulo del título en `/votacion/nueva` | `Título (opcional)` | `Ponele un título` + bajada `Es lo primero que ve el grupo cuando abre el link. Si lo dejás vacío ponemos uno.` |

## Criterios de done (DoD)

- [ ] **`R2-02`** — el HTML servido de `/votacion/[token]` **y** el de `/` traen `og:image`,
      `og:title`, `og:description` y `twitter:card = summary_large_image`. Verificado sobre el
      **HTML renderizado**, no leyendo el código. La URL de la imagen es **absoluta y del dominio
      real** (no `localhost`), que es lo que la vuelve verificable mandándose el link.
- [ ] **`R2-04`** — el H1 de una votación **sin** título propio mide **una línea a 360 px** y no
      contiene ningún nombre de lugar. Con título propio, no cambia nada.
- [ ] **`R2-05`** — «Votar», «Inicio», el `+` de cada resultado del sheet y el link del pie miden
      **≥ 44 px** de alto, medidos con `getBoundingClientRect()` a 390 y a 360.
- [ ] **`R2-06`** — con la votación abierta se lee cuánto falta para que cierre, y el texto es
      coherente con `expires_at` (verificado contra la fila).
- [ ] **`R2-07`** — «Podés cambiar tu voto» se lee **antes** de votar, sin haber votado.
- [ ] **`R2-10`** — en el sheet, la bajada queda **debajo** del título (mismo `x` de arranque).
- [ ] **`R2-11`** — la barra y el botón de votar de un lugar quedan **dentro** del mismo recuadro
      que su card; el chip de origen también.
- [ ] **`R2-12`** — sin cookie de voto no hay ni conteo ni porcentaje por opción, y **sí** el total.
      Al votar aparecen los dos. Una votación cerrada muestra todo sin haber votado.
- [ ] **`R2-13`** — sumar un lugar no desactualiza el H1 (por construcción: ya no lo compone).
- [ ] **`R4-02`** — el campo de título de `/votacion/nueva` dice para qué sirve y sigue siendo
      opcional (se puede crear sin él).
- [ ] Nada rompe a **360 px** en el recorrido completo (`document.scrollWidth === clientWidth`).
- [ ] `npx tsc --noEmit` · `npm test` verdes · `npm run build` con el dev server **parado**.
- [ ] La votación de prueba que se cree queda **anotada con su `id`** o borrada (decisión 13 de
      `PULIDO_BETA`).

## QA manual (IDs propuestos)

Recorrido en vivo contra `https://adondesalimos.ngrok.app` con Playwright, **a 390×844 y a
360×844**, en ventana limpia (sin sesión y sin cookie `voter_id` — es el estado del invitado real).

| ID | Qué se verifica |
|----|-----------------|
| `INV-01` | `og:image` + `twitter:card` presentes en el HTML servido de `/votacion/[token]` |
| `INV-02` | Ídem en `/` (la mitad de `R2-02` que no es la votación) |
| `INV-03` | La imagen responde 200 y mide 1200×630 |
| `INV-03b` | La ficha (`/lugar/[id]`) también hereda la imagen (decisión 2 ter) |
| `INV-04` | H1 sin título propio: una línea a 360 px, sin nombres de lugares |
| `INV-05` | H1 **con** título propio: sin cambios respecto de hoy |
| `INV-06` | Toques ≥ 44 px (tabla medida, los 4 de `R2-05`) |
| `INV-07` | Línea de plazo visible y coherente con `expires_at` de la fila |
| `INV-08` | «Podés cambiar tu voto» legible **antes** de votar |
| `INV-09` | Sin voto: sin desglose por opción, con total |
| `INV-10` | Al votar: aparecen conteo y barra, y el propio voto queda marcado |
| `INV-11` | Votación **cerrada** sin haber votado: se ve el desglose completo y el ganador |
| `INV-12` | El bloque de voto queda dentro del recuadro de su card (medido por `boundingRect`) |
| `INV-13` | Bajada del sheet debajo del título |
| `INV-14` | Sumar un lugar: el H1 no cambia ni queda viejo |
| `INV-15` | `/votacion/nueva`: se crea sin título y el rótulo explica para qué sirve |
| `INV-16` | 360 px sin desbordes en el recorrido completo |

### Lo que la imagen NO tiene, a propósito

El wordmark de la app es **extrabold** y el de la imagen sale en peso normal: `next/og` trae una
sola variante de su fuente por defecto, y darle el peso real significaría **empaquetar un archivo
de fuente** para una imagen que se ve al tamaño de una tarjeta de WhatsApp. Se mira y se lee bien.
Si algún día molesta, es agregar `fonts` — no rehacer nada.

## Relación con otros specs

- **`VOTACION`** — se enmienda **parcialmente** su decisión 13 (decisión 6 de acá). La enmienda se
  anota inline en la fila 13 de `done/VOTACION.md`, como se hizo con la 29 de `BUSQUEDA`.
  Las decisiones 1, 8, 11 y 15 quedan **intactas**.
- **`PULIDO_BETA`** — este spec ejecuta el bloque R2 de sus 33 hallazgos al backlog. No lo reabre:
  `PULIDO_BETA` está cerrado y sus IDs se tildan en el `BACKLOG`, uno por uno.
- **`SUGERIR_EN_VOTACION`** — el sheet de sumar y los dos techos (`MAX_OPCIONES` 5 del creador ·
  `MAX_OPCIONES_TOTAL` 8 del grupo) no se tocan.
- **`FICHA`** — su `generateMetadata` es el patrón que se reusa para el `openGraph`; el `og:image`
  de la raíz la alcanza gratis, sin declarar nada.
