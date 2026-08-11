import { cornerPlacement, placeCard } from '../lib/cardPlacement'
import type { AnchorRect } from './MapView'
import type { NodeProvenance, NodeStanding } from '../lib/reach'
import type { Node } from '../types'

/**
 * Why one variable is the colour it is.
 *
 * The whole card answers a single question — which programmes reach this, and
 * through what — because that is the only thing the map cannot already say. The
 * counts live in the bar and the four states live in the key, so repeating
 * either here would be furniture.
 *
 * The behaviour under each programme is the part worth keeping. A programme
 * "reaching" a variable is a claim made by the mapping, not a fact about the
 * world, and the behaviour is the claim's only visible workings. When the real
 * inventory replaces the placeholders it is what a reader checks against.
 */

const CARD_W = 276
const MAX_H = 360

/** The map's own status colours, so the card and the box cannot disagree. */
const TONE: Record<string, { dot: string; ring: string }> = {
  covered: { dot: '#bbf7d0', ring: '#16a34a' },
  gap: { dot: '#fecaca', ring: '#dc2626' },
  beyond: { dot: '#fed7aa', ring: '#ea580c' },
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
        note: 'In this persona’s map, and a programme that applies to them reaches it.',
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
        label: 'Gap',
        note: 'In this persona’s map, and nothing that applies to them reaches it.',
      }
    default:
      // "Nothing that applies to them", not "no programme": an untouched
      // variable can still be covered by a programme this persona fails the
      // gate for, and the flat claim contradicted the list underneath it.
      return withPersona
        ? {
            label: 'Not reached',
            note: 'Not in this persona’s map, and nothing that applies to them reaches it.',
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
  // A cap, not a height: the card is `maxHeight`, so it sizes to its content
  // and this only decides when a scrollbar appears. That makes over-estimating
  // free and under-estimating a scrollbar on a card with three lines in it, so
  // the allowances below are deliberately loose — a behaviour heading and a
  // programme name both wrap at this width more often than not.
  const groups = new Set(
    [...reaching, ...unticked, ...ineligible].map(
      (v) => v.behaviour?.id ?? 'pinned',
    ),
  ).size
  const rows = reaching.length + unticked.length + ineligible.length
  const height = Math.min(MAX_H, 190 + groups * 26 + rows * 19)
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
      <div className="min-h-0 flex-1 overflow-y-auto">
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
            heading={
              withPersona ? 'Reached by' : `Reached by ${reaching.length}`
            }
            via={reaching}
          />
        )}

        {/* What the filter is costing on this variable. Listed before the
            eligibility group because it is the one the reader just caused, and
            the one they can undo. */}
        {unticked.length > 0 && (
          <Programmes
            heading="Would reach it, but unticked"
            via={unticked}
            muted
          />
        )}

        {/* "A programme covers this, and they are not eligible" is a different
            decision from "nothing covers it" — one is a question about the gate,
            the other about the inventory. */}
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
 * Programmes under the behaviour that carried each one here.
 *
 * Grouped rather than listed flat because the real inventory made a flat list
 * unreadable: the most-reached variable is named by 32 programmes, and all but
 * a handful arrive through the same behaviour, so the label repeated 30 times
 * down the card and buried the programme names it was meant to explain. As a
 * heading it is stated once.
 *
 * A null behaviour is the escape hatch — the programme names the node outright
 * — and gets its own group saying so, rather than a blank where the workings
 * should be.
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
  const groups = new Map<string, { label: string; names: string[] }>()
  for (const { programme, behaviour } of via) {
    const key = behaviour?.id ?? ' pinned'
    const group = groups.get(key)
    if (group) group.names.push(programme.name)
    else {
      groups.set(key, {
        label: behaviour ? `via ${behaviour.label}` : 'named directly',
        names: [programme.name],
      })
    }
  }

  return (
    <div className="border-b border-gray-100 px-3 py-2 last:border-b-0">
      <p className="text-[10.5px] uppercase tracking-wide text-gray-400">
        {heading}
      </p>
      {[...groups].map(([key, group]) => (
        <div key={key} className="mt-1.5">
          <p className="text-[11px] leading-snug text-gray-500">{group.label}</p>
          <ul className={muted ? 'text-gray-500' : 'text-gray-800'}>
            {group.names.map((name) => (
              <li key={name} className="py-px text-[12px] leading-snug">
                {name}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
