import type { ReactNode } from 'react'

import { ModeSwitcher } from './ModeSwitcher'
import type { MapMode } from '../types'

interface MapHeaderProps {
  mode: MapMode
  onModeChange: (mode: MapMode) => void
  onResetView: () => void
  /** Multiplies the map scale — one notch per press. */
  onZoomBy: (factor: number) => void
  /** Reopens the walkthrough. */
  onOpenGuide: () => void
  guideOpen: boolean
  highContrast: boolean
  onHighContrastChange: (on: boolean) => void
  /** Centre slot — the node search. */
  children?: ReactNode
}

/**
 * One press of the zoom buttons. Matches roughly three wheel notches, which is
 * enough to feel like progress on a map spanning a 240x scale range without
 * overshooting the level where labels become readable.
 */
const ZOOM_STEP = 1.4

/**
 * Single header row: identity on the left, mode switcher beside it, search in
 * the middle, view controls on the right. Wraps rather than crushing the
 * search field on narrow viewports.
 *
 * Every mode renders exactly this, which is the point. Trace used to insert its
 * direction toggle here — 433px of radio buttons, wider than the mode switcher
 * itself — and the row could not hold it: at 1280 the header went from 59px to
 * 105px, the search field collapsed to 122px, and the map lost 46px of height,
 * all at the instant the reader pressed Trace. The control now lives at the top
 * of the trace panel, where 368px of width lets the three options stack and
 * carry their own explanations.
 */
export function MapHeader({
  mode,
  onModeChange,
  onResetView,
  onZoomBy,
  onOpenGuide,
  guideOpen,
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
        {/* Provenance, and the widest thing in this block at about 270px. Below
            1280 that width is the difference between the header holding one row
            and wrapping, so it stands down — the walkthrough still says where
            the map comes from, and a second header row costs 45px of map on
            every screen that can least afford it. */}
        <p className="mt-0.5 truncate text-xs leading-tight text-gray-500 max-xl:hidden">
          Adapted from UK Government Foresight Programme, 2007
        </p>
      </div>

      <ModeSwitcher mode={mode} onModeChange={onModeChange} />

      {/* A floor, so the field wraps onto a row of its own rather than being
          crushed. Everything else in this header costs about 1016px, so it keeps
          one row down to ~1210 — every common laptop width — and below that a
          second row is the honest outcome: at 768 this slot had squeezed the
          search to 74px, about five characters. */}
      <div className="flex min-w-[12rem] flex-1 justify-center">{children}</div>

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
          'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium',
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

      {/* Help sits before the view controls: it is about the whole tool, where
          those two are about what you are looking at. */}
      <button
        type="button"
        onClick={onOpenGuide}
        aria-expanded={guideOpen}
        aria-label="How this works"
        title="How this works"
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
          guideOpen
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
        ].join(' ')}
      >
        ?
      </button>

      {/* Zoom, made visible. The wheel already zoomed, but nothing on screen
          said so — and with the whole 3370px map fitted to the viewport the
          labels start at about 3px, so "how do I make this readable" is the
          first question every user has. Fit stays alongside as the way back. */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-gray-200 bg-white p-0.5">
        <ZoomButton
          label="Zoom out"
          onClick={() => onZoomBy(1 / ZOOM_STEP)}
          d="M4 8h8"
        />
        <ZoomButton
          label="Zoom in"
          onClick={() => onZoomBy(ZOOM_STEP)}
          d="M8 4v8M4 8h8"
        />
        <button
          type="button"
          onClick={onResetView}
          title="Fit the whole map in the window"
          className="rounded-full px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Fit
        </button>
      </div>
    </header>
  )
}

/** Square icon button, sized so it is comfortable to hit from a lectern. */
function ZoomButton({
  label,
  onClick,
  d,
}: {
  label: string
  onClick: () => void
  d: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}
