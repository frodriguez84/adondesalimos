# Las 46 zonas de AMBA — fuentes, licencias y composición

Un archivo GeoJSON por zona, nombrado por su `slug`. Son **artefactos versionados**
(decisión 13 del spec [ZONAS](../../docs/specs/active/ZONAS.md)): el repo los lleva
adentro porque combinan merges curados y polígonos dibujados a mano que no se
derivan de ninguna fuente.

Se regeneran con `npm run zones:build` y se cargan a la base con `npm run zones:load`.

---

## Licencias — qué se puede usar y por qué

| Fuente | Qué aporta | Licencia | Atribución obligatoria |
|--------|-----------|----------|------------------------|
| **BA Data** — GCBA | Los 48 barrios oficiales de CABA | **CC BY 2.5 AR** (declarada en el API CKAN del dataset) | "Barrios: Gobierno de la Ciudad de Buenos Aires — BA Data (CC BY 2.5 AR)" |
| **IGN** — Instituto Geográfico Nacional | Los partidos del conurbano (capa `ign:municipio` vía WFS) | **Ley 27.275** de acceso a la información pública, declarada en el `AccessConstraints` del servicio | "FUENTE: Instituto Geográfico Nacional de la República Argentina" |
| Elaboración propia | Los merges, los 4 de Palermo y los 5 cortes del conurbano | — | "Zonas: elaboración propia" |

Ninguna de las dos fuentes tiene cláusula *share-alike* ni deriva de OpenStreetMap.

### Fuentes evaluadas y descartadas

- **OpenStreetMap** — ODbL, *share-alike*. Descartada por la decisión 15 del spec: es el
  riesgo exacto que se evitó al elegir Overture para el catálogo. **Es la única fuente del
  mundo que tiene polígonos de "Ramos Mejía"**, y aun así no se usa.
- **INDEC** — sus condiciones de uso dicen textualmente *"Queda, además, prohibida su
  comercialización en cualquiera de sus formas"*. Para un producto comercial es peor que
  ODbL: ODbL al menos permite comercializar. Descartada de plano.
- **ARBA / Datos Abiertos PBA** — licencia **CC BY 4.0**, era la mejor opción para partidos.
  El recurso ZIP está **roto del lado del servidor**: entrega 97.071 bytes de los 7.796.169
  declarados, de forma determinística. Si algún día se arregla, es preferible al IGN (licencia
  estándar y trazable en vez de un texto propio).
- **BAHRA** — el sitio propio tiene el certificado TLS mal configurado. La capa se consigue
  igual vía IGN (`ign:localidad_bahra`), pero es **MultiPoint**: no sirve para polígonos.

### Por qué el conurbano se dibuja a mano

**Ninguna fuente estatal argentina publica polígonos de localidades del conurbano.**
Verificado, no asumido:

- `ign:localidad_bahra` y la API Georef devuelven **puntos**, no polígonos.
- Las *localidades censales* del INDEC sí son polígonos, pero en el conurbano colapsan al
  aglomerado — La Matanza entera es **una** localidad censal, así que no distinguen
  "Ramos Mejía" de "Haedo". Y están prohibidas comercialmente.

Por eso 17 zonas son un partido entero del IGN y las 8 restantes salen de cortar 5 partidos
a mano.

---

## Cómo reconstruir

Las fuentes **no** se versionan (15 MB). Para regenerar los 46 archivos:

```bash
mkdir -p data/sources

# CABA — 48 barrios (CC BY 2.5 AR)
curl -L -o data/sources/caba-barrios.geojson \
  "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/innovacion-transformacion-digital/barrios/barrios.geojson"

# Conurbano — 135 partidos de PBA (IGN, Ley 27.275)
curl -L -o data/sources/ign-municipios-pba.geojson -G "https://wms.ign.gob.ar/geoserver/ows" \
  --data-urlencode "service=wfs" --data-urlencode "version=2.0.0" \
  --data-urlencode "request=GetFeature" --data-urlencode "typeName=ign:municipio" \
  --data-urlencode "outputFormat=application/json" --data-urlencode "srsName=EPSG:4326" \
  --data-urlencode "CQL_FILTER=in1 LIKE '06%'"

npm run zones:build
```

