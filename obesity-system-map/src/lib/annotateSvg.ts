import type { EdgeGeometry } from '../types'
import type { LabelLayout } from './labelLayout'
import { hexToHsl, ringFrom } from './ringColour'

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
  /** Both taxonomies, tagged separately so either can drive the filter. */
  taxonomiesOf: (nodeId: number) => { type?: string; cluster?: string }
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
  const { taxonomiesOf, labelFor } = options
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

    const taxonomies = taxonomiesOf(id)
    if (taxonomies.type) group.setAttribute('data-type', taxonomies.type)
    if (taxonomies.cluster) group.setAttribute('data-cluster', taxonomies.cluster)

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
        `--node-colour:${fill};--node-accent:${accentFrom(fill)};` +
          `--node-ring:${ringFrom(fill)}`,
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
const ORPHAN_TYPE_PAIR: [string, string] = ['Economic', 'Infrastructure']
const ORPHAN_CLUSTER_PAIR: [string, string] = [
  'Food production',
  'Physical activity environment',
]

export interface TaxonomyPairs {
  typePair: [string, string]
  clusterPair: [string, string]
}

export interface EdgeTaxonomyLookup {
  pairsForConnection: (connectionId: string) => TaxonomyPairs | undefined
}

/**
 * Regroups edge paths by the *combination* of both taxonomies, so either can
 * filter at group level. The two cross-cut, so grouping by one alone would put
 * mixed values of the other inside a single group and make that filter wrong.
 *
 * 78 combined groups for 892 paths — still two orders of magnitude fewer
 * elements to restyle than touching paths individually.
 *
 * Reordering is lossless here: every drawn element in the edges layer is the
 * same colour (#231f20 fill and stroke), so paint order among edges cannot
 * change the rendered result. Groups are created inside the clipped <g> so the
 * layer's clip-path still applies.
 */
export function groupEdgePathsByTaxonomy(
  inner: string,
  lookup: EdgeTaxonomyLookup,
): string {
  const root = parseFragment(inner, 'edges layer')
  const paths = drawablePaths(root)
  if (paths.length === 0) throw new Error('annotateSvg: edges layer has no paths')

  const parent = paths[0].parentNode
  if (!parent) throw new Error('annotateSvg: edge paths have no parent')

  const order: string[] = []
  const buckets = new Map<string, { pairs: TaxonomyPairs; paths: SVGPathElement[] }>()

  for (const path of paths) {
    const ids = path.getAttribute('data-connection-ids')?.split(' ').filter(Boolean) ?? []
    const resolved = ids
      .map((id) => lookup.pairsForConnection(id))
      .filter((p): p is TaxonomyPairs => !!p)

    const keyOf = (p: TaxonomyPairs) =>
      `${p.typePair.join('|')}::${p.clusterPair.join('|')}`
    const distinct = new Set(resolved.map(keyOf))

    const orphan: TaxonomyPairs = {
      typePair: ORPHAN_TYPE_PAIR,
      clusterPair: ORPHAN_CLUSTER_PAIR,
    }
    // A shared path must resolve to one combination to be groupable; the one
    // shared trunk's four connections agree, but guard rather than assume.
    const pairs = ids.length === 0 ? orphan : (resolved[0] ?? orphan)
    const key =
      distinct.size > 1
        ? `mixed:${path.getAttribute('data-path-index')}`
        : keyOf(pairs)

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { pairs, paths: [] }
      buckets.set(key, bucket)
      order.push(key)
    }
    bucket.paths.push(path)
  }

  const doc = root.ownerDocument
  for (const key of order) {
    const bucket = buckets.get(key)!
    const group = doc.createElementNS(SVG_NS, 'g')
    group.setAttribute('data-edge-group', '')
    group.setAttribute('data-type-a', bucket.pairs.typePair[0])
    group.setAttribute('data-type-b', bucket.pairs.typePair[1])
    group.setAttribute('data-cluster-a', bucket.pairs.clusterPair[0])
    group.setAttribute('data-cluster-b', bucket.pairs.clusterPair[1])
    for (const path of bucket.paths) group.appendChild(path)
    parent.appendChild(group)
  }

  return serializeChildren(root)
}

/**
 * Builds an invisible layer of fat strokes tracing the visible edges, so edges
 * can actually be clicked.
 *
 * The drawn lines are 0.51 units wide on a 3370-unit canvas — far below a
 * pixel at fit zoom. `vector-effect: non-scaling-stroke` keeps the hit stroke a
 * constant width in screen pixels at every zoom level, so the target neither
 * vanishes when zoomed out nor swells when zoomed in.
 *
 * Cluster-pair groups are preserved so the hit layer inherits the same filter
 * state as the artwork; a filtered-out cluster must not be clickable.
 */
export function buildEdgeHitLayer(annotatedEdgesInner: string): string {
  const root = parseFragment(annotatedEdgesInner, 'edges layer (hit)')
  const doc = root.ownerDocument
  const container = doc.createElementNS(SVG_NS, 'g')

  for (const group of root.querySelectorAll('g[data-edge-group]')) {
    const hitGroup = doc.createElementNS(SVG_NS, 'g')
    hitGroup.setAttribute('data-edge-group', '')
    for (const attr of ['data-type-a', 'data-type-b', 'data-cluster-a', 'data-cluster-b']) {
      hitGroup.setAttribute(attr, group.getAttribute(attr) ?? '')
    }

    for (const path of group.querySelectorAll('path')) {
      // Markers are tiny and sit under the node boxes; the line is the target.
      if (path.getAttribute('data-edge-role') !== 'line') continue
      const ids = path.getAttribute('data-connection-ids')
      if (!ids) continue

      const hit = doc.createElementNS(SVG_NS, 'path')
      hit.setAttribute('d', path.getAttribute('d') ?? '')
      const transform = path.getAttribute('transform')
      if (transform) hit.setAttribute('transform', transform)
      hit.setAttribute('data-connection-ids', ids)
      hit.setAttribute('data-hit', '')
      const index = path.getAttribute('data-path-index')
      if (index) hit.setAttribute('data-path-index', index)
      hitGroup.appendChild(hit)
    }

    if (hitGroup.childNodes.length > 0) container.appendChild(hitGroup)
  }

  return serializeChildren(container)
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
