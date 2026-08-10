# Spec: ORDEN_ORGANICO — que la primera pantalla no abra con Burger King (PBETA-R1-02)

**Estado:** ✅ Implementado (2026-08-10)
**Prioridad:** Alta — es el `PBETA-R1-02` de la ronda de feedback de `PULIDO_BETA`, reportado por
usuarios reales y **ratificado por Fer el 2026-08-10** como el ítem que más rompe la lógica que el
usuario espera. El público objetivo son jóvenes y adolescentes: la app se juzga en los primeros
tres segundos de la primera pantalla, y hoy esa pantalla abre con cadenas de fast food.
**Gate:** Ninguno — las dos señales que usa ya existen en la base y no hace falta ni una migración.
**Bloquea:** nada formalmente, pero es la condición para que `PBETA-R1-04` (ponerle techo al
scroll infinito) deje de ser arbitrario: recién con un orden que pone lo bueno arriba, cortar la
lista en N deja de esconder cosas al azar.
**Depende de:** [BUSQUEDA](../done/BUSQUEDA.md) (decisión 16 — el orden orgánico, que este spec
**enmienda**; decisión 19 — el cursor keyset; decisión 25 + el fix del piso por zona del
2026-08-10) · [CURADURIA](../done/CURADURIA.md) (los `place_tags` con `source='admin'` son la
señal de calidad) · [CATALOGO](../done/CATALOGO.md) (`lib/db/visibility.ts`, `app_settings`) ·
[MONETIZACION](../done/MONETIZACION.md) (decisiones 20-21 — los destacados, que este spec **no
toca**).

---

## Problema

`lib/search/query.ts` ordena por la decisión 16 de BUSQUEDA: **dueño > `confidence` > nombre**.
El orden es correcto contra su spec y equivocado contra el usuario, y el motivo es una sola
confusión de vocabulario:

> **`places.confidence` mide la confianza de Overture en que el dato del lugar es correcto, no la
> calidad del lugar para salir.** Una cadena tiene dato impecable — nombre canónico, dirección
> verificada, categoría inequívoca — ⇒ `confidence` alto ⇒ primera posición.

Eso no es una intuición: está medido sobre los 18.993 lugares publicados (2026-08-10, umbral
`catalog.confidence_threshold = 0.5`).

**El mecanismo, medido.** Agrupando los publicados por cuántos locales comparten el mismo nombre:

| Banda | Lugares | `confidence` promedio | % con `confidence ≥ 0,99` | % con website |
|-------|---------|----------------------|---------------------------|---------------|
| Cadena (≥ 8 locales) | 1.513 | 0,876 | **25,8 %** | 88,8 % |
| Cadena chica (4-7) | 452 | 0,824 | 11,9 % | 64,4 % |
| Repetido (2-3) | 1.419 | 0,810 | 8,9 % | 56,9 % |
| Único | 15.609 | 0,776 | **6,1 %** | 44,1 % |

Una cadena grande tiene **4,2× más probabilidad** de estar en el tramo de `confidence` que
encabeza el listado. El sesgo no es un accidente de Palermo: es sistemático y estructural.

**Lo que se ve hoy.** Top real por zona, sin chip, con el orden de la decisión 16:

| Zona | Publicados | #1 y #2 de hoy | Cadenas en el top 20 |
|------|-----------|----------------|----------------------|
| Palermo Soho | 1.094 | **Burger King · Subway** | 3 |
| Belgrano | 714 | La Farola de Cabildo · **Subway** | 3 |
| Retiro-Microcentro | 1.706 | Hard Rock Cafe · Patio 378 | 4 |
| Quilmes | 601 | Vinsanto · **Burger King** | 7 |

Y con el chip **Cenar afuera** (que es `restaurante`, uno de los 4 de la home) en Palermo Soho es
literalmente la queja del usuario: **1 Burger King · 2 Subway · … · 10 McDonald's**.

**Por qué no alcanza con lo que ya se arregló.** El fix del piso por zona (`8972271`) garantizó
que un chip no mienta sobre **cuántos** lugares hay. No dice nada sobre **cuáles** aparecen
primero — y eso es exactamente lo único que se juzga en los primeros tres segundos.

## Objetivo

Que la primera pantalla de resultados —en cualquiera de las 46 zonas, con chip o sin chip—
muestre lugares que un usuario reconozca como *"acá sale ir"*, sin que ninguna cadena de fast food
la encabece, y **sin que ningún lugar desaparezca del catálogo**: esto es orden, no filtro.

