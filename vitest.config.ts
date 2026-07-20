import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    // Los tests de integración comparten UN Postgres y varios crean/limpian
    // filas propias en las mismas tablas. En paralelo, los fixtures de un
    // archivo son visibles para las aserciones de otro: los fixtures de zona de
    // BUSQUEDA rompían el invariante "hay 46 zonas" de ZONAS sin que hubiera
    // nada mal en ninguno de los dos. Serial es el modelo que corresponde
    // mientras la base sea compartida.
    fileParallelism: false,
    include: [
      'lib/**/__tests__/**/*.test.ts',
      'components/**/__tests__/**/*.test.ts',
      'scripts/**/__tests__/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
