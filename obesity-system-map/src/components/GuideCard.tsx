import { useEffect, useRef, type ReactNode } from 'react'

import {
  GUIDE_ORDER,
  GUIDE_SECTIONS,
  type GuideActionId,
  type GuideSection,
  type GuideSectionId,
} from '../data/guide'
import type { MapMode } from '../types'

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

/**
 * Shared shell, so the contents and the steps sit in the same place at the same
 * size and reading one never moves the other.
 */
function GuideShell({
  label,
  ariaLabel,
  bottomInset = 0,
  place = 'bottom',
  onClose,
  onHeightChange,
  right,
  children,
}: {
  label: string
  ariaLabel: string
  bottomInset?: number
  place?: 'top' | 'bottom'
  onClose: () => void
  /** Reports how tall the card is, so framing can keep clear of it. */
  onHeightChange?: (height: number) => void
  right?: ReactNode
  children: ReactNode
}) {
  // Focus the shell when it opens so Tab and Enter reach its buttons rather than
  // the 108 variables behind it. Focus is not held: Shift-Tab leaves as normal.
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  /**
   * Measured rather than assumed: the card's height follows its copy, which
   * differs per step, and a framed route that lands under it is invisible.
   */
  const reportRef = useRef(onHeightChange)
  reportRef.current = onHeightChange
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const report = () => reportRef.current?.(element.offsetHeight)
    report()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={ariaLabel}
      tabIndex={-1}
      style={
        place === 'top'
          ? { width: CARD_W, top: 16 }
          : { width: CARD_W, bottom: 16 + bottomInset }
      }
      className="absolute left-1/2 z-40 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl border border-gray-300 bg-white p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.3)] outline-none"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <div className="flex items-center gap-2">
          {right}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the guide"
            title="Close the guide (Esc)"
            className="-mr-1.5 flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
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
      {children}
    </div>
  )
}

export interface GuideContentsProps {
  /** Used only to mark the guide for the mode currently being viewed. */
  mode: MapMode
  onStart: (id: GuideSectionId) => void
  onClose: () => void
  /**
   * True when starting a section elsewhere would clear a trace in progress, so
   * the list can say so rather than destroying it quietly.
   */
  warnLosingTrace?: boolean
  bottomInset?: number
  onHeightChange?: (height: number) => void
}

/** The menu of walkthroughs. */
export function GuideContents({
  mode,
  onStart,
  onClose,
  warnLosingTrace = false,
  bottomInset = 0,
  onHeightChange,
}: GuideContentsProps) {
  return (
    <GuideShell
      label="Guides"
      ariaLabel="Choose a walkthrough"
      bottomInset={bottomInset}
      onClose={onClose}
      onHeightChange={onHeightChange}
    >
      <h2 className="text-base font-semibold leading-snug text-gray-900">
        What would you like to know?
      </h2>

      <ul className="mt-2 space-y-1">
        {GUIDE_ORDER.map((id) => {
          const section = GUIDE_SECTIONS[id]
          const leavingTrace =
            warnLosingTrace && section.mode !== undefined && section.mode !== 'trace'
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onStart(id)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-left hover:border-gray-300 hover:bg-gray-50"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {section.label}
                  </span>
                  <span className="text-xs tabular-nums text-gray-500">
                    {section.steps.length} steps
                  </span>
                  {section.mode === mode && (
                    <span className="rounded-full bg-gray-100 px-1.5 text-xs font-medium text-gray-600">
                      you are here
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                  {section.blurb}
                </span>
                {leavingTrace && (
                  <span className="mt-1 block text-xs leading-snug text-amber-700">
                    Starting this will clear the trace you have open.
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          I&rsquo;ll look around myself
        </button>
      </div>
    </GuideShell>
  )
}

export interface GuideCardProps {
  section: GuideSection
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  /** Runs a step's demonstration. Only ever called from the button. */
  onAction: (id: GuideActionId) => void
  /** Where "Done" goes when the section wants to offer the other guides. */
  onFinish: () => void
  /** Px of the bottom edge covered by a bar the guide does not own. */
  bottomInset?: number
  onHeightChange?: (height: number) => void
  /** Whether this step's `awaits` condition has been satisfied. */
  awaitMet?: boolean
}

export function GuideCard({
  section,
  index,
  onIndexChange,
  onClose,
  onAction,
  onFinish,
  bottomInset = 0,
  onHeightChange,
  awaitMet = false,
}: GuideCardProps) {
  const step = section.steps[index]
  const first = index === 0
  const last = index === section.steps.length - 1

  if (!step) return null

  return (
    <GuideShell
      label={section.label}
      ariaLabel={`${section.label}: ${step.title}`}
      bottomInset={bottomInset}
      place={step.place}
      onClose={onClose}
      onHeightChange={onHeightChange}
      right={
        // Dots rather than "3 of 5": at five steps the shape of the row says how
        // much is left at a glance, without being read.
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
      }
    >
      <h2 className="text-base font-semibold leading-snug text-gray-900">
        {step.title}
      </h2>

      <div className="mt-1.5 space-y-1.5">
        {step.body.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-gray-600">
            {paragraph}
          </p>
        ))}
      </div>

      {step.action && (
        <button
          type="button"
          onClick={() => onAction(step.action!.id)}
          className="mt-3 rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700"
        >
          {step.action.label}
        </button>
      )}

      {/* Your turn. Next stays enabled throughout: a guide that will not let you
          past until you comply is worse than one you can walk away from. */}
      {step.awaits && (
        <div
          role="status"
          className={[
            'mt-3 flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs leading-snug',
            awaitMet
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-gray-300 bg-gray-50 text-gray-700',
          ].join(' ')}
        >
          <span aria-hidden="true" className="mt-px shrink-0">
            {awaitMet ? (
              <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M2 6.5l2.6 2.6L10 3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden="true">
                <circle
                  cx="6"
                  cy="6"
                  r="4.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="2 1.6"
                />
              </svg>
            )}
          </span>
          <span>{awaitMet ? step.awaits.done : step.awaits.prompt}</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-gray-500 hover:text-gray-800"
        >
          {last ? 'Close' : 'Skip'}
        </button>
        <span className="flex-1" />
        {!first && (
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (!last) onIndexChange(index + 1)
            // The first-run tour's last step introduces the four modes, which is
            // the moment to offer a closer look at one. Every other section just
            // finishes.
            else if (section.endsAtContents) onFinish()
            else onClose()
          }}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
        >
          {last ? (section.endsAtContents ? 'Choose a guide' : 'Done') : 'Next'}
        </button>
      </div>
    </GuideShell>
  )
}
