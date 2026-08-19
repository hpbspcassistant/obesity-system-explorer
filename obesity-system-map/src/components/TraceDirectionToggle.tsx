import { TRACE_DIRECTIONS } from '../data/modes'
import type { TraceDirection } from '../types'

interface TraceDirectionToggleProps {
  direction: TraceDirection
  onDirectionChange: (direction: TraceDirection) => void
}

/**
 * One compact question with three equal answers. The selected answer keeps its
 * plain-language explanation underneath, so loops remain a first-class tracing
 * question without three paragraphs competing with the results.
 */
export function TraceDirectionToggle({
  direction,
  onDirectionChange,
}: TraceDirectionToggleProps) {
  const selected = TRACE_DIRECTIONS.find((option) => option.id === direction)

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Trace question"
        data-testid="trace-direction"
        className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1"
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
              onClick={() => onDirectionChange(option.id)}
              className={[
                'rounded-md px-2 py-2 text-center text-xs font-medium transition-colors',
                active
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900',
              ].join(' ')}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {selected && (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          {selected.description}
        </p>
      )}
    </>
  )
}
