import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Search } from 'lucide-react'

import { auth } from '@/lib/auth'
import { buscarCatalogoCompleto } from '@/lib/claims/query'
import { BrandHeader } from '@/components/shared/brand-header'
import { AltaForm } from './alta-form'
import { ROBOTS_RESULTADOS } from '@/lib/seo/robots'

/**
 * `/registrar-negocio` — entrada única del flujo dueño (decisión 11).
 *
 * **Arranca buscando, no cargando.** La búsqueda corre sobre el catálogo
 * COMPLETO —visibles e invisibles— por dos motivos que valen lo mismo: evita
 * duplicados, y rescata el caso de negocio del spec (el lugar real que quedó
 * bajo el umbral no tiene ficha pública, así que su dueño no puede llegar por el
 * botón "¿Sos el dueño?"). Solo si no está, se ofrece el alta.
 *
 * Server component: el término viaja en la URL (`?q=`) y la consulta se hace
 * acá. No hace falta un endpoint — el resultado no es interactivo, es una lista.
 */

/**
 * Misma regla que la home (SEO, decisión 10): con `?q=` esto es una pantalla de
 * resultados y no se indexa. Acá pesa más todavía — el buscador corre sobre el
 * catálogo **completo, incluidos los no publicados** (`buscarCatalogoCompleto`),
 * que es exactamente lo que `publishedWhere` decide no mostrar. Pelada se indexa.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}): Promise<Metadata> {
  const { q } = await searchParams
  const titulo = 'Registrá tu negocio — ¿A dónde salimos?'
  const buscando = (q ?? '').trim().length > 0
  return buscando ? { title: titulo, robots: ROBOTS_RESULTADOS } : { title: titulo }
}

export default async function RegistrarNegocioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user) redirect('/login?callbackUrl=/registrar-negocio')

  const { q } = await searchParams
  const termino = (q ?? '').trim()
  const buscado = termino.length >= 2
  const resultados = buscado ? await buscarCatalogoCompleto(termino) : []

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      {/* PBETA-R4-06: ver la nota en `/votacion/nueva`. */}
      <BrandHeader />

      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Registrá tu negocio</h1>
        <Link href="/" className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary">
          ← Volver
        </Link>
      </header>

      <p className="text-sm text-muted-foreground">
        Buscalo primero: puede estar cargado aunque todavía no aparezca en la app. Si está, lo
        reclamás; si no, lo damos de alta.
      </p>

      {/* Form GET: el término queda en la URL y la búsqueda la resuelve el server. */}
      <form method="get" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={termino}
            placeholder="Nombre del negocio"
            className="w-full rounded-xl border border-border bg-background py-3 pl-9 pr-4 text-sm text-foreground placeholder-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Buscar
        </button>
      </form>

      {buscado && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {resultados.length > 0 ? 'Resultados' : 'No encontramos nada con ese nombre'}
          </h2>

          {resultados.map((r) => {
            const ubicacion = [r.zone, r.address ?? r.locality].filter(Boolean).join(' · ')
            return (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  {/* PBETA-R6-05: la dirección es el dato que distingue dos
                      locales del mismo nombre, y se cortaba con «…». Acá se lee
                      entera aunque ocupe dos líneas. */}
                  {ubicacion && <p className="text-xs text-muted-foreground">{ubicacion}</p>}
                  {/* Un lugar cargado pero invisible es exactamente el que este
                      flujo rescata: decirlo evita que el dueño crea que no está. */}
                  {!r.publicado && !r.reclamado && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cargado, todavía sin publicar
                    </p>
                  )}
                </div>

                {r.reclamado ? (
                  <span className="shrink-0 self-center text-xs text-muted-foreground">
                    Ya reclamado
                  </span>
                ) : (
                  <Link
                    href={`/reclamar/${r.id}`}
                    className="shrink-0 self-center rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                  >
                    Es mío
                  </Link>
                )}
              </div>
            )
          })}
        </section>
      )}

      {/* El alta solo se ofrece después de haber buscado: es la forma de que el
          "buscá primero" no sea una sugerencia opcional. */}
      {buscado && <AltaForm nombreSugerido={termino} />}
    </main>
  )
}
