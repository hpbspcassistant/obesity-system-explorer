import {
  connections,
  connectionsById,
  incomingByNode,
  nodes,
  nodesById,
  outgoingByNode,
} from '../data/systemMap'
import type { Connection } from '../types'

/**
 * Profiles: a curated point of view on the map.
 *
 * A profile is NOT "everything that affects this persona". Almost every factor
 * reaches almost every other, so a "what applies" view would light up the whole
 * map and every persona would look identical. Instead a person marks what they
 * judge to be significant, and that judgement is binary — marked or not. There
 * is deliberately no weight, score or level anywhere in this file, and the store
 * is two sets, so magnitude has nowhere to live even by accident.
 *
 * This module uses only adjacency — which factor connects to which. It shares
 * the `outgoingByNode`/`incomingByNode` indexes with Trace because those live in
 * the data layer, but it imports nothing from `lib/trace.ts`: no routes, no path
 * enumeration, no distance. Profile grows one step at a time, by hand.
 */

export interface Profile {
  id: string
  name: string
  /** Freeform persona notes. Descriptive only — nothing reads or acts on them. */
  details: string
  nodeIds: ReadonlySet<number>
  edgeIds: ReadonlySet<string>
}

export const TOTAL_NODES = nodes.length
export const TOTAL_CONNECTIONS = connections.length

let idCounter = 0

export function createProfile(name: string, details = ''): Profile {
  idCounter += 1
  return {
    id: `p${Date.now().toString(36)}-${idCounter}`,
    name,
    details,
    nodeIds: new Set(),
    edgeIds: new Set(),
  }
}

/** Binary toggles. Returns a new profile; callers treat profiles as immutable. */
export function toggleNode(profile: Profile, nodeId: number): Profile {
  const nodeIds = new Set(profile.nodeIds)
  if (!nodeIds.delete(nodeId)) nodeIds.add(nodeId)
  return { ...profile, nodeIds }
}

export function toggleEdge(profile: Profile, connectionId: string): Profile {
  const edgeIds = new Set(profile.edgeIds)
  if (!edgeIds.delete(connectionId)) edgeIds.add(connectionId)
  return { ...profile, edgeIds }
}

/** Every connection touching a factor, in either direction. */
function connectionsTouching(nodeId: number) {
  return [
    ...(outgoingByNode.get(nodeId) ?? []),
    ...(incomingByNode.get(nodeId) ?? []),
  ]
}

/**
 * The suggestions. One step out from what is already marked, and no further —
 * the point is to answer "where do I go next?", not to reveal the whole map.
 *
 * Factors only. An earlier version also returned the connections reaching out
 * to them, which the map drew as a second layer: seventeen extra lines for a
 * three-factor profile, and no channel left to draw them in, since dash means
 * "negative" throughout the artwork. Naming the factors is the whole job.
 */
export function frontierOf(profile: Profile): ReadonlySet<number> {
  const nodeIds = new Set<number>()

  for (const nodeId of profile.nodeIds) {
    for (const connection of connectionsTouching(nodeId)) {
      const otherId =
        connection.sourceId === nodeId ? connection.targetId : connection.sourceId
      // A self-loop reaches nothing new.
      if (otherId === nodeId) continue
      if (profile.nodeIds.has(otherId)) continue
      nodeIds.add(otherId)
    }
  }

  return nodeIds
}

/**
 * Connections whose two ends are both marked but which are not marked
 * themselves. People mark the factors and forget the link that ties them, so
 * these are offered explicitly rather than left to be noticed.
 */
export function missingLinks(profile: Profile): string[] {
  const found: string[] = []
  for (const connection of connections) {
    if (profile.edgeIds.has(connection.id)) continue
    if (connection.sourceId === connection.targetId) continue
    if (
      profile.nodeIds.has(connection.sourceId) &&
      profile.nodeIds.has(connection.targetId)
    ) {
      found.push(connection.id)
    }
  }
  return found
}

/**
 * A connection written out in full. Marked connections are listed in the review
 * sheet with no map context around them, so both ends have to be named.
 */
export function connectionLabel(connection: Connection): string {
  const from = nodesById.get(connection.sourceId)?.label ?? connection.sourceId
  const to = nodesById.get(connection.targetId)?.label ?? connection.targetId
  return `${from} → ${to}`
}

