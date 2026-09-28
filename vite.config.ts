import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `vite build --mode single` inlines everything into one HTML file (used for shareable previews).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  // Relative paths so the build works on GitHub Pages under /<repo>/ as well as at a domain root.
  base: './',
  build: { chunkSizeWarningLimit: 1000, ...(mode === 'single' ? { outDir: 'dist-single' } : {}) },
}))
