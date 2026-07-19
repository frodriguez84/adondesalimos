# IDEAS — A Dónde Salimos

Volcado crudo de la conversación de producto, organizado por temas. **Este archivo es la
fuente de verdad del traspaso entre sesiones** (regla en `CLAUDE.md` § Continuidad entre
sesiones). Se actualiza *durante* la conversación, no al final.

Convención de marcado — nada se lee como cerrado si no lo dice explícitamente:

- ✅ **DECISIÓN TOMADA** — cerrado; solo se reabre a pedido del usuario
- 💡 **IDEA SIN DECIDIR** — sobre la mesa, sin compromiso
- ❓ **PREGUNTA ABIERTA** — necesita respuesta del usuario o análisis

Cuando un bloque de temas madura lo suficiente, se propone pasarlo a spec con `/new-spec`
(no antes).

---

## Concepto general

- ✅ La app sirve para **decidir a dónde ir** según lo que escriba el usuario + una tanda
  de filtros. Es de **descubrimiento puro**: muestra teléfono, dirección, horarios, link —
  **no se reserva nada** desde la app; el resto corre por cuenta del usuario.
- ✅ Inspiración: adondevamos.com, una web de hace 15-20 años que hacía esto y desapareció.
- ✅ **Mobile-first**: la gran mayoría del uso va a ser en celular, muy poco en PC. Debe
  estar adaptada y muy optimizada para móvil.
- 💡 Los **filtros van a ser el fuerte de la app**. Ejemplos: Gastronomía / Juegos de mesa /
  Bar temático; Restaurante + comida pakistaní / árabe / etc.; Stand Up + Bar.
- ✅ **Taxonomía de filtros curada** (opción C): las primeras categorías/tags las creamos
  nosotros; después Fer agrega las que falten y las que **sugieran usuarios y sobre todo
  dueños** (que son los que saben de SU negocio). Los usuarios eligen del árbol, no crean
  tags libres; las sugerencias pasan por aprobación.
