import type {
  AtlasClusterMeta,
  Connection,
  EdgeGeometry,
  Node,
  Taxonomy,
  VariableTypeMeta,
} from '../types'
import type { NodeBox } from '../lib/labelLayout'
import rawClusters from './clusters.json'
import rawGeometry from './edge_geometry.json'
import rawBoxes from './node_boxes.json'
import raw from './obesity_system_data.json'

/**
 * Typed access to the raw map data. The JSON carries more than the logical
 * model (questions, baselines, tuning constants); this module narrows it to
 * the parts the map itself renders, and joins it to the SVG geometry mapping.
 */

export const nodes = raw.nodes as Node[]
export const connections = raw.connections as unknown as Connection[]

// Node x/y live in the same coordinate space as the SVG layers; MapView derives
// that space from the source viewBox rather than repeating it here.

export const nodesById = new Map<number, Node>(nodes.map((n) => [n.id, n]))
export const connectionsById = new Map<string, Connection>(
  connections.map((c) => [c.id, c]),
)

/** Path-index -> connection mapping, generated from the geometry workbook. */
export const edgeGeometry = rawGeometry as unknown as EdgeGeometry

/** Node box bounds in map coordinates, used to wrap label text to each box. */
export const nodeBoxes = (rawBoxes as unknown as { boxes: NodeBox[] }).boxes
export const nodeBoxesById = new Map<number, NodeBox>(
  nodeBoxes.map((box) => [box.id, box]),
)

function groupBy(pick: (c: Connection) => number): Map<number, Connection[]> {
  const map = new Map<number, Connection[]>()
  for (const connection of connections) {
    const key = pick(connection)
    const bucket = map.get(key)
    if (bucket) bucket.push(connection)
    else map.set(key, [connection])
  }
  return map
}

export const outgoingByNode = groupBy((c) => c.sourceId)
export const incomingByNode = groupBy((c) => c.targetId)

const rawTaxonomies = rawClusters as unknown as {
  variableTypes: VariableTypeMeta[]
  atlasClusters: AtlasClusterMeta[]
}

/** The map's colour groupings, in printed-legend order, swatches from artwork. */
export const variableTypes = rawTaxonomies.variableTypes
/** The Foresight atlas's own clusters. No swatches — see AtlasClusterMeta. */
export const atlasClusters = rawTaxonomies.atlasClusters

export const variableTypeNames = variableTypes.map((t) => t.name)
export const atlasClusterNames = atlasClusters.map((c) => c.name)

export function namesForTaxonomy(taxonomy: Taxonomy): string[] {
  return taxonomy === 'type' ? variableTypeNames : atlasClusterNames
}

/** The node's group under a given taxonomy. */
export function groupOfNode(node: Node, taxonomy: Taxonomy): string {
  return taxonomy === 'type' ? node.mapCluster : node.atlasCluster
}

/** Any run of dash-like characters, which is how "undocumented" is recorded. */
const DASH_ONLY = /^[\s\-‐-―]*$/

/**
 * A node's definition, or null where the atlas never wrote one.
 *
 * 22 of the 108 variables carry a bare em-dash instead of prose. Rendered
 * verbatim under a "Definition" heading that reads as a broken panel rather
 * than as "nobody documented this", so callers get null and say so in words.
 */
export function definitionOf(node: Node): string | null {
  const text = node.definition?.trim() ?? ''
  return text && !DASH_ONLY.test(text) ? text : null
}

/**
 * Shared wording for the gap. Lives here rather than in each component so the
 * three places a definition appears cannot drift apart.
 */
export const NO_DEFINITION = 'No definition recorded in the source atlas.'

export interface ConnectionTaxonomyPairs {
  /** Variable types of the two endpoints, sorted. */
  typePair: [string, string]
  /** Atlas clusters of the two endpoints, sorted. */
  clusterPair: [string, string]
}

/**
 * Both taxonomies for a connection's endpoints. Edge paths are grouped by the
 * *combination*, so a single set of groups can be filtered by either taxonomy
 * without regrouping — the two cross-cut, so one grouping alone cannot serve
 * both.
 */
