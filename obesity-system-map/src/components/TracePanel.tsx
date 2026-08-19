import { useEffect, useState } from 'react'

import { TraceDirectionToggle } from './TraceDirectionToggle'
import { NO_DEFINITION, definitionOf, nodesById } from '../data/systemMap'
import type { LoopSearch } from '../lib/loops'
import { LIST_MAX_HOPS, isEnergyCore } from '../lib/trace'
import type { PathSet, Route, RouteSearch } from '../lib/trace'
import type { TraceDirection } from '../types'

interface TracePanelProps {
  direction: TraceDirection
  onDirectionChange: (direction: TraceDirection) => void
  startId: number | null
  paths: PathSet | null
  search: RouteSearch | null
  maxSteps: number
  onMaxStepsChange: (maxSteps: number) => void
  focusedRouteKey: string | null
  onFocusRoute: (key: string | null) => void
  animatedHops: number | null
  onPlay: () => void
  onStop: () => void
  onClear: () => void
}

const INITIAL_ROUTE_COUNT = 5
const ROUTE_PAGE_SIZE = 20
const NO_ROUTES: Route[] = []

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-gray-200 px-4 py-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * Replaces a graph-depth slider with three plain-language choices. Values above
 * six remain available, but stay behind an advanced disclosure because they are
 * rarely useful and can make the map much denser.
 */
