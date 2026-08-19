import { lazy, Suspense } from 'react'

import { AppErrorBoundary } from './components/AppErrorBoundary'

// Loading App lazily lets the boundary catch malformed shipped data and SVG
// modules as well as ordinary render errors.
const App = lazy(() => import('./App.tsx'))

export function RootApp() {
  return (
    <AppErrorBoundary>
      <Suspense
        fallback={
          <div className="flex min-h-full items-center justify-center text-sm text-gray-600">
            Loading map…
          </div>
        }
      >
        <App />
      </Suspense>
    </AppErrorBoundary>
  )
}
