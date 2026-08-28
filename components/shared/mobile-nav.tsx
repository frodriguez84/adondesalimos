'use client'

import Link from 'next/link'
import { Bookmark, Home, Map, UserRound } from 'lucide-react'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/', label: 'Explorar', icon: Home },
  { href: '/salir', label: 'Mapa', icon: Map },
  { href: '/mis-lugares', label: 'Guardados', icon: Bookmark },
  { href: '/cuenta', label: 'Cuenta', icon: UserRound },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around gap-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
