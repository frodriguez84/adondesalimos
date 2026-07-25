import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

/**
 * Blindaje de la decisión 11 (mismo test-criterio que Google/R2): los secretos de
 * MercadoPago solo se leen en `lib/billing/mercadopago.ts`. Si aparecen en cualquier
 * otro módulo —y sobre todo en un componente `'use client'`— podrían filtrarse al
 * bundle del browser. El test recorre el árbol de fuentes y falla si el nombre de
 * un secreto aparece fuera del único módulo autorizado.
 */

const RAIZ = path.resolve(__dirname, '../../..')
const CARPETAS = ['lib', 'app', 'components']
const SECRETOS = ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET']
const AUTORIZADO = path.join('lib', 'billing', 'mercadopago.ts')

function fuentes(dir: string): string[] {
  const out: string[] = []
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === '__tests__') continue
    const full = path.join(dir, entrada)
    if (statSync(full).isDirectory()) {
      out.push(...fuentes(full))
    } else if (/\.(ts|tsx)$/.test(entrada)) {
      out.push(full)
    }
  }
  return out
}

describe('secretos de MercadoPago fuera del bundle (decisión 11)', () => {
  it('solo mercadopago.ts referencia MP_ACCESS_TOKEN / MP_WEBHOOK_SECRET', () => {
    const infractores: string[] = []
    for (const carpeta of CARPETAS) {
      for (const archivo of fuentes(path.join(RAIZ, carpeta))) {
        const rel = path.relative(RAIZ, archivo)
        if (rel === AUTORIZADO) continue
        const contenido = readFileSync(archivo, 'utf8')
        if (SECRETOS.some((s) => contenido.includes(s))) infractores.push(rel)
      }
    }
    expect(infractores).toEqual([])
  })
})
