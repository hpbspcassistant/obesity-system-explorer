import type { ClusterMeta, Connection, EdgeGeometry, Node } from '../types'
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

/** Legend clusters in printed-map order, with swatches read from the artwork. */
export const clusters = (rawClusters as unknown as { clusters: ClusterMeta[] })
  .clusters

export const clusterNames = clusters.map((c) => c.name)

/** Cluster pair a connection spans, used to group edge paths for filtering. */
export function clusterPairForConnection(
  connectionId: string,
): [string, string] | undefined {
  const connection = connectionsById.get(connectionId)
  if (!connection) return undefined
  const source = nodesById.get(connection.sourceId)?.mapCluster
  const target = nodesById.get(connection.targetId)?.mapCluster
  return source && target ? [source, target] : undefined
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
