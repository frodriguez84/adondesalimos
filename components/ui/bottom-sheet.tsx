'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

/**
 * Sheet inferior mobile-first: overlay + panel deslizante, resuelto con CSS + estado.
 * Sin librería extra. El padre controla `open` y provee `onClose`.
 */
function BottomSheet({ open, onClose, children, className }: BottomSheetProps) {
  return (
    <div
      data-slot="bottom-sheet"
      aria-hidden={!open}
      className={cn('fixed inset-0 z-50', open ? 'pointer-events-auto' : 'pointer-events-none')}
    >
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/60 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/40" />
        {children}
      </div>
    </div>
  )
}

export { BottomSheet }
