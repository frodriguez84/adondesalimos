import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { sesionAdmin } from '@/lib/auth/sesion'
import { claimsPorEstado } from '@/lib/claims/query'
import { getHistorialPrecios, getPreciosActuales } from '@/lib/billing/settings'
import { contarUsuarios, getSuscripcionesAdmin, getUsuariosAdmin } from '@/lib/billing/admin'
import { contarInteresados, getInteresadosAdmin } from '@/lib/billing/interes'
import { getCostosChat, getCupoChat, getSugerenciaPrecio, getUsoGoogle } from '@/lib/admin/costos'
import { zonasConCola } from '@/lib/curation/query'
import { ColaClient } from './cola-client'
import { CostosAdmin, SugeridorPrecio } from './costos'
import { CuraduriaClient } from './curaduria-client'
import { PreciosClient } from './precios-client'
import { SuscripcionesAdmin } from './suscripciones'
import { AdminTabs } from './tabs'
import { UsuariosClient } from './usuarios-client'

/**
 * `/admin` — cola de aprobación (AUTH, decisión 22) + Precios y Suscripciones
 * read-only (MONETIZACION, decisión 26) + Costos (COSTOS_ADMIN). El resto del
 * admin (umbral, curaduría) sigue en BACKLOG a propósito.
 *
 * Gate inline con `ADMIN_EMAIL` (decisión 8) y **404, no 403**: para cualquiera
 * que no sea el admin, esta ruta no existe. Con `ADMIN_EMAIL` sin setear no hay
 * admin posible — nunca un panel abierto por default.
 *
 * Tabs sobre una sola ruta (PULIDO, decisión 2): este sigue siendo el único
 * lugar con el gate y el `Promise.all` — `AdminTabs` es puramente presentación
 * sobre los datos ya resueltos acá.
 */

export const metadata: Metadata = { title: 'Admin — ¿A dónde salimos?' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const admin = await sesionAdmin(await headers())
  if (!admin) notFound()

  const [
    pendientes,
    aprobados,
    precios,
    historial,
    suscripciones,
    interesados,
    conteoInteresados,
    costosChat,
    usoGoogle,
    cupoChat,
    sugerencia,
    zonasCuraduria,
    usuarios,
    totalUsuarios,
  ] = await Promise.all([
    claimsPorEstado('pending'),
    claimsPorEstado('approved'),
    getPreciosActuales(),
    getHistorialPrecios(),
    getSuscripcionesAdmin(),
    getInteresadosAdmin(),
    // Los números van aparte de la lista: la lista está topeada en 200 y el
    // conteo por eje es el dato que dispara prender el cobro (INT2-28).
    contarInteresados(),
    getCostosChat(),
    getUsoGoogle(),
    getCupoChat(),
    getSugerenciaPrecio(),
    zonasConCola(),
    getUsuariosAdmin(),
    // El total va aparte del listado, que está topeado (mismo criterio que la
    // lista de interesados).
    contarUsuarios(),
  ])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin</h1>
          <p className="text-sm text-muted-foreground">{admin.email}</p>
        </div>
        <Link href="/" className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-primary">
          ← Volver
        </Link>
      </header>

      <AdminTabs
        cola={<ColaClient pendientes={pendientes} aprobados={aprobados} />}
        precios={<PreciosClient precios={precios} historial={historial} />}
        suscripciones={
          <SuscripcionesAdmin
            suscripciones={suscripciones}
            interesados={interesados}
            conteoInteresados={conteoInteresados}
          />
        }
        costos={
          <div className="flex flex-col gap-6">
            <CostosAdmin chat={costosChat} google={usoGoogle} cupo={cupoChat} />
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sugeridor de precio
              </h3>
              <SugeridorPrecio sugerencia={sugerencia} />
            </div>
          </div>
        }
        curaduria={<CuraduriaClient zonasIniciales={zonasCuraduria} />}
        usuarios={<UsuariosClient usuariosIniciales={usuarios} total={totalUsuarios} />}
      />
    </main>
  )
}
