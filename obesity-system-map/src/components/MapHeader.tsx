import type { ReactNode } from 'react'

interface MapHeaderProps {
  onResetView: () => void
  /** Centre slot — the node search. */
  children?: ReactNode
}

/**
 * Real header row rather than a floating overlay: the title, search and view
 * controls would otherwise collide on narrow viewports, and a solid bar keeps
 * the search from covering any of the map.
 */
export function MapHeader({ onResetView, children }: MapHeaderProps) {
  return (
    <header className="relative z-30 flex shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-5 py-2.5">
      <div className="min-w-0 shrink-0">
        <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-gray-900">
          Foresight
          <span className="ml-1.5 font-normal text-gray-700">
            Obesity System Map
          </span>
        </h1>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-gray-500">
          Adapted from UK Government Foresight Programme, 2007
        </p>
      </div>

      <div className="flex min-w-0 flex-1 justify-center">{children}</div>

      <button
        type="button"
        onClick={onResetView}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M2 8a6 6 0 1 1 1.8 4.3M2 12.5V8.6h3.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Reset view
      </button>
    </header>
  )
}