> La propiedad del nombre en el archivo de CABA es **`nombre`**, en minúscula y **sin
> acentos** (`Nuñez`, `Constitucion`, `Villa Gral. Mitre`). En el archivo del IGN es `nam`.
> Verificado contra los archivos reales.

### Las tres técnicas del build

1. **Merge** — unión de polígonos oficiales (las 17 zonas de CABA que no son Palermo, y los
   17 partidos enteros).
2. **Recorte** — un anillo dibujado a mano ∩ el polígono oficial que lo contiene. Lo que
   sobra del dibujo lo tira el recorte, así que el anillo se dibuja generoso.
3. **Remanente** — la base **menos** las zonas ya recortadas de ella.

El remanente es lo que hace que las particiones sean exactas **por construcción**: si una
coordenada dibujada a mano está corrida, la zona queda corrida, pero nunca aparece un hueco
ni un solape. Es lo que verifica el test de `lib/zones/__tests__/poligonos.test.ts`.

### El oráculo de centroides

`scripts/zones/composicion.ts` lleva los centroides reales de los lugares de Overture
agrupados por `locality`, con la zona en la que tienen que caer. El build **falla** si alguno
cae mal. No es decorativo: en la primera corrida cazó que Villa Adelina cae del lado de
Vicente López, no de San Isidro — la expectativa estaba mal, no el polígono.

---

## Composición de cada zona

### CABA (21) — merge de los 48 barrios oficiales

| Zona | Barrios oficiales |
|------|-------------------|
| `palermo-soho` · `palermo-hollywood` · `botanico-alto-palermo` · `las-canitas` | partición de **Palermo** (ver abajo) |
| `villa-crespo` | Villa Crespo |
| `chacarita-colegiales` | Chacarita · Colegiales · Villa Ortuzar · **Parque Chas** |
| `villa-urquiza-coghlan` | Villa Urquiza · Coghlan · **Villa Pueyrredon** |
| `belgrano` | Belgrano |
| `nunez` | Nuñez |
| `saavedra` | Saavedra |
| `recoleta` | Recoleta |
| `retiro-microcentro` | Retiro · San Nicolas |
| `puerto-madero` | Puerto Madero |
| `san-telmo` | San Telmo |
| `monserrat-congreso` | Monserrat · **Constitucion** · **San Cristobal** |
| `la-boca-barracas` | La Boca · Barracas · **Nueva Pompeya** · **Parque Patricios** |
| `almagro-boedo` | Almagro · Boedo |
| `once-abasto` | Balvanera |
| `caballito` | Caballito · **Parque Chacabuco** |
| `devoto-villa-del-parque` | Villa Devoto · Villa Del Parque · **Agronomia** · **Paternal** · **Villa Santa Rita** · **Villa Gral. Mitre** · **Monte Castro** · **Villa Real** · **Versalles** |
| `flores-floresta` | Flores · Floresta · **Velez Sarsfield** · **Villa Luro** · **Liniers** · **Mataderos** · **Parque Avellaneda** · **Villa Lugano** · **Villa Soldati** · **Villa Riachuelo** |

En **negrita**, los barrios que el spec no nombraba y que se repartieron por curaduría.
Los 48 entran exactamente una vez: ningún punto de CABA queda fuera de toda zona, y la suma
de las 21 zonas da **204 km²** contra los 203 km² reales de la ciudad (lo verifica un test).

Decisiones de reparto que merecen justificación:

- **Parque Chas** → Chacarita y Colegiales: es un enclave entre Villa Ortúzar y Agronomía;
  quien sale por Parque Chas sale por Chacarita.
- **Constitución y San Cristóbal** → Monserrat y Congreso. El spec preveía "parte de
  Balvanera sur", pero Balvanera va **entera** a Once y Abasto por decisión ya tomada, así
  que cortarla habría contradicho el canon. Estos dos barrios cubren esa franja sur.
- **Villa Pueyrredón** → Villa Urquiza y Coghlan: comparte el eje de Av. Triunvirato.
- **Nueva Pompeya y Parque Patricios** → La Boca y Barracas: el corredor sur del Riachuelo.
- **Villa Lugano, Soldati y Riachuelo** → Flores y Floresta. Es el reparto más discutible del
  mapa: son barrios grandes y lejanos que quedan colgados de una zona cuyo nombre no los
  menciona. Entran ahí porque el canon de 46 no tiene una zona del sur de CABA, y dejarlos
  sin zona sería peor. Anotado en el backlog.