Concretamente, Palermo Soho con **Cenar afuera** pasa de

```
1 Burger King   2 Subway   3 Las Pizarras bistro   …   10 McDonald's
```

a

```
1 Las Pizarras bistro   2 L'Adesso   3 Barú Gastropub   4 The Night Market
5 Bulls BBQ smoke house   6 La Carnicería   7 Arte de Mafia   …
```

## Qué NO es esta feature

- **No es curaduría.** No se cura ningún lugar nuevo ni se toca `place_tags`. La curaduría
  existente se **consume** como señal; la corrida de más cobertura es otro ítem.
- **No es un filtro.** Ninguna cadena se oculta ni se despublica. `countPlaces`, el botón
  "Ver N lugares" y el piso de los chips (`PISO_HOME` / `PISO_ZONA`) devuelven **exactamente los
  mismos números que hoy**. Si algo cambia ahí, es un bug del spec.
- **No es el destaque pago.** Los 3 slots de MONETIZACION son otro eje y ya existen: se sirven
  aparte, arriba de la primera página. Ver decisión 9.
- **No es un rating.** No nace ninguna nota de calidad, ni propia ni de Google. Ver decisión 12.
- **No toca `PBETA-R1-03`** (el buffer de 400 m sin explicar) **ni `PBETA-R1-04`** (el conteo que
  desaparece + el scroll sin techo). Son la misma pantalla pero son UI y no tocan el motor: van
  juntos en otro pase (decidido con Fer el 2026-08-10).

## Decisiones cerradas