function DistancePicker({
  loop,
  value,
  maximum,
  onChange,
}: {
  loop: boolean
  value: number
  maximum: number
  onChange: (value: number) => void
}) {
  const floor = loop ? 2 : 1
  const ceiling = Math.max(floor, maximum)
  const rawChoices = loop
    ? [
        { label: 'Short', value: Math.min(3, ceiling) },
        { label: 'Medium', value: Math.min(5, ceiling) },
        { label: 'Wider', value: Math.min(6, ceiling) },
      ]
    : [
        { label: 'Direct', value: Math.min(2, ceiling) },
        { label: 'Nearby', value: Math.min(4, ceiling) },
        { label: 'Wider', value: Math.min(6, ceiling) },
      ]
  const choices = rawChoices.filter(
    (choice, index) =>
      rawChoices.findIndex((other) => other.value === choice.value) === index,
  )
  const custom = !choices.some((choice) => choice.value === value)

  return (
    <div>
      <div className="flex gap-1">
        {choices.map((choice) => {
          const active = choice.value === value
          return (
            <button
              key={choice.label}
              type="button"
              onClick={() => onChange(choice.value)}
              aria-pressed={active}
              className={[
                'min-w-0 flex-1 rounded-md border px-2 py-2 text-center transition-colors',
                active
                  ? 'border-teal-700 bg-teal-50 text-teal-800'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              <span className="block text-xs font-medium">{choice.label}</span>
              <span className="mt-0.5 block text-[11px] text-gray-500">
                {choice.value} {loop ? 'variables' : 'steps'}
              </span>
            </button>
          )
        })}
      </div>

      {ceiling > 6 && (
        <details className="mt-2" open={custom || undefined}>
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-800">
            More distance options{custom ? ` · ${value} ${loop ? 'variables' : 'steps'}` : ''}
          </summary>
          <div className="mt-2 rounded-md bg-gray-50 px-2.5 py-2">
            <input
              type="range"
              data-testid="step-slider"
              min={floor}
              max={ceiling}
              step={1}
              value={value}
              onChange={(event) => onChange(Number(event.target.value))}
              className="w-full accent-teal-600"
            />
            <p className="mt-1 text-xs text-gray-500">
              Up to <strong className="font-medium text-gray-700">{value}</strong>{' '}
              {loop ? 'variables per loop' : 'steps per pathway'}
            </p>
          </div>
        </details>
      )}
    </div>
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
/**
 * What the variable at the end of the walk actually means.
 *
 * The starting variable has had a definition since Trace stopped being a
 * dead end for "what is this?", but a route is a chain of names and the other
 * five are just as likely to be unfamiliar. Reading a path meant recognising
 * every variable on it or going to Explore, which clears the trace.
 *
 * One at a time, and it follows the walk: press Trace and this is the variable
 * you have just arrived at, changing on each step. Definitions for every hop at
 * once would be six paragraphs where the list is one line per hop, which is a
 * wall rather than an answer.
 */
function ArrivalDefinition({
  route,
  animatedHops,
  startId,
}: {
  route: Route
  animatedHops: number | null
  startId: number
}) {
  // Mid-walk, wherever the last crossed arrow landed; otherwise where the route
  // ends, which is what the row was chosen for.
  const nodeId =
    animatedHops !== null && animatedHops > 0
      ? (route.nodeIds[Math.min(animatedHops, route.length)] ??
        route.destinationId)
      : route.destinationId

  // A loop closes on the variable it left, whose definition is already sitting
  // above the slider. Repeating it here would be the only thing this slot ever
  // said in loop mode.
  if (nodeId === startId) return null

  const node = nodesById.get(nodeId)
  if (!node) return null
  const definition = definitionOf(node)

  return (
    <p className="mb-1.5 border-t border-gray-100 pt-1.5 text-sm leading-relaxed">
      {/* Named, because which variable this describes changes as you walk. */}
      <span className="font-medium text-gray-700">{node.label}</span>{' '}
      <span className={definition ? 'text-gray-600' : 'italic text-gray-500'}>
        {definition ?? NO_DEFINITION}
      </span>
    </p>
  )
}

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
          'flex items-baseline gap-1.5 rounded px-1.5 py-1 text-sm leading-snug',
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
        'flex items-baseline gap-1.5 rounded px-1.5 py-1 text-sm leading-snug',
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
        <span className="text-gray-500">
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
  onDirectionChange,
  startId,
  paths,
  search,
  maxSteps,
  onMaxStepsChange,
  focusedRouteKey,
  onFocusRoute,
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
  const routes = search?.routes ?? NO_ROUTES
  const focused = routes.find((r) => r.key === focusedRouteKey) ?? null
  const animating = animatedHops !== null
  const finished =
    focused !== null && animatedHops !== null && animatedHops >= focused.length
  const running = animating && !finished
  const listCap = Math.min(maxSteps, LIST_MAX_HOPS)
  const startNode = startId === null ? null : (nodesById.get(startId) ?? null)
  const [visibleRouteCount, setVisibleRouteCount] = useState(INITIAL_ROUTE_COUNT)

  useEffect(() => {
    setVisibleRouteCount(INITIAL_ROUTE_COUNT)
  }, [startId, direction, maxSteps])

  // A guide action may select a route below the initial five. Keep the selected
  // row visible rather than highlighting something on the map with no row in
  // the panel to explain it.
  useEffect(() => {
    const index = routes.findIndex((route) => route.key === focusedRouteKey)
    if (index >= 0) {
      setVisibleRouteCount((current) => Math.max(current, index + 1))
    }
  }, [routes, focusedRouteKey])

  const shownRoutes = routes.slice(0, visibleRouteCount)
  const routesRemaining = Math.max(0, routes.length - shownRoutes.length)
  const canSize = paths !== null && (isLoops ? totalLoops > 0 : paths.stepsForAll > 0)
  const emptyMessage = isLoops
    ? 'No reinforcing loops found for this variable.'
    : direction === 'upstream'
      ? 'No variables feed into this one.'
      : 'No pathway from this variable reaches the energy core.'
  const resultHeadline = isLoops
    ? `${routes.length} reinforcing loop${routes.length === 1 ? '' : 's'} found`
    : direction === 'upstream'
      ? `${routes.length} contributing variable${routes.length === 1 ? '' : 's'} found`
      : `${routes.length} pathway${routes.length === 1 ? '' : 's'} found`

  return (
    <aside className="absolute inset-y-0 right-0 z-10 flex w-[23rem] max-w-[85vw] flex-col border-l border-gray-200 bg-white shadow-xl">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <h2 className="text-base font-semibold text-gray-900">Trace</h2>
        {startId !== null && (
          <button
            type="button"
            data-testid="clear-start"
            onClick={onClear}
            className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            Start over
          </button>
        )}
      </header>

      {startId === null || !paths ? (
        <div className="px-4 py-5">
          <p className="text-sm font-medium text-gray-900">
            Select a starting variable
          </p>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            Trace follows causal pathways through the system. Choose a variable
            to explore what it affects, what affects it, or the reinforcing loops
            that return to it.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Starting variable
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {startNode?.label}
            </p>
            {startNode && (
              <p
                data-testid="start-definition"
                className={[
                  'mt-1.5 text-xs leading-relaxed',
                  definitionOf(startNode)
                    ? 'text-gray-600'
                    : 'italic text-gray-500',
                ].join(' ')}
              >
                {definitionOf(startNode) ?? NO_DEFINITION}
              </p>
            )}
          </div>

          <Section title="Question">
            <TraceDirectionToggle
              direction={direction}
              onDirectionChange={onDirectionChange}
            />
          </Section>

          {direction === 'downstream' && isEnergyCore(startId) && (
            <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
              This variable is part of the energy core, so the trace follows it on
              to the other core variables.
            </p>
          )}

          {!canSize ? (
            <div className="border-t border-gray-200 px-4 py-4 text-sm text-gray-500">
              {emptyMessage}
            </div>
          ) : (
            <>
              <Section title={isLoops ? 'Loop size' : 'Distance'}>
                <DistancePicker
                  loop={isLoops}
                  value={maxSteps}
                  maximum={paths.stepsForAll}
                  onChange={onMaxStepsChange}
                />
                <p data-testid="path-counts" className="mt-2.5 text-sm font-medium text-gray-800">
                  {paths.nodeIds.length + 1} variables · {paths.connectionIds.length}{' '}
                  connections highlighted
                </p>
              </Section>

              <Section title={isLoops ? 'Reinforcing loops' : 'Pathways'}>
                <p data-testid="route-headline" className="mb-2 text-xs text-gray-500">
                  {routes.length === 0
                    ? isLoops
                      ? 'No reinforcing loops found at this size. Try a wider loop size.'
                      : `No pathway is available within ${listCap} steps.`
                    : resultHeadline}
                </p>

                <ul className="space-y-0.5">
                  {shownRoutes.map((route, index) => {
                    const active = route.key === focusedRouteKey
                    return (
                      <li key={route.key}>
                        <button
                          type="button"
                          data-route-key={route.key}
                          onClick={() => onFocusRoute(active ? null : route.key)}
                          className={[
                            'flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                            active
                              ? 'bg-teal-50 ring-1 ring-teal-200'
                              : 'hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <span className="w-4 shrink-0 tabular-nums text-gray-500">
                            {index + 1}
                          </span>
                          <span className="flex-1 text-gray-700">
                            <RouteChain route={route} loop={isLoops} />
                          </span>
                          <span className="shrink-0 text-xs text-gray-500">
                            {route.length} {route.length === 1 ? 'step' : 'steps'}
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
                                className="rounded-full bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700"
                              >
                                {running
                                  ? 'Stop'
                                  : finished
                                    ? 'Replay path'
                                    : 'Play path'}
                              </button>
                              <span className="text-xs text-gray-500">
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

                            <ArrivalDefinition
                              route={route}
                              animatedHops={animatedHops}
                              startId={startId}
                            />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {routes.length > INITIAL_ROUTE_COUNT && (
                  <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
                    {routesRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleRouteCount((current) => current + ROUTE_PAGE_SIZE)
                        }
                        className="text-xs font-medium text-teal-700 hover:text-teal-900"
                      >
                        Show {Math.min(ROUTE_PAGE_SIZE, routesRemaining)} more
                      </button>
                    )}
                    {visibleRouteCount > INITIAL_ROUTE_COUNT && (
                      <button
                        type="button"
                        onClick={() => {
                          const focusedIndex = routes.findIndex(
                            (route) => route.key === focusedRouteKey,
                          )
                          if (focusedIndex >= INITIAL_ROUTE_COUNT) onFocusRoute(null)
                          setVisibleRouteCount(INITIAL_ROUTE_COUNT)
                        }}
                        className="text-xs text-gray-500 hover:text-gray-800"
                      >
                        Show fewer
                      </button>
                    )}
                  </div>
                )}

              </Section>
            </>
          )}
        </div>
      )}
    </aside>
  )
}
