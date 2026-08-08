'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Campo de contraseña con el "ojito" para verla (FB-06).
 *
 * **Dueño único del ojito**: los 8 campos de contraseña del producto (`login`,
 * `registro` ×2, `restablecer` ×2, `cuenta` ×3) pasan por acá. Ninguno arma su
 * propio toggle — es la misma regla de "una regla, un dueño" aplicada a un
 * primitivo de UI.
 *
 * Conviven **dos formas de conectarlo** y las dos tienen que funcionar:
 * `{...register('password')}` de react-hook-form (necesita el `ref`, por eso el
 * `forwardRef`) y controlado con `value`/`onChange`. Todo lo demás se spreadea
 * tal cual, así que sigue siendo un `<input>` a todos los efectos.
 *
 * El `type` NO se puede pisar desde afuera: lo maneja el toggle.
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type'>
>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        data-slot="password-input"
        // `pr-11` deja el lugar del botón; va después del className del que llama
        // para que twMerge lo haga ganar sobre cualquier padding propio.
        className={cn(className, 'w-full pr-11')}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
})

export { PasswordInput }
