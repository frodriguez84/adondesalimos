import { BrandHeader } from '@/components/shared/brand-header'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandHeader />
        </div>
        {children}
      </div>
    </div>
  )
}
