import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('combina clases condicionales', () => {
    expect(cn('text-sm', false, 'font-medium')).toBe('text-sm font-medium')
  })

  it('resuelve conflictos de Tailwind quedándose con la última clase', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
