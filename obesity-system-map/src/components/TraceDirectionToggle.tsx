import { TRACE_DIRECTIONS } from '../data/modes'
import type { TraceDirection } from '../types'

interface TraceDirectionToggleProps {
  direction: TraceDirection
  onDirectionChange: (direction: TraceDirection) => void
}

/**
 * Shown only while tracing. Styled to match the mode switcher so the two read
 * as one control strip, but kept visually secondary — the mode is the primary
 * choice, direction is a setting within it.
 */
export function TraceDirectionToggle({
  direction,
  onDirectionChange,
}: TraceDirectionToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Trace direction"
      data-testid="trace-direction"
      className="inline-flex shrink-0 rounded-full border border-gray-200 bg-white p-0.5"
    >
      {TRACE_DIRECTIONS.map((option) => {
        const active = option.id === direction
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-direction={option.id}
            title={option.description}
            onClick={() => onDirectionChange(option.id)}
            className={[
              'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-800',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