| # | Decisión |
|---|----------|
| 1 | **Enmienda explícita a la decisión 16 de BUSQUEDA.** El orden orgánico deja de ser `dueño > confidence > nombre` y pasa a ser **`dueño > banda > confidence > nombre`**. Todo lo demás de la 16 queda intacto: con texto libre manda la similitud, con GPS manda la distancia, y el `id` sigue último para que el orden sea total |
| 2 | **La señal nueva es una banda entera (0-3), no un score continuo.** Un score con pesos es imposible de explicar y de debuggear ("¿por qué este está 4º?"); una banda se lee de un vistazo y se testea con igualdad. La banda combina las dos únicas señales de calidad que el catálogo tiene hoy: **es cadena** y **está curado** |
| 3 | **Las bandas, de arriba abajo: `3` = no-cadena y curado · `2` = no-cadena · `1` = cadena curada · `0` = cadena.** O sea: **ser cadena despriorizá antes de que la curaduría promueva**. El orden entre las dos señales no es un detalle de gusto — está medido: la curaduría curó **85 McDonald's, 41 Starbucks, 13 Subway y 8 KFC**, así que con la precedencia invertida ("curado primero") *Un café · Palermo Soho* abre con **Starbucks 2º y 3º**. Con esta precedencia abre con Mulata Café, Maricafe y Full City |
| 4 | **"Curado" = el lugar tiene al menos un `place_tags` con `source='admin'`.** Es la única señal del catálogo que significa *"alguien (o un modelo, con evidencia) miró este lugar y le encontró una ocasión"*. Hoy cubre 1.202 de 18.993 lugares (6,3 %) — y **las 46 zonas tienen ≥ 21 curados** (la más pobre es San Justo con 21), o sea que alcanza para llenar la primera pantalla de 20 en **todas** las zonas. Corolario deliberado: **cada corrida de curaduría mejora el orden sola**, sin tocar código |
| 5 | **"Cadena" = el nombre normalizado del lugar está en la lista `search.cadenas` de `app_settings`**, editable sin deploy — mismo patrón que `chips.schedule`, `catalog.confidence_threshold` y `ai.chat_model`. **No se computa al vuelo** por dos razones: (a) un `COUNT` por nombre en cada búsqueda es un agregado global en el `ORDER BY`, y (b) sobre todo, la lista **necesita criterio humano** — Havanna (110 locales) y Café Martínez (95) son cadenas para el detector y opciones reales en el conurbano; sacarlas de la lista tiene que ser un `UPDATE`, no un deploy |
| 6 | **Normalización de la lista: `lower(immutable_unaccent(name))`**, con **igualdad exacta**, no prefijo ni `LIKE`. Se reusa la función que ya existe (BUSQUEDA F1) en vez de inventar otra. Colapsa "Café Martínez" con "Cafe Martinez" en una sola entrada; deja "burger king argentina" (11 locales) como entrada aparte de "burger king" (114), que es lo correcto: un prefijo se comería "la parrilla" al querer "la parrilla del tío" |
| 7 | **Dueño único de "quién es cadena": `lib/search/cadenas.ts`.** Lee y valida el setting, cachea por request y expone el fragmento SQL. Nadie más lee `search.cadenas`. Mismo patrón y mismo tamaño que `lib/search/pintado.ts`, que `chips.ts` consulta desde el server |
| 8 | **La banda NO filtra: es un `ORDER BY`, nunca un `WHERE`.** `construirWhere` no se toca. Consecuencia obligatoria y verificable: `countPlaces`, "Ver N lugares", el piso de los chips y la cobertura por zona devuelven **los mismos números que hoy, sin excepción**. Un lugar que hoy aparece, mañana aparece — más abajo |
| 9 | **Los destacados (MONETIZACION 20-21) no se tocan y no hay que hacer nada para que convivan.** `buscarDestacados` es una **query aparte** con su propio orden (rotación por `featured_impressions` + `md5(id‖fecha)`) que se sirve arriba de la primera página de la lista. Vender una posición y ordenar mejor lo orgánico son ejes independientes por construcción; este spec vive entero dentro de `clavesDeOrden` |
| 10 | **La banda se agrega dentro del bloque `if (!usaGps)` de `clavesDeOrden`, entre `ownerRank` y `confKey`.** En modo GPS manda la distancia y la banda queda inerte (la distancia en `double` casi nunca empata) — **y así debe ser**: quien pide "cerca mío" pide cercanía, y un Burger King a 100 m es legítimamente lo más cercano. Con texto libre la similitud sigue mandando; la banda desempata, que es donde hace falta ("cafe" empata mucho) |
| 11 | **El cursor lleva la banda como una clave más (`'b'`)**, exactamente igual que las otras: `clavesDeOrden` es la fuente única y el keyset la reusa tal cual, así que **no hay nada que sincronizar a mano**. La banda es un entero 0-3 estable por fila ⇒ el keyset sigue siendo un orden total y la paginación no repite ni saltea. **Riesgo declarado:** si alguien cura un lugar o edita `search.cadenas` mientras un usuario scrollea, ese lugar cambia de banda y puede duplicarse o saltearse una card. Es el **mismo** riesgo que ya corre hoy `confidence`, y las dos escrituras son eventos manuales por lote (`npm run curar`, un `UPDATE`), no continuos. Se acepta y se documenta; no se resuelve con un snapshot |
| 12 | **Ninguna señal de Google, ni ahora ni como extensión.** Rating y reviews no se pueden persistir ni cachear (ToS, CLAUDE.md § *Disciplina de costos*) ⇒ no pueden ordenar. Tampoco entran datos de uso: medido el 2026-08-10, `place_impressions_daily` tiene **211 aperturas de ficha en total sobre 36 lugares y 4 guardados** — ordenar con eso hoy sería ruido puro, y el rich-get-richer de una señal de popularidad sobre un catálogo sin tráfico es un pozo. Se re-evalúa cuando `detail_views` tenga volumen, no antes |
| 13 | **Descartada la "riqueza de perfil" (website / redes / teléfono) como señal.** Medida y **contraproducente**: 88,8 % de las cadenas tienen website contra 44,1 % de los únicos. Ordenar por completitud de contacto **agrava** el problema que este spec viene a arreglar |
| 14 | **El generador de la lista propone, no escribe.** `scripts/cadenas.ts` (`npm run cadenas:proponer`) imprime los nombres normalizados con ≥ 8 locales y el `UPDATE` listo para pegar; **no toca la base**. Mismo criterio que la curaduría: la máquina propone, el humano acepta. Se corre después de cada import de Overture. Hoy la lista arranca con los 19 nombres de ≥ 8 locales más las variantes que el umbral se pierde y un humano reconoce (`mc donalds`, `starbucks argentina`, `burger king argentina`) — **22 entradas**. **Corrección medida al implementar (2026-08-10):** el detector a ≥ 8, agrupando por nombre normalizado sobre el catálogo publicado, devuelve **49 nombres / 1.562 lugares**, no 19 — los 19 del anexo eran el recorte que ya había pasado por ojo humano (y 1.562 es lo que cierra con los 1.513 de la banda «cadena» de la tabla de arriba, que 19 nombres no explicaban). O sea: el filtro humano de la decisión 14 **no es opcional**, es la mitad del trabajo. Entre las 27 que el detector ve y la lista inicial no tiene hay cadenas de verdad (`tea connection`, `green eat`, `el noble`, `sushiclub`, `wendy's`, `mccafe`, `la continental`, `la farola express`) y candidatas a mirar de cerca (`lo de carlitos`, `la fabrica`, `mi gusto`, `romario`, `sensu`). Sumarlas es un `UPDATE` |
| 15 | **Umbral del generador: ≥ 8 locales con el mismo nombre normalizado.** Con 8 la lista no tiene un solo falso positivo. Con 4 sí los tiene y son caros: "parrilla", "la casona", "el patio", "la esquina" son homónimos independientes, no cadenas. Y con 8 quedan **fuera** las cadenas chicas que sí son un buen plan — Antares, La Birra Bar, Lattente, Tostado Café Club, Negro Cueva de Café: el usuario no se quejó de "cadena", se quejó de fast food genérico |
| 16 | **Puerta de ida y vuelta, por construcción.** Sin migración, sin columna nueva y sin dato materializado: la señal sale de `place_tags` (que ya existe) y de un setting. **`search.cadenas` vacío o ausente ⇒ la banda colapsa a `2`/`3` y el orden degrada al de hoy**, en silencio y sin error — mismo criterio de degradación que `chips.schedule`. Volver atrás es un `UPDATE`. **Precisión al implementar (2026-08-10):** «degrada al de hoy» es exacto en la mitad que importa —las cadenas vuelven a subir, verificado en vivo: con `[]`, *Palermo Soho* abre con Subway y *Un café* con Starbucks 1º y 3º— pero la banda 2/3 **sigue poniendo lo curado arriba de lo no curado**. Es deliberado: vaciar la lista apaga la mitad «cadena», que es la que causaba la queja; la mitad «curaduría» no se apaga desde este setting porque no es lo que rompía la primera pantalla (y apagarla pediría sacar la clave entera del orden, acoplando dos señales que no tienen por qué viajar juntas) |
| 17 | **`searchPins` (el mapa) hereda el orden sin tocarlo**, porque ya llama a `clavesDeOrden`. Es lo correcto y está en el spec de BUSQUEDA (decisión 21): cuando el resultado excede `MAP_PIN_LIMIT`, los 200 pins tienen que ser **los mismos** lugares que encabezan la lista. Si el orden cambia en un solo lado, el mapa y la lista dejan de contar la misma historia |
| 18 | **Costo, medido, y el índice que lo paga.** El `EXISTS` de curaduría por fila lleva la página 1 de **3,3 → 7,7 ms con zona** (el caso mayoritario) y de **13,8 → 66,5 ms sin zona** (AMBA entero, 18.993 filas: la home con chip y sin zona). `place_tags` hoy solo tiene el PK `(place_id, tag_id)` y el índice por `tag_id`. Se agrega **un índice parcial `place_tags (place_id) WHERE source='admin'`** (3.967 filas de 51 mil) y **el DoD exige volver a medir**: si no baja de 40 ms sin zona, se replantea materializar la señal en vez de sumar un índice que no paga.<br><br>**Re-medido el 2026-08-10** (migración `0017_orden_organico`, `EXPLAIN (ANALYZE, BUFFERS)` sobre la página 1 real, mediana de 3 corridas, Postgres de dev):<br>· **con zona** (`palermo-soho`, el caso mayoritario): **2,5 → 5,9 ms**<br>· **sin zona** (AMBA entero, 18.993 filas): **8,4 → 41,5 ms** con el índice, contra **116,6 ms sin él** ⇒ **el índice paga: −64 %**<br>La baseline de esta máquina es más rápida que la del diseño (8,4 vs 13,8 ms), así que la línea absoluta de 40 ms quedó rozada por 1,5 ms. **No se materializa**, y el motivo es que la medición partida muestra que el `EXISTS` **no es** la mitad cara: sobre AMBA entero, la curaduría sola suma **+10,5 ms** y el `immutable_unaccent(lower(name))` del match de cadena suma **+17 ms**. Materializar «curado» en una columna compraría ~10 ms, rompería la puerta de ida y vuelta de la decisión 16 y dejaría intacta la mitad grande. Se revisa si el catálogo crece o si la home sin zona se vuelve el caso mayoritario |