- ✅ Búsqueda **clásica** para arrancar: campo de texto (matchea nombres/categorías) +
  filtros. La búsqueda por **texto libre con IA** (LLM traduce "algo tranqui con comida
  árabe" → filtros) **queda para más adelante**: al usuario le "re copa", pero se posterga
  y se retoma cuando se hable de monetización — la idea es que la monetización solvente el
  costo de la API de Claude.
- ✅ **Alcance geográfico: AMBA** (CABA + conurbano; no la provincia entera). CABA sola
  quedaba corta — hay muchas cosas buenas en AMBA.

## Diseño / UX

- ✅ **Regla fundamental: la app debe ser absurdamente intuitiva.** Muy fácil de usar, cero
  fricción, super entendible — eso decide si la gente la usa o la abandona. Aplica en
  particular a la **búsqueda** y a la **lectura de resultados**.
- ✅ Mobile-first (ya decidido en Concepto general).
- ✅ **Identidad visual calibrada** con referencias del usuario (le gustan: Neon/neon.tech,
  GR-IT/grit.com.ar, Notion, InShot, Mobbin; no le gusta: la app de MercadoPago):
  **minimalismo con carácter** — pocas cosas por pantalla, mucho aire, jerarquía clarísima,
  un solo acento de color, tipografía confiada, cards nítidas, cero banners/ruido.
- ✅ **Un solo tema al lanzamiento: OSCURO** (identidad nocturna del rubro; el claro se
  suma después si hace falta). Nada de mantener dos temas en v1.
- ✅ **Tono del copy: canchero y divertido, pero CERO emojis.** Rioplatense cercano
  (estilo "¿Y? ¿A dónde salimos?"), nunca corporativo acartonado.
- 💡 **Branding/paleta en definición** — el usuario no tiene marca pensada y pidió ayuda.
  Su brief verbal: "algo oscuro, que dé a salida de noche, barcito, amigos, baja luz".
  Recorrido: ronda 1 (ámbar s/marrón, violeta, verde+dorado) descartada — evitar marrones,
  aceituna y violetas; ronda 2 (hora azul, teal, coral s/petróleo) tampoco convenció.
  - ✅ **Dirección elegida: "Luz de bar" sobre FONDO NEGRO como StressPlan.** Dato: StressPlan
    ya usa exactamente eso — fondo `#0F0F0F`, cards `#1A1A1A`, primary ámbar `#F59E0B`.
  - ✅ **PALETA ELEGIDA (2026-07-19): "Ámbar StressPlan"** — fondo `#0F0F0F`, cards
    `#1A1A1A`, acento ámbar `#F59E0B`, texto `#F5F5F5`. Mismo sistema de color que
    StressPlan → los componentes que se roben ya vienen "vestidos".
    Muestra: https://claude.ai/code/artifact/e572380c-ffae-43b5-8a2f-3ff6ba9748b1
- ✅ **El branding es revisable**: la paleta elegida es base de trabajo, no compromiso. La
  app se construye con **design tokens** (variables CSS / theme Tailwind, como StressPlan)
  y sin colores hardcodeados en componentes — cambiar la paleta entera = tocar ~6 variables.
  Lo único caro de cambiar es post-lanzamiento y es nombre/logo/dominio, no los colores.

## Búsqueda por ubicación

- ✅ **Default: el usuario elige zona/barrio** (fundamental). En AMBA la distancia manda —
  nadie viaja de Quilmes a Tigre por una hamburguesa.
- ✅ **"Cerca de mí" (GPS) como opción secundaria** — toggle/botón; raro que se use pero
  no se niega.
- ✅ Al activar "cerca de mí", el **GPS reemplaza a la zona elegida** (opción a): un toggle
  = un comportamiento obvio. No se combinan criterios.

## Alcance de tipos de negocio

- ✅ Entran: gastronomía (restaurantes, bares, cafés) y actividades (stand up, teatro,
  juegos de mesa, bares temáticos, etc.).
- ✅ Quedan **afuera**: ferias itinerantes / eventos de días específicos (tipo BA Market).
- 💡 Complejos de salas (ej. Complejo La Plaza para teatro/stand up): aparece el complejo
  como resultado y se muestra el **link del lugar** para que el usuario siga la búsqueda ahí
  adentro. No se listan las obras/funciones individuales.

## Fuentes de lugares (3 orígenes)

1. ✅ **Google** (lo más fiable) — ✅ **Places API (New)**. Investigación **COMPLETA** en
   `docs/product/investigacion-google-places-2026-07-19.md` (verificada 2026-07-19 contra
   fuentes oficiales). 💡 **El rol de Google queda en revisión** — ver "Arquitectura de
   datos" abajo: los ToS + precios empujan a que Google sea *enriquecedor*, no catálogo.
2. ✅ **Dueños de local** — registran su negocio: dirección, tipo de negocio, qué se hace,
   qué se come, todo lo relacionado. Funciona **en paralelo** a Google: en una búsqueda
   aparecen mezclados los resultados de Google y los cargados por dueños.
3. ✅ **Consumidores — FUERA DE v1** (decidido 2026-07-19). La idea: un usuario descubre un
   lugar que no está y lo registra. Se posterga por el riesgo de lugares falsos, que
   obligaría a construir todo un sistema de moderación/reportes antes de tener usuarios
   reales que lo justifiquen. v1 arranca con Google + dueños, que ya dan catálogo
   suficiente. Mitigación pensada para cuando se retome: comentarios de otros usuarios +
   indicador "existe / es real"; al 5to-6to reporte, banner "muchos usuarios dicen que no
   existe".

### Arquitectura de datos — hallazgos de la investigación (2026-07-19)

Los cinco hechos verificados que condicionan el diseño (detalle y citas en el doc de
investigación):

- ✅ **Solo `place_id` se puede persistir** indefinidamente. Nombre, dirección, teléfono,
  horarios, rating: **prohibido cachearlos**. Fotos: ni siquiera se puede guardar el
  identificador de la foto.
- ✅ **La ficha completa que definimos es tier Enterprise** = $20/1.000, con solo **1.000
  gratis/mes**. Ojo: `displayName` (el nombre del lugar) ya es tier Pro.
- ✅ **Se factura por request, no por lugar devuelto** — una búsqueda que trae 20 lugares
  es 1 solo evento. La búsqueda no es el problema.
- 🔴 **Cada foto mostrada es una request facturable** ($7/1.000, **1.000 gratis/mes**).
  Una lista de 20 cards con foto = 21 eventos. **50 búsquedas agotan el cupo gratis
  mensual de fotos.** Es el mayor multiplicador de costo de toda la app.
- ✅ **El crédito de USD $200/mes ya no existe** (desde marzo 2025): son cupos por SKU.

✅ **ARQUITECTURA DECIDIDA (2026-07-19)** — invertir el rol de Google: **catálogo propio
persistido** (Overture/FSQ + lugares de dueños + `place_id` como clave) → **buscar y
filtrar gratis en Postgres con la taxonomía propia** → **Google solo al abrir la ficha**,
para horarios y rating. Google deja de ser el catálogo y pasa a ser el enriquecedor.

- ✅ **DECIDIDO — el listado va SIN foto de Google.** Cards con nombre, tags propios, zona
  y rating; la foto de Google aparece solo al abrir la ficha. Las fotos de dueño sí se
  muestran siempre (son propias y gratis, y le dan valor a la suscripción B2B).
  **Motivo — la cuenta a 5.000 búsquedas/mes**: foto en cada card ≈ **$693/mes** vs foto
  solo en ficha ≈ **$3,50/mes**. Doscientas veces más caro por una decisión visual.
  Bonus: coincide con el "minimalismo con carácter" ya elegido.
- ❓ **BLOQUEANTE — cobertura de Overture/FSQ en AMBA sin verificar.** Ninguna publica
  desglose por país. Referencia medida: OSM tiene **5.938 gastronómicos en CABA**, pero
  con solo 17% de horarios y 12% de teléfonos. **Tarea concreta**: bajar el extract de
  Overture para el bbox de AMBA con DuckDB y contar (una tarde de trabajo).
- ❓ **Leer a mano el ToS §3.2.3(b) y §3.2.4** — las páginas del contrato se truncaron en
  la investigación; lo verificado viene de páginas de Google que las citan, no del
  contrato. Hacerlo antes de comprometer la arquitectura de datos.
- ✅ **Atribución obligatoria**: logo de Google al mostrar datos sin mapa; crédito al autor
  en fotos/reviews. ("Powered by Google" NO es el wording correcto.)

## Presentación de resultados

- ✅ **Lista como default + botón "ver en mapa"** (opción C, acordada por ambos): la lista
  (cards con foto, nombre, tags, rating, zona) sirve para comparar; el mapa responde "qué
  hay por acá". Patrón conocido (Airbnb, TheFork) = cero curva de aprendizaje.

## Reviews y ficha de lugar

- ✅ **La app NO tiene reseñas ni puntuación propias** _(por ahora — revisable)_. Se muestra
  el **rating de Google** cuando el lugar viene de Google _(por ahora)_. Los comentarios de
  usuarios quedan solo como mecanismo de verificación de existencia (lugares cargados por
  consumidores).
- ✅ Principio de la ficha: **"simple no es pobre"** — info suficiente para que el usuario
  decida, sin ruido.
- ✅ La ficha muestra: teléfono, dirección, horarios, link del lugar, **rango de precios**
  y **redes sociales del lugar**.
- ✅ **Fotos: prioridad dueño → fallback Google.** Si el dueño reclamó la ficha y subió
  fotos, se muestran las suyas; si no, las de Google. Nota técnica: las fotos de Google se
  cobran por request y NO se pueden persistir; las del dueño son propias y gratis.
- ✅ **Botón "cómo llegar"**: deep link a Google Maps — saca fricción, cero costo,
  coherente con "la app no reserva, te empuja a ir".

## Pantallas (inventario inicial)

💡 Primer volcado del usuario (2026-07-19) — inventario, no diseño; sin orden de prioridad:

- Login · Registro · Recupero de contraseña · Cambio de contraseña
- ✅ **Sin landing separada: el Home ES la entrada** (adondesalimos.com.ar cae directo en
  el buscador). 💡 Excepciones puntuales posibles: página "próximamente" pre-lanzamiento
  y una página `/premium` para vender la suscripción.
- ✅ **Home = Search, misma pantalla, para todos.** El usuario logueado usa el MISMO
  buscador; la sesión agrega capacidades (armar votación, suscribirse, Mi cuenta), no
  cambia la pantalla.
- Search **sin IA** (v1) y **con IA** (premium, después)
- Resultado de búsqueda (lista default + vista mapa)
- Wizard con IA
- Card / ficha de cada resultado
- `/admin` (Fer)
- Panel del dueño ("Mi negocio")
- Mi cuenta — datos del usuario; posibles tabs: datos, pagos/suscripción, eliminar cuenta

✅ **Faltantes validados (2026-07-19)** — entran a v1:

- **Crear votación** · **Votar como invitado** (sin cuenta, vía link) · **Resultado de
  votación** — consecuencia directa de la feature ya decidida.
- **Registrar / reclamar negocio** — el flujo por el que se gana el rol dueño.
- **Verificación de email** — anti-abuso ya decidido.
- **Checkout premium (MercadoPago)**.
- **Términos y privacidad** — no opcional si se cobra con MP y se guardan datos personales.
- **404 amigable**.
- **Cola de aprobación de dueños dentro de `/admin`** — la aprobación manual ya decidida
  necesita su pantalla.
- **Estadísticas de la ficha en el panel del dueño** — es lo que justifica la suscripción
  B2B. Puede ser una sección del panel, no pantalla aparte.

❌ **FUERA de v1**: **cargar lugar nuevo (consumidor)** — ver "Fuentes de lugares" §3.

## Usuarios y roles

- ✅ Tres roles:
  1. **Consumidor** — el que busca a dónde ir.
  2. **Dueño de local** — registra su negocio.
  3. **Admin** (el usuario/Fer) — panel en ruta `/admin` con todas las estadísticas de la app.
- ✅ Va a hacer falta **login** al menos para cargar lugares (dueños y consumidores).
- ✅ **El consumidor que solo busca navega anónimo** — la cuenta se pide únicamente para
  cargar lugares / comentar. _(Revisable más adelante: si hace falta más data para el panel
  de estadísticas, se puede pasar a registro para todos.)_
- ✅ **Registro único, sin elección de rol** (opción B): todos se registran igual y son
  consumidores por default. El rol **dueño se gana con una acción**: "Registrá tu negocio"
  (lugar nuevo) o "¿Es tu negocio? Reclamalo" (lugar ya existente, ej. venido de Google) —
  mismo flujo con dos entradas. La cuenta dueño conserva también el rol consumidor.
- ✅ Ambas entradas del flujo dueño terminan en una **cola de aprobación manual del admin
  en `/admin`** (al menos al principio; verificación automatizada = versión 2).
- ❓ Cómo **verificar dueños** más allá de la aprobación manual (que el que reclama sea el
  dueño real) — mecanismo automatizado sin resolver, no bloquea el arranque.
- ✅ **Panel del dueño propio ("Mi negocio"), separado del `/admin`**. Tres niveles:
  consumidor (ficha pública) → dueño (panel de SU negocio: editar ficha, fotos,
  estadísticas, suscripción) → admin/Fer (ve todo).

## Testing / QA

- ✅ **Playwright** para pruebas QA en vivo.

## Stack y arquitectura

- ✅ Mismo stack que StressPlan — Next.js + TypeScript + Drizzle ORM + Tailwind CSS + Vitest.
- ✅ BD: **Postgres en Docker Desktop para desarrollo local**; en producción **Neon**.
- ✅ Auth: **better-auth** (replicar StressPlan). Encaja con registro único + roles que se ganan.
- ✅ Hosting: **Vercel** (aún no deployado; decisión tomada).
- ✅ Pagos: MercadoPago (ver Monetización).
- ✅ **Dominio: adondesalimos.com.ar** — ya comprado en NIC Argentina.
- ✅ **Cloudflare** (DNS/proxy) + **Resend** para mails — tal cual StressPlan.

### Reuso desde StressPlan (código/lógica para robar)

- ✅ Integración MercadoPago suscripciones (billing checkout/cancel, webhook, sync admin).
- ✅ Prompt + chat behavior del chat IA.
- ✅ Email verificado obligatorio + rate limit por IP/dispositivo.
- ✅ Setup de better-auth.

## Monetización

_Tema abierto — el usuario avisó que requiere mucha charla. Dos vías confirmadas como
dirección, detalles sin cerrar:_

- 💡 **Vía B2B — dueños pagan por destacar su lugar.** Tensión a cuidar (señalada por
  Claude, compartida): si los destacados ensucian los resultados se pierde la confianza en
  la app — deben estar claramente marcados y acotados.
- 💡 **Vía B2C — premium para consumidores**, centrado en IA:
  - Chat con IA que sugiere lugares según lo que el usuario pida, con **mensajes limitados
    según plan**.
  - Modo wizard: la IA hace preguntas guiadas y sugiere lugares.
  - **Muy parecido a StressPlan** — ✅ se pueden reutilizar prompt y chat behavior de
    StressPlan como base.
  - Más features free-vs-premium a definir.
- 💡 La búsqueda con IA se posterga hasta que la monetización solvente el costo de la API
  de Claude (ya anotado en Concepto general).
- ✅ **Medio de pago: MercadoPago** (suscripciones / bricks). Verificado en código: StressPlan
  usa MP (`app/api/billing/checkout`, `billing/cancel`, webhook `api/webhooks/mercadopago`,
  panel de sync MP en admin) — **reutilizar esa integración**. (Los paquetes Stripe en su
  package.json son dependencias muertas.)
- ✅ **Dueños: suscripción mensual** (no pagos puntuales por destaque) — recurrente,
  predecible, y el dashboard de estadísticas justifica la recurrencia.
- 💡 Reglas anti-desconfianza para destacados (propuesta Claude, bien recibida): etiqueta
  "Destacado" visible + **solo aparece si matchea la búsqueda** (compra orden, no relevancia).
- 💡 Suscripción de dueño incluiría: destaque + estadísticas de ficha (vistas, taps en
  "cómo llegar"/teléfono, búsquedas que lo encontraron) + ficha enriquecida.
- 💡 **Instrumentar métricas de ficha desde el día 1** aunque el cobro llegue después — el
  histórico es el argumento de venta ("tu ficha tuvo 400 visitas este mes").
- 💡 Free con probadita de IA (2-3 mensajes) para convertir; wizard guiado es más barato en
  tokens que chat libre.
- 💡 Principio rector propuesto: **lo core (búsqueda clásica) gratis siempre**; el premium
  vende comodidad, no acceso.
- ✅ **UN solo plan premium B2C que agrupa todo** (no features sueltas): chat IA + wizard
  (con cupo mensual de mensajes), votaciones ilimitadas + historial + IA arma shortlist.
  Free: búsqueda completa sin login, 1 votación activa, probadita de IA (2-3 mensajes).
  Si hace falta, a futuro se agrega un tier superior con más mensajes.
- ✅ Resumen del modelo: **B2B** = suscripción mensual dueño (destaque + estadísticas +
  ficha enriquecida) · **B2C** = premium único.
- ❓ **Precios**: postergado a propósito hasta tener el análisis de costos de APIs y el
  producto más cerca del lanzamiento.

## Feature: votación en grupo ("¿a dónde salimos?")

- ✅ **Anotada en serio** (idea de Claude, al usuario le encantó): armar una shortlist de
  lugares, compartirla por link (ej. al grupo de WhatsApp), los amigos **votan sin
  necesidad de cuenta**, gana uno. Resuelve la decisión en grupo y cada link compartido
  trae gente nueva → crecimiento viral.
- ✅ Diseño v1 (casos de uso discutidos y bien recibidos): el **creador necesita cuenta**,
  los **votantes jamás** (ahí está el loop viral); los votantes NO agregan opciones ("el que
  arma la votación arma la cancha"; "sugerir lugar" = mejora futura); el creador cierra
  cuando quiere y desempata él; shortlist de 2-5 lugares; link expira a las 48-72hs.
- ✅ **Freemium: free = UNA votación activa a la vez** (no "una por mes"): cubre el caso
  real de una persona normal, no frustra, y mata el incentivo de multi-cuentas (una segunda
  cuenta solo daría dos votaciones simultáneas — caso rarísimo).
- ✅ Premium (de esta feature): votaciones simultáneas ilimitadas + la IA arma la shortlist
  + historial de votaciones.
- ✅ **Anti-abuso v1**: email verificado obligatorio para crear cuenta + rate limit por
  IP/dispositivo — **código/lógica ya existe en StressPlan, se saca de ahí**.

---

## Estado de la conversación

_Actualizado durante la tanda 2 (2026-07-19). Esta sección es lo primero que lee la
sesión siguiente._

### Tanda 2 — en curso

- ✅ **Investigación de Google Places COMPLETA** (era la primera tarea pendiente). Los
  cinco hallazgos están arriba en "Arquitectura de datos"; el detalle con citas en
  `docs/product/investigacion-google-places-2026-07-19.md`.
- 🔴 **Lo que cambió respecto de la tanda 1**: Google ya no puede asumirse como el
  catálogo de la app. El ToS prohíbe persistir sus datos y las fotos son un costo
  multiplicativo. → Se decidió la **arquitectura híbrida** (ver "Arquitectura de datos").
- ✅ **Decidido en la tanda 2**: arquitectura híbrida (catálogo propio + Google solo en
  ficha); listado sin foto de Google; carga de lugares por consumidores **fuera de v1**;
  lista de pantallas de v1 validada.
- ⏸️ **Precios de planes**: sigue sin abrirse. Ahora sí hay números de costo de API para
  fundamentarlo.

- **Temas cerrados (tanda 1)**: modalidad de trabajo sembrada (`/bootstrap-project`);
  concepto general (descubrimiento sin reservas, mobile-first, búsqueda clásica primero);
  alcance AMBA; tipos de negocio (sin ferias itinerantes); taxonomía curada (opción C);
  zona/barrio default + GPS reemplaza zona; 3 roles + registro único (rol dueño se gana,
  aprobación manual en `/admin`); consumidor anónimo para buscar; sin reviews propias
  (rating de Google); ficha (teléfono/dirección/horarios/link/precios/redes/fotos
  dueño→Google/"cómo llegar"); resultados lista + mapa; panel del dueño separado;
  votación en grupo (diseño v1 completo + free "1 activa a la vez"); monetización
  (B2B suscripción mensual dueños; B2C premium único; MP; principio "core gratis");
  stack completo (Next.js/TS/Drizzle/Postgres local Docker/Neon prod/Vercel/better-auth/
  Cloudflare/Resend; dominio adondesalimos.com.ar); paleta "Ámbar StressPlan"; tono
  canchero sin emojis; Home=Search sin landing; Places API (New).
- **Tema en curso al cortar**: pantallas — quedó volcado el inventario y los faltantes
  propuestos por Claude (votación, flujo dueño, carga de lugar, verificación email,
  checkout, legales, 404) **sin validación explícita del usuario ítem por ítem**.
- ~~**PRIMERA TAREA**: completar la investigación de Google Places~~ → ✅ **HECHA en la
  tanda 2** (2026-07-19).
- **Preguntas abiertas**: fotos en el listado (decisión de costo más grande del proyecto);
  cobertura de Overture/FSQ en AMBA (bloqueante, requiere bajar el extract y contar);
  leer a mano el ToS §3.2.3(b)/§3.2.4; validar la propuesta de arquitectura híbrida;
  validar lista de pantallas faltantes; precios de planes; verificación automatizada de
  dueños (no bloquea).
- **NO hacer todavía**: specs (`/new-spec`), scaffold, código. Seguimos en volcado.
  No commitear sin preguntar (hay cambios sin commitear del bootstrap + docs).
