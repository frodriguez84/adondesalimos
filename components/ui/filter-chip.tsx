'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

interface FilterChipProps extends React.ComponentProps<'button'> {
  active?: boolean
}

function FilterChip({ className, active = false, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      data-slot="filter-chip"
      data-active={active}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center justify-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { FilterChip }
