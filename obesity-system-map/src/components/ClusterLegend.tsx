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
  /** Shrunk to a pill. A user preference, so it survives mode switches. */
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  /** Px covered by a side panel, so the legend sits beside it, not under it. */
  rightInset?: number
  /** Px covered by a bottom bar, for the same reason. */
  bottomInset?: number
  /** Legend swatches follow the map's palette; see src/data/contrast.ts. */
  highContrast: boolean
  /**
   * False where the map is not painting variables by their group.
   *
   * Intervention paints every box by whether a programme reaches it, so a type
   * swatch there promises a colour that appears nowhere — and it does it beside
   * a second key that is telling the truth about the same boxes. The filter
   * underneath is still worth having, so the swatch goes and the box stays.
   */
  showSwatches?: boolean
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

/**
 * The colour key and the cluster filter.
 *
 * Both live here because they are the same question asked twice — "what do these
 * colours mean" and "show me only these" — and answering one usually leads
 * straight to the other.
 *
 * It used to render in Explore alone, and to slide away entirely whenever
 * anything was selected. Two things followed from that, both bad. The key
 * vanished at the exact moment a variable's colour became relevant, and Profile —
 * whose whole visual language is "a marked variable gets its cluster colour back"
 * — never had a key at all. And because the filter is housed in the same box,
 * changing a filter meant closing whatever you were reading, changing it, then
 * finding your way back.
 *
 * So it now shows in every mode and stays put. Panels no longer hide it: it is
 * offset clear of them, and it collapses to a pill when the corner is genuinely
 * needed for something else.
 *
 * In Intervention it shows without swatches — see `showSwatches`. The two halves
 * come apart there: the filter is as useful as anywhere, and the colour key is
 * not merely redundant but wrong, since that mode paints boxes by reach.
 */
export function ClusterLegend({
  taxonomy,
  onTaxonomyChange,
  hiddenGroups,
  onToggleGroup,
  onShowAll,
  onHideAll,
  collapsed,
  onCollapsedChange,
  rightInset = 0,
  bottomInset = 0,
  highContrast,
  showSwatches = true,
}: ClusterLegendProps) {
  const entries =
    taxonomy === 'type'
      ? variableTypes.map((t) => ({
          name: t.name,
          nodeCount: t.nodeCount,
          // A legend showing the artwork's pastel while the map shows the
          // retint would be worse than either on its own.
          swatch: showSwatches
            ? ((highContrast
                ? (contrastSwatch(t.name) ?? t.swatch)
                : t.swatch) as string | undefined)
            : undefined,
        }))
      : atlasClusters.map((c) => ({
          name: c.name,
          nodeCount: c.nodeCount,
          swatch: undefined,
        }))

  const shown = entries.length - hiddenGroups.size
  const filtering = hiddenGroups.size > 0

  // Sits below the review sheet and the profile bar on purpose (z-10): those are
  // deliberate full-attention surfaces, and a key that paints over them would be
  // worse than one briefly covered. Panels are cleared by the insets instead.
  //
  // The offsets snap rather than ease. Transitioning `right` animates layout, and
  // a half-finished slide leaves the box overlapping the very panel the offset
  // exists to clear — a position that is merely correct beats one that is
  // usually correct and prettier on the way.
  const shell = 'absolute z-10 flex flex-col'
  const position = { right: 16 + rightInset, bottom: 16 + bottomInset }
  /**
   * Never taller than the stage leaves room for. Percentages on an absolutely
   * positioned box resolve against its containing block, so this is the stage's
   * height less the offset it already sits at and a matching gap on top. Without
   * it the box runs off the top of a short laptop window and takes the taxonomy
   * tabs with it — the one control you cannot do without.
   */
  const maxHeight = `calc(100% - ${32 + bottomInset}px)`

  if (collapsed) {
    return (
      <div className={shell} style={position}>
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          aria-expanded={false}
          title="Show the colour key and cluster filter"
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 py-2 text-[11px] font-medium text-gray-700 shadow-lg hover:bg-gray-50"
        >
          {/* A few swatches, so the pill says "colour key" without the words. */}
          <span aria-hidden="true" className="flex shrink-0 gap-0.5">
            {entries.slice(0, 3).map((entry) => (
              <span
                key={entry.name}
                className="h-3 w-3 rounded-[2px] border border-gray-300"
                style={{ backgroundColor: entry.swatch ?? '#e5e7eb' }}
              />
            ))}
          </span>
          Key &amp; filters
          {/* Only when something is hidden: otherwise the badge would imply a
              filter is active when nothing is filtered. */}
          {filtering && (
            <span className="rounded-full bg-gray-900 px-1.5 text-[10px] tabular-nums text-white">
              {shown}/{entries.length}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className={shell} style={{ ...position, maxHeight }}>
      <div className="flex min-h-0 w-56 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white/95 p-3 shadow-lg">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
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
                    'rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors',
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
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-[10px] font-medium text-gray-400">
              {shown}/{entries.length}
            </span>
            <button
              type="button"
              onClick={() => onCollapsedChange(true)}
              aria-expanded
              aria-label="Hide the colour key and cluster filter"
              title="Hide the colour key and cluster filter"
              className="-mr-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
                <path
                  d="M1 3.5 5 7.5l4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* The only part that gives way when space is short: the tabs, the
            show/hide buttons and the influence key all stay put. */}
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {entries.map((entry) => {
            const isHidden = hiddenGroups.has(entry.name)
            return (
              <li key={entry.name}>
                <button
                  type="button"
                  aria-pressed={!isHidden}
                  onClick={() => onToggleGroup(entry.name)}
                  title={`${entry.nodeCount} variables — click to ${isHidden ? 'show' : 'hide'}`}
                  className={[
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px]',
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

        <div className="mt-2 flex shrink-0 gap-1 border-t border-gray-200 pt-2">
          <button
            type="button"
            onClick={onShowAll}
            className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
          >
            Show all
          </button>
          <button
            type="button"
            onClick={onHideAll}
            className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
          >
            Hide all
          </button>
        </div>

        <div className="mt-2 shrink-0 space-y-1 border-t border-gray-200 pt-2">
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
