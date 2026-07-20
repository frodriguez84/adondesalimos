import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // El dev se expone por un túnel ngrok fijo (https://adondesalimos.ngrok.app).
  // Sin esto, Next bloquea los recursos de `/_next/*` cuando llegan desde ese
  // host y la app cargada por el túnel no monta el JS. Solo afecta a `next dev`.
  allowedDevOrigins: ['adondesalimos.ngrok.app'],
}

export default nextConfig
