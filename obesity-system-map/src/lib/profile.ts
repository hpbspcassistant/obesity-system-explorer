import {
  connections,
  connectionsById,
  incomingByNode,
  nodes,
  nodesById,
  outgoingByNode,
} from '../data/systemMap'
import type { PersonaCharacteristics } from './reach'
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
  /**
   * What Coverage's gates test against. Separate from `nodeIds` because the two
   * answer different questions: these decide which programmes apply to this
   * person, the marks decide what matters to them. Neither affects the other.
   *
   * Absent on profiles saved before Coverage existed, and on any hand-written
   * file, so every reader must tolerate an empty object.
   */
  characteristics: PersonaCharacteristics
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
    characteristics: {},
    nodeIds: new Set(),
    edgeIds: new Set(),
  }
}

/** Sets one characteristic. `null` means "does not apply to this person". */
export function setCharacteristic(
  profile: Profile,
  key: string,
  value: PersonaCharacteristics[string] | undefined,
): Profile {
  const characteristics = { ...profile.characteristics }
  // Deleting rather than storing undefined: absent is a meaningful state — not
  // yet decided — and it has to survive JSON, which drops undefined anyway.
  if (value === undefined) delete characteristics[key]
  else characteristics[key] = value
  return { ...profile, characteristics }
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
 * Every connection running between two factors in the given set.
 *
 * Self-loops are excluded: a connection from a factor to itself has both ends in
 * any set containing it, and marking it says nothing about a relationship
 * between two things.
 */
export function connectionsWithin(
  nodeIds: ReadonlySet<number>,
): string[] {
  const found: string[] = []
  for (const connection of connections) {
    if (connection.sourceId === connection.targetId) continue
    if (nodeIds.has(connection.sourceId) && nodeIds.has(connection.targetId)) {
      found.push(connection.id)
    }
  }
  return found
}

/**
 * Connections whose two ends are both marked but which are not marked
 * themselves. People mark the factors and forget the link that ties them, so
 * these are offered explicitly rather than left to be noticed.
 */
export function missingLinks(profile: Profile): string[] {
  return connectionsWithin(profile.nodeIds).filter(
    (id) => !profile.edgeIds.has(id),
  )
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
  characteristics: PersonaCharacteristics
  nodeIds: number[]
  edgeIds: string[]
}

function toStored(profile: Profile): StoredProfile {
  return {
    id: profile.id,
    name: profile.name,
    details: profile.details,
    characteristics: profile.characteristics,
    nodeIds: [...profile.nodeIds],
    edgeIds: [...profile.edgeIds],
  }
}

export interface ParseResult {
  profile: Profile
  /** Ids in the file that this map does not contain, so the user is told. */
  droppedNodeIds: number[]
  droppedEdgeIds: string[]
  /**
   * Connections the file did not name, filled in from its factors. Reported so
   * an import never quietly marks more than the file asked for.
   */
  autoLinkedEdgeIds: string[]
}

/**
 * Rebuild a profile from untrusted JSON — a hand-edited file, or one exported
 * from a different build of the map. Unknown ids are dropped and reported
 * rather than silently kept, which would leave marks that can never be seen.
 *
 * A file may list factors alone. Writing out connection ids by hand means
 * looking each one up in the data, which nobody is going to do, so when the file
 * has no `edgeIds` at all every connection running between two of its factors is
 * marked for it. The count comes back in the result, because an import that
 * silently marks thirty things the file never mentioned is not an import.
 *
 * An explicitly empty `edgeIds` is left alone, and means what it says: this
 * profile has no connections. That distinction matters because the app's own
 * export always writes the field, so a profile deliberately saved with none
 * would otherwise come back with them.
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
  const autoLinkedEdgeIds: string[] = []
  if (Array.isArray(raw.edgeIds)) {
    for (const value of raw.edgeIds) {
      if (typeof value !== 'string') continue
      if (connectionsById.has(value)) edgeIds.add(value)
      else droppedEdgeIds.push(value)
    }
  } else {
    // No edgeIds at all: a factors-only file, so the connections between those
    // factors are filled in. Anything else would import a set of variables with
    // nothing joining them, which is not what the map is for.
    for (const id of connectionsWithin(nodeIds)) {
      edgeIds.add(id)
      autoLinkedEdgeIds.push(id)
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
      // Anything that is not a plain object is discarded rather than trusted:
      // this comes from a hand-edited file as often as from an export.
      characteristics:
        typeof raw.characteristics === 'object' &&
        raw.characteristics !== null &&
        !Array.isArray(raw.characteristics)
          ? (raw.characteristics as PersonaCharacteristics)
          : {},
      nodeIds,
      edgeIds,
    },
    droppedNodeIds,
    droppedEdgeIds,
    autoLinkedEdgeIds,
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
