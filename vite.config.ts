import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // En GitHub Pages el sitio vive en /<repo>/ (lo define el workflow con BASE_PATH)
  base: (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2020',
    // dos páginas: el recorrido 3D (index.html) y el recorrido cinematográfico (cine/index.html)
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        cine: fileURLToPath(new URL('./cine/index.html', import.meta.url)),
      },
    },
    chunkSizeWarningLimit: 1600,
  },
})
