import { clusters } from '../data/systemMap'

interface ClusterLegendProps {
  hiddenClusters: ReadonlySet<string>
  onToggleCluster: (name: string) => void
  onShowAll: () => void
  onHideAll: () => void
  /** Shifted left so the legend clears the detail panel when it is open. */
  offset: boolean
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

export function ClusterLegend({
  hiddenClusters,
  onToggleCluster,
  onShowAll,
  onHideAll,
  offset,
}: ClusterLegendProps) {
  const activeFilterCount = hiddenClusters.size

  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 z-20 transition-transform duration-300 ease-out"
      style={{ transform: offset ? 'translateX(-22.5rem)' : undefined }}
    >
      <div className="pointer-events-auto w-52 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Clusters
          </h2>
          {activeFilterCount > 0 && (
            <span className="text-[10px] font-medium text-gray-400">
              {clusters.length - activeFilterCount}/{clusters.length} shown
            </span>
          )}
        </div>

        <ul className="space-y-1">
          {clusters.map((cluster) => {
            const hidden = hiddenClusters.has(cluster.name)
            return (
              <li key={cluster.name}>
                <button
                  type="button"
                  aria-pressed={!hidden}
                  onClick={() => onToggleCluster(cluster.name)}
                  title={`${cluster.nodeCount} nodes — click to ${hidden ? 'show' : 'hide'}`}
                  className={[
                    'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px]',
                    'border transition-colors duration-150',
                    hidden
                      ? 'border-dashed border-gray-300 text-gray-400'
                      : 'border-transparent text-gray-800 hover:border-gray-300 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-6 shrink-0 rounded-[3px] border"
                    style={{
                      backgroundColor: hidden ? 'transparent' : cluster.swatch,
                      borderColor: hidden ? '#cbd5e1' : '#9EA4AB',
                    }}
                  />
                  <span className={hidden ? 'line-through' : undefined}>
                    {cluster.name}
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
