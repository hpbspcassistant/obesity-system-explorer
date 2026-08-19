import { useState } from 'react'

import { cornerPlacement, placeCard } from '../lib/cardPlacement'
import type { AnchorRect } from './MapView'
import type { NodeProvenance, NodeStanding } from '../lib/reach'
import type { Node } from '../types'

/**
 * Why one variable is the colour it is.
 *
 * The whole card answers a single question — which programmes reach this, and
 * why — because that is the only thing the map cannot already say. The counts
 * live in the bar and the four states live in the key, so repeating either
 * here would be furniture.
 */

const CARD_W = 276
const MAX_H = 360
const PREVIEW = 4

/** The map's own status colours, so the card and the box cannot disagree. */
const TONE: Record<string, { dot: string; ring: string }> = {
  covered: { dot: '#bbf7d0', ring: '#16a34a' },
  gap: { dot: '#fef9c3', ring: '#ca8a04' },
  beyond: { dot: '#bbf7d0', ring: '#16a34a' },
  untouched: { dot: '#ffffff', ring: '#94a3b8' },
}

/**
 * The one-line verdict.
 *
 * `beyond` reads differently with and without a persona: in the whitespace view
 * there is no map to be outside of, so every reached variable is simply reached.
 */
function verdict(
  standing: NodeStanding,
  withPersona: boolean,
): { label: string; note: string } {
  switch (standing) {
    case 'covered':
      return {
        label: 'Reached',
        note: "In this persona's map, and a programme that applies to them reaches it.",
      }
    case 'beyond':
      return withPersona
        ? {
            label: 'Reached, outside their map',
            note: 'A programme reaches it, but this persona has not marked it as mattering to them.',
          }
        : { label: 'Reached', note: 'At least one programme reaches this variable.' }
    case 'gap':
      return {
        label: 'Opportunity area',
        note: 'Applies to this persona, but no programme reaches it yet.',
      }
    default:
      return withPersona
        ? {
            label: 'Not reached',
            note: "Not in this persona's map, and nothing that applies to them reaches it.",
          }
        : { label: 'Whitespace', note: 'No programme reaches this variable.' }
  }
}

export interface InterventionCardProps {
  anchor: AnchorRect | null
  container: { width: number; height: number }
  node: Node | null
  standing: NodeStanding | undefined
  /** Programmes reaching this variable that apply to the persona. */
  reaching: NodeProvenance['via']
  /**
   * Programmes reaching it that this persona is not eligible for. Only ever
   * non-empty on a gap, and the reason a gap is worth separating from `outside`:
   * something already covers this variable, just not for them.
   */
  ineligible: NodeProvenance['via']
  /**
   * Programmes that would reach it but have been unticked. This is what the
   * filter is costing, and it is the only place that cost is visible — on the
   * map an unticked programme simply stops existing.
   */
  unticked: NodeProvenance['via']
  withPersona: boolean
  onClose: () => void
}

export function InterventionCard({
  anchor,
  container,
  node,
  standing,
  reaching,
  ineligible,
  unticked,
  withPersona,
  onClose,
}: InterventionCardProps) {
  if (!node || !standing) return null

  const { label, note } = verdict(standing, withPersona)
  const tone = TONE[standing] ?? TONE.untouched
  const sections = [reaching, unticked, ineligible].filter((v) => v.length > 0).length
  const rows = [reaching, unticked, ineligible].reduce(
    (total, via) => total + Math.min(via.length, PREVIEW + 1),
    0,
  )
  const height = Math.min(MAX_H, 150 + sections * 26 + rows * 30)
  const { left, top } = anchor
    ? placeCard(anchor, container, CARD_W, height)
    : cornerPlacement(container, CARD_W)

  return (
    <div
      role="dialog"
      aria-label={node.label}
      style={{ left, top, width: CARD_W, maxHeight: height }}
      className="absolute z-20 flex flex-col overflow-hidden rounded-xl border border-gray-300 bg-white shadow-[0_8px_28px_-6px_rgba(0,0,0,0.26)]"
    >
      <div key={node.id} className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-gray-100 px-3 pb-2.5 pt-3">
          <p className="pr-6 text-[13.5px] font-semibold leading-snug text-gray-900">
            {node.label}
          </p>
          <span
            className="mt-2 inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11.5px] font-medium text-gray-800"
            style={{ backgroundColor: tone.dot, borderColor: tone.ring }}
          >
            {label}
          </span>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-gray-600">
            {note}
          </p>
        </div>

        {reaching.length > 0 && (
          <Programmes
            heading={`Reached by ${reaching.length}`}
            via={reaching}
          />
        )}

        {unticked.length > 0 && (
          <Programmes
            heading="Would reach it, but unticked"
            via={unticked}
            muted
          />
        )}

        {ineligible.length > 0 && (
          <Programmes
            heading="Covers it, but not for this persona"
            via={ineligible}
            muted
          />
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        title="Close (Esc)"
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
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
  )
}

/**
 * Programmes reaching this node, each with its reason.
 */
function Programmes({
  heading,
  via,
  muted = false,
}: {
  heading: string
  via: NodeProvenance['via']
  muted?: boolean
}) {
  const [open, setOpen] = useState(false)
  const hidden = via.length - PREVIEW
  const shown = open || hidden <= 0 ? via : via.slice(0, PREVIEW)

  return (
    <div className="border-b border-gray-100 px-3 py-2 last:border-b-0">
      <p className="text-[10.5px] uppercase tracking-wide text-gray-400">
        {heading}
      </p>
      <ul
        className={[
          'mt-1.5 space-y-2',
          muted ? 'text-gray-500' : 'text-gray-800',
        ].join(' ')}
      >
        {shown.map((entry, i) => (
          <li key={`${entry.programme.id}-${i}`} className="text-[12px] leading-[1.45]">
            <span className="font-medium">{entry.programme.name}</span>
            <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
              {entry.reason}
            </p>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="mt-0.5 text-[11px] text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-gray-800"
        >
          {open ? 'Show fewer' : `${hidden} more`}
        </button>
      )}
    </div>
  )
}
