# Lecciones aprendidas

Qué salió mal, por qué, y qué hacer distinto. No es un registro de bugs (eso va a
`docs/qa/AnalisisQA.md`): acá va solo lo que cambia cómo trabajamos la próxima vez.

---

## Un estado inicial que miente borra datos sin romper nada (2026-08-08 · CURADURIA_POR_NOMBRE)

**Qué pasó.** El editor de curaduría inicializaba el precio en `useState<string | null>(null)` —
"No sé"— porque `LugarEnCola` ni siquiera traía ese dato. Y `guardarCuraduria` hace
borrar-y-reinsertar sobre las facetas editables, `precio` incluida. O sea: **abrir un lugar ya
curado y guardarlo le borraba el precio**, en silencio, sin un error, sin un log y con la pantalla
mostrando exactamente lo que su estado decía. No lo reportó nadie: lo encontró el triaje leyendo el
código, y solo porque estaba mirando otra cosa (`FB-10`).

Lo que lo vuelve interesante no es el `null`. Es que **el bug era invisible por construcción**: la
UI era coherente consigo misma en todo momento. Un QA por pantalla —abrir, tocar un tag, guardar,
ver que dice "Guardado"— lo aprueba las diez veces. El único lugar donde el bug existe es la
diferencia entre dos `SELECT`.

**Por qué no se ve.** Un componente cuyo estado nace de `useState(valor)` tiene **dos** fuentes
posibles de verdad —lo que hay en la base y lo que el estado asume— y **solo una se renderiza**. Si
la que se muestra es la que asume, la pantalla no puede delatarla: se ve idéntica al caso legítimo
("este lugar no tiene precio"). El daño aparece recién cuando ese estado viaja de vuelta a un
`DELETE`/`INSERT` que trata la ausencia como una decisión del usuario. Es el mismo patrón de
cualquier form que hace PUT del objeto entero con los campos que no cargó en blanco.

Y hay un agravante de contexto: los datos que se borraban eran de los que **no están en git ni en
el seed** (los ~3.967 tags `source='admin'` de la curaduría cuestan ~US$17 de Sonnet reponerlos).
Un bug silencioso sobre datos irreproducibles no se descubre cuando pasa; se descubre meses después,
cuando alguien los busca.

**Qué hacer distinto:**

1. **Si un formulario borra-y-reinserta, su estado inicial tiene que venir de la base, sin
   excepción.** No es un detalle de UX: cada campo que el editor no sabe leer es un campo que el
   guardado va a borrar. La pregunta al escribir el `useState` es "¿qué pasa si el usuario guarda
   sin tocar esto?".
2. **Un bug de datos se verifica con `SELECT` antes/después, nunca por captura de pantalla.** Los
   casos `CURNOM-10`..`CURNOM-14` se escribieron así a propósito. Si el criterio de aceptación se
   puede cumplir con la pantalla mintiendo, el criterio está mal escrito.
3. **Al leer un campo "para mostrar", no filtres por quién lo escribió.** El precio se lee de
   `place_tags` **sin** filtrar por `source`: uno puesto por el dueño o traído del import también
   tiene que verse, porque el `DELETE` posterior lo alcanza igual. Filtrar de más en la lectura
   recrea el mismo bug con otra cara.
4. **Cuando una feature nueva convierte un camino raro en el camino principal, sus bugs latentes
   dejan de ser latentes.** `FB-10b` "casi no mordía" (un lugar con precio en 18.993, cola vacía) —
   hasta que `FB-10` volvía a *"busco un lugar, corrijo un tag, guardo"* el gesto más común del
   admin. Por eso los dos fueron en la misma tanda y **el piso primero**: abrir la puerta sin
   arreglarlo era agrandar un bug de pérdida de datos, no heredarlo.

