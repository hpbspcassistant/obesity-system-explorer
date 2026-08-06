import { MODES } from '../data/modes'
import type { MapMode } from '../types'

interface ModeSwitcherProps {
  mode: MapMode
  onModeChange: (mode: MapMode) => void
}

/**
 * Icons sit alongside the words, never instead of them — the audience is
 * non-technical and the control is read from across a room.
 */
function ModeIcon({ mode }: { mode: MapMode }) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      {mode === 'explore' && (
        <>
          <circle cx="7" cy="7" r="4.5" {...stroke} />
          <path d="M10.5 10.5 14 14" {...stroke} />
        </>
      )}
      {mode === 'trace' && (
        <>
          <circle cx="3.5" cy="12.5" r="1.8" {...stroke} />
          <circle cx="12.5" cy="3.5" r="1.8" {...stroke} />
          <path d="M5 11 11 5" {...stroke} />
        </>
      )}
      {mode === 'profile' && <path d="M2.5 8.5 6 12l7.5-8" {...stroke} />}
      {mode === 'coverage' && (
        <>
          <circle cx="6" cy="6" r="3.6" {...stroke} />
          <circle cx="10.5" cy="10" r="3.2" {...stroke} strokeDasharray="1.6 1.4" />
        </>
      )}
    </svg>
  )
}

export function ModeSwitcher({ mode, onModeChange }: ModeSwitcherProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Map mode"
      className="inline-flex shrink-0 rounded-full bg-gray-100 p-0.5"
    >
      {MODES.map((m) => {
        const active = m.id === mode
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-mode={m.id}
            onClick={() => onModeChange(m.id)}
            className={[
              // py-2 rather than py-1: this is the control that decides what a
              // click on the map means, and it gets pressed from a lectern.
              'flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors',
              active
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800',
            ].join(' ')}
          >
            <ModeIcon mode={m.id} />
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