## Criterios de done (DoD)

- [x] `lib/search/cadenas.ts` existe, es el **único** módulo que lee `search.cadenas`, valida el
      setting y degrada a lista vacía ante ausencia o JSON inválido.
      Verificable: `grep -rn "search.cadenas" lib/ app/ scripts/` devuelve ese archivo, el seed y
      el script generador — **ningún consumidor más** ✅ (grep corrido: `lib/search/cadenas.ts`,
      `scripts/seed.ts`, `scripts/cadenas.ts` y nadie más; validación en `cadenas.test.ts`, 6 casos)
- [x] `clavesDeOrden` incluye la banda con la precedencia de la decisión 3, dentro del
      `if (!usaGps)` y entre `ownerRank` y `confKey`; test unitario de las 4 bandas ✅
      (`orden-organico.integration.test.ts` → *las cuatro bandas*, con los `confidence` invertidos
      a propósito; verificado además por mutación: invertir la precedencia rompe 2 tests)
- [x] **El cursor sobrevive**: test de integración que pagina las 3 primeras páginas de una zona y
      verifica cero duplicados y cero saltos contra el resultado completo ordenado ✅ (45 fixtures,
      3 páginas, 45 ids distintos y bandas no-crecientes; 15 comparten nombre para forzar empates
      hasta el `id`). En vivo: ORD-06, 60 cards y 60 ids distintos
