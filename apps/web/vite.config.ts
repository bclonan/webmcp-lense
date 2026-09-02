import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  server: { port: 5176, strictPort: true },
  test: { include: ['tests/**/*.test.ts'] },
})
