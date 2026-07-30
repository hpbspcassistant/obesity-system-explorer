import { useEffect, useRef } from 'react'

import type { GuideActionId, GuideSection } from '../data/guide'

/**
 * The walkthrough card.
 *
 * Deliberately not a modal. It has no backdrop, traps no focus, and blocks
 * nothing: the map stays draggable and every control stays live underneath, so a
 * reader can wander off mid-tour and come back. The whole point of a step that
 * says "scroll to zoom" is that you can scroll while reading it.
 *
 * It sits bottom-centre rather than under the header, which is where it started.
 * The search step opens the results list, and that hangs down from the header
 * over exactly that spot; the bottom strip between the navigator and the key is
 * the one part of the stage nothing else claims.
 */

const CARD_W = 440

export interface GuideCardProps {
  section: GuideSection
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  /** Runs a step's demonstration. Only ever called from the button. */
  onAction: (id: GuideActionId) => void
  /** Px of the bottom edge covered by a bar the guide does not own. */
  bottomInset?: number
}

export function GuideCard({
  section,
  index,
  onIndexChange,
  onClose,
  onAction,
  bottomInset = 0,
}: GuideCardProps) {
  const step = section.steps[index]
  const first = index === 0
  const last = index === section.steps.length - 1

  // Focus the card when it opens so Tab and Enter reach its buttons rather than
  // the 108 variables behind it. Focus is not held: Shift-Tab leaves as normal.
  const cardRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  if (!step) return null

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`${section.label}: ${step.title}`}
      tabIndex={-1}
      style={{ width: CARD_W, bottom: 16 + bottomInset }}
      className="absolute left-1/2 z-40 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl border border-gray-300 bg-white p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.3)] outline-none"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">
          {section.label}
        </p>
        <div className="flex items-center gap-2">
          {/* Dots rather than "3 of 5": at five steps the shape of the row says
              how much is left at a glance, without being read. */}
          <span className="flex items-center gap-1" aria-hidden="true">
            {section.steps.map((s, i) => (
              <span
                key={s.title}
                className={[
                  'h-1.5 rounded-full transition-all',
                  i === index ? 'w-4 bg-gray-800' : 'w-1.5 bg-gray-300',
                ].join(' ')}
              />
            ))}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the guide"
            title="Close the guide (Esc)"
            className="-mr-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
              <path
                d="M2.5 2.5l7 7M9.5 2.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <h2 className="text-[15px] font-semibold leading-snug text-gray-900">
        {step.title}
      </h2>

      <div className="mt-1.5 space-y-1.5">
        {step.body.map((paragraph) => (
          <p key={paragraph} className="text-[12.5px] leading-relaxed text-gray-600">
            {paragraph}
          </p>
        ))}
      </div>

      {step.action && (
        <button
          type="button"
          onClick={() => onAction(step.action!.id)}
          className="mt-3 rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-[12.5px] font-medium text-white hover:bg-gray-700"
        >
          {step.action.label}
        </button>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] font-medium text-gray-500 hover:text-gray-800"
        >
          {last ? 'Close' : 'Skip'}
        </button>
        <span className="flex-1" />
        {!first && (
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-[12.5px] font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={() => (last ? onClose() : onIndexChange(index + 1))}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-gray-700"
        >
          {last ? 'Done' : 'Next'}
        </button>
      </div>
    </div>
  )
}
