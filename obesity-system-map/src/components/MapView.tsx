import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
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
  clusterPairForConnection,
  edgeGeometry,
  neighbourhoodOf,
  nodeBoxesById,
  nodesById,
} from '../data/systemMap'
import { layoutLabel } from '../lib/labelLayout'
import {
  annotateEdges,
  groupEdgePathsByCluster,
  groupNodePaths,
} from '../lib/annotateSvg'
import { extractSvgInner, readSvgViewBox } from '../lib/inlineSvg'
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

// Parsed and annotated once at module scope: the markup is static, so
// re-running this per render would only cost time. Edge paths gain their
// connection ids here; node paths already carry data-node-id from extraction.
const edgesInner = groupEdgePathsByCluster(
  annotateEdges(
    extractSvgInner(edgesRaw, 'obesity_map_edges_only.svg'),
    edgeGeometry,
  ),
  { pairForConnection: clusterPairForConnection },
)
const nodesInner = groupNodePaths(
  extractSvgInner(nodeBoxesRaw, 'obesity_system_map_node_boxes_only.svg'),
  {
    clusterOf: (nodeId) => nodesById.get(nodeId)?.mapCluster,
    labelFor: (nodeId, fill) => {
      const node = nodesById.get(nodeId)
      const box = nodeBoxesById.get(nodeId)
      return node && box ? layoutLabel(node.label, box, fill) : null
    },
  },
)

/** Highlighted edges are redrawn this much thicker than their source path. */
const HIGHLIGHT_STROKE_FACTOR = 1.9
/** Pointer travel above which a press counts as a pan, not a click. */
const CLICK_SLOP_PX = 5

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

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

export interface MapViewProps {
  selectedNodeId: number | null
  /** Called with the clicked node id, or null when empty space was clicked. */
  onNodeClick: (nodeId: number | null) => void
  /** Clusters to fade out; an edge fades if either endpoint is hidden. */
  hiddenClusters: ReadonlySet<string>
  /** Whether to draw the navigator thumbnail. */
  showMiniMap?: boolean
  ref?: Ref<MapViewHandle>
}

export interface MapViewHandle {
  /** Scales the map back to fit the viewport and re-centres it. */
  resetView: () => void
}

export function MapView({
  selectedNodeId,
  onNodeClick,
  hiddenClusters,
  showMiniMap = true,
  ref,
}: MapViewProps) {
  const apiRef = useRef<ReactZoomPanPinchRef | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const overlayRef = useRef<SVGGElement | null>(null)
  const pressRef = useRef<{ x: number; y: number } | null>(null)
  /** path-index -> element, built once; the layers never re-render. */
  const edgePathIndex = useRef<Map<number, SVGPathElement> | null>(null)

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

  // Snaps rather than eases: the library animates transforms with
  // requestAnimationFrame, and an instant reset is deterministic. Pass a
  // duration here (e.g. 250) to ease it instead.
  useImperativeHandle(
    ref,
    () => ({ resetView: () => fitToViewport(0) }),
    [fitToViewport],
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

    if (selectedNodeId === null) {
      for (const group of groups) {
        group.classList.remove('is-selected', 'is-neighbour')
      }
      return
    }

    const { neighbourIds, pathIndices } = neighbourhoodOf(selectedNodeId)
    const neighbours = new Set(neighbourIds)

    for (const group of groups) {
      const id = Number(group.dataset.nodeId)
      group.classList.toggle('is-selected', id === selectedNodeId)
      group.classList.toggle('is-neighbour', neighbours.has(id))
    }

    const fragment = document.createDocumentFragment()
    for (const index of pathIndices) {
      const source = edgePathAt(index)
      if (!source) continue

      // A highlighted edge must not reappear over a hidden cluster.
      const owner = source.closest<SVGGElement>('[data-cluster-a]')
      if (
        owner &&
        (hiddenClusters.has(owner.dataset.clusterA ?? '') ||
          hiddenClusters.has(owner.dataset.clusterB ?? ''))
      ) {
        continue
      }

      const clone = source.cloneNode(true) as SVGPathElement
      const width = Number.parseFloat(clone.getAttribute('stroke-width') ?? '')
      if (Number.isFinite(width) && width > 0) {
        clone.setAttribute(
          'stroke-width',
          (width * HIGHLIGHT_STROKE_FACTOR).toFixed(3),
        )
      }
      fragment.appendChild(clone)
    }
    overlay.appendChild(fragment)
  }, [selectedNodeId, hiddenClusters, edgePathAt])

  /**
   * Applies the cluster filter. Node groups fade by their own cluster; edge
   * groups fade when either endpoint's cluster is hidden, which is what makes
   * "show only Food + Activity" reveal exactly the cross-connections.
   */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    for (const group of svg.querySelectorAll<SVGGElement>('g[data-node-id]')) {
      group.classList.toggle(
        'is-filtered-out',
        hiddenClusters.has(group.dataset.cluster ?? ''),
      )
    }

    for (const group of svg.querySelectorAll<SVGGElement>('[data-cluster-a]')) {
      group.classList.toggle(
        'is-filtered-out',
        hiddenClusters.has(group.dataset.clusterA ?? '') ||
          hiddenClusters.has(group.dataset.clusterB ?? ''),
      )
    }
  }, [hiddenClusters])

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

      const group = (event.target as Element | null)?.closest<SVGGElement>(
        'g[data-node-id]',
      )
      const id = group ? Number(group.dataset.nodeId) : null
      onNodeClick(Number.isFinite(id as number) ? (id as number) : null)
    },
    [onNodeClick],
  )

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full overflow-hidden bg-white"
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <TransformWrapper
        onInit={(api) => {
          apiRef.current = api
          fitToViewport()
        }}
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
            className={`map-svg block shrink-0 bg-white${
              selectedNodeId === null ? '' : ' has-selection'
            }`}
          >
            {/* Drawing order is document order in SVG: edges first, so node
                boxes paint over the curves exactly as in the source map. */}
            <EdgeLayer />
            {/* Sits above the dimmed edges but below every node box, so
                highlighted curves never paint over the boxes. */}
            <g ref={overlayRef} data-layer="edge-highlight" />
            <NodeLayer />
          </svg>
        </TransformComponent>

        {showMiniMap && (
          <div className="pointer-events-none absolute bottom-4 left-4 z-20">
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