### Palermo (4) — partición por avenida

Palermo no tiene subdivisión oficial (decisión 8), así que se dibujan los límites por
avenida y el Botánico absorbe el remanente:

| Zona | Límites | Área |
|------|---------|------|
| `palermo-soho` | Juan B. Justo · Santa Fe · Scalabrini Ortiz · Córdoba | 1,89 km² |
| `palermo-hollywood` | Juan B. Justo · Dorrego · Córdoba · eje Santa Fe | 1,18 km² |
| `las-canitas` | Dorrego · Luis María Campos · Libertador | 1,23 km² |
| `botanico-alto-palermo` | **remanente** de Palermo | 11,62 km² |

Suman **15,92 km²** = el polígono oficial de Palermo, exacto. El Botánico se lleva el 73%
porque absorbe los Bosques de Palermo, el Hipódromo, el Campo de Polo, Palermo Chico, la
Costanera y Aeroparque — superficie enorme y casi sin salidas.

> **Aproximación conocida:** el polígono de Las Cañitas es algo más ancho que la franja
> gastronómica real de Báez, así que incluye parte del Campo de Polo y los cuarteles. Da 52
> lugares publicados por km² contra ~315 de Soho. La zona es correcta de nombre y ubicación;
> afinarla es curaduría futura.

### Conurbano (25)

**Partido entero del IGN (17):** `olivos-vicente-lopez` (Vicente López) · `tigre-nordelta`
(Tigre) · `san-fernando` · `san-miguel-bella-vista` (San Miguel) · `pilar` · `escobar` ·
`san-martin-villa-ballester` (General San Martín) · `ituzaingo` · `caseros-tres-de-febrero`
(Tres de Febrero) · `moreno` · `merlo` · `avellaneda` · `quilmes` · `lanus` · `monte-grande`
(Esteban Echeverría) · `berazategui` · `florencio-varela`.

**Cortados a mano (8, sobre 5 partidos):**

| Zona | Base | Cómo |
|------|------|------|
| `martinez-acassuso` | San Isidro | Recorte de la franja costera sur |
| `san-isidro` | San Isidro | **Remanente**: San Isidro centro, Béccar, Boulogne |
| `lomas-banfield` | Lomas de Zamora | Recorte al norte del eje Meeks/Frías |
| `temperley` | Lomas de Zamora | **Remanente**: Temperley, Turdera, Llavallol |
| `ramos-mejia-haedo` | La Matanza **+** Morón | Dos recortes unidos: la única zona que cruza partidos, tal como pide la decisión 3 (corredor, no partido) |
| `moron-castelar` | Morón | **Remanente**: Morón, Castelar, El Palomar, Villa Sarmiento |
| `san-justo` | La Matanza | Recorte **estricto**: no absorbe el resto del partido |
| `adrogue-burzaco` | Almirante Brown | Recorte **estricto**: no absorbe el resto del partido |

Los dos recortes estrictos son una decisión explícita: `san-justo` **no** se estira a
González Catán ni a Virrey del Pino, y `adrogue-burzaco` **no** se estira a Longchamps ni a
Glew. Esos lugares quedan sin zona a propósito (decisión 17): etiquetar como "San Justo" un
bar que está a 20 km sería mentirle al usuario para inflar una métrica de cobertura.

---

## Cobertura real

Con las 46 zonas cargadas y `npm run zones:assign` corrido sobre los 26.057 lugares:

- **23.857 (91,6%)** quedan con al menos una zona.
- **2.200 (8,4%)** quedan sin ninguna zona.
- **390** tienen zona de búsqueda pero no primaria: están dentro de los 400 m del buffer de
  alguna zona, pero fuera de todo polígono exacto.

Los lugares sin zona **no están en los bordes del bbox**, como anticipaba el spec: están en
partidos densos que el canon de 46 simplemente no incluye — José C. Paz (153), Gregorio de
Laferrere (147), General Rodríguez (131), González Catán (113), Hurlingham (101), Ezeiza
(84), Isidro Casanova (84), Longchamps (83). Está anotado en
[`docs/product/BACKLOG.md`](../../docs/product/BACKLOG.md) como candidato a zonas nuevas.
