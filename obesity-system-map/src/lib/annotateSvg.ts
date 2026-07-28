import type { EdgeGeometry } from '../types'
import type { LabelLayout } from './labelLayout'

/**
 * Attaches identity attributes to the inlined SVG layers so the static artwork
 * can be driven from the logical data.
 *
 * Edge paths carry no identifiers of their own, so they are matched purely by
 * document order against `edge_geometry.json`, which was generated from
 * obesity_system_map_complete_edge_geometry.xlsx and verified path-by-path
 * against the source SVG (`d` and `transform` both compared).
 *
 * Node paths already carry `data-node-id` from the extraction, so those are
 * verified rather than rewritten.
 */

/** Paths inside <defs> are clip geometry, never part of the drawn edge set. */
function drawablePaths(root: Element): SVGPathElement[] {
  return Array.from(root.querySelectorAll('path')).filter(
    (path) => !path.closest('defs'),
  )
}

function parseFragment(inner: string, label: string): Element {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`,
    'image/svg+xml',
  )
  const error = doc.querySelector('parsererror')
  if (error) {
    throw new Error(`annotateSvg: could not parse ${label} — ${error.textContent}`)
  }
  return doc.documentElement
}

function serializeChildren(root: Element): string {
  const serializer = new XMLSerializer()
  return Array.from(root.childNodes)
    .map((node) => serializer.serializeToString(node))
    .join('')
}

/**
 * Writes `data-connection-ids` (space separated, queryable with the `~=`
 * attribute selector) onto every edge path the workbook attributes to a
 * connection, plus `data-connection-id` where that attribution is unambiguous.
 */
export function annotateEdges(inner: string, geometry: EdgeGeometry): string {
  const root = parseFragment(inner, 'edges layer')
  const paths = drawablePaths(root)

  if (paths.length !== geometry.paths.length) {
    throw new Error(
      `annotateSvg: edge path count mismatch — SVG has ${paths.length}, ` +
        `geometry describes ${geometry.paths.length}. The mapping is ` +
        `positional, so a mismatch would mislabel every edge.`,
    )
  }

  paths.forEach((path, index) => {
    const entry = geometry.paths[index]
    path.setAttribute('data-path-index', String(index))
    path.setAttribute('data-edge-role', entry.role)
    if (entry.markerType) {
      path.setAttribute('data-marker-type', entry.markerType)
    }
    if (entry.connections?.length) {
      path.setAttribute('data-connection-ids', entry.connections.join(' '))
      if (entry.connections.length === 1) {
        path.setAttribute('data-connection-id', entry.connections[0])
      }
    }
  })

  return serializeChildren(root)
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** #RGB or #RRGGBB -> [h, s, l] with s/l in 0..1. */
function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const raw = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6
  return [h, s, l]
}

/**
 * Cluster fills are pale by design, so they read as nothing when used for a
 * glow. Push saturation up and lightness down to get a visible accent that is
 * still recognisably the node's own colour.
 */
function accentFrom(hex: string): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  const [h, s, l] = hsl
  const s2 = Math.min(1, Math.max(s, 0.15) * 2.6)
  const l2 = Math.min(0.62, Math.max(0.34, l * 0.62))
  return `hsl(${Math.round(h * 360)} ${Math.round(s2 * 100)}% ${Math.round(l2 * 100)}%)`
}

/**
 * Wraps each node's paths in a <g data-node-id> so selection state can be
 * transitioned per group rather than per path, and so `transform: scale()` has
 * a sensible box to scale about.
 *
 * Safe despite 14 nodes having non-adjacent paths: no two node boxes overlap
 * anywhere on the map, so paint order between different nodes cannot affect
 * the rendered result. Order *within* a node is preserved exactly.
 */
export interface NodeGroupOptions {
  clusterOf: (nodeId: number) => string | undefined
  /**
   * Optional label layout. Text is nested inside the node's own group so it
   * inherits selection scaling, cluster dimming and hit-testing without any
   * extra bookkeeping.
   */
  labelFor?: (nodeId: number, fill: string | undefined) => LabelLayout | null
}

export function groupNodePaths(
  inner: string,
  options: NodeGroupOptions,
): string {
  const { clusterOf, labelFor } = options
  const root = parseFragment(inner, 'nodes layer')
  const paths = drawablePaths(root)
  if (paths.length === 0) throw new Error('annotateSvg: nodes layer has no paths')

  const parent = paths[0].parentNode
  if (!parent) throw new Error('annotateSvg: node paths have no parent')

  const order: number[] = []
  const byNode = new Map<number, SVGPathElement[]>()
  for (const path of paths) {
    const raw = path.getAttribute('data-node-id')
    if (raw === null) {
      throw new Error('annotateSvg: node path missing data-node-id')
    }
    const id = Number(raw)
    let bucket = byNode.get(id)
    if (!bucket) {
      bucket = []
      byNode.set(id, bucket)
      order.push(id)
    }
    bucket.push(path)
  }

  const doc = root.ownerDocument
  for (const id of order) {
    const bucket = byNode.get(id)!
    const group = doc.createElementNS(SVG_NS, 'g')
    group.setAttribute('data-node-id', String(id))

    const label = bucket[0].getAttribute('data-node-label')
    if (label) group.setAttribute('data-node-label', label)

    const cluster = clusterOf(id)
    if (cluster) group.setAttribute('data-cluster', cluster)

    // The colour a label sits on is the topmost *filled* surface, i.e. the last
    // painted path that is not an outline ring. Accent hub nodes paint their
    // strong colour over the pale base, so taking the first fill would read the
    // hidden layer and put dark ink on a dark box.
    const surfaces = bucket.filter(
      (p) =>
        p.getAttribute('data-role') !== 'Outline ring' &&
        (p.getAttribute('fill') ?? 'none') !== 'none',
    )
    const fill =
      surfaces[surfaces.length - 1]?.getAttribute('fill') ??
      bucket
        .map((p) => p.getAttribute('fill'))
        .filter((f): f is string => !!f && f !== 'none')
        .pop()
    if (fill) {
      group.setAttribute(
        'style',
        `--node-colour:${fill};--node-accent:${accentFrom(fill)}`,
      )
    }

    // appendChild moves the path out of its old position; the parent ends up
    // holding exactly these groups, in first-appearance order.
    for (const path of bucket) group.appendChild(path)

    const layout = labelFor?.(id, fill)
    if (layout && layout.lines.length > 0) {
      const text = doc.createElementNS(SVG_NS, 'text')
      text.setAttribute('class', 'node-label')
      text.setAttribute('x', '0')
      text.setAttribute('y', '0')
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('font-size', String(layout.fontSize))
      text.setAttribute('fill', layout.fill)

      layout.lines.forEach((line, lineIndex) => {
        const tspan = doc.createElementNS(SVG_NS, 'tspan')
        tspan.setAttribute('x', layout.centreX.toFixed(2))
        tspan.setAttribute(
          'y',
          (layout.firstBaseline + lineIndex * layout.lineHeight).toFixed(2),
        )
        tspan.textContent = line
        text.appendChild(tspan)
      })
      group.appendChild(text)
    }

    parent.appendChild(group)
  }

  return serializeChildren(root)
}

/**
 * The three orphan paths (a dashed edge present in the artwork but absent from
 * both the geometry workbook and the JSON) run between node 77 "Demand for
 * Health" and node 80 "Dominance of Motorised Transport", established by
 * measuring their endpoints against every node box. Their cluster pair is
 * therefore inferred, not sourced — recorded here so the inference is visible.
 */
const ORPHAN_CLUSTER_PAIR: [string, string] = ['Economic', 'Infrastructure']

export interface EdgeClusterLookup {
  /** Cluster pair for a connection, or undefined if it cannot be resolved. */
  pairForConnection: (connectionId: string) => [string, string] | undefined
}

/**
 * Regroups edge paths by the cluster pair they connect, so a cluster filter
 * toggles ~48 groups instead of restyling 892 individual paths.
 *
 * Reordering is lossless here: every drawn element in the edges layer is the
 * same colour (#231f20 fill and stroke), so paint order among edges cannot
 * change the rendered result. Groups are created inside the clipped <g> so the
 * layer's clip-path still applies.
 */
export function groupEdgePathsByCluster(
  inner: string,
  lookup: EdgeClusterLookup,
): string {
  const root = parseFragment(inner, 'edges layer')
  const paths = drawablePaths(root)
  if (paths.length === 0) throw new Error('annotateSvg: edges layer has no paths')

  const parent = paths[0].parentNode
  if (!parent) throw new Error('annotateSvg: edge paths have no parent')

  const order: string[] = []
  const buckets = new Map<string, { pair: [string, string]; paths: SVGPathElement[] }>()

  for (const path of paths) {
    const ids = path.getAttribute('data-connection-ids')?.split(' ').filter(Boolean) ?? []
    const pairs = ids
      .map((id) => lookup.pairForConnection(id))
      .filter((p): p is [string, string] => !!p)
      .map((p) => [...p].sort() as [string, string])

    // A shared path must resolve to a single pair to be groupable. All four
    // connections on the one shared path agree, but guard rather than assume.
    const distinct = new Set(pairs.map((p) => p.join('|')))
    let pair: [string, string]
    if (ids.length === 0) {
      pair = ORPHAN_CLUSTER_PAIR
    } else if (distinct.size === 1) {
      pair = pairs[0]
    } else {
      // Ambiguous: give this path its own group so filtering stays correct.
      pair = pairs[0] ?? ORPHAN_CLUSTER_PAIR
    }

    const key = distinct.size > 1 ? `mixed:${path.getAttribute('data-path-index')}` : pair.join('|')
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { pair, paths: [] }
      buckets.set(key, bucket)
      order.push(key)
    }
    bucket.paths.push(path)
  }

  const doc = root.ownerDocument
  for (const key of order) {
    const bucket = buckets.get(key)!
    const group = doc.createElementNS(SVG_NS, 'g')
    group.setAttribute('data-cluster-a', bucket.pair[0])
    group.setAttribute('data-cluster-b', bucket.pair[1])
    for (const path of bucket.paths) group.appendChild(path)
    parent.appendChild(group)
  }

  return serializeChildren(root)
}

export interface NodeLayerCheck {
  pathCount: number
  nodeIds: number[]
}

/**
 * Reads back the `data-node-id` attributes already present on the node layer.
 * Throws if any path is unlabelled, since silently dropping a node would leave
 * part of the map inert with no visible symptom.
 */
export function readNodeLayer(inner: string): NodeLayerCheck {
  const root = parseFragment(inner, 'nodes layer')
  const paths = drawablePaths(root)
  const nodeIds = new Set<number>()

  for (const path of paths) {
    const raw = path.getAttribute('data-node-id')
    if (raw === null) {
      throw new Error(
        `annotateSvg: node path ${path.getAttribute('id') ?? '(no id)'} has no data-node-id`,
      )
    }
    nodeIds.add(Number(raw))
  }

  return { pathCount: paths.length, nodeIds: [...nodeIds].sort((a, b) => a - b) }
}
