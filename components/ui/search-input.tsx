'use client'

import * as React from 'react'
import { Search } from 'lucide-react'

import { cn } from '@/lib/utils'

function SearchInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        data-slot="search-input"
        className={cn(
          'h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export { SearchInput }
