import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * GitHub Pages can't send security headers, so the policy rides in a meta tag. It only lets the page
 * run its own scripts and talk to its own Supabase project, which blunts any injected script.
 * Left out of the single-file preview build, whose scripts are inlined.
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  const api = supabaseUrl ? new URL(supabaseUrl).host : '*.supabase.co'
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    `img-src 'self' data: blob: https://${api}`,
    `connect-src 'self' https://${api} wss://${api}`,
    `frame-src 'self' data: blob: https://${api}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`),
  }
}

// `vite build --mode single` inlines everything into one HTML file (used for shareable previews).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'single' ? [viteSingleFile()] : [contentSecurityPolicy(loadEnv(mode, '.', 'VITE_').VITE_SUPABASE_URL)])],
  // Relative paths so the build works on GitHub Pages under /<repo>/ as well as at a domain root.
  base: './',
  build: { chunkSizeWarningLimit: 1000, ...(mode === 'single' ? { outDir: 'dist-single' } : {}) },
}))
