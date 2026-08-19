import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/** Keeps a bad data/build payload from presenting as an unexplained blank page. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Obesity System Map failed to start', error, info)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children

    return (
      <main className="flex min-h-full items-center justify-center bg-gray-50 p-6 text-gray-900">
        <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold">The map could not be loaded</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Reload the page. If the problem continues, report the time of the
            error and the app version to the deployment owner. Your saved
            profiles remain in this browser.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Reload
          </button>
        </section>
      </main>
    )
  }
}
