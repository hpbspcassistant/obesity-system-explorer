import { NO_DEFINITION, definitionOf, nodesById } from '../data/systemMap'
import { MAX_LOOP_LENGTH, type LoopSearch } from '../lib/loops'
import { LIST_MAX_HOPS, TOTAL_VARIABLES, isEnergyCore } from '../lib/trace'
import type { PathSet, Route, RouteSearch } from '../lib/trace'
import type { TraceDirection } from '../types'

interface TracePanelProps {
  direction: TraceDirection
  startId: number | null
  paths: PathSet | null
  search: RouteSearch | null
  maxSteps: number
  onMaxStepsChange: (maxSteps: number) => void
  focusedRouteKey: string | null
  onFocusRoute: (key: string | null) => void
  onHoverRoute: (key: string | null) => void
  animatedHops: number | null
  onPlay: () => void
  onStop: () => void
  onClear: () => void
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-gray-200 px-4 py-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

function RouteChain({ route, loop }: { route: Route; loop?: boolean }) {
  return (
    <span className="leading-snug">
      {route.nodeIds.map((id, i) => (
        <span key={`${id}-${i}`}>
          {i > 0 && <span className="text-gray-300"> → </span>}
          <span
            className={
              id === route.destinationId
                ? loop
                  ? 'font-medium text-teal-700'
                  : 'font-medium text-orange-700'
                : undefined
            }
          >
            {nodesById.get(id)?.label ?? id}
          </span>
        </span>
      ))}
    </span>
  )
}

/**
 * The link's direction of effect. The source data carries only
 * `influence`/`sign` per connection, so there is no written rationale to show.
 */
function HopLine({
  fromId,
  hop,
  crossed,
  showSign = true,
}: {
  fromId: number
  hop: Route['hops'][number]
  crossed: boolean
  showSign?: boolean
}) {
  const positive = hop.influence === 'positive'
  if (!showSign) {
    return (
      <li
        className={[
          'flex items-baseline gap-1.5 rounded px-1.5 py-1 text-[11px] leading-snug',
          crossed ? 'bg-teal-50 text-gray-800' : 'text-gray-500',
        ].join(' ')}
      >
        <span className="shrink-0 text-gray-300">-&gt;</span>
        <span>{nodesById.get(hop.toNodeId)?.label}</span>
      </li>
    )
  }
  return (
    <li
      className={[
        'flex items-baseline gap-1.5 rounded px-1.5 py-1 text-[11px] leading-snug',
        crossed ? 'bg-teal-50 text-gray-800' : 'text-gray-500',
      ].join(' ')}
    >
      <span
        className={[
          'shrink-0 font-bold',
          positive ? 'text-emerald-600' : 'text-rose-600',
        ].join(' ')}
      >
        {positive ? '+' : '−'}
      </span>
      <span>
        {nodesById.get(fromId)?.label}{' '}
        <span className="text-gray-400">
          {positive ? 'positively influences' : 'negatively influences'}
        </span>{' '}
        {nodesById.get(hop.toNodeId)?.label}
        {hop.mixedInfluence && (
          <span className="ml-1 text-amber-600">(mixed signs)</span>
        )}
      </span>
    </li>
  )
}

export function TracePanel({
  direction,
  startId,
  paths,
  search,
  maxSteps,
  onMaxStepsChange,
  focusedRouteKey,
  onFocusRoute,
  onHoverRoute,
  animatedHops,
  onPlay,
  onStop,
  onClear,
}: TracePanelProps) {
  const isLoops = direction === 'loops'
  // LoopSearch extends RouteSearch, so this narrowing is safe and keeps the
  // loop-only counts out of the route path.
  const loops = isLoops ? (search as LoopSearch | null) : null
  const totalLoops = loops?.totalLoops ?? 0
  const routes = search?.routes ?? []
  const focused = routes.find((r) => r.key === focusedRouteKey) ?? null
  const animating = animatedHops !== null
  const finished =
    focused !== null && animatedHops !== null && animatedHops >= focused.length
  const running = animating && !finished

  const showingAll = paths !== null && maxSteps >= paths.stepsForAll
  // How much of what the map is showing these listed routes actually account
  // for. Past the list's step cap the map keeps growing and the list cannot,
  // and without this number that gap looks like a glitch.
  const coveredByRoutes = new Set(routes.flatMap((r) => r.nodeIds))
  const litCount = paths ? paths.nodeIds.length : 0
  const coveredCount = paths
    ? paths.nodeIds.filter((id) => coveredByRoutes.has(id)).length
    : 0
  const listCap = Math.min(maxSteps, LIST_MAX_HOPS)
  const listIsBehindMap = paths !== null && maxSteps > LIST_MAX_HOPS

  const startNode = startId === null ? null : (nodesById.get(startId) ?? null)

  return (
    <aside className="absolute inset-y-0 right-0 z-10 flex w-[23rem] max-w-[85vw] flex-col border-l border-gray-200 bg-white shadow-xl">
      <header className="px-4 py-3">
        <h2 className="text-base font-semibold text-gray-900">Trace</h2>
        <p className="mt-0.5 text-[11px] text-gray-500">
          {isLoops
            ? 'Loops that leave a variable and come back to it, reinforcing on the way round'
            : direction === 'downstream'
              ? 'Following the arrows outward to the energy core'
              : 'Following the arrows backward — what feeds into this variable'}
        </p>
      </header>

      {startId === null || !paths ? (
        <div className="px-4 py-3 text-sm text-gray-400">
          Click a variable on the map, or search for one, to start tracing.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Section title="Starting from">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">
                {startNode?.label}
              </p>
              <button
                type="button"
                data-testid="clear-start"
                aria-label="Clear starting variable"
                title="Clear starting variable"
                onClick={onClear}
                className="-mr-1 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </button>
            </div>
            {/* Not "reaches": a journey ends on arrival, so this counts the
                variables that lie on a route TO the core, which is narrower than
                everything the start eventually influences. */}
            <p data-testid="reach-headline" className="mt-1 text-[11px]">
              {isLoops ? (
                totalLoops === 0 ? (
                  <span className="text-gray-500">
                    Not part of any reinforcing loop up to {MAX_LOOP_LENGTH}{' '}
                    variables long.
                  </span>
                ) : (
                  <span className="font-medium text-teal-700">
                    Sits in {totalLoops} reinforcing loop
                    {totalLoops === 1 ? '' : 's'} — the shortest closes in{' '}
                    {loops?.shortest} steps
                  </span>
                )
              ) : (
                <span className="text-gray-500">
                  {direction === 'downstream'
                    ? `${paths.totalNodes} of ${TOTAL_VARIABLES} variables lie on a route to ${isEnergyCore(startId) ? 'the rest of the energy core' : 'the energy core'}`
                    : `${paths.totalNodes} of ${TOTAL_VARIABLES} variables feed into this, directly or indirectly`}
                </span>
              )}
            </p>

            {/*
             * What the variable actually means, so Trace is self-contained.
             *
             * Trace deliberately does not open a detail panel — a click here
             * picks a starting variable and nothing else — which left "what does
             * this variable mean?" answerable only in Explore. Switching modes to
             * find out cleared the trace on the way, so reading a definition
             * cost you the work that prompted the question.
             *
             * Below the reach line rather than above it: the reach is the answer
             * the mode exists to give, and this is the supporting detail.
             */}
            {startNode && (
              <p
                data-testid="start-definition"
                className={[
                  'mt-2 border-t border-gray-100 pt-2 text-[11px] leading-relaxed',
                  definitionOf(startNode)
                    ? 'text-gray-600'
                    : 'italic text-gray-400',
                ].join(' ')}
              >
                {definitionOf(startNode) ?? NO_DEFINITION}
              </p>
            )}
          </Section>

          {direction === 'downstream' && isEnergyCore(startId) && (
            <p className="px-4 pb-1 text-[11px] text-gray-500">
              This variable is part of the energy core, so the trace follows it on
              to the other core variables.
            </p>
          )}

          {/* Nothing to size when the variable sits in no loop. */}
          {(!isLoops || totalLoops > 0) && (
            <>
              <Section title={isLoops ? 'Loop length' : 'Path length'}>
                <input
                  type="range"
                  data-testid="step-slider"
                  min={2}
                  max={paths.stepsForAll}
                  step={1}
                  value={maxSteps}
                  onChange={(e) => onMaxStepsChange(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
                {/* A path is just a chain of arrows, so drawing every arrow on
                    any route is the same as showing every path. No hedging. */}
                <div className="mt-1 text-[11px]">
                  {showingAll ? (
                    <span className="font-medium text-teal-700">
                      {isLoops
                        ? `Every loop up to ${MAX_LOOP_LENGTH} variables is shown`
                        : 'Any length — every path is shown'}
                    </span>
                  ) : (
                    <span className="text-gray-600">
                      Up to <span className="font-medium">{maxSteps}</span>{' '}
                      {isLoops ? 'variables' : 'steps'}
                    </span>
                  )}
                </div>

                <p data-testid="path-counts" className="mt-1.5 text-[11px] text-gray-500">
                  {paths.nodeIds.length} of {paths.totalNodes} variables ·{' '}
                  {paths.connectionIds.length} of {paths.totalConnections} arrows
                </p>
              </Section>

              <Section
                title={
                  isLoops
                    ? 'Reinforcing loops'
                    : direction === 'downstream'
                      ? 'Routes written out'
                      : 'Affected by'
                }
              >
                <p data-testid="route-headline" className="mb-2 text-[11px] text-gray-500">
                  {isLoops
                    ? routes.length === 0
                      ? `No reinforcing loop closes within ${maxSteps} variables. The shortest through this variable needs ${loops?.shortest}.`
                      : routes.length === totalLoops
                        ? `All ${totalLoops} reinforcing loop${totalLoops === 1 ? '' : 's'} through this variable, listed in full.`
                        : `${routes.length} of this variable's ${totalLoops} reinforcing loops — those closing within ${maxSteps} variables.`
                    : direction === 'upstream'
                    ? routes.length === 0
                      ? `Nothing feeds into this variable within ${listCap} steps.`
                      : `${routes.length} variable${routes.length === 1 ? '' : 's'} feed in within ${listCap} steps, each shown by its shortest chain.`
                    : routes.length === 0
                      ? `No complete routes within ${listCap} steps.`
                      : `${routes.length} route${routes.length === 1 ? '' : 's'} up to ${listCap} steps, covering ${coveredCount} of the ${litCount} variables on the map.`}
                  {listIsBehindMap && direction === 'downstream' && (
                    // The map is complete; only this list is a sample.
                    <span className="text-gray-500">
                      {' '}
                      The other {litCount - coveredCount} are reached only by
                      routes longer than {LIST_MAX_HOPS} steps — drawn, but far
                      too many to write out.
                    </span>
                  )}
                  {search?.truncated && ' (list truncated)'}
                  {isLoops && (
                    // The cap is a limit on what is known, not on what is drawn.
                    <span className="block pt-1 text-gray-400">
                      Loops longer than {MAX_LOOP_LENGTH} variables are not
                      included — there are thousands, and they cannot be
                      summarised without listing them.
                    </span>
                  )}
                </p>

                <ul className="space-y-0.5" onMouseLeave={() => onHoverRoute(null)}>
                  {routes.map((route, index) => {
                    const active = route.key === focusedRouteKey
                    return (
                      <li key={route.key}>
                        <button
                          type="button"
                          data-route-key={route.key}
                          onMouseEnter={() => onHoverRoute(route.key)}
                          onClick={() => onFocusRoute(active ? null : route.key)}
                          className={[
                            'flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-[11px]',
                            active
                              ? 'bg-teal-50 ring-1 ring-teal-200'
                              : 'hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <span className="w-4 shrink-0 tabular-nums text-gray-400">
                            {index + 1}
                          </span>
                          <span className="flex-1 text-gray-700">
                            <RouteChain route={route} loop={isLoops} />
                          </span>
                          <span className="shrink-0 text-[10px] text-gray-400">
                            {route.length}
                          </span>
                        </button>

                        {active && (
                          // Inline, not in a section below: with hundreds of
                          // routes the controls were an entire list-scroll away
                          // from the row you had just clicked.
                          <div className="mb-1 ml-6 rounded-md border-l-2 border-teal-200 pl-2">
                            <div className="my-1.5 flex items-center gap-1.5">
                              <button
                                type="button"
                                data-testid="trace-play"
                                onClick={running ? onStop : onPlay}
                                className="rounded-full bg-teal-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-teal-700"
                              >
                                {running ? 'Stop' : finished ? 'Replay' : 'Trace'}
                              </button>
                              <span className="text-[11px] text-gray-500">
                                {animating
                                  ? `Step ${animatedHops} of ${route.length}`
                                  : isLoops
                                    ? `comes back round in ${route.length} steps`
                                    : `${route.length} steps to ${nodesById.get(route.destinationId)?.label}`}
                              </span>
                            </div>

                            <ul className="space-y-0.5 pb-1">
                              {route.hops.map((hop, i) => (
                                <HopLine
                                  key={`${hop.toNodeId}-${i}`}
                                  fromId={route.nodeIds[i]}
                                  hop={hop}
                                  showSign={!isLoops}
                                  crossed={
                                    animatedHops === null || i < animatedHops
                                  }
                                />
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </Section>

            </>
          )}
        </div>
      )}

      {startId !== null && (
        <footer className="border-t border-gray-200 px-4 py-2.5">
          <button
            type="button"
            onClick={onClear}
            className="w-full rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Clear trace
          </button>
        </footer>
      )}
    </aside>
  )
}
