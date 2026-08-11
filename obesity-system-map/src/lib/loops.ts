import rawLoops from '../data/loops.json'
import { connectionsById, nodes, outgoingByNode } from '../data/systemMap'
import type { Influence } from '../types'
import type { PathSet, Route, RouteHop, RouteSearch } from './trace'

/**
 * Reinforcing loops.
 *
 * A reinforcing loop is a path that leaves a variable, comes back to it, and
 * strengthens itself on the way round — a snowball rather than a thermostat.
 * Whether a loop reinforces or balances is decided by the number of negative
 * links in it: an odd number flips the sign somewhere and the loop damps itself.
 * That arithmetic is done at build time (`scripts/build_loops.py`), which also
 * asserts the derived set matches the reviewed workbook exactly.
 *
 * Two things this module deliberately does NOT do:
 *
 * 1. It does not claim completeness. The loops are capped at `MAX_LOOP_LENGTH`
 *    variables because loop counts roughly double per extra variable and there is no
 *    way to characterise the set without enumerating it — unlike reachability,
 *    where two breadth-first passes settle it. Every count here is "up to N".
 *
 * 2. It does not reuse the trace search. It reads the precomputed loops and
 *    reshapes them into the `Route`/`PathSet` shapes the trace panel and map
 *    already render, so the map layers, the focus highlight and the step-through
 *    animation all work unchanged. The types are imported for their shape only.
 */

interface RawLoop {
  id: string
  nodeIds: number[]
  type: string
  negativeLinks: number
  touchesEngine: boolean
}

const meta = rawLoops._meta as { maxLength: number; reinforcing: number }
const allLoops = rawLoops.loops as RawLoop[]

/** The longest loop the data knows about. A hard limit, not a preference. */
export const MAX_LOOP_LENGTH = meta.maxLength
/** Opens showing everything known, so the slider only ever simplifies. */
export const DEFAULT_LOOP_LENGTH = meta.maxLength
export const TOTAL_REINFORCING_LOOPS = meta.reinforcing

const reinforcing = allLoops.filter((loop) => loop.type === 'reinforcing')

/** variable -> the reinforcing loops it sits in, shortest first. */
const loopsByNode = new Map<number, RawLoop[]>()
for (const loop of reinforcing) {
  for (const nodeId of loop.nodeIds) {
    const list = loopsByNode.get(nodeId)
    if (list) list.push(loop)
    else loopsByNode.set(nodeId, [loop])
  }
}
for (const list of loopsByNode.values()) {
  list.sort((a, b) => a.nodeIds.length - b.nodeIds.length || a.id.localeCompare(b.id))
}

/** Variables sitting in at least one reinforcing loop of any known length. */
export const variablesInReinforcingLoop = nodes.filter((n) => loopsByNode.has(n.id))
  .length

export function hasReinforcingLoop(nodeId: number): boolean {
  return loopsByNode.has(nodeId)
}

/** Total reinforcing loops through a variable, ignoring the length slider. */
export function reinforcingLoopCount(nodeId: number): number {
  return loopsByNode.get(nodeId)?.length ?? 0
}

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

export interface LoopRoute extends Route {
  loopId: string
  touchesEngine: boolean
}

/**
 * Rotates a loop so it opens on the chosen variable and closes back on it, then
 * reshapes it as a route. Reading "Stress → Perceived Lack of Time → Stress"
 * is what makes the loop legible; the stored form always opens on the loop's
 * lowest id, which is an artefact of how it was found.
 */
function toRoute(loop: RawLoop, startId: number): LoopRoute {
  const at = loop.nodeIds.indexOf(startId)
  const rotated = [...loop.nodeIds.slice(at), ...loop.nodeIds.slice(0, at)]
  // Closing the ring explicitly: the chain and the animation both need the
  // return trip to exist as a hop, not be implied.
  const nodeIds = [...rotated, startId]
  return {
    key: `${loop.id}@${startId}`,
    loopId: loop.id,
    startId,
    // A loop ends where it began, so there is no separate destination. Left as
    // the start rather than null so the shared Route shape stays honest.
    destinationId: startId,
    nodeIds,
    hops: nodeIds.slice(1).map((to, i) => buildHop(nodeIds[i], to)),
    length: nodeIds.length - 1,
    touchesEngine: loop.touchesEngine,
  }
}

export interface LoopSearch extends RouteSearch {
  routes: LoopRoute[]
  /** Loops through this variable at any known length, ignoring the slider. */
  totalLoops: number
  /** Longest loop available through this variable — the top of the slider. */
  longest: number
  shortest: number
}

export function reinforcingLoopsThrough(
  startId: number,
  maxLength: number,
): LoopSearch {
  const all = loopsByNode.get(startId) ?? []
  const routes = all
    .filter((loop) => loop.nodeIds.length <= maxLength)
    .map((loop) => toRoute(loop, startId))
  return {
    routes,
    // Never truncated: within the cap this is the complete list, which is why
    // loops can be enumerated honestly where routes could not.
    truncated: false,
    maxHops: maxLength,
    totalLoops: all.length,
    longest: all.reduce((n, l) => Math.max(n, l.nodeIds.length), 0),
    shortest: all.reduce(
      (n, l) => Math.min(n, l.nodeIds.length),
      Number.POSITIVE_INFINITY,
    ),
  }
}

/**
 * Everything on any reinforcing loop through the variable, for the map. Built by
 * union over the enumerated loops, so at a given cap the map and the list agree
 * exactly — there is no approximation to explain here.
 */
export function loopPathSet(startId: number, maxLength: number): PathSet {
  const all = loopsByNode.get(startId) ?? []
  const nodeIds = new Set<number>()
  const connectionIds = new Set<string>()
  let totalNodes = 0
  let totalConnections = 0
  const everyNode = new Set<number>()
  const everyConnection = new Set<string>()

  for (const loop of all) {
    const within = loop.nodeIds.length <= maxLength
    const ring = [...loop.nodeIds, loop.nodeIds[0]]
    for (let i = 0; i < ring.length - 1; i++) {
      const from = ring[i]
      everyNode.add(from)
      if (within && from !== startId) nodeIds.add(from)
      for (const id of buildHop(from, ring[i + 1]).connectionIds) {
        everyConnection.add(id)
        if (within) connectionIds.add(id)
      }
    }
  }
  everyNode.delete(startId)
  totalNodes = everyNode.size
  totalConnections = everyConnection.size

  return {
    startId,
    // Reported for the panel's copy; the trace search is never called with it.
    direction: 'loops',
    maxSteps: maxLength,
    nodeIds: [...nodeIds],
    connectionIds: [...connectionIds],
    // A loop has no destination, so nothing gets the arrival styling — that
    // orange ring would otherwise land on the starting variable itself.
    destinationIds: [],
    stepsForAll: all.reduce((n, l) => Math.max(n, l.nodeIds.length), 2),
    totalNodes,
    totalConnections,
  }
}
