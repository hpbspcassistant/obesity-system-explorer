import type { ReactNode } from 'react'

import { ModeSwitcher } from './ModeSwitcher'
import { TraceDirectionToggle } from './TraceDirectionToggle'
import type { MapMode, TraceDirection } from '../types'

interface MapHeaderProps {
  mode: MapMode
  onModeChange: (mode: MapMode) => void
  traceDirection: TraceDirection
  onTraceDirectionChange: (direction: TraceDirection) => void
  onResetView: () => void
  highContrast: boolean
  onHighContrastChange: (on: boolean) => void
  /** Centre slot — the node search. */
  children?: ReactNode
}

/**
 * Single header row: identity on the left, mode switcher beside it, search in
 * the middle, view controls on the right. Wraps rather than crushing the
 * search field on narrow viewports.
 */
export function MapHeader({
  mode,
  onModeChange,
  traceDirection,
  onTraceDirectionChange,
  onResetView,
  highContrast,
  onHighContrastChange,
  children,
}: MapHeaderProps) {
  return (
    <header className="relative z-30 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 bg-white px-5 py-2.5">
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

      <ModeSwitcher mode={mode} onModeChange={onModeChange} />

      {mode === 'trace' && (
        <TraceDirectionToggle
          direction={traceDirection}
          onDirectionChange={onTraceDirectionChange}
        />
      )}

      <div className="flex min-w-0 flex-1 justify-center">{children}</div>

      {/* A view preference, so it sits with Reset view rather than with the
          mode switcher: it changes how the map looks, never what a click does. */}
      <button
        type="button"
        role="switch"
        aria-checked={highContrast}
        data-testid="contrast-toggle"
        onClick={() => onHighContrastChange(!highContrast)}
        title="Stronger fills and outlines, for projectors and small labels"
        className={[
          'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
          highContrast
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor" />
        </svg>
        High contrast
      </button>

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