**Dónde quedó:** `lib/curation/query.ts` (`LugarEnCola.precioSlug`, con el porqué del "sin filtrar
por `source`") · `app/admin/curaduria-client.tsx` (el `useState` con su comentario) ·
`docs/qa/AnalisisQA.md` § *CURADURIA_POR_NOMBRE* (`CURNOM-10`..`CURNOM-14`, con los `SELECT`).

---

## SQL escrito en un spec es una hipótesis, no un procedimiento (2026-08-03 · DEPLOY F0)

**Qué pasó.** El paso 5 de `DEPLOY` traía el SQL de limpieza **ya escrito**, con comentarios
cuidadosos y una advertencia en negrita sobre que `session` y `account` no cascadean. Se veía
revisado. Al ejecutarlo contra Neon falló en la segunda sentencia:
`ERROR: operator does not exist: text = uuid`. Faltaba un `::text`. **Nadie lo había corrido nunca.**

Y al mirar por qué fallaba apareció que **el spec también explicaba mal la causa**: decía que
better-auth *"las creó sin foreign key"*, que se lee como un descuido de la librería. Lo real es que
`users.id` es `uuid` y `session.user_id` / `account.user_id` son `text` — **la FK era imposible**.
La conclusión operativa (borrarlas a mano) era correcta; el porqué, no. Y un porqué equivocado
invita al arreglo equivocado: alguien "arregla" el schema agregando la FK y no entiende por qué falla.

**El mismo día, la misma forma, un tercer caso:** el paso 3 decía *"restaurar el dump completo
(`--no-owner --no-acl`)"* dando por sentado que el archivo que produce `npm run backup:db` ya traía
esos flags. **No los traía** — el script hacía `pg_dump` pelado, y el dump llevaba 62 `OWNER TO
adondesalimos`, un rol que en Neon no existe (ya está corregido en el script). Tres afirmaciones
escritas con seguridad en un spec revisado, y las tres se cayeron en los primeros diez minutos de
ejecutarlo.

**Por qué importa.** Un spec bien escrito genera la ilusión de que el paso ya está probado. No lo
está: está **diseñado**. La diferencia se paga entera en el momento más caro —ejecutando contra la
base nueva, con datos reales en juego— salvo que la ejecución tenga red.

**Qué hacer distinto.**
1. **Todo bloque destructivo se corre con `--single-transaction` + `-v ON_ERROR_STOP=1`.** Es lo que
   convirtió el error en un no-evento: la transacción abortó entera, `users` seguía en 4, y el
   segundo intento arrancó de una base idéntica a la del primero. Sin eso, el `delete from users`
   habría commiteado y el fallo de la línea siguiente dejaba sesiones y hashes huérfanos.
2. **Verificar por conteo no alcanza.** El spec pedía comparar conteos; se agregó `md5(string_agg(
   columna, ',' order by id))` sobre 6 conjuntos. **Un conteo igual con contenido distinto pasa la
   verificación del spec** — y en una migración de catálogo eso es justo lo que querés cazar. Cuesta
   una query.
3. **Cuando el spec afirma una causa técnica (por qué no hay FK, por qué falta un flag), verificarla
   en el momento de usarla**, no confiar en que se verificó al escribirla. Las tres de acá se
   resolvieron con `information_schema.columns`, `grep` sobre el dump y leer el script: minutos.

---

## Lo que el QA no puede ver por sí solo (2026-08-03 · PULIDO_BETA F4)

**Qué pasó.** Para verificar el alta de un usuario nuevo hacía falta el link de verificación del
mail. El reflejo fue buscarlo en la base para no depender de nadie: `select * from verification` →
**0 filas**, con el usuario recién creado y `email_verified = f`. La tabla existe, la migración está,
y aun así está vacía. **Better Auth firma el token de verificación con el secret y no persiste
nada**: no hay fila que leer, ni antes ni después. El link solo existe dentro del mail.

**Por qué importa.** Es un atajo que *parece* que tiene que estar —hay una tabla llamada
`verification`, después de todo— y buscarlo cuesta tiempo antes de concluir que no existe. En un QA
de alta nueva **el humano es parte del instrumento**: alguien tiene que abrir el inbox y pasar el
link. Conviene pedírselo **antes** de arrancar el recorrido y aclarar que **no lo clickee** — si lo
usa, el token se consume y se pierde la chance de medir dónde aterriza y qué sobrevive.

**El mismo día, dos veces más, la misma forma:** (a) **el service worker no es requisito para
instalar una PWA** — se verificó en la doc de Chrome *antes* de dar el DoD por cumplido, porque si lo
fuera el criterio era imposible sin salir de scope; (b) **`app/` no sirve archivos arbitrarios**,
solo los nombres de convención de Next (`icon`, `favicon`, `apple-icon`), así que los íconos que el
manifest referencia por URL fija van a `public/` — el spec decía *"no estrenes convención"* y la
respuesta correcta era usar las dos carpetas, cada una para lo suyo.

**El mismo día, el caso que costó dos intentos: el nombre en el splash.** Fer quería leer "¿A dónde
salimos?" al abrir la app. Se afirmó que *"Android lo pinta desde `name`"* — **su captura demostró
que no**. Después se afirmó que *"Chrome elige el ícono más grande para el splash"* y se agregó uno
de 1024: **tampoco** (la doc dice *«the icon that most closely matches the device resolution»*).
Recién en el tercer razonamiento apareció la respuesta real: **el splash usa el `maskable`, que es el
mismo archivo del ícono del launcher**, así que darle texto al splash es dárselo al ícono que se ve
todos los días. **Dos afirmaciones seguidas dichas con seguridad y las dos falsas**, cada una
costando un ciclo de "desinstalá y reinstalá". Lo que las delató no fue razonar mejor: fue que había
alguien probándolo en un celular de verdad.

**Qué hacer distinto.**
1. **Antes de dar por imposible (o por cumplido) un criterio que depende de una plataforma, chequear
   la doc de esa plataforma.** Los casos de arriba se resolvieron con una lectura corta, y todos
   tenían una respuesta intuitiva que era la equivocada. **Y cuando la afirmación se va a traducir en
   trabajo de Fer** (instalar, desinstalar, reinstalar), chequearla **antes** de pedirle la prueba,
   no después de que falle.
2. **Cuando el QA necesita una acción humana, pedirla al principio y con la instrucción exacta**
   (qué mirar, qué NO tocar). Un token de un solo uso se quema una sola vez.
3. **Lo físico se verifica o se anota, nunca se infiere.** Android se instaló de verdad; iOS no se
   pudo y quedó como `PBETA-07` pendiente, en vez de PASS "por lectura de código". Un spec puede
   cerrar con un pendiente escrito; lo que no puede es cerrar con un pendiente disfrazado de
   verificado.

---

## En QA con Playwright, tipear no es enfocar (2026-08-01 · alias de zonas)

**Qué pasó.** Verificando en vivo que los alias nuevos resolvieran, el desplegable de sugerencias
aparecía en la home vacía pero **no aparecía con una zona ya aplicada** — ni con un alias, ni con
`belgrano` (nombre de zona), ni con `pizza` (un tag). El síntoma era consistente y reproducible, así
que se reportó como hallazgo preexistente y **se llegó a escribir un ítem en `BACKLOG.md`** ("el
autocompletar desaparece apenas hay una zona elegida"). **Era falso.** El dropdown depende del
estado `enfocado` de `components/search/search-shell.tsx:131`, que se prende en `onFocus`; al tipear
con `pressSequentially` sobre un input que **ya era el `activeElement`** después de navegar, el
evento `focus` nunca se dispara y React nunca prende el estado. Con un click explícito en el campo
antes de tipear, funciona perfecto (`unicenter` ⇒ *"Martínez y Acassuso — Unicenter"* con el chip
`Flores y Floresta` puesto).

**Por qué no se ve.** El falso negativo es **estable**: se repite igual todas las veces, con
distintos términos, y encima tiene una explicación de producto que suena razonable ("en la pantalla
de resultados el campo busca por nombre de lugar, será deliberado"). Esa coherencia es justo lo
peligroso — un bug de método que se comporta como una decisión de diseño no se delata solo, y el
QA lo firma con evidencia de pantalla.

**Qué hacer distinto.**
1. **Click en el input antes de tipear**, siempre, en cualquier verificación con Playwright. Es una
   línea y elimina la clase entera de falso negativo.
2. Ante un síntoma de UI que se va a reportar como hallazgo, **ir al código a explicarlo antes de
   escribirlo**. Acá eso fue lo que lo cazó: la explicación no cerraba, y al mirar `search-shell`
   apareció el `onFocus`. Un hallazgo que no se puede explicar en el código todavía no es un
   hallazgo — es un síntoma, y puede ser del instrumento.
3. Vale para todo componente que dependa de `onFocus`, `onBlur`, `onMouseEnter` o cualquier evento
   que el usuario genera con el cuerpo y la automatización se puede saltear.

---

## Un `200 OK` no dice que la respuesta sea buena (2026-08-01 · medición de OSM/Overpass)

**Qué pasó.** Para medir cuánto aportaría OpenStreetMap al catálogo hubo que bajar los POI de AMBA
con la Overpass API, en 64 tiles. Como el endpoint público se congestiona, el script rotaba entre
tres mirrors. Uno de ellos, `overpass.osm.ch`, **responde HTTP 200 con JSON bien formado y cero
elementos**: su base está vacía, y se delata solo en un campo que nadie mira
(`osm3s.timestamp_osm_base: "116082"`, donde va una fecha ISO). El código chequeaba `res.ok` y
guardaba el resultado. **Una corrida entera de 64 tiles terminó "exitosa" con 617 elementos en vez
de 16.949**, y encima cacheada en disco: los tiles vacíos quedaron guardados como buenos y la
siguiente corrida los iba a reusar. Se descubrió por olfato —el total era absurdo para AMBA—, no
por ningún error.

**Por qué no se ve.** Un mirror caído devuelve 5xx y el retry lo cubre. Un mirror **vacío** devuelve
200. El happy path del código es exactamente el mismo, y si el dominio admite resultados legítimos
en cero (un tile rural sin bares), no hay forma de distinguir "no hay nada acá" de "esta fuente no
tiene nada". El fallback silencioso a datos vacíos es peor que el error: se propaga a la conclusión.

**Qué hacer distinto:**

1. **Validá el payload, no el status.** Si la respuesta trae un campo que prueba que la fuente está
   viva (un timestamp, una versión, un total), chequealo antes de aceptarla. Acá fueron tres líneas
   (`/^\d{4}-\d{2}-\d{2}T/.test(...)`) y habrían ahorrado una corrida entera.
2. **Un resultado vacío de una fuente externa es sospechoso hasta que se demuestre lo contrario** —
   sobre todo si lo vas a cachear. Cachear un vacío convierte un problema transitorio en permanente.
3. **Antes de creerle a un agregado, mirá si el orden de magnitud cierra.** "617 POI en todo AMBA"
   era imposible y estaba a la vista en la línea final del log. Aplica igual a cualquier número que
   se vaya a escribir en un doc.

*(La otra cicatriz de la misma sesión, más chica y específica de Overpass: `nwr["amenity"~"^(a|b|c)$"]`
hace 504 en los tiles densos; la unión de statements con `=` exacto devuelve lo mismo en ~17 s.)*

---

## Un hallazgo de QA puede generalizar de más, y la generalización sobrevive al bug (2026-07-31 · pase de deuda)

**Qué pasó.** El H-1 de AUTH F2 fue un bug real: un `EXISTS` escrito a mano donde Drizzle renderizó
`${places.id}` como `"id"` sin calificar la tabla, y como `place_claims` también tiene `id`, la
condición era `pc.place_id = pc.id` — falsa siempre. Al corregirlo se escribió la causa como una
regla general: *"dentro de un subquery en SQL crudo, Drizzle no califica la tabla"*. De ahí salió un
H-2 ("mismo patrón latente en `lib/search/query.ts`, hoy inocuo **por descarte**") y de ahí un ítem
de backlog que pedía refactorizar el motor de búsqueda a `leftJoin`, con test de regresión.

Diez días después, al ir a hacerlo, alcanzó un `toSQL()` para ver que la regla era otra: **Drizzle
omite la tabla solo cuando la columna se renderiza en la lista de SELECT**; en el WHERE la califica.

```
EN SELECT : ... WHERE pc.place_id = "id"            ← acá estaba el bug de claims
EN WHERE  : ... WHERE pc.place_id = "places"."id"   ← acá viven los EXISTS del motor
```

Los `EXISTS` del motor nunca estuvieron en riesgo. El refactor habría tocado el camino crítico de la
búsqueda para arreglar nada — y con un test de regresión al lado, que lo habría dejado pareciendo
justificado para siempre.

**Por qué no se ve.** Un hallazgo de QA se escribe caliente, justo después de entender el bug, y en
ese momento la explicación más simple parece la más general. Nadie vuelve a medirla: queda citada en
el QA, copiada al backlog y después parafraseada en el prompt de la sesión que la va a "arreglar".
Cada copia se lee como confirmación de la anterior. **Un diagnóstico heredado se cita, no se
verifica** — y cuanto mejor escrito está, menos ganas dan de dudarlo.

**Qué hacer distinto:**

1. **Antes de arreglar un bug que no viste fallar, reproducilo.** Si el ítem dice "hoy funciona por
   descarte", el primer paso es que el descarte se vea: `toSQL()`, un `EXPLAIN`, un conteo contra la
   verdad en SQL crudo. Acá costó dos scripts de diez líneas y cambió la conclusión entera.
2. **Al escribir un hallazgo, separá lo que medí de lo que infiero.** "El `EXISTS` del campo
   `reclamado` salió `pc.place_id = "id"`" es una medición; "Drizzle no califica dentro de
   subqueries" es una teoría que la explica. La segunda va marcada como tal, o se vuelve doctrina.
3. **Cerrar un ítem del backlog con "no era un bug" es un resultado, no una falla.** Se registra
   igual que un fix, con la medición al lado — si no, el próximo que lea el hallazgo viejo vuelve a
   abrirlo.

**Dónde quedó:** `docs/qa/AnalisisQA.md` § *Pase de deuda técnica* (H-1) y la corrección sobre el
H-2 de AUTH F2, más el comentario en `lib/search/query.ts` que nombra el riesgo **real** (no mover
esos fragmentos a una posición de SELECT) y la afirmación acotada en `lib/claims/query.ts`.

---

## Un spec puede envejecer contra los datos sin que nadie toque una línea (2026-07-31 · CHIPS_ROTACION)

**Qué pasó.** El spec se escribió el 2026-07-29 con un § *Problema* medido contra la home de ese
momento: «After office» estaba detrás de "Ver más" y por eso las dos reglas semilla —adelantarlo un
martes a las 18, y «Salir a bailar» un viernes a la noche— tenían sentido. Entre medio pasó la
corrida de CURADURIA F3, que revivió chips que daban 0. Al empezar a implementar, medido contra la
base: los cuatro chips de la home eran `salida-con-chongo` · `salir-a-bailar` · `after-office` ·
`tomar-algo`. **Los dos chips de las reglas semilla ya estaban en la home a toda hora.** Aplicar la
feature tal cual estaba escrita no habría movido un pixel, y los tres primeros IDs de QA
(`ROT-01/02/03`) habrían dado PASS sin que la feature hiciera nada: «After office» estaba adelante
igual, por la columna `sort`.

**Por qué no se ve.** El spec no tenía ningún error: cada decisión seguía siendo correcta contra el
mundo en el que se escribió. Lo que cambió fue el **catálogo**, que en este proyecto es un insumo
vivo (la curaduría prende chips sin deploy — que es exactamente lo que BUSQUEDA decisión 25 buscaba).
Releer el spec cien veces no lo habría mostrado; los IDs de QA tampoco, porque estaban redactados
como "«After office» visible sin abrir Ver más" y eso ya era cierto **antes** de implementar nada.
Un criterio de QA que pasa con el código viejo no es un criterio: es una descripción del presente.

**Qué hacer distinto:**

1. **Antes de implementar, re-medir contra la base los números que el spec usó para justificarse.**
   Cuesta una query. Si el spec dice "hoy esto da 0" o "hoy esto está detrás de Ver más", eso es un
   dato con fecha, no una premisa permanente. Vale sobre todo para lo que toca el catálogo, los
   chips o los tags, que la curaduría mueve sin deploy.
2. **Sospechar del ID de QA que ya pasaría antes de escribir el código.** Al redactarlo, preguntarse
   "¿esto es distinguible del estado actual?". `ROT-01` pasó a decir «After office» es el **primer**
   chip de Ocasión, no "está visible", justamente por eso.
3. **Cuando el mundo cambió, la salida es una decisión nueva, no un ajuste silencioso.** Acá fue la
   decisión 11 (una regla puede traer un chip sin `in_home`), consultada con Fer y escrita en el
   spec **antes** de codear, con la alternativa conservadora anotada y el costo asumido (`in_home`
   cambia de significado). Implementar "lo que el spec dice" sabiendo que no hace nada habría sido
   cumplir el contrato y entregar una feature muerta.

---

## Un efecto que tiene que sobrevivir no puede vivir dentro de la transacción que va a fallar (2026-07-31 · SUGERIR_EN_VOTACION)

**Qué pasó.** `sugerirOpcion` abre una transacción, toma la fila de `polls` con `FOR UPDATE`
(porque el techo de 8 se cuenta y después se inserta) y valida los gates adentro. Uno de esos
gates es "la votación tiene que estar abierta", y ahí se copió el patrón de `votar()`: si venció
pero la columna `status` sigue `'open'`, se persiste el **cierre perezoso** (decisión 11 de
VOTACION, no hay cron) y se devuelve el error. El error de negocio se lanza como excepción para
cortar la transacción… y el `ROLLBACK` **se lleva puesto el cierre perezoso**. La votación vencida
quedaba `'open'` en la base para siempre; la respuesta al usuario era correcta, así que a simple
vista todo andaba.

**Por qué no se ve.** Los dos efectos viven en la misma función y "los dos escriben en `polls`",
pero tienen destinos opuestos: uno **debe** persistir (el cierre) y el otro **debe** deshacerse (la
opción que no entró). El commit/rollback es por transacción, no por statement — no hay forma de
que el mismo `tx` guarde uno y descarte el otro. Lo cazó un test que, después de un intento de
sugerir sobre una votación vencida, chequeaba `status === 'closed'` en la base. Sin esa línea, el
test pasaba igual: el `code` devuelto era el correcto.

**Qué hacer distinto:**

1. **Antes de meter una escritura dentro de una transacción, preguntarse si tiene que sobrevivir a
   que esa transacción falle.** Si la respuesta es sí, va **afuera** — antes, como pre-chequeo, o
   después. Acá quedó igual que en `votar()`: leer el estado y persistir el cierre fuera, y adentro
   el `FOR UPDATE` solo **revalida** por si algo cambió entre medio.
2. **Un test de un caso de error tiene que assertear también el efecto colateral esperado**, no
   solo el código devuelto. "Devolvió `VOTACION_CERRADA`" y "quedó cerrada en la base" son dos
   afirmaciones distintas, y la segunda es la que se rompe en silencio.
3. **Copiar un patrón que funciona no es gratis si cambia el envoltorio.** El código de `votar()`
   era correcto **porque estaba fuera de una transacción**. Al pegarlo adentro de una, la misma
   línea pasó a ser un no-op. Cuando se reusa un fragmento, mirar qué garantías le daba su
   contexto anterior.

---

## El prompt caching falla en silencio, y los tokens de caché no son gratis (2026-07-29 · mail de Anthropic)

**Qué pasó.** Llegó un mail de Anthropic avisando "tu cache hit rate es bajo, podrías ahorrar hasta
un 54%". Al medirlo: el **chat ya cacheaba bien** (8.776 tokens de prefijo, 8× sobre el mínimo) y
gasta ~US$0,11 al mes — el 54% de eso son centavos. El gasto real estaba en otro lado: el
**sugeridor de curaduría** pasaba el system como string plano sin `cache_control`, y ese system es
idéntico en las ~1.840 llamadas de una corrida. Se reprocesó a precio pleno 1.840 veces.

**Dos cosas que no son obvias y que costaron plata cada una:**

1. **Hay un mínimo cacheable, y por debajo el caching no cachea *sin avisar*.** No hay error:
   `cache_creation_input_tokens` vuelve en 0 y la factura llega igual. El mínimo **depende del
   modelo y no es monotónico** (Sonnet 5: 1.024 · Haiku 4.5: 4.096). Medido, el system del
   sugeridor da **1.260 tokens en Sonnet 5** — cachea, con solo 23% de margen — y **958 en Haiku**
   (tokenizer distinto), donde nunca alcanzaría los 4.096. O sea: **bajar `ai.curation_model` a
   Haiku "para ahorrar" apagaría el caching en silencio y saldría más caro por el otro lado.**
2. **`input_tokens` es el remanente NO cacheado.** El total de entrada es
   `input + cache_read + cache_creation`. Un read cuesta 0,1× y un write 1,25×: **no son gratis**.
   Todo cálculo de costo que sume solo `input_tokens` **subestima** en cuanto empieza a cachear —
   le pasaba al log del chat y al reporte de `npm run curar`, los dos arreglados acá.

**Qué hacer distinto:**

1. **Si un prompt se repite entre llamadas, cachealo — y medí el prefijo con `count_tokens`
   (gratis) antes de dar el ahorro por hecho.** Escribí el número y la fecha en el código: es un
   umbral que se cruza al recortar un prompt, y nadie lo va a recordar.
2. **Cualquier cálculo de costo tiene que recibir los tokens de caché**, no solo input/output.
   `calcularCostoUsd` (dueño único del costo) ahora los toma como parámetros opcionales.
3. **Un reporte de costo debería delatar su propia rotura.** `npm run curar` ahora imprime el
   ahorro vs. no cachear y grita si hubo **cero** lecturas de caché en toda la corrida — el
   síntoma exacto de que el prefijo cayó por debajo del mínimo.
4. **Un mail de alerta de un proveedor es una hipótesis, no un diagnóstico.** Este tenía razón en
   el ratio y apuntaba a un gasto que ya había ocurrido y no se repite. Medir primero **dónde**
   está el gasto evitó optimizar la parte que costaba centavos.

**Cuánto era "no son gratis" (medido el 2026-07-31, al persistir los tokens de caché).** Un
mensaje real del chat: 893 input + 407 output + 8.701 read + 8.701 write ⇒ **US$ 0,0440**, de los
cuales **US$ 0,0326 (74%) es la escritura del prefijo**. El cálculo viejo daba US$ 0,0088: el
tablero informaba **1/5** del costo. Detalle en `docs/qa/AnalisisQA.md` § *Pase de deuda
técnica*, H-2.

**Y una trampa mental al leer ese número: el caché NO es por conversación.** Es por **prefijo**
(system + tools), compartido entre requests y usuarios del mismo workspace, **por modelo**, y cada
lectura le **refresca el TTL gratis** (verificado contra la doc de Anthropic el 2026-07-31: *"The
cache is refreshed for no additional cost each time the cached content is used"*). Tres
consecuencias que cambian cualquier mitigación que se diseñe:

1. **El write se paga una vez por período frío, no una por conversación.** Con un mensaje cada
   menos de 5 minutos —de cualquier usuario, en cualquier conversación— no se vuelve a pagar. El
   régimen caro es el tráfico **ralo**, que es justo cuando el costo absoluto son centavos: a
   volumen esto se arregla solo.
2. **Cachear una sola llamada aislada es una pérdida, no un ahorro**: el write a 1,25× cuesta más
   que pagar el input pleno (1×). Recién conviene desde la segunda llamada que comparte el
   prefijo. Acá igual gana siempre, porque el tool-use hace **dos** llamadas por turno (la primera
   escribe, la segunda lee) — por eso la fila medida tiene read y write iguales.
3. **Los cachés son por modelo, así que "modelo barato en el primer mensaje, caro después" no
   ahorra: agrega un write.** El primer mensaje escribiría el caché del modelo chico y el segundo
   pagaría igual el del grande (idea de Fer, 2026-07-31, descartada con números: US$ 0,0439 vs
   US$ 0,0329 — y encima pone el modelo débil en el mensaje que más define la voz).

Las palancas reales, si algún día hace falta: dejar que el volumen lo mantenga caliente · el TTL
de 1 h (write a 2×, conviene solo con tráfico a baches y ≥3 llamadas por hora) · recortar el
prefijo. Las tres se deciden con datos de tráfico real — anotado en el BACKLOG, sin tocar nada.

---

## Un comentario del código puede tener razón y el dato contradecirlo, sin que nada falle (2026-07-29 · autoría de v2)

**Qué pasó.** `lib/db/taxonomy.ts:157` dice, desde CATALOGO, que el tag `abierto-ahora` *"se
siembra porque es parte de la taxonomía decidida, pero **NO** puede evaluarse contra
`place_tags`"*. Dos días antes, la corrida autónoma de CURADURIA F3 le asignó ese tag a **20
lugares publicados** (`source='admin'`). El comentario tenía razón —el tag es un concepto
computado, hora + horarios— y el dato lo contradijo. **Se descubrió de casualidad**, al medir la
base para escribir el spec de "Abierto ahora".

**Causa raíz.** El LLM de curaduría recibe la lista de tags de una faceta y decide con la
evidencia del lugar. `abierto-ahora` estaba en la lista porque está sembrado y `active`: nada en
el dato le decía que ese tag no es asignable. La regla vivía en un **comentario para humanos**,
no en un lugar que el código o el prompt pudieran hacer cumplir.

**Por qué no lo cazó nada.** Typecheck verde (no hay tipos involucrados). 468 tests verdes
(ninguno afirma qué tags puede asignar la curaduría). El QA de CURADURIA verificó el flujo, la
evidencia y la cobertura de chips — no que cada tag asignado fuera *asignable*. Y los checks de
`/consistency-check` cruzaban docs contra **código y git**, nunca contra los **datos**.

**Qué hacer distinto:**

1. **Una regla que el código no puede hacer cumplir necesita un check contra los datos, no un
   comentario.** Se agregó el **check (f)** a `/consistency-check`: cruza los docs y las reglas
   contra el runtime (`app_settings`, tags activos en 0, tags retirados con filas, tags que el
   código declara no evaluables **pero tienen filas**, canario de la curaduría, gates de specs ya
   cumplidos). Es read-only, solo `SELECT`.
2. **Ojo con las reglas que viven en `app_settings` y en la data.** Son la decisión correcta
   (cambiar sin deploy) con un costo real: **el doc y la verdad se separan sin que nadie toque un
   archivo**. Es el mismo patrón del A/B del chat, donde el BACKLOG decía "revertido a Haiku" y
   el runtime ya corría Sonnet 5.
3. **Si un spec tiene un gate numérico, la consulta que lo evalúa va escrita en el spec.** Un
   gate que ya se cumplió y nadie advirtió es trabajo desbloqueado invisible (check f11).
4. **Al darle a un LLM una lista de opciones, sacar de la lista lo que no debe elegir.** No
   alcanza con documentar aparte por qué una opción no va: si está en la lista, es elegible.

> **Cerrado el 2026-07-30 (ABIERTO_AHORA F1).** El punto 4 se aplicó de la única forma que el
> sistema puede hacer cumplir solo: `active = false`. El sugeridor de curaduría filtra `active`
> (`lib/curation/query.ts:155`), así que el tag **salió de la lista** que ve el LLM — no por
> documentación, por dato. Sus 20 filas siguen ahí (ocultar ≠ borrar).
>
> **Y apareció una quinta lección, del mismo tronco: un retiro que vive solo en la base es la misma
> trampa una vuelta más adentro.** El seed no pisa `active` a propósito (apagar un tag a mano es
> curaduría y tiene que sobrevivir a un reseed), pero eso hacía que un retiro **decidido en un
> spec** se perdiera en silencio al recrear la base — y el tag volvía a ser elegible para el LLM,
> que es exactamente el bug de arriba. Arreglado el mismo día: la lista vive en código
> (`TAGS_RETIRADOS` en `lib/db/taxonomy.ts`, dueño único del hecho) y se aplica con
> `npm run db:retiros`, idempotente y sin tocar `place_tags`. El check f7 de `/consistency-check`
> cruza base ↔ declaración en los dos sentidos. **La forma general: si una decisión no está
> declarada en código, no es una decisión — es el estado actual de una base.**

---

## Un driver puede tragarse un campo entero sin dar un solo error (2026-07-20 · CATALOGO)

**Qué pasó.** El import de Overture corrió limpio: 26.057 lugares, cero errores, reporte
verde. Los teléfonos, webs, redes y emails de **los 26.057** estaban en `null`.

**Causa raíz.** Las columnas `VARCHAR[]` no llegan como array de JavaScript desde
`@duckdb/node-api`. El código hacía `Array.isArray(value) ? … : null` sobre el valor crudo:
como nunca era un array, la respuesta siempre fue `null`. La rama de descarte era la única
que se ejecutaba, y descartar en silencio es exactamente lo que se le pidió que hiciera.

**Por qué no lo cazó nada.** El typecheck estaba conforme (el tipo declarado era `string[]`,
que es lo que *debería* haber llegado). Los tests no tocaban esa función. El reporte del
import contaba filas insertadas, no campos poblados. Todo verde.

**Qué hacer distinto:**

1. **Después de un import, verificar cobertura por campo, no solo el conteo de filas.**
   `count(*)` responde "¿llegaron?", no "¿llegaron completos?". La medición previa del spec
   decía 86% con teléfono y 98% con redes — ese número existía y nadie lo contrastó hasta
   el spot-check de QA. **Si el spec trae una cifra esperada, la verificación tiene que
   compararse contra ella.**
2. **No confiar en el tipo declarado en el borde de un driver externo.** Ahí el tipo es una
   intención, no una garantía. Cuando el dato cruza un driver, o se serializa explícitamente
   (acá: `CAST(to_json(x) AS VARCHAR)` + parseo) o se inspecciona el valor real una vez.
3. **Una conversión con rama de fallback silenciosa merece test propio.** Cualquier función
   que pueda devolver `null` por "formato inesperado" puede devolverlo *siempre*.
   Ver `scripts/overture/__tests__/normalizacion.test.ts`.

---

## En QA en vivo, "anónimo" se confirma server-side, no con `document.cookie` (2026-07-26 · QA integral)

**Qué pasó.** El primer chequeo del gate anónimo del chat dio un falso positivo alarmante:
`POST /api/chat` devolvió **200 + respuesta de IA real** y el contador bajó 3→2, "probando" que
un anónimo podía usar el chat premium. Estuve a un paso de reportar un bypass de seguridad.

**Causa raíz.** El browser de Playwright MCP **persiste la sesión** entre corridas de QA: quedaba
logueada la cuenta `juan` de la QA de CHAT F3 (cookie de auth **httpOnly**). Dos señales
engañaron: `document.cookie` daba `[]` (no ve cookies httpOnly) y la vista `request-headers` de
Playwright **redacta el header `cookie`** — así que la request "parecía" anónima por los dos lados
que miré primero.

**Cómo se cazó.** Grounding en el código del route (`app/api/chat/route.ts`: devuelve 401 si
`!session?.user` — si dio 200, hay sesión) + `GET /api/auth/get-session` → `juan@gmail.com`. El
código no mentía; mi premisa de "anónimo" sí.

**Qué hacer distinto:**

1. **El estado de sesión se verifica con `/api/auth/get-session`**, nunca con `document.cookie`
   (ciego a httpOnly) ni con la vista de headers de Playwright (redacta la cookie).
2. **Antes de cualquier prueba de gate anónimo, limpiar sesión** con `POST /api/auth/sign-out` y
   confirmar `session == null`. El browser de QA no arranca limpio.
3. **Un 200 donde el código dice 401 es, por defecto, un problema de premisa del test**, no un
   bug del server — verificar la premisa antes de escribir el hallazgo (misma disciplina que
   "un campo puede mentir fila por fila").

---

## Sondear el schema real antes de escribir la query (2026-07-20 · CATALOGO)

**Qué pasó (bien).** Antes de escribir el import se corrió un `DESCRIBE` contra el parquet
de Overture en S3, en vez de asumir el schema desde el spec. Confirmó que `taxonomy` y
`operating_status` existían tal como el spec decía.

**Por qué vale la pena.** Un `DESCRIBE` cuesta un minuto; descubrir a mitad del import que
un campo se llama distinto cuesta la corrida entera contra S3. **En fuentes externas
versionadas, verificar primero es más barato que reintentar.**

De ahí salió también el hallazgo H-2 (`operating_status` viene NULL en todo AMBA): un dato
que el spec daba por disponible y que cambia lo que Búsqueda puede asumir. **Confirmar que
un campo existe no es lo mismo que confirmar que trae datos** — conviene mirar las dos cosas
en el mismo sondeo.

---

## Cuando el dato contradice al spec, el spec puede ser el que está mal (2026-07-20 · ZONAS)

**Qué pasó.** El QA de ZONAS cerró BLOQUEADO con un FAIL y dos PARCIAL. Ninguno era un
defecto de implementación: eran tres afirmaciones del spec desmentidas por los datos. El spec
decía que las 4 zonas de Palermo sumaban más lugares publicados que toda la región Sur (da
1.734 vs 2.598) y que los lugares sin zona estarían "en los bordes del bbox —
Escobar/Pilar/Varela" (esos tres partidos tienen **cero** sin zona).

**Qué se hizo.** Se corrigió el **spec**, no el código. ZON-05 pasó a medir densidad —que es
lo que la decisión de producto siempre quiso decir— y ahí Palermo gana 35×. Pero la corrección
se hizo **con el usuario**, no por decisión de quien implementó, y quedó registrada en el
propio spec con qué decía antes y por qué cambió.

**La regla:** el spec es el árbitro, así que quien implementó **no puede reescribirlo para que
su implementación apruebe**. Cuando el DoD y los datos se contradicen, el QA se reporta
BLOQUEADO con los números crudos y la corrección la decide el usuario. Un QA que se aprueba
solo ajustando el criterio no verificó nada.

**Corolario para escribir specs:** cuidado con meter en el DoD **predicciones** ("se espera que
los sin zona estén en los bordes") en vez de **invariantes** ("cero lugares de CABA sin zona").
Una predicción que falla bloquea un QA sin que haya nada roto. La versión corregida pide el
dato ("listar en qué localidades están"), que es lo que de verdad servía para decidir.

---

## Un campo poblado al 99,5% igual puede mentir fila por fila (2026-07-20 · ZONAS)

**Qué pasó (dos veces, en direcciones opuestas).** `places.locality` viene poblado en 25.926
de 26.057 lugares y con la granularidad justa ("Ramos Mejía", "Banfield Este"). Se usó como
oráculo de validación de los polígonos dibujados a mano, y funcionó: cazó en el primer build
que Villa Adelina cae del lado de Vicente López, no de San Isidro.

Pero en el QA, un checker marcó FAIL porque encontró 3 lugares sin zona con
`locality = 'Ciudad de Buenos Aires'`. Verificados contra el polígono oficial de los 48
barrios, **ninguno estaba en CABA**: los tres caen en La Matanza, cruzando la General Paz.

**Qué hacer distinto:** un campo de texto de una fuente externa sirve como oráculo
**agregado** (el centroide de 300 lugares de una localidad es robusto ante ruido) y no como
verdad **fila por fila**. Antes de aceptar un FAIL basado en una etiqueta, verificar contra la
geometría, que es el dato duro. Aplica también al revés: el bbox aproximado que se le pasó al
checker se extendía al sur del Riachuelo, así que "está en el bbox de CABA" tampoco probaba
nada. **La verificación buena fue la cara: 2.200 puntos contra 48 polígonos — 0 adentro.**

---

## Un criterio que solo un browser puede ver no lo cierra `/qa-spec`, y re-correrlo lo regresa (2026-07-20 · BUSQUEDA)

**Qué pasó.** El QA de BUSQUEDA cerró en PARCIAL con 11 de 12 criterios PASS. El único abierto
—BUSQ-QA-09, la vista mapa— no es verificable leyendo código: MapLibre carga teselas, dibuja
pins y clusters y abre mini-cards **solo en un browser real**. El checker de `/qa-spec` es
read-only sobre el código, así que estructuralmente no lo puede cerrar. Se verificó en una
sesión aparte con Playwright contra el ngrok del proyecto (los 5 pasos del spec), y recién ahí
el veredicto pasó a APROBADO.

**La trampa.** El checklist de `/close-spec` dice "corré `/qa-spec` una vez". Si se lo hubiera
corrido de nuevo al cerrar, el checker habría vuelto a marcar BUSQ-QA-09 como PARCIAL —porque
sigue sin poder ver el browser— **pisando la verificación en vivo** que ya estaba hecha. El
veredicto habría regresado solo por re-verificar.

**Qué hacer distinto:**

1. **Un criterio de rendering (mapa, animación, layout, permiso de dispositivo) se marca en el
   spec como "requiere QA en vivo" desde el vamos.** No es una falla del checker: es que ese
   criterio vive fuera de su alcance. El DoD puede decirlo explícitamente.
2. **La QA en vivo se corre una vez, se documenta con evidencia (screenshots + el detalle de
   cada paso en `AnalisisQA.md`), y ese registro es la fuente de verdad.** No se re-corre
   `/qa-spec` después: el gate técnico (typecheck + tests) sí se reconfirma, pero el veredicto
   de un criterio in-vivo ya cerrado no se somete de nuevo a un checker que no lo puede ver.
3. **Ojo con re-correr `next build` con el `npm run dev` levantado:** comparten `.next` y el
   build puede romper. Si el código no cambió desde el último gate verde (solo se tocó `docs/`),
   reconfirmar typecheck + tests alcanza; el build se re-corre con el server parado si hace falta.

**Corolario de herramienta.** El MCP de Playwright (`.mcp.json` con `@playwright/mcp`) es lo
que hizo verificable en vivo lo que el checker no alcanza. Para specs con UI —FICHA y Votación
lo van a necesitar— es la pieza que cierra los criterios de rendering. Los pins/clusters son
capas GL (no DOM), así que el tap se dispara con un click por coordenadas
(`page.mouse.click`), no por selector.

---

## Un test que fija el set EXACTO de columnas se rompe con toda migración aditiva (2026-07-20 · FICHA)

**Qué pasó.** F1 agregó la columna `detail_views` a `place_impressions_daily`. Un test de
integración de BUSQUEDA afirmaba que esa tabla tenía **exactamente** `['date','impressions',
'place_id']` — como guardián de "acá no hay datos por usuario". La columna nueva, que no
identifica a nadie, hizo fallar el test sin que hubiera nada mal.

**La distinción.** El invariante que el test quería proteger era "**ninguna** columna
identifica a un usuario" — eso es un **denylist** (que ninguna columna matchee
`user|ip|session|cookie|email`). Lo que estaba escrito era un **allowlist** ("exactamente
estas tres"), que además de cazar un `user_id` nuevo se rompe con cualquier columna benigna.
El allowlist confunde "no hay dato personal" con "el schema está congelado".

**Qué se hizo.** Se actualizó la aserción para incluir `detail_views` (sigue siendo un
allowlist, porque la tabla es chica y estable y el set explícito se lee bien). Pero la regla
general para el próximo:

**Cuándo cada uno.** Si el test protege una **propiedad** ("no hay PII", "no hay secretos"),
escribilo como denylist: sobrevive a columnas nuevas legítimas y sigue cazando la regresión
real. Reservá el allowlist exacto para cuando **el set completo es el contrato** y querés que
agregar cualquier cosa obligue a mirar el test — pero entonces sabé que toda migración aditiva
lo va a tocar, y eso es a propósito, no una molestia.

---

## "El rating coincide" no prueba "es el mismo local": verificar el storefront, no el atributo (2026-07-20 · FICHA F2)

**Qué pasó.** En la QA en vivo de F2 marqué FICHA-03 (matching Overture↔Google) como PASS
porque el rating que devolvió Google (4,8 · 4025) coincidía con "un" Club Milanesa. Fer
después chequeó la dirección real: Av. Libertador 3883 es **"Williamsburg Infanta"**, y el
`place_id` que matcheamos es **"El Club de la Milanesa – Paseo de la Infanta"**, a **~160 m**.
La app mostraba el rating de un local que no es el de esa dirección.

**Causa raíz del miss (no es un bug).** Es el **matching a ciegas** que la decisión 8 aceptó
a propósito: Text Search *IDs-Only* cuesta $0 pero **no devuelve nombre ni distancia**, así
que no se puede comparar la respuesta — las salvaguardas son solo de entrada (`textQuery` +
rectángulo de ±300 m). Una sucursal de la **misma marca** a 160 m entra en los 300 m y es
indistinguible sin pagar Text Search Pro ($32/1.000), que rompería el modelo $0. El código
hizo exactamente lo especificado. Riesgo **aceptado por Fer** (2026-07-20); la red es
`google_match_status='blocked'|'manual'` por `UPDATE`.

**El error de método, ese sí mío.** Aprobé un criterio de **correspondencia** verificando un
**atributo** (el rating) en vez de la **identidad** (¿es el local de esa dirección?). Es la
misma trampa de "un campo poblado al 99,5% igual puede mentir fila por fila" (ZONAS): un
atributo que coincide no prueba que la fila sea la correcta.

**Qué hacer distinto:**

1. **Para verificar un match, comparar identidad contra el dato duro** —dirección/coordenada
   del `place_id` devuelto contra las nuestras—, no un atributo lateral como el rating. Si el
   criterio dice "corresponde al lugar", la evidencia es "está en la misma dirección", no
   "tiene el mismo puntaje".
2. **Un criterio de calidad de matching se mide sobre una muestra, no sobre un caso.** Un solo
   acierto o un solo fallo no dice si la tasa es 1% o 20%. FICHA-03 pide 10 fichas a propósito;
   cerrar el criterio con la primera es cerrar sin medir.

**Corolario de producto (aparte del matching).** El nombre que muestra la ficha ("Club
Milanesa", no "El Club de la Milanesa") **sale de Overture, nunca de Google** — por ToS
(no se persiste el nombre de Google), por costo (`displayName` es tier Pro y ni se pide) y
por diseño (decisión 13: el dato propio funciona con Google caído). Un nombre abreviado o
imperfecto es calidad del dato de origen; se corrige con curaduría o con el reclamo del dueño
(spec 5), **no** trayendo el nombre de Google.

---

## Dos componentes que muestran datos de la misma request paga = doble factura (2026-07-20 · FICHA F3)

**Qué pasó (evitado a tiempo, no sufrido).** El mockup de la ficha pone la **foto** de Google
arriba (en su slot) y el **rating/horarios** más abajo, separados por el encabezado. La forma
"natural" de implementarlo —un componente cliente para la foto y otro para los datos, cada uno
con su `fetch`— habría disparado **dos** llamadas Place Details Enterprise ($20/1.000) por cada
apertura de ficha: el doble del costo, sobre el SKU más caro después de Photos.

**Causa.** La foto y los datos vienen de la **misma** respuesta de Place Details (el field mask
ya trae `photos`). Dos componentes que la piden por separado no comparten esa respuesta: son dos
requests lógicas y dos eventos facturables, aunque muestren pedazos del mismo lugar.

**Qué se hizo.** Un **shell cliente de un solo fetch**: `components/lugar/ficha-google.tsx`
envuelve el slot de foto (arriba), el encabezado **server-rendered pasado como `children`** y el
bloque de datos (abajo). Hace **un** `fetch` y reparte el resultado a las dos regiones. El
patrón RSC de pasar un server component como `children` a un client component es justo lo que
permite intercalar el header (server, con datos propios) entre dos regiones cliente sin duplicar
la request. Verificado en vivo: el panel de red muestra **una** llamada a
`/api/lugar/[id]/google` por apertura, y `google_api_usage.details` sube de a 1, no de a 2.

**La regla para el próximo (Auth/reclamo, Votación).** Cuando **una** request paga alimenta
**varias** zonas de la UI separadas en el DOM, el fetch va **una vez arriba** y se reparte
—shell con `children`, contexto, o props—, nunca un fetch por zona. "Componentes chicos y
autónomos, cada uno con su fetch" es buen default para datos gratis; sobre una API que factura
por request, es multiplicar la factura por la cantidad de componentes.

---

## Un edge case del spec puede quedar sin dueño entre dos fases (2026-07-21 · AUTH F3)

**Qué pasó.** El edge case "eliminar cuenta de un dueño" del spec pide tres cosas: bajar
`publish_override`, que el contenido de dueño deje de mostrarse y que las fotos se borren de
R2. F2 implementó la primera y **anotó explícitamente en sus notas** que "el resto del edge
case (contenido de dueño, fotos de R2) es F3". F3 arrancó con un alcance escrito en términos
de pantallas y endpoints —panel, editor, R2, huecos en la ficha— donde esas dos deudas **no
aparecían por ningún lado**. Se encontraron leyendo el spec entero de nuevo a mitad de la
implementación, no por la lista de tareas.

**Por qué importa.** El agujero no era teórico: sin la parte del contenido, revocarle el
reclamo a alguien le dejaba el teléfono publicado en la ficha **para siempre**. Y ninguna de
las dos habría salido en el QA de F3, porque el QA se arma contra el alcance de la fase.

**La causa.** Una nota de fase que dice "esto lo hace la fase siguiente" es una deuda sin
dueño: vive en la sección de **otra** fase, así que ni el alcance de F3 ni su DoD la
mencionan. El único lugar donde estaba escrita era el párrafo que la difería.

**La regla.** Al arrancar una fase, **buscar en el spec entero las deudas que las fases
anteriores difirieron a ésta** —grep de "es F3", "queda para", "la fase siguiente"— y sumarlas
al alcance antes de empezar. Y al diferir algo, escribirlo **en las dos puntas**: en la nota de
la fase que lo difiere *y* en el alcance de la fase que lo recibe. Un ítem que solo existe en
el párrafo que lo pospone es un ítem que nadie va a implementar.

---

## Un cap que se cuenta y después se inserta no es un cap (2026-07-21 · AUTH F3)

**Qué pasó.** El límite de fotos por plan (3 free / 15 pago) arrancó como el patrón obvio:
contar cuántas hay, comparar contra el cap, subir a R2, insertar la fila. Con dos uploads
simultáneos del mismo lugar y 2 fotos cargadas, los dos cuentan 2, los dos pasan, y el plan
free termina con 4 fotos. La ventana es chica pero el límite es exactamente lo que no puede
fallar: **subir un cupo es un regalo; bajarlo es una traición**, así que una foto de más
regalada por una carrera no se puede sacar después sin romper la promesa.

**Por qué el retry no alcanza.** Mover el conteo adentro de la transacción tampoco cierra:
bajo `READ COMMITTED` cada transacción ve su propio insert y no el de la otra, así que las dos
cuentan 3 sobre un cap de 3 y las dos commitean.

**Qué se hizo.** `SELECT ... FROM places WHERE id = $1 FOR UPDATE` al entrar a la transacción,
antes de contar: bloquea la fila del lugar y serializa los uploads **de ese lugar** (no de la
tabla). Dos líneas, sin tabla de locks ni advisory locks, y el cap pasa a ser real. El
pre-chequeo barato se mantiene igual, pero por otro motivo: evitar un PUT a R2 que va a
rebotar.

**La regla para el próximo (Votación, Monetización).** Todo límite de negocio que se verifica
leyendo y se aplica escribiendo necesita **el lock de la fila que lo ancla**, no solo la
transacción. "Contar y después insertar" es correcto solo si nadie más puede insertar en el
medio, y eso hay que garantizarlo, no suponerlo. Si el límite se puede pasar por una carrera,
no es un límite: es una sugerencia con buena intención.

---

## Un valor que depende del reloj no se calcula en el render (2026-07-22 · AUTH F4)

**Qué pasó.** El "Abierto ahora / Cerrado ahora" de la ficha depende de la hora actual. La
tentación es calcularlo directo en el render con `estaAbierto(horarios, new Date())`. Pero la
ficha es un componente cliente que **también** se renderiza en el server (SSR): el server
calcula con SU reloj, el cliente re-hidrata con el suyo, y si el minuto cruzó un borde de
apertura entre ambos, el HTML del server y el del cliente no coinciden — hydration mismatch.

**Qué se hizo.** El estado abierto/cerrado se calcula **después de montar** (`useEffect` que
setea `new Date()` en estado): en el primer render —server y cliente— vale `null` y no se
pinta el punto, y recién tras la hidratación aparece. La **semana** (las líneas de horario) no
depende de la hora, así que esa sí se pinta directo en el server, sin riesgo. Dos verdades
separadas: lo determinista se puede prerenderizar; lo que depende del "ahora", no.

**Los otros dos cuidados del cálculo de horarios, para el próximo (filtro "Abierto ahora").**
(1) Un rango que **cruza la medianoche** (`20:00–02:00`) pertenece al día en que abre: para
saber si está abierto a la 01:30 hay que mirar los rangos de **ayer**, no solo los de hoy. Es
el caso que más fácil sale mal y por eso `estaAbierto` es una función pura con **tabla de
tests** (lunes 23:00, martes 01:30, martes 03:00, salto domingo→lunes), no lógica adentro de un
componente. (2) La zona horaria se fija explícita (`America/Argentina/Buenos_Aires` vía `Intl`),
nunca el reloj de quien mira: un turista en otra TZ tiene que ver el mismo estado que un local.

---

## Una cookie httpOnly no se puede setear en el render de un Server Component (2026-07-22 · VOTACION)

**Qué pasó (decisión de diseño, no un bug).** La decisión 7 del spec dice "al abrir el link se
setea la cookie `voter_id` (httpOnly)". La forma literal —crearla en el render de
`app/votacion/[token]/page.tsx`— **no es posible**: un React Server Component no puede escribir
cookies (solo leerlas), y el proyecto no tiene `middleware.ts` (AUTH decisión 9), que sería el
otro lugar donde setearla al entrar. Y como es `httpOnly`, el cliente tampoco puede crearla.

**Qué se hizo.** La cookie se crea en el **primer voto** (el `POST` del route handler, que sí
puede escribir cookies). Antes de votar el dispositivo no tiene identidad, y no la necesita: el
anti-doble-voto se ancla a la cookie que nace justo cuando hay un voto que deduplicar. Al reabrir
el link, la cookie ya existe y se lee server-side para marcar la opción votada. Funcionalmente
idéntico a "setearla al abrir", sin sumar middleware por esto. La divergencia quedó anotada en el
código (`voto/route.ts`) y en SPECS_ARCHIVO.

**La regla para el próximo (spec 7 y cualquier feature con identidad anónima o cookie funcional).**
Si una cookie tiene que ser `httpOnly`, el único lugar que la puede crear es un **Route Handler o
Server Action** (o `middleware.ts` si existe) — nunca el render de una página. Antes de escribir
"al entrar se setea la cookie X" en un spec, verificar que haya un boundary de escritura en ese
momento; si el único evento server es un `POST` posterior, la identidad se crea ahí y el spec debe
decirlo. Setear la cookie "al abrir" **exige** middleware, y sumarlo es una decisión aparte.

---

## Un PNG "transparente" de un generador de IA puede tener el damero horneado (2026-07-23 · HOME_IDENTIDAD)

**Qué pasó.** Para el logo se recibió un `logo.png` que en el visor se veía con fondo transparente
(el clásico damero gris/blanco). Pero al inspeccionarlo: **color type 2 (RGB, sin canal alfa)** y
las esquinas eran píxeles opacos alternando `#F0F0F0`/`#FFFFFF` — el damero estaba **pintado en la
imagen**, no era transparencia real. Puesto sobre el fondo oscuro de la app habría mostrado una
caja gris a cuadros alrededor del logo. Los generadores de imágenes (ChatGPT/DALL·E incluidos)
suelen "dibujar" el fondo de transparencia en vez de exportar alfa real. El segundo intento
(`logo_2.png`) sí vino bien: **color type 6 (RGBA)**, esquinas alfa=0.

**La regla.** Antes de usar un PNG "transparente" que vino de afuera, **verificar la transparencia
de verdad**, no confiar en cómo se ve en el visor (el visor dibuja damero tanto para alfa real como
para un damero horneado). Chequeos baratos: el **color type del IHDR** (byte 25: 6 = RGBA, 4 =
gray+alpha; 2 o 0 = **sin alfa**), y muestrear el alfa de las esquinas (`GetPixel().A` debe ser 0).
Si el "fondo" son píxeles opacos, pedir de nuevo el asset con alfa real (o recortarlo). Vale además
para el matte: aun con alfa real, las zonas transparentes pueden traer color residual en el RGB
(glow) — inocuo en web (el navegador respeta el alfa) pero problemático si algún día se aplana
sobre fondo claro.

## Un mensaje de error portado puede traer lenguaje de sandbox a producción (2026-07-24 · MONETIZACION F2)

**Qué pasó.** El mapeo de errores de MercadoPago (`lib/billing/mp-errors.ts`) se **portó de
StressPlan** con los mensajes tal cual. Uno de ellos, para el código antifraude `CC_VAL_433`,
decía al usuario final: *"Esperá unos minutos y probá de nuevo con el comprador de prueba,
titular APRO"*, y otro sugería números de tarjeta de test (`5031 7557 3453 0604`…). En el
sandbox eso es útil. En **producción**, un cliente real con una tarjeta genuinamente rechazada
vería instrucciones de QA sin sentido ("¿qué comprador de prueba?"). Los tests unit incluso
**afirmaban** esas frases (`expect(msg).toMatch(/APRO/)`), así que blindaban el bug en vez de
detectarlo. Lo encontró el **usuario mirando el mensaje real** durante el QA en vivo de MONE-04.

**La regla.** Al portar mensajes de cara al usuario desde otro proyecto, **releerlos como los
lee un cliente en producción**, no como los lee un dev en sandbox. La guía de test (tarjetas,
titulares `APRO`/`OTHE`, "comprador de prueba") va en **comentarios**, nunca en el string que
llega a la UI. Y el test tiene que **prohibir la fuga**, no fijarla: la aserción correcta es
`expect(msg).not.toMatch(/APRO|comprador de prueba|\d{4} \d{4}/)`, no una que exija esas frases.
Reafirma [[qa-en-vivo-encuentra-lo-que-los-tests-no]]: el copy solo se juzga leyéndolo, y un
test escrito sobre el bug lo perpetúa.

---

## Un segundo escritor concurrente a la misma tabla necesita orden de locking, o deadlockea (2026-07-25 · MONETIZACION F3)

**Qué pasó.** F3 sumó `registrarDestacados` como segundo `after()` que upsertea
`place_impressions_daily`, tabla que ya escribía `registrarImpresiones`. Los dos batches
multi-fila comparten filas (los destacados están en las dos listas) y las lockeaban en
**distinto orden** — así que entre dos requests simultáneos cada transacción esperaba una fila
que la otra tenía: **`deadlock detected (40P01)`**. Como el helper es best-effort
(`try/catch` que loguea y sigue), la pantalla nunca falló, pero cada upsert deadlockeado
**rollbackeaba su increment**. El `featured_impressions` venía corto en la QA y se lo atribuí a
"latencia del `after()`" — era mitad latencia, mitad datos perdidos.

**Por qué no lo cazó nada.** Los tests de integración corrían los helpers **en serie**: un
upsert por vez nunca se pelea consigo mismo. El deadlock solo aparece con **concurrencia real**,
que es exactamente lo que produce el server bajo tráfico (varios `after()` en paralelo) y lo que
un test serial no modela. Lo vio el usuario en la **consola del server** durante el QA en vivo.

**La regla.**

1. **Todo upsert multi-fila sobre una tabla con más de un escritor concurrente ordena el batch
   por su clave de conflicto** (acá `place_id`, o `(place_id, tag_id)`). Con un orden de locking
   global y estable, dos transacciones que comparten filas las toman siempre en la misma
   dirección → no hay ciclo. Es una línea (`.sort()`) y elimina la clase entera.
2. **Un `try/catch` best-effort esconde un deadlock como si fuera un no-op.** "No rompe la
   pantalla" no es "no perdió datos". Si el contador que no se puede reconstruir cae bajo un
   catch silencioso, el error hay que **mirarlo** (consola/observabilidad), no solo tragarlo.
3. **La concurrencia se testea con concurrencia.** La regresión (`destacados.integration.test.ts`)
   dispara N upserts solapados en orden **opuesto** con `Promise.all` y afirma el conteo
   **exacto** — un increment perdido por deadlock la hace fallar. Un test serial nunca la habría
   visto. Reafirma [[qa-en-vivo-encuentra-lo-que-los-tests-no]].

## Un diagnóstico de geometría "a ojo" mandó una prioridad #1 entera por el camino equivocado (2026-07-26 · ZONAS)

**Qué pasó.** Fer reportó que buscar parrillas por zona traía lugares de "zonas no
adyacentes". Un diagnóstico read-only previo concluyó que `place_zones` tenía asignaciones
**"geométricamente imposibles"** y lo priorizó como **bug #1** con sesión propia. Al
investigar midiendo, **no había bug**: las 12.122 filas no-primarias estaban **todas ≤400 m**
del borde de su zona — la decisión 5 (buffer de 400 m) funcionando como se especificó. La
sesión #1 no arregló nada porque no había nada roto.

**Causa raíz del diagnóstico errado.** Dos afirmaciones geométricas hechas **sin medir**:
(1) "`la-boca-barracas` = La Boca + Barracas, y Almagro no linda con eso" — falso: la zona son
**4 barrios** (incluye Nueva Pompeya + Parque Patricios), que **sí** lindan con Boedo y Parque
Chacabuco. Bastaba abrir `composicion.ts:48`. (2) "Palermo y Caballito están a mucho más de
400 m" (ítem del escape-room) — falso: 186 m y 359 m, dentro del buffer. Era una estimación
visual sobre un mapa mental, no una distancia calculada.

**Por qué no lo cazó nada.** El diagnóstico era read-only y "razonado", así que se leyó como
confiable — pero razonar sobre geometría sin turf es adivinar. El bbox de ~12 km de
la-boca-barracas se leyó como "sospechoso" cuando era **correcto** (4 barrios). Nadie corrió
un `pointToLineDistance` hasta esta sesión; ahí el "bug" se evaporó en tres mediciones.

**La regla.**

1. **Una afirmación de distancia o adyacencia en un diagnóstico geométrico es un número, no
   una intuición: se mide con turf (`pointToLineDistance`, `booleanPointInPolygon`) antes de
   escribirla.** "Está lejos", "no linda", "es imposible" sobre coordenadas son hipótesis hasta
   que hay un metraje al lado.
2. **Antes de creerle a un diagnóstico que define la composición de un dato, abrir la fuente
   de esa composición.** Acá `composicion.ts` decía en una línea que la zona eran 4 barrios; la
   premisa entera del bug caía con leerla. Reafirma [[qa-en-vivo-encuentra-lo-que-los-tests-no]]:
   la data real desmiente al relato.
3. **Cuantificar la escala ANTES de causa-raíz y priorización.** El primer paso barato
   (auditar las 12.122 filas: ¿cuántas violan el buffer?) habría dado **cero** y evitado
   priorizar como #1 una sesión de fix de algo que no existía. Medir la escala primero es lo
   que separa un bug de un malentendido.

## Un test de integración que "limpia" la tabla del mes real borra datos de verdad (2026-07-26 · COSTOS_ADMIN)

**Qué pasó.** El primer render del tablero de costos mostró el cupo del chat en 0/5.000 con 20
mensajes assistant reales en el mes. No era bug del tablero: `cupo.integration.test.ts:64` hace
`db.delete(aiApiUsage)` de la fila del **mes calendario real** como setup/cleanup, así que cada
corrida de la suite contra el Postgres de dev resetea el contador del kill switch (CHAT_IA
decisión 15). La suite había corrido dos veces ese día después del QA del chat.

**Causa raíz.** El test usa la clave natural real (`to_char(current_date,'YYYY-MM')` + sku) en
vez de una clave sintética, y su "limpieza" no distingue filas propias de filas de producción-dev.
241 tests verdes y el contador mentía — variante nueva de "el QA en vivo encuentra lo que los
tests no": esta vez lo encontró un **tablero**, mirando la tabla que los tests pisan.

**Cómo evitarlo.** Tests de integración que escriben tablas compartidas: (a) clave sintética que
no colisione con datos reales (un mes imposible), o (b) guardar y restaurar el valor previo en
setup/teardown. Nunca `delete` por la clave del período corriente. El fix puntual quedó como ítem
en BACKLOG § Mejoras futuras.

## El click sintético de Playwright puede no disparar un handler de React sin dar error (2026-07-27 · PULIDO · ampliada 2026-08-03 · PULIDO_BETA F1)

**Qué pasó.** En el QA en vivo de `/chat`, `browser_click` sobre el botón "Enviar" (y sobre los
chips de sugerencia con `onClick={() => enviar(s)}`) no disparaba ningún `POST /api/chat`: sin
error de consola, sin overlay bloqueando, el botón aparecía habilitado en la screenshot, y
`document.elementFromPoint` sobre el centro del botón confirmaba que no había nada tapándolo.
Varios reintentos (re-snapshot, `Escape` + click con `force:true`, `Enter` en el textarea)
tampoco dispararon el request.

**Qué lo resolvió.** Despachar el click directamente en la página con
`page.evaluate(() => btn.click())` (vía `browser_run_code_unsafe`) sí disparó el `onClick`/
`onSubmit` de React y el `POST /api/chat` salió con 200. El mismo flujo funciona con un click
real de usuario — no es un bug de la app ni del componente.

**Causa probable (no confirmada).** El click sintético de CDP en este entorno (ngrok + una
extensión de Kaspersky inyectando scripts en la página, visible en `browser_network_requests`)
puede no completar el ciclo `pointerdown`/`pointerup` que React espera para el evento sintético
de `click`, aunque el DOM reporte el elemento como clickeable.

**Cómo evitarlo la próxima vez.** En QA en vivo de `/chat` (o cualquier form con `onSubmit`/
`onClick` crítico) que no reaccione a `browser_click` sin error visible: no asumir que el flujo
está roto — probar `element.click()` vía `page.evaluate`/`browser_run_code_unsafe` antes de
diagnosticar un bug de la app.

**Ampliación (2026-08-03, `PULIDO_BETA` F1): NO es solo el form del chat.** Escrita como estaba, la
lección se lee como un caso particular de `<form onSubmit>`, y por eso la auditoría de recorridos la
descartó al toparse con lo mismo en otra pantalla. Falló igual, sin error y sin request, en: el
**botón de guardar de una card** del listado (`aria-label="Guardar"`), el **«+»** del sheet *Sumar un
lugar* de una votación, y **«Es mío»** de `/registrar-negocio`. Estuvo a un paso de anotarse como un
BLOQUEANTE falso («guardar no guarda»).

**La regla, en una línea:** en QA en vivo de esta app, **cualquier control se toca con
`element.click()` vía `evaluate`** — `browser_click` reporta éxito igual, así que la única señal
confiable de que la acción ocurrió es la **consecuencia** (una request en `browser_network_requests`,
un cambio de estado en pantalla, o una fila en la base), nunca el resultado de la herramienta. Para
inputs controlados por React, el equivalente es el setter nativo:
`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v)` +
`dispatchEvent(new Event('input',{bubbles:true}))`. Y sigue valiendo la lección de arriba (*tipear no
es enfocar*): si el handler depende de `onFocus`, hay que enfocar aparte.

## Un auto-apply "aditivo" que reusa un `delete`-then-insert de reemplazo borra lo de la tanda anterior (2026-07-27 · CURADURIA F3)

**Qué pasó.** La decisión 13 pidió que el batch masivo, además de guardar sugerencias,
**auto-aplicara** las que tienen evidencia a `place_tags` (`source='admin'`, `accepted`),
"reusando el criterio de `guardarCuraduria`". Esa función —la de la cola manual— hace
`delete` de todas las tags `admin` de las facetas editables y **reinserta** solo las tildadas:
es semántica de **reemplazo total**, correcta ahí porque el humano re-envía el set completo
(el "corregir/destildar"). Copiar ese `delete` tal cual al batch habría sido un bug silencioso:
la corrida es **por zona y por tanda**, y una zona se puede correr de nuevo (idempotencia) o
en tandas que comparten lugares. El `delete` global de admin habría **borrado los tags
auto-aplicados en una corrida anterior** del mismo lugar antes de reinsertar solo los de la
corrida actual.

**Qué lo resolvió.** Se reusó solo la mitad segura del criterio: la **escritura** a `place_tags`
(admin + `onConflictDoNothing`, para que una fila `import` gane si ya está), **sin** el `delete`.
El auto-apply es puramente **aditivo** y se apoya en el `.returning()` del upsert de sugerencias:
solo se aplican las filas que el `onConflictDoNothing` realmente insertó. Una sugerencia que ya
existía —`accepted` o `rejected` por Fer en el piloto— no vuelve en `.returning()`, así que jamás
se re-aplica ni pisa una decisión humana. Verificado en vivo: re-curar las 2 zonas piloto con
Sonnet dejó sus 5 `accepted` + 4 `rejected` (Haiku) exactos y solo **agregó** lo nuevo.

**Cómo evitarlo la próxima vez.** "Reusar el criterio de X" no es "copiar la función X entera".
Cuando una función tiene semántica de **reemplazo** (delete-then-insert sobre un set que el
llamador re-declara completo) y se la quiere reusar en un contexto **aditivo/idempotente**,
separar la parte de escritura de la parte de borrado, y declarar la divergencia explícitamente
(quedó en el docstring de `lib/curation/suggestions.ts` y en el QA). La señal de que estás en
contexto aditivo: el mismo registro se puede procesar más de una vez (re-corridas, tandas que
solapan) sin que el llamador re-declare el estado deseado completo.
