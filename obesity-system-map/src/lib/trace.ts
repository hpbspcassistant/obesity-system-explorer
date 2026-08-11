import {
  connectionsById,
  connections,
  incomingByNode,
  nodes,
  outgoingByNode,
} from '../data/systemMap'
import type { Connection, Influence, TraceDirection } from '../types'

/**
 * Tracing in either direction.
 *
 * Forward ends at the energy core — the variables the original map draws at its
 * centre, derived from the data rather than hardcoded. Backward has no
 * destination: it simply answers "what feeds into this variable", bounded by the
 * step slider.
 *
 * The map shows EVERY path, never trimmed. That is affordable because the union
 * of all routes is computable without enumerating any of them: a variable lies on
 * some route of at most N steps exactly when
 *
 *     distance(start → variable) + distance(variable → destination) <= N
 *
 * Two breadth-first passes, no combinatorics. This matters because the routes
 * themselves cannot be enumerated — one forward start has 227 routes within 6
 * steps and 106,718 within 16. So the map draws the complete picture at any
 * limit, and the side list enumerates only the short routes a person can read.
 */

export const ENERGY_CORE_CLUSTER = 'Engine'

export const energyCoreIds: readonly number[] = nodes
  .filter((n) => n.atlasCluster === ENERGY_CORE_CLUSTER)
  .map((n) => n.id)

const energyCoreSet = new Set(energyCoreIds)

export function isEnergyCore(nodeId: number): boolean {
  return energyCoreSet.has(nodeId)
}

export const TOTAL_VARIABLES = nodes.length

/* ------------------------------------------------------------- direction */

/** Steps taken along the arrows, or against them. */
function stepsAlong(nodeId: number, direction: TraceDirection): Connection[] {
  return direction === 'downstream'
    ? (outgoingByNode.get(nodeId) ?? [])
    : (incomingByNode.get(nodeId) ?? [])
}

/** The far end of a connection when travelling in `direction`. */
function farEnd(connection: Connection, direction: TraceDirection): number {
  return direction === 'downstream' ? connection.targetId : connection.sourceId
}

/**
 * Forward tracing heads somewhere: the energy core, the centre the whole map is
 * about. Backward tracing does not. "Variables with no incoming arrow" looked like
 * a mirror image, but it is an artefact of where the mapmakers stopped drawing —
 * the eight of them span unrelated clusters and include Ambient Temperature. So
 * backward simply answers "what feeds into this", bounded by the step slider.
 */
export function destinationsFor(
  startId: number,
  direction: TraceDirection,
): number[] {
  if (direction === 'upstream') return []
  return energyCoreIds.filter((id) => id !== startId)
}

function isDestination(nodeId: number, direction: TraceDirection): boolean {
  return direction === 'downstream' && isEnergyCore(nodeId)
}

function computeStepsTo(
  destinationIds: readonly number[],
  direction: TraceDirection,
): Map<number, number> {
  const dist = new Map<number, number>(destinationIds.map((id) => [id, 0]))
  const queue = [...destinationIds]
  // Walking *against* the trace direction, to measure distance to a destination.
  const back: TraceDirection =
    direction === 'downstream' ? 'upstream' : 'downstream'
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head]
    for (const connection of stepsAlong(v, back)) {
      const u = farEnd(connection, back)
      if (!dist.has(u)) {
        dist.set(u, dist.get(v)! + 1)
        queue.push(u)
      }
    }
  }
  return dist
}

// Few distinct destination sets exist, so caching them keeps every trace cheap.
const stepsToCache = new Map<string, Map<number, number>>()

function stepsToDestinations(
  destinationIds: readonly number[],
  direction: TraceDirection,
): Map<number, number> {
  const key = `${direction}:${destinationIds.join(',')}`
  let cached = stepsToCache.get(key)
  if (!cached) {
    cached = computeStepsTo(destinationIds, direction)
    stepsToCache.set(key, cached)
  }
  return cached
}

/**
 * Steps from the start to each variable, with destinations absorbing: a journey
 * ends the moment it arrives, so we never travel on *through* a destination to
 * reach something beyond it.
 */
