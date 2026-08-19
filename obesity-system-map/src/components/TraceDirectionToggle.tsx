import { TRACE_DIRECTIONS } from '../data/modes'
import type { TraceDirection } from '../types'

interface TraceDirectionToggleProps {
  direction: TraceDirection
  onDirectionChange: (direction: TraceDirection) => void
  /**
   * Whether to explain the two options not currently chosen. True while the
   * panel has nothing else in it, false once a trace fills it.
   */
  explainAll: boolean
}

/**
 * The first thing in the trace panel, because it is the first decision: it
 * decides what clicking a variable means, and the same variable answers a
 * different question under each option.
 *
 * Stacked rather than laid out in a row. As a segmented control in the header
 * these three labels measured 433px — wider than the mode switcher — and forced
 * the header to wrap the moment Trace was pressed. The panel's 23rem gives each
 * option a line of its own, which is also what makes room for the descriptions:
 * they used to be `title` tooltips, invisible on touch and to anyone who did not
 * think to hover the control they had not yet understood.
 *
 * The chosen option keeps its description always; the other two lose theirs once
 * a trace is running. Three descriptions is 227px of a 661px panel, which is a
 * fair price while the panel is otherwise empty and the reader is deciding, and
 * a poor one once there is a route list underneath wanting the room.
 */
export function TraceDirectionToggle({
  direction,
  onDirectionChange,
  explainAll,
}: TraceDirectionToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Trace direction"
      data-testid="trace-direction"
      className="flex flex-col gap-1"
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
              'rounded-lg border px-3 py-2 text-left transition-colors',
              active
                ? 'border-gray-900 bg-gray-900'
                : 'border-gray-200 bg-white hover:bg-gray-50',
            ].join(' ')}
          >
            <span
              className={[
                'block text-sm font-medium',
                active ? 'text-white' : 'text-gray-800',
              ].join(' ')}
            >
              {option.label}
            </span>
            {(active || explainAll) && (
              <span
                className={[
                  'mt-0.5 block text-xs leading-snug',
                  active ? 'text-gray-300' : 'text-gray-500',
                ].join(' ')}
              >
                {option.description}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
