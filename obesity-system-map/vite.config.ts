import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Root is the production-container default. Static hosts that mount the app
 * below a path can build with VITE_BASE_PATH=/obesity-map/ instead.
 */
function deploymentBase(raw: string | undefined): string {
  const value = raw?.trim() || '/'
  if (value === './') return value
  if (value === '/') return value
  return `/${value.replace(/^\/+|\/+$/g, '')}/`
}

export default defineConfig({
  base: deploymentBase(process.env.VITE_BASE_PATH),
  plugins: [react(), tailwindcss()],
})