function stepsFromStart(
  startId: number,
  direction: TraceDirection,
): Map<number, number> {
  const dist = new Map<number, number>([[startId, 0]])
  const queue = [startId]
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head]
    if (isDestination(u, direction) && u !== startId) continue
    for (const connection of stepsAlong(u, direction)) {
      const v = farEnd(connection, direction)
      if (!dist.has(v)) {
        dist.set(v, dist.get(u)! + 1)
        queue.push(v)
      }
    }
  }
  return dist
}

/* -------------------------------------------------------------- path set */

export interface PathSet {
  startId: number
  direction: TraceDirection
  maxSteps: number
  /** Variables on at least one route within the limit, excluding the start. */
  nodeIds: number[]
  connectionIds: string[]
  /** Destinations reached within the limit. */
  destinationIds: number[]
  /** Smallest limit that includes everything — the top of the slider. */
  stepsForAll: number
  totalNodes: number
  totalConnections: number
}

export function pathSetWithin(
  startId: number,
  maxSteps: number,
  direction: TraceDirection,
): PathSet {
  const fromStart = stepsFromStart(startId, direction)
  const destinations = destinationsFor(startId, direction)
  // Forward must also get *out* to a destination; backward just walks back.
  const stepsTo =
    direction === 'downstream'
      ? stepsToDestinations(destinations, direction)
      : null

  let stepsForAll = 0
  let totalNodes = 0
  const nodeIds: number[] = []
  for (const node of nodes) {
    const a = fromStart.get(node.id)
    if (a === undefined || node.id === startId) continue
    const b = stepsTo ? stepsTo.get(node.id) : 0
    if (b === undefined) continue
    totalNodes += 1
    stepsForAll = Math.max(stepsForAll, a + b)
    if (a + b <= maxSteps) nodeIds.push(node.id)
  }

  let totalConnections = 0
  const connectionIds: string[] = []
  for (const connection of connections) {
    // Travelling in `direction`, this connection runs from `near` to `far`.
    const near = direction === 'downstream' ? connection.sourceId : connection.targetId
    const far = direction === 'downstream' ? connection.targetId : connection.sourceId

    // A journey ends on arrival, so it never leaves a destination. Without this
    // the arrow rule outruns the variable rule and draws arrows heading out of a
    // destination toward variables that are — correctly — not lit.
    if (isDestination(near, direction) && near !== startId) continue

    const a = fromStart.get(near)
    if (a === undefined) continue
    const b = stepsTo ? stepsTo.get(far) : 0
    if (b === undefined) continue
    totalConnections += 1
    stepsForAll = Math.max(stepsForAll, a + 1 + b)
    if (a + 1 + b <= maxSteps) connectionIds.push(connection.id)
  }

  return {
    startId,
    direction,
    maxSteps,
    nodeIds,
    connectionIds,
    destinationIds: destinations.filter(
      (id) => (fromStart.get(id) ?? Infinity) <= maxSteps,
    ),
    stepsForAll,
    totalNodes,
    totalConnections,
  }
}

/* ------------------------------------------------------------- route list */

export interface RouteHop {
  toNodeId: number
  connectionIds: string[]
  influence: Influence
  mixedInfluence: boolean
}

export interface Route {
  key: string
  startId: number
  destinationId: number
  /** Always in causal order: cause first, effect last, whichever way we traced. */
  nodeIds: number[]
  hops: RouteHop[]
  length: number
}

export interface RouteSearch {
  routes: Route[]
  truncated: boolean
  maxHops: number
}

export const LIST_MAX_HOPS = 6
export const DEFAULT_MAX_STEPS = 4
const ROUTE_LIMIT = 600

function buildHop(fromId: number, toId: number): RouteHop {
  const connectionIds = (outgoingByNode.get(fromId) ?? [])
    .filter((c) => c.targetId === toId)
    .map((c) => c.id)
  const influences = new Set(
    connectionIds.map((id) => connectionsById.get(id)?.influence),
  )
  return {
    toNodeId: toId,
    connectionIds,
    influence:
      (connectionsById.get(connectionIds[0])?.influence as Influence) ??
      'positive',
    mixedInfluence: influences.size > 1,
  }
}

