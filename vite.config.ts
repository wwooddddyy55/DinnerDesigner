import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works both standalone and behind Home
  // Assistant's ingress proxy path prefix — see DEPLOY.md.
  base: './',
})
