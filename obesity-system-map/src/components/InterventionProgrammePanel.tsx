import { useMemo, useRef, useState } from 'react'

import type { Applicability, Programme } from '../lib/reach'

/**
 * Picking which programmes the map should answer for.
 *
 * The mode's default question is "what reaches this persona", summed over every
 * programme they are eligible for. This asks the narrower one — what does *this*
 * programme reach, or these three — which is how you audit a tagging or price up
 * a portfolio.
 *
 * It does not recolour anything. The four states stay computed from everything
 * that applies, and a selection only fades what it does not reach; see the
 * `programme-filter` rule in map.css for why recolouring was rejected.
 *
 * Programmes the persona is not eligible for are listed and selectable, marked
 * as such. That is deliberate: five variables in the current inventory are
 * reachable only through gated programmes, so "what would we cover if we
 * widened this" is a real question and there is nowhere else to ask it. The
 * cost is that the map can then show reach this persona cannot actually get,
 * which is what the marking is for.
 */

export interface InterventionProgrammePanelProps {
  /** Split for the current persona; `applies` is everything in whitespace view. */
  applicability: Applicability
  /** Variables each programme reaches, so a row can say how much it covers. */
  reachSize: (programme: Programme) => number
  /** Null means no filter — every applicable programme counts, as by default. */
  selected: ReadonlySet<string> | null
  onSelectedChange: (next: ReadonlySet<string> | null) => void
  onClose: () => void
  /** True in the whitespace view, where eligibility is not being tested. */
  withoutPersona: boolean
}

interface Row {
  programme: Programme
  /** 'applies' | 'undetermined' | 'excluded', or null in whitespace view. */
  standing: keyof Applicability | null
}

const STANDING_NOTE: Record<keyof Applicability, string | null> = {
  applies: null,
  undetermined: 'characteristic not set',
  excluded: 'not eligible',
}

export function InterventionProgrammePanel({
  applicability,
  reachSize,
  selected,
  onSelectedChange,
  onClose,
  withoutPersona,
}: InterventionProgrammePanelProps) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement | null>(null)

  const rows = useMemo<Row[]>(() => {
    const of = (key: keyof Applicability): Row[] =>
      applicability[key].map((programme) => ({
        programme,
        standing: withoutPersona ? null : key,
      }))
    // Eligible first, then the ones needing a decision, then the rest. Sorting
    // by name inside each block rather than keeping the spreadsheet's order,
    // which is neither alphabetical nor meaningful to a reader.
    const byName = (a: Row, b: Row) =>
      a.programme.name.localeCompare(b.programme.name)
    return [
      ...of('applies').sort(byName),
      ...of('undetermined').sort(byName),
      ...of('excluded').sort(byName),
    ]
  }, [applicability, withoutPersona])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      row.programme.name.toLowerCase().includes(needle),
    )
  }, [rows, query])

  const isOn = (id: string) => selected === null || selected.has(id)

  /**
   * Toggling out of the unfiltered state has to materialise the full set first,
   * or unticking one row would read as "select only that one" — the opposite of
   * what a checkbox means.
   */
  const toggle = (id: string) => {
    const base = selected ?? new Set(rows.map((r) => r.programme.id))
    const next = new Set(base)
    if (!next.delete(id)) next.add(id)
    // Back to no filter rather than a set that happens to hold everything, so
    // the bar can say "all programmes" and the map can drop the fade entirely.
    onSelectedChange(next.size === rows.length ? null : next)
  }

  /** The audit gesture: this one and nothing else. */
  const solo = (id: string) => onSelectedChange(new Set([id]))

  const selectedCount = selected === null ? rows.length : selected.size

  return (
    <aside
      aria-label="Filter by programme"
      className="absolute bottom-0 right-0 top-0 z-20 flex w-[23rem] flex-col border-l border-gray-200 bg-white"
    >
      <div className="shrink-0 border-b border-gray-200 px-3 pb-2.5 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-gray-900">
            Filter by programme
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
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
        <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
          The map keeps its colours and fades whatever the chosen programmes do
          not reach.
        </p>

        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search programmes…"
          className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-[12.5px] focus:border-gray-800 focus:outline-none"
        />

        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectedChange(null)}
            disabled={selected === null}
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-[11.5px] font-medium text-gray-600 hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            All programmes
          </button>
          <button
            type="button"
            onClick={() => onSelectedChange(new Set())}
            disabled={selected !== null && selected.size === 0}
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-[11.5px] font-medium text-gray-600 hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            None
          </button>
          <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
            {selectedCount}/{rows.length}
          </span>
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {shown.length === 0 && (
          <li className="px-3 py-3 text-[12px] text-gray-500">
            Nothing matches “{query.trim()}”.
          </li>
        )}
        {shown.map(({ programme, standing }) => {
          const on = isOn(programme.id)
          const reach = reachSize(programme)
          const note = standing ? STANDING_NOTE[standing] : null
          return (
            <li key={programme.id} className="px-1.5">
              <div
                className={[
                  'flex items-start gap-2 rounded-md px-1.5 py-1.5',
                  on ? '' : 'opacity-55',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(programme.id)}
                  aria-label={programme.name}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900"
                />
                {/* The name solos rather than toggles. Auditing one programme is
                    the common gesture and it would otherwise mean None followed
                    by finding the row again. */}
                <button
                  type="button"
                  onClick={() => solo(programme.id)}
                  title={`Show only ${programme.name}`}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block text-[12.5px] leading-snug text-gray-800">
                    {programme.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-gray-400">
                    {reach === 0 ? (
                      // Four programmes in the inventory reach nothing at all.
                      // Selecting one lights an empty map, so the row says so
                      // rather than leaving that looking like a fault.
                      <span className="text-amber-700">reaches nothing</span>
                    ) : (
                      `${reach} variable${reach === 1 ? '' : 's'}`
                    )}
                    {note && <span className="text-gray-400"> · {note}</span>}
                  </span>
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