/**
 * Backward: one row per contributing variable, showing its shortest chain into
 * the start. Enumerating every backward chain is not an option — a median
 * variable has 47 within 4 steps and busy ones have 764 — and it answers the
 * wrong question anyway. "What affects this?" is about variables, not routes.
 */
function contributorsOf(startId: number, maxHops: number): RouteSearch {
  const parent = new Map<number, number>()
  const dist = new Map<number, number>([[startId, 0]])
  const queue = [startId]
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head]
    if (dist.get(v)! >= maxHops) continue
    for (const connection of incomingByNode.get(v) ?? []) {
      const u = connection.sourceId
      if (!dist.has(u)) {
        dist.set(u, dist.get(v)! + 1)
        parent.set(u, v)
        queue.push(u)
      }
    }
  }

  const routes: Route[] = []
  for (const [nodeId, steps] of dist) {
    if (nodeId === startId || steps > maxHops) continue
    // Follow parents forward: the chain already reads in causal order.
    const nodeIds = [nodeId]
    let cursor = nodeId
    while (cursor !== startId) {
      cursor = parent.get(cursor)!
      nodeIds.push(cursor)
    }
    routes.push({
      key: nodeIds.join('-'),
      startId,
      destinationId: nodeId,
      nodeIds,
      hops: nodeIds.slice(1).map((to, i) => buildHop(nodeIds[i], to)),
      length: nodeIds.length - 1,
    })
  }

  routes.sort((a, b) => a.length - b.length || a.key.localeCompare(b.key))
  return { routes, truncated: false, maxHops }
}

/**
 * Forward: every simple route between `startId` and a destination, at most
 * `maxHops`. Routes are always returned in causal order — cause first.
 */
export function routesWithin(
  startId: number,
  maxHops: number,
  direction: TraceDirection,
): RouteSearch {
  if (direction === 'upstream') return contributorsOf(startId, maxHops)

  const routes: Route[] = []
  const destinations = new Set(destinationsFor(startId, direction))
  let truncated = false

  const record = (walked: number[], destinationId: number) => {
    const nodeIds = direction === 'downstream' ? walked : [...walked].reverse()
    routes.push({
      key: nodeIds.join('-'),
      startId,
      destinationId,
      nodeIds,
      hops: nodeIds.slice(1).map((to, i) => buildHop(nodeIds[i], to)),
      length: nodeIds.length - 1,
    })
  }

  const walk = (path: number[], visited: Set<number>) => {
    if (routes.length >= ROUTE_LIMIT) {
      truncated = true
      return
    }
    if (path.length - 1 >= maxHops) return

    const u = path[path.length - 1]
    for (const connection of stepsAlong(u, direction)) {
      const v = farEnd(connection, direction)
      if (destinations.has(v)) {
        record([...path, v], v)
        if (routes.length >= ROUTE_LIMIT) {
          truncated = true
          return
        }
        continue
      }
      if (!visited.has(v)) {
        visited.add(v)
        walk([...path, v], visited)
        visited.delete(v)
      }
    }
  }

  walk([startId], new Set([startId]))
  routes.sort((a, b) => a.length - b.length || a.key.localeCompare(b.key))
  return { routes, truncated, maxHops }
}

/* ----------------------------------------------------------------- focus */

export interface TraceFocus {
  nodeIds: number[]
  connectionIds: string[]
}

/**
 * The one route being studied. Kept separate from the path set because hovering
 * the list changes only this, and rebuilding the whole map layer per mouse-over
 * cost ~7ms and read as flicker.
 */
export function buildFocus(
  route: Route | null,
  animatedHops: number | null,
): TraceFocus | null {
  if (!route) return null
  const shown =
    animatedHops === null ? route.hops : route.hops.slice(0, animatedHops)
  return {
    nodeIds: [route.nodeIds[0], ...shown.map((h) => h.toNodeId)],
    connectionIds: shown.flatMap((h) => h.connectionIds),
  }
}
