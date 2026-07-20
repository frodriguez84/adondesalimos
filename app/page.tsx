import { SearchInput } from '@/components/ui/search-input'
import { FilterChip } from '@/components/ui/filter-chip'
import { PlaceCard } from '@/components/shared/place-card'

const CHIPS = ['Cerca mío', 'Barato', 'Al aire libre', 'Abierto ahora']

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">¿A dónde salimos?</h1>
        <p className="text-sm text-muted-foreground">Decidilo rápido, sin dar mil vueltas.</p>
      </header>

      <SearchInput placeholder="Buscá un bar, un resto, un plan..." />

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip, i) => (
          <FilterChip key={chip} active={i === 0}>
            {chip}
          </FilterChip>
        ))}
      </div>

      <PlaceCard
        name="La Birra Bar"
        tags={['Cerveza artesanal', 'Hamburguesas', 'Terraza']}
        zone="Palermo, CABA"
        rating={4.6}
      />
    </main>
  )
}