/* ------------------------------------------------------------------ summary */

export interface ClusterTally {
  name: string
  nodeIds: number[]
}

/**
 * Marked factors grouped for the sidebar, using the map's own colour grouping —
 * the ten the brief asks for. Only groups with something in them are returned.
 */
export function markedByCluster(profile: Profile): ClusterTally[] {
  const byName = new Map<string, number[]>()
  for (const nodeId of profile.nodeIds) {
    const node = nodesById.get(nodeId)
    if (!node) continue
    const list = byName.get(node.mapCluster)
    if (list) list.push(nodeId)
    else byName.set(node.mapCluster, [nodeId])
  }
  return [...byName]
    .map(([name, ids]) => ({
      name,
      nodeIds: ids.sort((a, b) =>
        (nodesById.get(a)?.label ?? '').localeCompare(
          nodesById.get(b)?.label ?? '',
        ),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/* ------------------------------------------------------- persistence & files */

const STORAGE_KEY = 'obesity-system-map.profiles.v1'

interface StoredProfile {
  id: string
  name: string
  details: string
  nodeIds: number[]
  edgeIds: string[]
}

function toStored(profile: Profile): StoredProfile {
  return {
    id: profile.id,
    name: profile.name,
    details: profile.details,
    nodeIds: [...profile.nodeIds],
    edgeIds: [...profile.edgeIds],
  }
}

export interface ParseResult {
  profile: Profile
  /** Ids in the file that this map does not contain, so the user is told. */
  droppedNodeIds: number[]
  droppedEdgeIds: string[]
}

/**
 * Rebuild a profile from untrusted JSON — a hand-edited file, or one exported
 * from a different build of the map. Unknown ids are dropped and reported
 * rather than silently kept, which would leave marks that can never be seen.
 */
export function parseProfile(input: unknown): ParseResult | null {
  if (typeof input !== 'object' || input === null) return null
  const raw = input as Record<string, unknown>
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return null

  const nodeIds = new Set<number>()
  const droppedNodeIds: number[] = []
  if (Array.isArray(raw.nodeIds)) {
    for (const value of raw.nodeIds) {
      const id = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(id)) continue
      if (nodesById.has(id)) nodeIds.add(id)
      else droppedNodeIds.push(id)
    }
  }

  const edgeIds = new Set<string>()
  const droppedEdgeIds: string[] = []
  if (Array.isArray(raw.edgeIds)) {
    for (const value of raw.edgeIds) {
      if (typeof value !== 'string') continue
      if (connectionsById.has(value)) edgeIds.add(value)
      else droppedEdgeIds.push(value)
    }
  }

  idCounter += 1
  return {
    profile: {
      id:
        typeof raw.id === 'string' && raw.id
          ? raw.id
          : `p${Date.now().toString(36)}-${idCounter}`,
      name,
      details: typeof raw.details === 'string' ? raw.details : '',
      nodeIds,
      edgeIds,
    },
    droppedNodeIds,
    droppedEdgeIds,
  }
}

export function loadProfiles(): Profile[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as unknown
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as Record<string, unknown>)?.profiles as unknown)
    if (!Array.isArray(list)) return []
    return list
      .map((entry) => parseProfile(entry)?.profile)
      .filter((p): p is Profile => p !== undefined)
  } catch {
    // A corrupt or unreadable store must never stop the map from loading.
    return []
  }
}

export function saveProfiles(profiles: readonly Profile[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, profiles: profiles.map(toStored) }),
    )
  } catch {
    // Private-browsing quota errors are not worth interrupting marking for.
  }
}

/** The exported file: name, details, and the two id lists. Nothing else. */
export function profileToJson(profile: Profile): string {
  return JSON.stringify(
    {
      ...toStored(profile),
      _meta: {
        source: 'Foresight Obesity System Map explorer',
        totalNodes: TOTAL_NODES,
        totalConnections: TOTAL_CONNECTIONS,
      },
    },
    null,
    2,
  )
}

export function downloadProfile(profile: Profile): void {
  const safe = profile.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const blob = new Blob([profileToJson(profile)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `profile-${safe || 'persona'}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
