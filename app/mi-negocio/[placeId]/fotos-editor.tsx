'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'

import { Aviso } from '@/components/negocio/campos'
import type { FotoDelPanel } from '@/lib/negocio/query'
import type { OwnerPlan } from '@/lib/db/schema'

/**
 * Fotos del dueño (decisiones 5, 16 y 17). Aparte del formulario: se suben de a
 * una, con un POST propio, y el resultado tiene que verse al instante.
 *
 * El cap del plan se muestra acá **y** lo aplica el servidor: el botón se
 * deshabilita al llegar al tope, pero el 4º POST con plan free responde 409 igual
 * si alguien lo fuerza. "Subir un cupo es un regalo; bajarlo es una traición" —
 * por eso el límite vive del lado que no se puede saltear.
 *
 * El archivo va a `/api/mi-negocio/[placeId]/photos`, nunca directo a R2: las
 * credenciales del bucket son server-only.
 */

const TIPOS_INPUT = 'image/jpeg,image/png,image/webp'
const LADO_MAYOR_MAX = 1600

/**
 * Redimensiona en el browser antes de subir (BACKLOG, 2026-07-21): una foto de
 * celular son ~4000 px / 3-5 MB y el slot de la ficha muestra ~1250 px físicos —
 * se estaba subiendo y bajando 10-20x más grande de lo necesario. Si algo falla
 * (browser sin `createImageBitmap`, canvas bloqueado, etc.) devuelve el archivo
 * original: el resize es un optimizador, no un boundary de seguridad — el límite
 * de 5 MB y la validación de tipo del server no cambian.
 */
async function redimensionar(archivo: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(archivo)
    const escala = Math.min(1, LADO_MAYOR_MAX / Math.max(bitmap.width, bitmap.height))
    if (escala === 1) return archivo

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) return archivo
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
    if (!blob) return archivo
    return new File([blob], archivo.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' })
  } catch {
    return archivo
  }
}

export function FotosEditor({
  placeId,
  inicial,
  cap,
  plan,
}: {
  placeId: string
  inicial: FotoDelPanel[]
  cap: number
  plan: OwnerPlan
}) {
  const [fotos, setFotos] = useState<FotoDelPanel[]>(inicial)
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const lleno = fotos.length >= cap

  async function subir(archivo: File) {
    setError(null)
    setSubiendo(true)
    try {
      const optimizada = await redimensionar(archivo)
      const form = new FormData()
      form.append('foto', optimizada)
      const res = await fetch(`/api/mi-negocio/${placeId}/photos`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error?.message ?? 'No pudimos subir la foto.')
        return
      }
      setFotos((prev) => [...prev, { id: json.data.id, url: json.data.url, sort: prev.length }])
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function borrar(id: string) {
    setError(null)
    try {
      const res = await fetch(`/api/mi-negocio/${placeId}/photos?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        setError(json?.error?.message ?? 'No pudimos borrar la foto.')
        return
      }
      setFotos((prev) => prev.filter((f) => f.id !== id))
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">Fotos</h2>
        <p className="text-xs text-muted-foreground">
          {fotos.length} de {cap} · jpg, png o webp, hasta 5 MB.
          {plan === 'free' && ' El plan pago llega a 15.'}
        </p>
        {/* PBETA-R6-03: quedaban abajo del botón de guardar y se leían como si
            estuvieran afuera del formulario. Están afuera, y por eso se dice. */}
        <p className="text-xs text-muted-foreground">
          Se suben al toque: no hace falta guardar.
        </p>
        {fotos.length > 0 && (
          <p className="text-xs text-muted-foreground">
            La primera es la que se ve en tu ficha.
          </p>
        )}
      </div>

      {fotos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {fotos.map((foto) => (
            <li key={foto.id} className="relative overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto propia servida por R2, sin optimizador */}
              <img src={foto.url} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                aria-label="Borrar foto"
                onClick={() => borrar(foto.id)}
                className="absolute right-1 top-1 rounded-lg bg-background/80 p-1.5 text-muted-foreground backdrop-blur transition-colors hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}

      <input
        ref={inputRef}
        type="file"
        accept={TIPOS_INPUT}
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          if (archivo) void subir(archivo)
        }}
      />
      <button
        type="button"
        disabled={lleno || subiendo}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
      >
        <ImagePlus className="size-4" />
        {subiendo ? 'Subiendo…' : lleno ? `Llegaste al máximo de ${cap}` : 'Agregar foto'}
      </button>
    </section>
  )
}
