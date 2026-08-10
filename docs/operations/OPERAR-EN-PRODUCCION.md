# Operar en producción — qué mirar y cada cuánto

> **Normativo.** Escrito el 2026-08-10, el día en que el primer QA en producción encontró
> **cuatro** roturas que el deploy no llevaba y **ninguna tiraba un error**. Este archivo existe
> para que eso no dependa de que a alguien se le ocurra mirar.

La app está en `https://adondesalimos.com.ar` desde el 2026-08-07 (Vercel + Neon + Cloudflare).
Es una **beta con usuarios reales pero poco tráfico**, y eso cambia por completo qué vale la pena
vigilar.

## Lo primero: qué NO hay que mirar todavía

Casi todo el consejo de monitoreo que se encuentra por ahí está escrito para otra escala y acá
sería puro ritual. Con este tráfico **no** hace falta: uptime monitoring, APM, alertas de latencia,
dashboards de errores en tiempo real, ni tracing. El cold start de Neon Free (1-3 s tras 5 minutos
de inactividad) es la peor latencia del sistema, **está aceptado con motivo** (DEPLOY, decisión 11)
y no es un incidente.

Poner esas herramientas ahora costaría tiempo y ruido, y taparía lo que sí importa.

## Los cuatro riesgos reales, en orden

| # | Riesgo | Por qué es este el orden |
|---|--------|--------------------------|
| 1 | **Perder datos** | Es el único **irreversible**. En Neon ya hay cosas que no están en ningún otro lado |
| 2 | **Roturas silenciosas** | Es lo más **probable**: la app degrada con elegancia, y esa virtud se paga en visibilidad. Cuatro casos el primer día que se miró |
| 3 | **Plata que se fuga** | Google y Anthropic cobran por uso. Hay topes, así que el riesgo no es la factura sorpresa sino **agotar un tope y no enterarse** |
| 4 | **No saber si la usan** | No rompe nada, pero es lo que decide **qué construir después** |

### 1 · Perder datos

En producción viven datos que **no están en git, ni en el seed, ni en dev**: el mail de
`premium_interest`, las listas de favoritos de usuarios reales, las correcciones hechas desde
`/admin`, y lo que venga.

⚠️ **La ventana de restore de Neon Free son 6 horas** (verificado en el panel el 2026-08-10; el
slider ya está en el máximo del plan — para 30 días hay que pagar). O sea: **si un borrado o una
corrupción no se detecta dentro de esas 6 horas, el time-travel de Neon ya no alcanza y el único
camino de vuelta son los dumps propios.** Seis horas es menos que una noche de sueño, así que el
backup no es una formalidad: es la red de verdad.

**El comando:** `npm run backup:prod` → deja un `.sql.gz` en `backups/` (gitignoreado; **trae mails
y hashes de usuarios reales**, no lo compartas). Conserva los últimos 10.

⚠️ **La copia es local a esta máquina.** Si se pierde el disco, se pierden los dumps. Subirlos a R2
sigue pendiente, igual que para dev.

### 2 · Roturas silenciosas

**La causa raíz, escrita una vez:** la mitad de un feature vive en **datos** —`app_settings`, los
tags de la curaduría, los `chip_tags`, las correcciones de `places`— y **los datos no están en git**.
Vercel deploya código; nadie deploya filas. Un feature puede quedar a medias sin un solo error en
los logs.

**El comando:** `npm run prod:check`. Read-only (la sesión se abre en `READ ONLY`), tarda segundos y
mira: migraciones aplicadas contra las del repo · `app_settings` clave por clave contra dev · las 9
tablas de catálogo y config · el canario de la curaduría · los topes · la antigüedad del backup ·
las señales de uso. Sale con **código 1** si hay algo, así que sirve como gate.

**Cuándo:** después de cada deploy que toque datos, y una vez por semana.

Lo que ese comando **no** puede ver es el comportamiento: si el deploy tocó una interacción
(chips, mapa, formularios), hay que **clickearla en producción**. Los dos fixes de chips del
2026-08-10 pasaron todos los tests y solo se verificaron a mano.

### 3 · Plata que se fuga

Los topes viven en `app_settings` y se editan sin deploy: `google.details_monthly_cap`,
`google.photos_monthly_cap`, `ai.chat_monthly_cap` (500 en prod, más bajo que en dev a propósito).
Superado un tope, la feature **degrada** en vez de facturar — que es lo correcto, y también lo que
hace que nadie se entere.

`npm run prod:check` avisa al 80% de cada tope. Para el detalle en pesos está el tablero de
**`/admin` → Costos**. Una mirada por semana alcanza.

⚠️ **El día que se encienda el cobro**, Vercel Hobby deja de alcanzar: prohíbe el uso comercial, y
pasar a Pro son US$20/mes (≈ 7 premium solo para empatar). Está en DEPLOY, decisión 5 — el cobro
apagado no es una preferencia, es la condición del plan actual.

### 4 · ¿La usan?

`npm run prod:check` cierra con las señales: usuarios, fichas abiertas, impresiones, lugares
guardados y mails dejados para el premium. **`place_impressions_daily` es el histórico que vende el
B2B y no se puede reconstruir después**, así que mirarlo también es controlar que se esté
escribiendo.

## La rutina

| Cuándo | Qué |
|--------|-----|
| **Al deployar** algo que toque datos, settings o migraciones | `npm run prod:check` · aplicar migraciones contra el endpoint **direct** · clickear en prod lo que el deploy haya tocado de interacción |
| **Semanal** | `npm run prod:check` · `/admin` → Costos · `npm run backup:prod` |
| **Después de cualquier sesión que haya ESCRITO en prod** | `npm run backup:prod` — con 6 h de ventana en Neon, pasado el mismo día el dump es la única red |
| **Antes de encender el cobro** | Vercel Pro (ver arriba) |

## Lo que dice el panel de Neon (verificado 2026-08-10)

| Setting | Valor | Qué implica |
|---------|-------|-------------|
| **History window** | **6 h** (máximo del Free) | El restore propio de Neon solo cubre hoy. Todo lo anterior depende de `backup:prod` |
| **Scale to zero** | 5 min | Es el cold start aceptado en DEPLOY, decisión 11. No es un incidente |
| **Compute** | 0,25 – 2 CU | Suficiente y de sobra para este tráfico |
| **Tráfico** | público, sin restricción por IP (el Free no la ofrece) | La base es alcanzable desde internet con usuario y contraseña. Es lo normal en Neon Free, pero **la credencial es el único candado**: no la pegues en ningún lado y mantenela solo en `.env` |
| **Acceso al proyecto** | 1 persona (`adondesalimos.app@gmail.com`, Admin) | Sin nadie más con acceso |

## Cómo se conecta con lo que ya existía

Las cinco redes de [`REDES-DE-SEGURIDAD.md`](REDES-DE-SEGURIDAD.md) apuntan **a dev** — se
escribieron cuando producción no existía. `prod:check` es el hermano de `/consistency-check` para el
otro lado, y `backup:prod` el de `backup:db`. La lección que los originó está en
[`LECCIONES_APRENDIDAS.md`](LECCIONES_APRENDIDAS.md) § *Deployar un feature de datos es dos deploys*.

## Credenciales

Los dos comandos leen **`PROD_DATABASE_URL`** de `.env` (gitignoreado): el endpoint **direct** de
Neon, no el pooled. El pooled es para la app; `pg_dump` y las migraciones van por el direct. Ningún
script la imprime nunca, y `prod:check` abre la sesión en modo lectura para que ni un bug pueda
escribir en producción.