- [x] **Nada se filtra**: test que compara `countPlaces` antes y después del cambio para una
      matriz de búsquedas (con zona / sin zona / con chip / con texto) y exige **igualdad exacta**
      ✅ (6 casos × lista prendida/apagada + mismo conjunto de lugares en otro orden)
- [x] Los 4 chips de la home siguen prendidos con los mismos conteos: `npm run cobertura-chips`
      da la misma matriz que hoy (el piso se calcula sobre `countPlaces`, que no cambió) ✅ —
      corrida con el `query.ts` de HEAD y con el nuevo: **`diff` vacío**, matriz byte a byte igual
      (8/9 chips en ≥1 zona, 46/46 zonas)
- [x] `buscarDestacados` no se toca — `git diff` no muestra cambios en ese bloque ✅
- [x] `scripts/cadenas.ts` + `npm run cadenas:proponer` imprimen la lista y el `UPDATE`, **sin
      escribir en la base** (verificable: el script no importa nada que escriba) ✅ (solo hace
      `select` vía `db`; imprime 49 nombres y el `UPDATE` con la unión contra lo que ya hay)
- [x] El seed siembra `search.cadenas` con la lista inicial y es idempotente ✅
      (`onConflictDoNothing`, igual que `chips.schedule`: no pisa una lista curada a mano)
- [x] Índice parcial creado por migración y **costo re-medido** con `EXPLAIN ANALYZE` en los dos
      casos (con zona y sin zona), con el número anotado en el spec ✅ — migración
      `0017_orden_organico`, números en la decisión 18
- [x] En modo GPS el orden **no cambia**: test que verifica que la banda no altera el resultado
      cuando hay coordenadas ✅ (mismo resultado con la lista prendida y apagada). En vivo:
      ORD-07, Burger King 1º a 0,00 km del Obelisco, que es lo correcto
- [x] `npx tsc --noEmit` · `npm test` · `npm run build` verdes (el build con el dev server parado)
      ✅ typecheck limpio · `npm test` **728/728** · `npm run build` compilado sin errores
      (2026-08-10, con el dev server parado)

## QA manual (IDs)

**Corrido el 2026-08-10** contra `https://adondesalimos.ngrok.app` (MCP de Playwright) sobre el
catálogo real: **10/10 PASS**. El detalle por caso está en `docs/qa/AnalisisQA.md` § ORDEN_ORGANICO.

