import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
const buildId = new Date().toISOString()
export default defineConfig({
  define: { 'import.meta.env.VITE_LENS_BUILD_ID': JSON.stringify(buildId) },
  plugins: [
    vue(),
    {
      name: 'lens-build-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'app-version.json',
          source: JSON.stringify({ buildId, protocolVersion: 1 }),
        })
      },
    },
  ],
  server: { port: 5176, strictPort: true },
  test: { include: ['tests/**/*.test.ts'] },
})
