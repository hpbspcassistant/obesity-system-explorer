import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type Ref,
} from 'react'
import {
  MiniMap,
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch'

import edgesRaw from '../assets/obesity_map_edges_only.svg?raw'
import nodeBoxesRaw from '../assets/obesity_system_map_node_boxes_only.svg?raw'
import {
  connectionsById,
  edgeGeometry,
  edgeSelectionOf,
  neighbourhoodOf,
  nodeBoxesById,
  nodesById,
  taxonomyPairsForConnection,
} from '../data/systemMap'
import type { MapMode, Selection, Taxonomy } from '../types'
import type { PathSet, TraceFocus } from '../lib/trace'
import { layoutLabel } from '../lib/labelLayout'
import {
  annotateEdges,
  buildEdgeHitLayer,
  groupEdgePathsByTaxonomy,
  groupNodePaths,
} from '../lib/annotateSvg'
import { contrastFillCss } from '../data/contrast'
import { extractSvgInner, readSvgViewBox } from '../lib/inlineSvg'
import { svgToPngBlob } from '../lib/exportImage'
import '../map.css'

/**
 * Both layers are authored against the same coordinate space, so we adopt the
 * edges layer's viewBox for the composite and assert the nodes layer agrees.
 * A mismatch would silently misalign every node, so fail loudly instead.
 */
const EDGES_VIEW_BOX = readSvgViewBox(edgesRaw)
const NODES_VIEW_BOX = readSvgViewBox(nodeBoxesRaw)

if (!EDGES_VIEW_BOX || EDGES_VIEW_BOX !== NODES_VIEW_BOX) {
  throw new Error(
    `MapView: layer viewBox mismatch — edges "${EDGES_VIEW_BOX}" vs nodes "${NODES_VIEW_BOX}"`,
  )
}

export const MAP_VIEW_BOX = EDGES_VIEW_BOX
const [, , MAP_WIDTH, MAP_HEIGHT] = MAP_VIEW_BOX.split(/\s+/).map(Number)

const MIN_SCALE = 0.05
const MAX_SCALE = 12
/** Exponent per wheel unit; one mouse notch (deltaY 100) zooms ~13%. */
const WHEEL_SENSITIVITY = 0.00125
/** Breathing room around the map when fitting it to the viewport. */
const FIT_PADDING = 0.96
/**
 * Ceiling for follow-the-trace zoom. Labels are 10 map units, so a scale of
 * ~0.9 puts them at ~9px — the point they become readable. Going much past
 * that gains nothing and makes short routes feel like a jump cut.
 */
const FOLLOW_MAX_SCALE = 1.1
/** Map-unit margin left around framed variables. */
const FOCUS_PADDING = 70

// Parsed and annotated once at module scope: the markup is static, so
// re-running this per render would only cost time. Edge paths gain their
// connection ids here; node paths already carry data-node-id from extraction.
const edgesInner = groupEdgePathsByTaxonomy(
  annotateEdges(
    extractSvgInner(edgesRaw, 'obesity_map_edges_only.svg'),
    edgeGeometry,
  ),
  { pairsForConnection: taxonomyPairsForConnection },
)
const nodesInner = groupNodePaths(
  extractSvgInner(nodeBoxesRaw, 'obesity_system_map_node_boxes_only.svg'),
  {
    taxonomiesOf: (nodeId) => {
      const node = nodesById.get(nodeId)
      return { type: node?.mapCluster, cluster: node?.atlasCluster }
    },
    labelFor: (nodeId, fill) => {
      const node = nodesById.get(nodeId)
      const box = nodeBoxesById.get(nodeId)
      return node && box ? layoutLabel(node.label, box, fill) : null
    },
  },
)

const edgeHitInner = buildEdgeHitLayer(edgesInner)
const contrastCss = contrastFillCss()

const SVG_NS = 'http://www.w3.org/2000/svg'

/** The artwork's ink, and the colour a traced route is repainted in. */
const EDGE_INK = '#231f20'
/** Paths within the step limit, and the one route being read. */
const TRACE_INK = '#0d9488'
const FOCUS_INK = '#0f766e'
/*
 * Profile introduces no colour of its own. Unmarked variables go grey and marked
 * ones get their cluster fill back (see map.css), so a marked connection is
 * simply the artwork's own ink at full strength over a web faded to 0.3 — the
 * only black line on screen. Deliberately not dash: every dashed line in the
 * artwork is a negative connection, so a dashed overlay would read as a claim
 * about sign.
 */
const MARK_INK = EDGE_INK
/**
 * Available, meaning any connection you could mark but have not: the ones
 * belonging to the variable whose card is open, and the ones whose two ends are
 * both marked. One reading covers both — black is a decision, grey is an offer.
 *
 * Separating these from marked by weight alone did not work; 1.5px against
 * 2.6px is a difference of degree, and it read as "the same thing, fainter".
 * Grey is a difference in kind while still, correctly, looking lesser than
 * black. It stays hue-free on purpose: the ten cluster rings already hold
 * yellow, green and blue, Trace owns teal, and the only unclaimed bands left
 * are red — which would read as "negative" against the +/− the map carries —
 * and pink.
 */
const AVAILABLE_INK = '#8a857c'

/** Screen-px widths for the profile edge layers; all are non-scaling. */
const MARKED_EDGE_PX = 2.6
const AVAILABLE_EDGE_PX = 1.6
/** Diameters of the accept-this-link target, in screen px at any zoom. */
const LINK_BADGE_PX = 13
const LINK_BADGE_CORE_PX = 5
/** Bands for the ring around the variable the card is open on. */
const FOCUS_BANDS = [
  { width: 13, opacity: 0.16 },
  { width: 5, opacity: 0.32 },
] as const

/** Highlighted edges are redrawn this much thicker than their source path. */
const HIGHLIGHT_STROKE_FACTOR = 1.9
/** Pointer travel above which a press counts as a pan, not a click. */
const CLICK_SLOP_PX = 5

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Redraws a cloned edge at a fixed screen width.
 *
 * The dash pattern is the artwork's way of saying "negative" — all 98 dashed
 * lines are negative connections and no positive one is dashed — so it has to
 * survive being redrawn several times thicker. Under `non-scaling-stroke` the
 * dash is measured in screen pixels too, which would turn a 1.4-unit dash under
 * a 2.6px stroke into a solid line; scaling it by the same factor keeps the
 * pattern's proportions and the meaning with them.
 */
function applyScreenStroke(path: SVGPathElement, width: number): void {
  const artwork = Number.parseFloat(path.getAttribute('stroke-width') ?? '')
  path.setAttribute('stroke-width', String(width))

  const dash = path.getAttribute('stroke-dasharray')
  if (!dash || !Number.isFinite(artwork) || artwork <= 0) return
  const factor = width / artwork
  path.setAttribute(
    'stroke-dasharray',
    dash
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((n) => (Number.parseFloat(n) * factor).toFixed(2))
      .join(' '),
  )
}

/**
 * The two artwork layers are memoised with no props so React renders them
 * exactly once.
 *
 * Without this, React re-applies `dangerouslySetInnerHTML` on every render and
 * replaces all ~1050 paths. That silently discarded the `is-filtered-out` and
 * `is-selected` classes applied imperatively (selecting a node wiped the
 * cluster filter), and it also defeated the CSS transitions, since a freshly
 * created element has no previous value to animate from.
 */
const EdgeLayer = memo(function EdgeLayer() {
  return <g data-layer="edges" dangerouslySetInnerHTML={{ __html: edgesInner }} />
})

const EdgeHitLayer = memo(function EdgeHitLayer() {
  return (
    <g data-layer="edge-hit" dangerouslySetInnerHTML={{ __html: edgeHitInner }} />
  )
})

const NodeLayer = memo(function NodeLayer() {
  return <g data-layer="nodes" dangerouslySetInnerHTML={{ __html: nodesInner }} />
})

/**
 * The minimap re-draws the node boxes only — edges would double the DOM for no
 * legibility at thumbnail size. Element ids are stripped so the copy cannot
 * collide with the real layer's ids.
 */
const miniInner = nodesInner.replace(/\sid="[^"]*"/g, '')

const MiniMapContent = memo(function MiniMapContent() {
  return (
    <svg
      viewBox={MAP_VIEW_BOX}
      width={MAP_WIDTH}
      height={MAP_HEIGHT}
      aria-hidden="true"
      className="block bg-white"
      dangerouslySetInnerHTML={{ __html: miniInner }}
    />
  )
})

/**
 * A ring around the variable a trace starts from. The node's own outline carries a
 * crisp non-scaling stroke, but at fit zoom a node box is only ~8px across, so a
 * ring alone is easy to lose among 108 of them. A wide translucent stroke
 * straddles the box edge, putting half its width outside as a constant-width
 * halo at any zoom — a screen-space effect without reading the transform. The
 * inner half is hidden by the node box, which paints after this layer.
 */
const NodeHalos = memo(function NodeHalos({
  layer,
  nodeIds,
  colour,
  bands,
}: {
  layer: string
  nodeIds: readonly number[]
  colour: string
  /** Outer band first. Widths are screen px; see the note above. */
  bands: readonly { width: number; opacity: number }[]
}) {
  if (!nodeIds.length) return null
  return (
    <g data-layer={layer} className="pointer-events-none">
      {bands.map((band) => (
        <g key={band.width}>
          {nodeIds.map((id) => {
            const box = nodeBoxesById.get(id)
            if (!box) return null
            return (
              <rect
                key={id}
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                rx={2}
                fill="none"
                stroke={colour}
                strokeWidth={band.width}
                strokeOpacity={band.opacity}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </g>
      ))}
    </g>
  )
})

const TRACE_START_BANDS = [
  { width: 14, opacity: 0.18 },
  { width: 6, opacity: 0.3 },
] as const

export interface MapViewProps {
  /** Decides what a click reveals, not just what it does. */
  mode: MapMode
  selection: Selection | null
  /** Called with what was clicked, or null when empty space was clicked. */
  onSelect: (selection: Selection | null) => void
  /** Which taxonomy the filter applies to. */
  taxonomy: Taxonomy
  /** Groups to fade out; an edge fades if either endpoint is hidden. */
  hiddenGroups: ReadonlySet<string>
  /** Variables marked significant in Profile; persists across modes. */
  markedNodeIds?: ReadonlySet<number>
  /** Connections marked significant in Profile. */
  markedEdgeIds?: ReadonlySet<string>
  /**
   * Unmarked variables one step from something marked. Drawn as a white box with
   * a ring in their own cluster colour — the colour they would take if marked.
   */
  candidateNodeIds?: ReadonlySet<number>
  /**
   * Connections whose two ends are both marked but which are not marked
   * themselves. Drawn between the two purple boxes with a target on the line,
   * replacing what used to be an ever-growing list in the side panel.
   */
  missingLinkIds?: readonly string[]
  /** Accepts one of those links. Only ever called from its own target. */
  onAcceptLink?: (connectionId: string) => void
  /** Everything on a route within the current step limit. */
  tracePaths?: PathSet | null
  /** The one route being studied; changes on hover, so kept separate. */
  traceFocus?: TraceFocus | null
  /**
   * The variable the floating card is open on. MapView owns the pan/zoom
   * transform, so it is the only thing that can say where that box currently
   * sits on screen.
   */
  anchorNodeId?: number | null
  /** Fires with the anchor's viewport-relative box, and again on every pan. */
  onAnchorChange?: (rect: AnchorRect | null) => void
  /** Repaints the fills for legibility; see src/data/contrast.ts. */
  highContrast?: boolean
  /** Drops everything unmarked out of the picture; Profile only. */
  markedOnly?: boolean
  /** node id -> how it stands against HPB programme reach; Intervention only. */
  intervention?: ReadonlyMap<number, string>
  /** Fades everything that is not a gap for the current persona. */
  gapsOnly?: boolean
  /** Whether to draw the navigator thumbnail. */
  showMiniMap?: boolean
  /**
   * Px of the bottom edge covered by a bar the map does not own, so the
   * navigator can sit above it rather than half underneath.
   */
  bottomInset?: number
  ref?: Ref<MapViewHandle>
}

/** A node box in wrapper-relative screen pixels. */
export interface AnchorRect {
  x: number
  y: number
  w: number
  h: number
}

export interface FocusOptions {
  /** Width in px covered by an overlaying panel on the right. */
  rightInset?: number
  /** Height in px covered by an overlaying card along the bottom. */
  bottomInset?: number
  animationTime?: number
}

export interface MapViewHandle {
  /** Scales the map back to fit the viewport and re-centres it. */
  resetView: () => void
  /** Multiplies the current scale about the middle of the viewport. */
  zoomBy: (factor: number) => void
  /** Frames the given variables, clear of any right-hand panel. */
  focusOnNodes: (nodeIds: readonly number[], options?: FocusOptions) => void
  /** Renders the whole map, exactly as it currently looks, to a PNG. */
  exportPng: (scale?: number) => Promise<Blob>
}

const NO_MARKS: ReadonlySet<number> = new Set()
const NO_EDGE_MARKS: ReadonlySet<string> = new Set()
const NO_LINKS: readonly string[] = []

export function MapView({
  mode,
  selection,
  onSelect,
  taxonomy,
  hiddenGroups,
  markedNodeIds = NO_MARKS,
  markedEdgeIds = NO_EDGE_MARKS,
  candidateNodeIds = NO_MARKS,
  missingLinkIds = NO_LINKS,
  onAcceptLink,
  tracePaths = null,
  traceFocus = null,
  anchorNodeId = null,
  onAnchorChange,
  highContrast = false,
  markedOnly = false,
  intervention,
  gapsOnly = false,
  showMiniMap = true,
  bottomInset = 0,
  ref,
}: MapViewProps) {
  const apiRef = useRef<ReactZoomPanPinchRef | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const overlayRef = useRef<SVGGElement | null>(null)
  const traceOverlayRef = useRef<SVGGElement | null>(null)
  const markedEdgeRef = useRef<SVGGElement | null>(null)
  const linkEdgeRef = useRef<SVGGElement | null>(null)
  const linkBadgeRef = useRef<SVGGElement | null>(null)
  const pressRef = useRef<{ x: number; y: number } | null>(null)
  /** path-index -> element, built once; the layers never re-render. */
  const edgePathIndex = useRef<Map<number, SVGPathElement> | null>(null)

  const traceStartIds = useMemo(
    () => (tracePaths ? [tracePaths.startId] : []),
    [tracePaths],
  )

  /**
   * The variable the card is open on, ringed. Drawn as a halo outside the box
   * rather than as a heavier outline, because in Profile the box's own edge is
   * already carrying a state.
   */
  const focusNodeIds = useMemo(
    () => (mode === 'profile' && anchorNodeId !== null ? [anchorNodeId] : []),
    [mode, anchorNodeId],
  )

  /**
   * Where the anchored variable's box currently sits on screen.
   *
   * Read through refs and called imperatively rather than derived in render:
   * this has to re-run on every frame of a pan, and routing that through React
   * state would re-render the whole map 60 times a second to move one card.
   */
  const anchorIdRef = useRef(anchorNodeId)
  anchorIdRef.current = anchorNodeId
  const onAnchorChangeRef = useRef(onAnchorChange)
  onAnchorChangeRef.current = onAnchorChange

  const pushAnchor = useCallback(() => {
    const report = onAnchorChangeRef.current
    if (!report) return
    const api = apiRef.current
    const id = anchorIdRef.current
    const box = id === null ? null : nodeBoxesById.get(id)
    if (!api || !box) {
      report(null)
      return
    }
    const { positionX, positionY, scale } = api.state
    report({
      x: positionX + box.x * scale,
      y: positionY + box.y * scale,
      w: box.w * scale,
      h: box.h * scale,
    })
  }, [])

  useEffect(() => {
    pushAnchor()
  }, [anchorNodeId, pushAnchor])

  const edgePathAt = useCallback((index: number) => {
    let lookup = edgePathIndex.current
    if (!lookup) {
      lookup = new Map()
      const paths = svgRef.current?.querySelectorAll<SVGPathElement>(
        '[data-layer="edges"] path[data-path-index]',
      )
      for (const path of paths ?? []) {
        lookup.set(Number(path.dataset.pathIndex), path)
      }
      edgePathIndex.current = lookup
    }
    return lookup.get(index)
  }, [])

  /** Scale the whole map to fit the viewport, then centre it. */
  const fitToViewport = useCallback((animationTime = 0) => {
    const api = apiRef.current
    const host = wrapperRef.current
    if (!api || !host) return

    const { clientWidth: w, clientHeight: h } = host
    if (!w || !h) return

    const scale = clamp(
      Math.min(w / MAP_WIDTH, h / MAP_HEIGHT) * FIT_PADDING,
      MIN_SCALE,
      MAX_SCALE,
    )
    api.setTransform(
      (w - MAP_WIDTH * scale) / 2,
      (h - MAP_HEIGHT * scale) / 2,
      scale,
      animationTime,
    )
  }, [])

  /**
   * The library's wheel handler is additive (`scale + delta * step`), which is
   * unusable across a 240x zoom range — one notch saturates at low scale and
   * barely moves at high scale. Zoom multiplicatively about the cursor instead.
   */
  useEffect(() => {
    const host = wrapperRef.current
    if (!host) return

    const onWheel = (event: WheelEvent) => {
      const api = apiRef.current
      if (!api) return
      event.preventDefault()

      const { scale, positionX, positionY } = api.state
      const next = clamp(
        scale * Math.exp(-event.deltaY * WHEEL_SENSITIVITY),
        MIN_SCALE,
        MAX_SCALE,
      )
      if (next === scale) return

      // Keep the point under the cursor pinned while the scale changes.
      const rect = host.getBoundingClientRect()
      const cx = event.clientX - rect.left
      const cy = event.clientY - rect.top
      const ratio = next / scale

      api.setTransform(
        cx - (cx - positionX) * ratio,
        cy - (cy - positionY) * ratio,
        next,
        0,
      )
    }

    // Non-passive so preventDefault actually stops the page from scrolling.
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    fitToViewport()
    const host = wrapperRef.current
    if (!host || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => fitToViewport())
    observer.observe(host)
    return () => observer.disconnect()
  }, [fitToViewport])

  /**
   * Frames a set of variables. Uses the box geometry rather than measuring the
   * DOM, so it works regardless of what is currently rendered or dimmed.
   */
  const focusOnNodes = useCallback(
    (nodeIds: readonly number[], options?: FocusOptions) => {
      const api = apiRef.current
      const host = wrapperRef.current
      if (!api || !host || nodeIds.length === 0) return

      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const id of nodeIds) {
        const box = nodeBoxesById.get(id)
        if (!box) continue
        x0 = Math.min(x0, box.x)
        y0 = Math.min(y0, box.y)
        x1 = Math.max(x1, box.x + box.w)
        y1 = Math.max(y1, box.y + box.h)
      }
      if (!Number.isFinite(x0)) return

      x0 -= FOCUS_PADDING
      y0 -= FOCUS_PADDING
      x1 += FOCUS_PADDING
      y1 += FOCUS_PADDING

      // Centre within the space the panels leave, not the whole wrapper. Both
      // insets shrink the box the variables are fitted into *and* shift its centre,
      // which is what keeps a framed route clear of a right-hand panel and of a
      // card along the bottom rather than merely smaller than the viewport.
      const visibleWidth = Math.max(120, host.clientWidth - (options?.rightInset ?? 0))
      const visibleHeight = Math.max(
        120,
        host.clientHeight - (options?.bottomInset ?? 0),
      )

      const scale = clamp(
        Math.min(visibleWidth / (x1 - x0), visibleHeight / (y1 - y0)),
        MIN_SCALE,
        FOLLOW_MAX_SCALE,
      )
      const centreX = (x0 + x1) / 2
      const centreY = (y0 + y1) / 2

      api.setTransform(
        visibleWidth / 2 - centreX * scale,
        visibleHeight / 2 - centreY * scale,
        scale,
        options?.animationTime ?? 0,
      )
    },
    [],
  )

  /**
   * Zoom from a button rather than the wheel.
   *
   * Same multiplicative step as the wheel handler, but anchored to the middle of
   * the viewport: there is no cursor to zoom about, and the centre is the only
   * point a user can predict will stay put.
   */
  const zoomBy = useCallback((factor: number) => {
    const api = apiRef.current
    const host = wrapperRef.current
    if (!api || !host) return

    const { scale, positionX, positionY } = api.state
    const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE)
    if (next === scale) return

    const cx = host.clientWidth / 2
    const cy = host.clientHeight / 2
    const ratio = next / scale

    api.setTransform(
      cx - (cx - positionX) * ratio,
      cy - (cy - positionY) * ratio,
      next,
      0,
    )
  }, [])

  // Snaps rather than eases: the library animates transforms with
  // requestAnimationFrame, and an instant reset is deterministic. Pass a
  // duration here (e.g. 250) to ease it instead.
  /**
   * The whole map as a PNG, however far in or out the view happens to be.
   *
   * The reference scale is fit, not the current zoom. The profile layers carry
   * screen-pixel strokes, so exporting against the live scale would make line
   * weights depend on how far someone had zoomed before pressing the button —
   * the same profile coming out spidery or blunt for no stated reason. Fit is
   * the view a whole-map export corresponds to, so it is the one to match.
   */
  const exportPng = useCallback(
    async (scale = 1) => {
      const svg = svgRef.current
      const host = wrapperRef.current
      if (!svg || !host) throw new Error('MapView: nothing to export yet')
      const fit = clamp(
        Math.min(host.clientWidth / MAP_WIDTH, host.clientHeight / MAP_HEIGHT) *
          FIT_PADDING,
        MIN_SCALE,
        MAX_SCALE,
      )
      return svgToPngBlob(svg, { scale, referenceScale: fit })
    },
    [],
  )

  useImperativeHandle(
    ref,
    () => ({
      resetView: () => fitToViewport(0),
      zoomBy,
      focusOnNodes,
      exportPng,
    }),
    [fitToViewport, zoomBy, focusOnNodes, exportPng],
  )

  /**
   * Marks the selected node and its neighbours, and lifts the connected edges
   * into the overlay group so they sit above the dimmed edges layer at full
   * opacity. Cloning leaves the source layer untouched, so clearing a
   * selection is just emptying the overlay.
   */
  useEffect(() => {
    const svg = svgRef.current
    const overlay = overlayRef.current
    if (!svg || !overlay) return

    const groups = svg.querySelectorAll<SVGGElement>('g[data-node-id]')
    overlay.replaceChildren()

    // The clicked variable is flagged in every mode, so the map always shows
    // which one the panel is describing.
    const clickedNodeId = selection?.kind === 'node' ? selection.nodeId : null

    // Explore and Profile both answer "what touches this"; Trace does not,
    // because there the route is the answer and a neighbourhood competes with
    // it. The two differ in how loudly: Explore dims the rest of the map to
    // make the neighbourhood the only thing on screen, whereas Profile only
    // lifts the connected edges and leaves every node readable, because the job
    // there is scanning and deciding, which dimming actively obstructs. That
    // split is in the CSS — `has-selection` is set for Explore alone.
    const lighting = mode === 'explore' || mode === 'profile'
    if (!lighting || selection === null) {
      for (const group of groups) {
        group.classList.toggle(
          'is-selected',
          Number(group.dataset.nodeId) === clickedNodeId,
        )
        group.classList.remove('is-neighbour', 'is-endpoint')
      }
      return
    }

    // A node lights up its whole neighbourhood; an edge lights up just the two
    // nodes it joins, with neither treated as "the" selected node.
    let pathIndices: number[]
    let selectedId: number | null = null
    let neighbours = new Set<number>()
    let endpoints = new Set<number>()

    if (selection.kind === 'node') {
      const hood = neighbourhoodOf(selection.nodeId)
      pathIndices = hood.pathIndices
      selectedId = selection.nodeId
      neighbours = new Set(hood.neighbourIds)
    } else {
      const edge = edgeSelectionOf(selection.connectionId)
      pathIndices = edge?.pathIndices ?? []
      endpoints = new Set(
        [edge?.connection.sourceId, edge?.connection.targetId].filter(
          (id): id is number => typeof id === 'number',
        ),
      )
    }

    for (const group of groups) {
      const id = Number(group.dataset.nodeId)
      group.classList.toggle('is-selected', id === selectedId)
      group.classList.toggle('is-neighbour', neighbours.has(id))
      group.classList.toggle('is-endpoint', endpoints.has(id))
    }

    const fragment = document.createDocumentFragment()
    for (const index of pathIndices) {
      const source = edgePathAt(index)
      if (!source) continue

      // A highlighted edge must not reappear over a filtered-out group.
      // Read the group's attributes rather than its `.is-filtered-out` class:
      // that class is written by another effect, and effects run in declaration
      // order, so testing it here would race.
      const owner = source.closest<SVGGElement>('[data-edge-group]')
      if (owner) {
        const [attrA, attrB] =
          taxonomy === 'type'
            ? (['typeA', 'typeB'] as const)
            : (['clusterA', 'clusterB'] as const)
        if (
          hiddenGroups.has(owner.dataset[attrA] ?? '') ||
          hiddenGroups.has(owner.dataset[attrB] ?? '')
        ) {
          continue
        }
      }

      const clone = source.cloneNode(true) as SVGPathElement
      if (mode === 'profile') {
        // Profile fades the artwork almost to nothing at fit zoom, so a
        // proportional thickening would still be invisible — screen pixels
        // instead. And grey, not black: these are connections you *could* mark,
        // which must not look like the ones you have.
        if (clone.dataset.edgeRole === 'line') {
          applyScreenStroke(clone, AVAILABLE_EDGE_PX)
        }
        if (clone.getAttribute('fill') === EDGE_INK) {
          clone.setAttribute('fill', AVAILABLE_INK)
        }
        if (clone.getAttribute('stroke') === EDGE_INK) {
          clone.setAttribute('stroke', AVAILABLE_INK)
        }
      } else {
        const width = Number.parseFloat(clone.getAttribute('stroke-width') ?? '')
        if (Number.isFinite(width) && width > 0) {
          clone.setAttribute(
            'stroke-width',
            (width * HIGHLIGHT_STROKE_FACTOR).toFixed(3),
          )
        }
      }
      fragment.appendChild(clone)
    }
    overlay.appendChild(fragment)
  }, [mode, selection, taxonomy, hiddenGroups, edgePathAt])

  /**
   * Mode-owned marks live on their own classes, independent of selection, so
   * a profile stays visible while you click around and survives mode switches.
   */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    for (const group of svg.querySelectorAll<SVGGElement>('g[data-node-id]')) {
      const id = Number(group.dataset.nodeId)
      group.classList.toggle('is-marked', markedNodeIds.has(id))
      // Never both: something already marked is not a candidate.
      group.classList.toggle(
        'is-candidate',
        !markedNodeIds.has(id) && candidateNodeIds.has(id),
      )
    }
  }, [markedNodeIds, candidateNodeIds])

  /** One class per standing; map.css turns them into the four status colours. */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    for (const group of svg.querySelectorAll<SVGGElement>('g[data-node-id]')) {
      const standing = intervention?.get(Number(group.dataset.nodeId))
      group.classList.toggle('is-covered', standing === 'covered')
      group.classList.toggle('is-gap', standing === 'gap')
      group.classList.toggle('is-beyond', standing === 'beyond')
      group.classList.toggle('is-untouched', standing === 'untouched')
    }
  }, [intervention])

  /**
   * The 108 node boxes are bare <g> elements straight out of the artwork, which
   * left the map reachable by mouse only. In Profile the map *is* the primary
   * input, so each box becomes a real checkbox: focusable, named, and reporting
   * whether it is marked.
   *
   * Confined to Profile deliberately. Adding 108 tab stops to Explore would
   * make the header and legend unreachable without a hundred presses, and there
   * the panel already offers the same information in a keyboard-native list.
   */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const profiling = mode === 'profile'
    for (const group of svg.querySelectorAll<SVGGElement>('g[data-node-id]')) {
      if (!profiling) {
        group.removeAttribute('tabindex')
        group.removeAttribute('role')
        group.removeAttribute('aria-checked')
        group.removeAttribute('aria-label')
        continue
      }
      const id = Number(group.dataset.nodeId)
      group.setAttribute('tabindex', '0')
      group.setAttribute('role', 'checkbox')
      group.setAttribute('aria-checked', String(markedNodeIds.has(id)))
      group.setAttribute(
        'aria-label',
        group.dataset.nodeLabel ?? `Variable ${group.dataset.nodeId}`,
      )
    }
  }, [mode, markedNodeIds])


  /**
   * Clones connections into an overlay, recoloured so they read as a layer.
   *
   * `widthFactor` scales the artwork's own stroke, which is in map units and so
   * shrinks with the zoom — right for Trace, where a route is read at the zoom
   * it was framed at. Profile passes `screenWidth` instead: those layers carry
   * `vector-effect: non-scaling-stroke`, so a marked connection holds the same
   * weight at fit zoom as at 1:1. Only the line paths take it — the arrowheads
   * and squares are filled shapes and would be deformed by a fat stroke.
   */
  const paintOverlay = useCallback(
    (
      overlay: SVGGElement | null,
      connectionIds: readonly string[] | undefined,
      colour: string,
      widthFactor: number,
      screen?: { width: number; opacity?: number },
    ) => {
      if (!overlay) return
      overlay.replaceChildren()
      if (!connectionIds?.length) return
      const fragment = document.createDocumentFragment()
      for (const connectionId of connectionIds) {
        for (const index of edgeGeometry.connections[connectionId]?.pathIndices ??
          []) {
          const source = edgePathAt(index)
          if (!source) continue
          const clone = source.cloneNode(true) as SVGPathElement
          if (screen?.opacity !== undefined) {
            clone.setAttribute('opacity', String(screen.opacity))
          }
          if (screen && clone.dataset.edgeRole === 'line') {
            applyScreenStroke(clone, screen.width)
          } else {
            const width = Number.parseFloat(clone.getAttribute('stroke-width') ?? '')
            if (Number.isFinite(width) && width > 0) {
              clone.setAttribute('stroke-width', (width * widthFactor).toFixed(3))
            }
          }
          if (clone.getAttribute('fill') === EDGE_INK) clone.setAttribute('fill', colour)
          if (clone.getAttribute('stroke') === EDGE_INK) {
            clone.setAttribute('stroke', colour)
          }
          fragment.appendChild(clone)
        }
      }
      overlay.appendChild(fragment)
    },
    [edgePathAt],
  )

  /**
   * Every path within the current step limit — the honest picture, drawn as the
   * normal display rather than as background. Deliberately independent of the
   * focus, so hovering the route list does not rebuild it.
   */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const onPath = new Set(tracePaths?.nodeIds ?? [])
    const destinations = new Set(tracePaths?.destinationIds ?? [])
    const startId = tracePaths?.startId

    for (const group of svg.querySelectorAll<SVGGElement>('g[data-node-id]')) {
      const id = Number(group.dataset.nodeId)
      group.classList.toggle('is-trace-start', id === startId)
      group.classList.toggle('is-path', onPath.has(id))
      group.classList.toggle('is-trace-core', destinations.has(id))
    }

    paintOverlay(overlayRef.current, tracePaths?.connectionIds, TRACE_INK, 1.6)
  }, [tracePaths, paintOverlay])

  /** The studied route. Cheap enough to repaint on hover. */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const focusNodes = new Set(traceFocus?.nodeIds ?? [])
    for (const group of svg.querySelectorAll<SVGGElement>('g[data-node-id]')) {
      group.classList.toggle(
        'is-focus',
        focusNodes.has(Number(group.dataset.nodeId)),
      )
    }
    paintOverlay(traceOverlayRef.current, traceFocus?.connectionIds, FOCUS_INK, 3)
  }, [traceFocus, paintOverlay])

  /**
   * Profile's two edge layers, separated by weight alone.
   *
   * There is deliberately no frontier-edge layer. It drew seventeen suggestion
   * lines for a three-variable profile, which was clutter rather than guidance,
   * and the only channel left to distinguish it — dash — belongs to the sign of
   * the connection. The suggested *nodes* already answer "where do I go next".
   */
  useEffect(() => {
    paintOverlay(markedEdgeRef.current, [...markedEdgeIds], MARK_INK, 2.2, {
      width: MARKED_EDGE_PX,
    })
  }, [markedEdgeIds, paintOverlay])

  useEffect(() => {
    paintOverlay(linkEdgeRef.current, missingLinkIds, AVAILABLE_INK, 1.8, {
      width: AVAILABLE_EDGE_PX,
    })
  }, [missingLinkIds, paintOverlay])

  /**
   * A clickable target at the midpoint of each unmarked link.
   *
   * Both discs are zero-length round-capped paths rather than <circle>s: a
   * circle's radius is in map units and would shrink to nothing at fit zoom,
   * whereas a round line cap is drawn from the stroke width, which
   * `non-scaling-stroke` pins to screen pixels. So the target stays the same
   * size however far out you are.
   *
   * The midpoint is read off the artwork's own path and re-parented under that
   * path's transform, so it lands on the drawn curve rather than on a straight
   * line between the two boxes.
   */
  useEffect(() => {
    const layer = linkBadgeRef.current
    if (!layer) return
    layer.replaceChildren()
    if (!missingLinkIds.length) return

    const fragment = document.createDocumentFragment()
    for (const connectionId of missingLinkIds) {
      const geometry = edgeGeometry.connections[connectionId]
      const path = geometry ? edgePathAt(geometry.terminalIndex) : undefined
      if (!path) continue

      let mid: DOMPoint
      try {
        mid = path.getPointAtLength(path.getTotalLength() / 2)
      } catch {
        // A degenerate path has no midpoint; skipping costs only the target,
        // and the dashed line is still there to be clicked through the card.
        continue
      }

      const holder = document.createElementNS(SVG_NS, 'g')
      const transform = path.getAttribute('transform')
      if (transform) holder.setAttribute('transform', transform)
      holder.dataset.linkId = connectionId
      holder.style.cursor = 'pointer'

      const title = document.createElementNS(SVG_NS, 'title')
      const connection = connectionsById.get(connectionId)
      const from = connection && nodesById.get(connection.sourceId)?.label
      const to = connection && nodesById.get(connection.targetId)?.label
      title.textContent =
        from && to
          ? `Both ends marked — click to mark ${from} → ${to}`
          : 'Click to mark this connection'
      holder.appendChild(title)

      const dot = (width: number, colour: string) => {
        const disc = document.createElementNS(SVG_NS, 'path')
        disc.setAttribute('d', `M${mid.x} ${mid.y}h0`)
        disc.setAttribute('stroke', colour)
        disc.setAttribute('stroke-width', String(width))
        disc.setAttribute('stroke-linecap', 'round')
        disc.setAttribute('fill', 'none')
        disc.setAttribute('vector-effect', 'non-scaling-stroke')
        return disc
      }
      holder.appendChild(dot(LINK_BADGE_PX, AVAILABLE_INK))
      holder.appendChild(dot(LINK_BADGE_CORE_PX, '#ffffff'))
      fragment.appendChild(holder)
    }
    layer.appendChild(fragment)
  }, [missingLinkIds, edgePathAt])

  /**
   * Applies the cluster filter. Node groups fade by their own cluster; edge
   * groups fade when either endpoint's cluster is hidden, which is what makes
   * "show only Food + Activity" reveal exactly the cross-connections.
   */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const nodeAttr = taxonomy === 'type' ? 'type' : 'cluster'
    for (const group of svg.querySelectorAll<SVGGElement>('g[data-node-id]')) {
      group.classList.toggle(
        'is-filtered-out',
        hiddenGroups.has(group.dataset[nodeAttr] ?? ''),
      )
    }

    // Edge groups carry both taxonomies; read whichever is active.
    const [attrA, attrB] =
      taxonomy === 'type'
        ? (['typeA', 'typeB'] as const)
        : (['clusterA', 'clusterB'] as const)
    for (const group of svg.querySelectorAll<SVGGElement>('[data-edge-group]')) {
      group.classList.toggle(
        'is-filtered-out',
        hiddenGroups.has(group.dataset[attrA] ?? '') ||
          hiddenGroups.has(group.dataset[attrB] ?? ''),
      )
    }
  }, [taxonomy, hiddenGroups])

  // Panning ends in a click event, so only treat a press as a click when the
  // pointer barely moved — otherwise every pan would clear the selection.
  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    pressRef.current = { x: event.clientX, y: event.clientY }
  }, [])

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      const press = pressRef.current
      pressRef.current = null
      if (
        press &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) >
          CLICK_SLOP_PX
      ) {
        return
      }

      const target = event.target as Element | null

      // The accept-this-link target is the one thing on the map that changes a
      // profile on a single click. That is safe precisely because it is a
      // purpose-built control: it exists only where both ends are already
      // marked, and it says what it does on hover.
      const badge = target?.closest<SVGGElement>('[data-link-id]')
      if (badge?.dataset.linkId) {
        onAcceptLink?.(badge.dataset.linkId)
        return
      }

      // Node boxes paint over the edges, so a hit on one wins outright.
      const nodeGroup = target?.closest<SVGGElement>('g[data-node-id]')
      if (nodeGroup) {
        const id = Number(nodeGroup.dataset.nodeId)
        onSelect(Number.isFinite(id) ? { kind: 'node', nodeId: id } : null)
        return
      }

      const hit = target?.closest<SVGPathElement>('path[data-connection-ids]')
      const ids = hit?.dataset.connectionIds?.split(' ').filter(Boolean) ?? []
      // A shared trunk carries several connections; take the first and let the
      // panel disclose the rest rather than guessing silently.
      onSelect(ids.length > 0 ? { kind: 'edge', connectionId: ids[0] } : null)
    },
    [onSelect, onAcceptLink],
  )

  /**
   * Enter or Space on a focused variable opens it, matching what a click does.
   * Neither marks it — the card's button is the only thing that does that, by
   * mouse or by keyboard alike.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const group = (event.target as Element | null)?.closest<SVGGElement>(
        'g[data-node-id]',
      )
      if (!group) return
      const id = Number(group.dataset.nodeId)
      if (!Number.isFinite(id)) return
      event.preventDefault()
      onSelect({ kind: 'node', nodeId: id })
    },
    [onSelect],
  )

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full overflow-hidden bg-white"
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <TransformWrapper
        onInit={(api) => {
          apiRef.current = api
          fitToViewport()
        }}
        // The floating card is positioned in screen space, so it has to be told
        // about every pan and zoom or it detaches from its variable.
        onTransform={pushAnchor}
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        limitToBounds={false}
        centerOnInit={false}
        doubleClick={{ disabled: true }}
        wheel={{ disabled: true }}
        panning={{ velocityDisabled: true }}
      >
        {/* No contentClass override: the library's default `fit-content`
            sizing is what makes the content box wrap the full 3370px map.
            Forcing `w-auto` here collapsed it to the viewport width. */}
        <TransformComponent wrapperClass="!h-full !w-full bg-white">
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={MAP_VIEW_BOX}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            // shrink-0 is load-bearing: TransformComponent's content is a flex
            // container, so without it the 3370px-wide SVG shrinks to the
            // viewport width and preserveAspectRatio letterboxes the map into a
            // fraction of its proper size.
            className={[
              'map-svg block shrink-0 bg-white',
              mode === 'explore' && selection !== null ? 'has-selection' : '',
              tracePaths ? 'has-trace' : '',
              tracePaths?.nodeIds.length || tracePaths?.connectionIds.length
                ? 'has-trace-lit'
                : '',
              mode === 'profile' ? 'has-profile' : '',
              mode === 'profile' && markedOnly ? 'marked-only' : '',
              mode === 'intervention' ? 'has-intervention' : '',
              mode === 'intervention' && gapsOnly ? 'gaps-only' : '',
              highContrast ? 'high-contrast' : '',
              markedNodeIds.size || markedEdgeIds.size ? 'has-marks' : '',
              traceFocus?.nodeIds.length ? 'has-trace-focus' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {/* Drawing order is document order in SVG: edges first, so node
                boxes paint over the curves exactly as in the source map. */}
            <style>{contrastCss}</style>
            <EdgeLayer />
            {/* Sits above the dimmed edges but below every node box, so
                highlighted curves never paint over the boxes. */}
            {/* All paths within the step limit, then the studied route on top. */}
            <g ref={overlayRef} data-layer="edge-highlight" />
            {/* Trace routes paint above the selection highlight so a trace is
                never buried under it when both are active. */}
            <g ref={traceOverlayRef} data-layer="trace-highlight" />
            {/* Weaker claim first: an unmarked link yields where it overlaps a
                connection the user has already decided about. */}
            <g ref={linkEdgeRef} data-layer="profile-link-edges" />
            <g ref={markedEdgeRef} data-layer="profile-marked-edges" />
            {/* Invisible click targets, above the artwork but below the nodes
                so a node box always wins a contested click. */}
            <EdgeHitLayer />
            {/* Below the nodes on purpose: the node box paints over the inner
                half of the halo's stroke, leaving a clean outer ring that never
                tints the cluster colour or the label. */}
            <NodeHalos
              layer="trace-start-marker"
              nodeIds={traceStartIds}
              colour="#0f766e"
              bands={TRACE_START_BANDS}
            />
            <NodeHalos
              layer="profile-focus-node"
              nodeIds={focusNodeIds}
              colour="#111827"
              bands={FOCUS_BANDS}
            />
            <NodeLayer />
            {/* Above the boxes, unlike the halo: a mark on a node has to sit on
                top of it, not behind it. */}
            {/* Above the boxes: these are controls, not artwork, and one can sit
                on a node it does not belong to. */}
            <g ref={linkBadgeRef} data-layer="profile-link-badges" />
          </svg>
        </TransformComponent>

        {showMiniMap && (
          // Lifted clear of any bar the map does not own — Profile's strip used
          // to cover the bottom quarter of the navigator, including the corner of
          // the viewport rectangle you drag to move around.
          <div
            className="pointer-events-none absolute left-4 z-20"
            style={{ bottom: 16 + bottomInset }}
          >
            <div className="pointer-events-auto overflow-hidden rounded-lg border border-gray-200 bg-white/95 p-1 shadow-lg backdrop-blur">
              <MiniMap
                width={168}
                height={119}
                borderColor="#9ca3af"
                previewStyle={{
                  border: '1.5px solid #2563eb',
                  background: 'rgba(37, 99, 235, 0.08)',
                }}
              >
                <MiniMapContent />
              </MiniMap>
            </div>
          </div>
        )}
      </TransformWrapper>
    </div>
  )
}