| ID | Caso | Criterio | Resultado |
|----|------|----------|-----------|
| ORD-01 | Palermo Soho, sin chip | El top 20 no tiene ninguna cadena de la lista; #1 y #2 no son Burger King ni Subway | ✅ 1 *70 30 Bar* · 2 *La Choppería*; cero cadenas en el top 20 |
| ORD-02 | Palermo Soho + chip **Cenar afuera** | El top 10 es el de la sección *Objetivo*; McDonald's no está en la primera página | ✅ los 7 primeros son **exactamente** los del *Objetivo*, en ese orden; sin McDonald's en las 20 |
| ORD-03 | Palermo Soho + chip **Un café** | Starbucks **no** está en el top 10 (es el caso que mata la precedencia invertida de la decisión 3) | ✅ 1 *Mulata Café* · 2 *Maricafe* · 3 *Full City*; ningún Starbucks en las 20 |
| ORD-04 | Quilmes (conurbano), sin chip y con **Cenar afuera** | Mismo criterio que ORD-01/02 con oferta chica: el top sigue lleno y sin cadenas | ✅ 20 cards en los dos; 1 *Vinsanto*; sin cadenas de la lista |
| ORD-05 | Las 46 zonas | Ninguna queda con la primera pantalla vacía o más corta que hoy (el orden no filtra) | ✅ 46/46 con 20 cards y `countPlaces` idéntico al de HEAD; **29 de 46 cambiaron de #1** |
| ORD-06 | Scroll de 3 páginas en Palermo Soho | Ninguna card repetida, ninguna salteada; el conteo del sheet coincide con lo que se puede scrollear | ✅ 60 cards, 60 ids distintos; el sheet sigue anunciando 1.094 |
| ORD-07 | "Cerca de mí" (GPS) | El orden es por distancia, idéntico al de hoy: la banda no interviene | ✅ distancias monótonas; **Burger King 1º a 0,00 km** del Obelisco, que es lo correcto (decisión 10) |
| ORD-08 | Texto libre "burger" | Burger King aparece arriba: con texto manda la similitud y la banda solo desempata | ✅ 1 y 2 son Burger King |
| ORD-09 | Vista mapa con resultado > 200 | Los pins son los mismos lugares que encabezan la lista (decisión 17) | ✅ 200 pins + `truncated`; los primeros 20 son los mismos ids y en el mismo orden que la página 1 |
| ORD-10 | `UPDATE app_settings SET value='[]' WHERE key='search.cadenas'` | El orden degrada al de hoy sin error y sin pantalla rota; volver a poner la lista lo restaura (decisión 16) | ✅ 200 sin errores de consola, `count` intacto (1.094) y las cadenas vuelven (Subway 1º, Starbucks 1º y 3º en *Un café*); el `UPDATE` de vuelta lo restaura. Ver la precisión de la decisión 16 |

---

## Anexo — la medición que fundó las decisiones (2026-08-10)

Todo lo de abajo se midió sobre el Postgres de dev (Docker, puerto 5439), con
`catalog.confidence_threshold = 0.5` y 18.993 lugares publicados.

**Señales disponibles y su estado real:**

| Señal | Volumen | ¿Sirve? |
|-------|---------|---------|
| `place_tags` con `source='admin'` | 3.967 tags sobre **1.202 lugares** | ✅ Es la señal |
| Nombre repetido ≥ 8 locales | **19 nombres**, 1.513 lugares | ✅ Es la otra |
| `place_impressions_daily.detail_views` | **211 en total**, 36 lugares | ❌ No hay tráfico |
| `place_impressions_daily.saves` | **4** | ❌ |
| `place_photos` | 2 | ❌ |
| `places.source='owner'` | **0** | ❌ (ya está arriba en el orden) |
| Website / redes / teléfono | 9.322 / 18.035 / 15.730 | ❌ Contraproducente (decisión 13) |
| Rating de Google | — | ⛔ Prohibido persistirlo |

**Densidad de tags como proxy de curaduría** — cuántas facetas distintas tiene cada publicado:
8.545 lugares con 1 faceta · 9.456 con 2 · 555 con 3 · 410 con 4 · 27 con 5. Burger King tiene
**1** (`restaurante`); Antares Quilmes curado tiene **4** (`bar, grupos-grandes, happy-hour,
musica-en-vivo`). Se usó el booleano "tiene tag `admin`" y no el conteo de facetas porque son casi
el mismo conjunto (1.202 vs 992) y el booleano es estable en el cursor.

**Las 19 cadenas de ≥ 8 locales:** mcdonald's (181) · starbucks (122) · burger king (114) ·
havanna (110) · subway (105) · café martínez (95) · sabores express (73) · mostaza (65) ·
bonafide (59) · kentucky (35) · club milanesa (31) · hamburguesas extremas (29) · fabric sushi
(27) · el club de la milanesa (26) · le pain quotidien (24) · the coffee store (24) · brioche
dorée (21) · kfc (21) · almacén de pizzas (13, en el borde).

**Curados por zona (las 5 más pobres):** san-justo 21/191 · san-martin-villa-ballester 22/373 ·
lanus 22/385 · avellaneda 23/376 · san-miguel-bella-vista 23/351. Ninguna baja de 21 ⇒ la primera
pantalla de 20 se llena de curados en las 46.

**Cadenas curadas** (lo que fuerza la precedencia de la decisión 3): mcdonald's **85** ·
starbucks **41** · subway 13 · la continental 11 · café martínez 10 · kfc 8 · tienda de café 7 ·
kentucky 6 · burger king 4.
