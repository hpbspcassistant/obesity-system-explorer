import { contrastSwatch } from '../data/contrast'
import { atlasClusters, variableTypes } from '../data/systemMap'
import type { Taxonomy } from '../types'

interface ClusterLegendProps {
  taxonomy: Taxonomy
  onTaxonomyChange: (taxonomy: Taxonomy) => void
  hiddenGroups: ReadonlySet<string>
  onToggleGroup: (name: string) => void
  onShowAll: () => void
  onHideAll: () => void
  /** Hidden while something is selected; the detail panel takes that corner. */
  hidden: boolean
  /** Legend swatches follow the map's palette; see src/data/contrast.ts. */
  highContrast: boolean
}

/** Solid line ending in an arrowhead, as printed on the original legend. */
function PositiveIcon() {
  return (
    <svg viewBox="0 0 44 10" className="h-2.5 w-11 shrink-0" aria-hidden="true">
      <path d="M0 5h34" stroke="#231f20" strokeWidth="1" fill="none" />
      <path d="M33 1.6 42 5l-9 3.4z" fill="#231f20" />
    </svg>
  )
}

/** Dashed line ending in a filled square, as printed on the original legend. */
function NegativeIcon() {
  return (
    <svg viewBox="0 0 44 10" className="h-2.5 w-11 shrink-0" aria-hidden="true">
      <path
        d="M0 5h35"
        stroke="#231f20"
        strokeWidth="1"
        strokeDasharray="2.2 1.8"
        fill="none"
      />
      <rect x="36" y="1.8" width="6.4" height="6.4" fill="#231f20" />
    </svg>
  )
}

const TABS: { id: Taxonomy; label: string; title: string }[] = [
  {
    id: 'type',
    label: 'Type',
    title: "The map's colour groupings — what the printed legend shows",
  },
  {
    id: 'cluster',
    label: 'Cluster',
    title: "The Foresight atlas's own classification",
  },
]

export function ClusterLegend({
  taxonomy,
  onTaxonomyChange,
  hiddenGroups,
  onToggleGroup,
  onShowAll,
  onHideAll,
  hidden,
  highContrast,
}: ClusterLegendProps) {
  const entries =
    taxonomy === 'type'
      ? variableTypes.map((t) => ({
          name: t.name,
          nodeCount: t.nodeCount,
          // A legend showing the artwork's pastel while the map shows the
          // retint would be worse than either on its own.
          swatch: (highContrast
            ? (contrastSwatch(t.name) ?? t.swatch)
            : t.swatch) as string | undefined,
        }))
      : atlasClusters.map((c) => ({
          name: c.name,
          nodeCount: c.nodeCount,
          swatch: undefined,
        }))

  const shown = entries.length - hiddenGroups.size

  return (
    <div
      aria-hidden={hidden}
      className={[
        'pointer-events-none absolute bottom-4 right-4 z-20',
        // Tailwind v4 emits the standalone `translate` property rather than
        // `transform`, so the transition must name `translate` or the slide snaps.
        'transition-[opacity,translate] duration-300 ease-out',
        hidden ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100',
      ].join(' ')}
    >
      <div
        className={[
          'w-56 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur',
          hidden ? 'pointer-events-none' : 'pointer-events-auto',
        ].join(' ')}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div
            role="radiogroup"
            aria-label="Group nodes by"
            className="inline-flex rounded-full bg-gray-100 p-0.5"
          >
            {TABS.map((tab) => {
              const active = tab.id === taxonomy
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-taxonomy={tab.id}
                  title={tab.title}
                  onClick={() => onTaxonomyChange(tab.id)}
                  className={[
                    'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                    active
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          <span className="shrink-0 text-[10px] font-medium text-gray-400">
            {shown}/{entries.length}
          </span>
        </div>

        <ul className="space-y-1">
          {entries.map((entry) => {
            const isHidden = hiddenGroups.has(entry.name)
            return (
              <li key={entry.name}>
                <button
                  type="button"
                  aria-pressed={!isHidden}
                  onClick={() => onToggleGroup(entry.name)}
                  title={`${entry.nodeCount} factors — click to ${isHidden ? 'show' : 'hide'}`}
                  className={[
                    'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px]',
                    'border transition-colors duration-150',
                    isHidden
                      ? 'border-dashed border-gray-300 text-gray-400'
                      : 'border-transparent text-gray-800 hover:border-gray-300 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {entry.swatch ? (
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-6 shrink-0 rounded-[3px] border"
                      style={{
                        backgroundColor: isHidden ? 'transparent' : entry.swatch,
                        borderColor: isHidden ? '#cbd5e1' : '#9EA4AB',
                      }}
                    />
                  ) : (
                    // Atlas clusters have no colour in the artwork, so the count
                    // stands in for a swatch rather than inventing a hue that
                    // appears nowhere on the map.
                    <span
                      aria-hidden="true"
                      className="w-6 shrink-0 text-right text-[10px] tabular-nums text-gray-400"
                    >
                      {entry.nodeCount}
                    </span>
                  )}
                  <span className={isHidden ? 'line-through' : undefined}>
                    {entry.name}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-2 flex gap-1 border-t border-gray-200 pt-2">
          <button
            type="button"
            onClick={onShowAll}
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-50"
          >
            Show all
          </button>
          <button
            type="button"
            onClick={onHideAll}
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-50"
          >
            Hide all
          </button>
        </div>

        <div className="mt-2 space-y-1 border-t border-gray-200 pt-2">
          <div className="flex items-center gap-2 text-[11px] text-gray-700">
            <PositiveIcon />
            <span>Positive influence</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-700">
            <NegativeIcon />
            <span>Negative influence</span>
          </div>
        </div>
      </div>
    </div>
  )
}