export function taxonomyPairsForConnection(
  connectionId: string,
): ConnectionTaxonomyPairs | undefined {
  const connection = connectionsById.get(connectionId)
  if (!connection) return undefined
  const source = nodesById.get(connection.sourceId)
  const target = nodesById.get(connection.targetId)
  if (!source || !target) return undefined

  const sortPair = (a: string, b: string): [string, string] =>
    a <= b ? [a, b] : [b, a]

  return {
    typePair: sortPair(source.mapCluster, target.mapCluster),
    clusterPair: sortPair(source.atlasCluster, target.atlasCluster),
  }
}

export interface Neighbourhood {
  nodeId: number
  outgoing: Connection[]
  incoming: Connection[]
  /** Every connection touching the node, in either direction. */
  connectionIds: string[]
  /** Nodes at the far end of those connections (never the node itself). */
  neighbourIds: number[]
  /** Edge-layer path indices to raise out of the dimmed layer. */
  pathIndices: number[]
}

export interface EdgeSelection {
  connection: Connection
  source: Node | undefined
  target: Node | undefined
  /** Edge-layer path indices to raise out of the dimmed layer. */
  pathIndices: number[]
  /** Other connections drawn by the same shared line, if any. */
  sharesLineWith: string[]
}

/** Everything the map needs to highlight when an edge is selected. */
export function edgeSelectionOf(connectionId: string): EdgeSelection | null {
  const connection = connectionsById.get(connectionId)
  if (!connection) return null

  const geometry = edgeGeometry.connections[connectionId]
  const pathIndices = geometry?.pathIndices ?? []

  // A shared trunk serves several connections; surface that rather than
  // pretending the click resolved to exactly one edge.
  const shared = new Set<string>()
  for (const index of pathIndices) {
    for (const id of edgeGeometry.paths[index]?.connections ?? []) {
      if (id !== connectionId) shared.add(id)
    }
  }

  return {
    connection,
    source: nodesById.get(connection.sourceId),
    target: nodesById.get(connection.targetId),
    pathIndices,
    sharesLineWith: [...shared],
  }
}

/** Everything the map needs to highlight when a node is selected. */
export function neighbourhoodOf(nodeId: number): Neighbourhood {
  const outgoing = outgoingByNode.get(nodeId) ?? []
  const incoming = incomingByNode.get(nodeId) ?? []
  const touching = [...outgoing, ...incoming]

  const neighbourIds = new Set<number>()
  const pathIndices = new Set<number>()
  for (const connection of touching) {
    const other =
      connection.sourceId === nodeId ? connection.targetId : connection.sourceId
    if (other !== nodeId) neighbourIds.add(other)
    for (const index of edgeGeometry.connections[connection.id]?.pathIndices ?? []) {
      pathIndices.add(index)
    }
  }

  return {
    nodeId,
    outgoing,
    incoming,
    connectionIds: touching.map((c) => c.id),
    neighbourIds: [...neighbourIds],
    pathIndices: [...pathIndices],
  }
}

/** Connections drawn in the SVG but absent from the logical data. */
export const orphanPathIndices = edgeGeometry._meta.orphanPathIndices

export interface MappingReport {
  nodeCount: number
  connectionCount: number
  mappedConnections: number
  unmappedConnections: string[]
  geometryWithoutData: string[]
  orphanPaths: number[]
  sharedPaths: number[]
}

/**
 * Cross-checks the geometry mapping against the logical data. Both sides are
 * generated independently, so a drift here means the map would silently
 * highlight the wrong edges.
 */
export function buildMappingReport(): MappingReport {
  const geometryIds = Object.keys(edgeGeometry.connections)
  const dataIds = new Set(connections.map((c) => c.id))

  const sharedPaths = edgeGeometry.paths.flatMap((p, i) =>
    (p.connections?.length ?? 0) > 1 ? [i] : [],
  )

  return {
    nodeCount: nodes.length,
    connectionCount: connections.length,
    mappedConnections: geometryIds.filter((id) => dataIds.has(id)).length,
    unmappedConnections: connections
      .filter((c) => !edgeGeometry.connections[c.id])
      .map((c) => c.id),
    geometryWithoutData: geometryIds.filter((id) => !dataIds.has(id)),
    orphanPaths: orphanPathIndices,
    sharedPaths,
  }
}
