import type { Metadata } from 'next'

import { Documento, Externo, MailContacto, Seccion } from '@/components/legales/ui'

export const metadata: Metadata = {
  title: 'Fuentes y atribución — ¿A dónde salimos?',
  description: 'Fuentes de datos, licencias y atribución del catálogo de lugares.',
}

/**
 * Atribución obligatoria de las fuentes del catálogo.
 *
 * Las 9 fuentes de Overture y sus 3 licencias no son decorativas: son la
 * condición bajo la que se puede usar el dato. Al agregar una fuente nueva al
 * import, agregarla acá en el mismo commit.
 * Fuente: https://docs.overturemaps.org/attribution/
 *
 * ⚠️ **Vive en su propia URL desde LEGALES F0 (decisión 2), y no por prolijidad.**
 * Esto es una **condición de licencia**; los T&C son un **contrato con el usuario**.
 * Dos documentos con dueños, ciclos de vida y riesgos distintos en un solo archivo
 * terminan driftando, y el que quede viejo es el que rompe una licencia. Por eso los
 * links que existen **porque una licencia los exige** —el de Google en la ficha, sobre
 * todo— apuntan acá y no al índice: a dos clicks ya no cumplen (decisión 5).
 */

const CDLA_PERMISSIVE = [
  'Meta',
  'Microsoft',
  'PinMeTo',
  'Krick',
  'RenderSEO',
  'DAC',
  'BrightQuery',
]

export default function AtribucionPage() {
  return (
    <Documento
      titulo="Fuentes y atribución"
      bajada={
        <>
          El catálogo de lugares se construye sobre datos abiertos de{' '}
          <Externo href="https://overturemaps.org/">Overture Maps Foundation</Externo> y se
          enriquece en vivo con datos de Google. Acá están las fuentes y sus licencias.
        </>
      }
    >
      <Seccion titulo="Overture Maps — datos del catálogo">
        <p>
          Los lugares, sus coordenadas y sus datos de contacto provienen del tema{' '}
          <em>places</em> de Overture Maps (release 2026-06-17.0). Overture combina datos de
          nueve fuentes, cada una con su licencia:
        </p>
      </Seccion>

      <Seccion titulo="CDLA Permissive 2.0 — 7 fuentes">
        <p>
          Los datos aportados por <strong>{CDLA_PERMISSIVE.join(', ')}</strong> se distribuyen
          bajo la{' '}
          <Externo href="https://cdla.dev/permissive-2-0/">
            Community Data License Agreement – Permissive, Version 2.0
          </Externo>
          .
        </p>
        <p>
          La licencia permite usar, modificar y redistribuir los datos, incluso con fines
          comerciales, con la condición de conservar este aviso y el texto de la licencia (o un
          enlace a él) en toda redistribución de los datos. Esta página cumple esa condición.
        </p>
        <ul className="list-inside list-disc">
          {CDLA_PERMISSIVE.map((fuente) => (
            <li key={fuente}>
              {fuente} — datos bajo CDLA Permissive 2.0
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Apache License 2.0 — Foursquare">
        <p>
          Parte de los datos de lugares provienen de <strong>Foursquare</strong>, distribuidos
          bajo la{' '}
          <Externo href="https://www.apache.org/licenses/LICENSE-2.0">
            Apache License, Version 2.0
          </Externo>
          .
        </p>
        <p>Copyright © Foursquare Labs, Inc. Todos los derechos reservados.</p>
        <p>
          El aviso completo requerido por la licencia está en el{' '}
          <Externo href="https://opensource.foursquare.com/places-notice-txt/">
            NOTICE.txt de Foursquare Places
          </Externo>
          .
        </p>
      </Seccion>

      <Seccion titulo="CC0 1.0 — AllThePlaces">
        <p>
          Los datos aportados por <strong>AllThePlaces</strong> se publican bajo{' '}
          <Externo href="https://creativecommons.org/publicdomain/zero/1.0/">
            CC0 1.0 Universal (dedicación al dominio público)
          </Externo>
          .
        </p>
      </Seccion>

      <Seccion titulo="Zonas — límites geográficos">
        <p>
          Las 46 zonas de salida se construyeron a partir de dos fuentes oficiales. Los
          agrupamientos, las subdivisiones de Palermo y los cortes del conurbano son
          elaboración propia.
        </p>
        <ul className="list-inside list-disc">
          <li>
            Barrios de la Ciudad de Buenos Aires —{' '}
            <Externo href="https://data.buenosaires.gob.ar/dataset/barrios">
              BA Data, Gobierno de la Ciudad de Buenos Aires
            </Externo>
            , bajo{' '}
            <Externo href="https://creativecommons.org/licenses/by/2.5/ar/">
              CC BY 2.5 Argentina
            </Externo>
            .
          </li>
          <li>
            Límites de los partidos del conurbano — FUENTE:{' '}
            <Externo href="https://www.ign.gob.ar/">
              Instituto Geográfico Nacional de la República Argentina
            </Externo>
            , publicados según el Artículo 2 de la Ley 27.275 de acceso a la información
            pública.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Mapa — OpenStreetMap y OpenFreeMap">
        <p>
          La vista de mapa se dibuja con{' '}
          <Externo href="https://maplibre.org/">MapLibre GL JS</Externo> sobre teselas servidas
          por <Externo href="https://openfreemap.org/">OpenFreeMap</Externo>.
        </p>
        <p>
          Los datos cartográficos de esas teselas son ©{' '}
          <Externo href="https://www.openstreetmap.org/copyright">
            colaboradores de OpenStreetMap
          </Externo>
          , disponibles bajo la{' '}
          <Externo href="https://opendatacommons.org/licenses/odbl/">
            Open Database License (ODbL)
          </Externo>
          . La atribución también se muestra sobre el mapa, como exige la licencia.
        </p>
        <p>
          Los puntos que se ven sobre el mapa son coordenadas propias del catálogo (Overture), no
          de OpenStreetMap.
        </p>
      </Seccion>

      <Seccion titulo="Google">
        <p>
          Algunos datos de la ficha de cada lugar —como horarios, calificaciones y fotos— se
          consultan <strong>en vivo a Google Maps Platform</strong> en el momento en que abrís la
          ficha, y no se almacenan en nuestros servidores.
        </p>
        <p>
          Esos contenidos pertenecen a Google y a quienes los publicaron. Su uso se rige por los{' '}
          <Externo href="https://cloud.google.com/maps-platform/terms">
            Términos del Servicio de Google Maps Platform
          </Externo>{' '}
          y la{' '}
          <Externo href="https://policies.google.com/privacy">
            Política de Privacidad de Google
          </Externo>
          .
        </p>
      </Seccion>

      <Seccion titulo="Correcciones">
        <p>
          Los datos abiertos pueden estar desactualizados o tener errores. Si encontrás algo mal
          en un lugar, escribinos a <MailContacto /> y lo corregimos.
        </p>
      </Seccion>
    </Documento>
  )
}
