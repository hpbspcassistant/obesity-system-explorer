/**
 * Rendering the map to a PNG.
 *
 * The hard part is not the raster step, it is that almost nothing you can see on
 * the map is in the map. Every colour in Profile — grey for unmarked, the cluster
 * fill for marked, the ring on a suggestion, the faded artwork — comes from
 * `map.css` matching on classes. A serialised SVG carries none of it: handed to an
 * <img>, the document's stylesheets do not come along, and what renders is the
 * 2007 artwork in its original colours with nothing marked at all.
 *
 * So every element's computed style is read from the live map and written onto the
 * clone as a presentation attribute. It is the whole reason this file exists.
 */

/**
 * Properties worth carrying over.
 *
 * Deliberately excludes `transform` and `filter`. Both are used for transient
 * emphasis — the 1.05 scale on a selected box, the drop-shadow on a neighbour —
 * and both depend on `transform-box`/`transform-origin` pairs that do not survive
 * being flattened onto one element. An export is of a profile, not of whatever
 * happened to be selected when the button was pressed.
 */
const BAKED = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'display',
  'visibility',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
] as const

/**
 * Line weight for the overlay edges, in map units.
 *
 * 0.85 is the widest the artwork draws a connection (0.51, 0.69, 0.83) rounded up,
 * and the same number high contrast pins the web to. Using `Math.min` against it
 * rather than assigning it means an overlay thinner than the web stays thinner.
 */
const WEB_EDGE_WIDTH = 0.85

export interface ExportOptions {
  /**
   * Output pixels per map unit. The map is 3370 units wide, so 3 gives a
   * 10111px image — A3 at 611dpi. See EXPORT_SCALES in App.
   */
  scale?: number
}

/**
 * Flattens a `non-scaling-stroke` width into ordinary map units, one for one.
 *
 * Those strokes hold a constant screen width at any zoom, which a static image
 * has no equivalent of, so the flag comes off and the number stays.
 */
function bakeStrokes(
  source: Element,
  target: Element,
  computed: CSSStyleDeclaration,
): void {
  const nonScaling = computed.getPropertyValue('vector-effect').trim() ===
    'non-scaling-stroke'
  /*
   * A screen pixel becomes one map unit, and nothing is scaled up.
   *
   * There used to be a divisor here, dividing every non-scaling width by the fit
   * scale so it kept its on-screen proportion. It was wrong at every setting, and
   * two attempts to narrow it down only moved which layer came out heavy:
   *
   *   everything    edges 3.2, boxes 3.4 and 8.3 units, against artwork drawn at
   *                 0.51 to 0.83 — the marker-pen look
   *   overlays only marked connections at 2.6 / 0.27 = 9.6 units, eleven times
   *                 the web beside them
   *
   * The premise was that 2.6px against a 3370px image is a hairline. That was
   * true when the export ran at scale 1; it is not now the image is 10111px
   * wide, where 2.6 units is nearly 8 pixels, and on A3 a third of a millimetre.
   *
   * So the rule is simply 1px = 1 unit. That is the map as it looks at 100% zoom
   * — which is what a print of it should be — and it keeps the app's own
   * hierarchy without inventing one: 0.85 for the web, 0.9 or 2.2 for a box, 2.6
   * for a marked connection.
   */
  /*
   * The overlay edges are drawn at the web's own weight, not their screen one.
   *
   * On screen a marked connection is 2.6px against artwork lines of 0.51 to 0.83
   * units, and it needs to be: at fit zoom those artwork widths are a fraction of
   * a pixel, so without extra weight a marked connection would be invisible on
   * the layer the whole mode is about.
   *
   * A print has no such problem. At A3 the web is already a clean 0.1mm line, and
   * a marked connection four times that reads as heavy rather than as chosen —
   * which is what it looked like. Tone is doing the work anyway: the artwork web
   * is faded to 0.3 in Profile and the marked layer is full-strength artwork ink,
   * so the two are told apart without spending weight on it.
   */
  const OVERLAY_EDGES = [
    'profile-marked-edges',
    'profile-link-edges',
    'edge-highlight',
    'trace-highlight',
  ]
  const layer = source.closest('[data-layer]')
  const isOverlayEdge =
    layer instanceof SVGElement &&
    OVERLAY_EDGES.includes(layer.dataset.layer ?? '')

  const width = Number.parseFloat(computed.getPropertyValue('stroke-width'))
  if (Number.isFinite(width)) {
    target.setAttribute(
      'stroke-width',
      String(isOverlayEdge ? Math.min(width, WEB_EDGE_WIDTH) : width),
    )
  }

  const dash = computed.getPropertyValue('stroke-dasharray').trim()
  if (dash && dash !== 'none') {
    target.setAttribute(
      'stroke-dasharray',
      dash
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((part) => Number.parseFloat(part))
        .map((n) => (Number.isFinite(n) ? n.toFixed(3) : '0'))
        .join(' '),
    )
  }

  // Flattened, so the width above is taken at face value.
  if (nonScaling) target.setAttribute('vector-effect', 'none')
  void source
}

/** Walks both trees in step, copying the live look onto the copy. */
function bakeStyles(source: Element, target: Element): void {
  const computed = window.getComputedStyle(source)
  for (const property of BAKED) {
    const value = computed.getPropertyValue(property)
    if (value) target.setAttribute(property, value)
  }
  bakeStrokes(source, target, computed)

  // Class names are dead weight once the styling is inline, and their absence
  // makes the exported file readable if anyone opens it.
  target.removeAttribute('class')

  const from = source.children
  const to = target.children
  for (let i = 0; i < from.length && i < to.length; i += 1) {
    bakeStyles(from[i], to[i])
  }
}

/**
 * Renders the given SVG to a PNG blob.
 *
 * Everything happens on a detached clone, so the live map is never touched: no
 * flicker, and a failed export leaves nothing behind.
 */
export async function svgToPngBlob(
  svg: SVGSVGElement,
  { scale = 1 }: ExportOptions,
): Promise<Blob> {
  const viewBox = svg.getAttribute('viewBox')
  const [, , widthUnits, heightUnits] = (viewBox ?? '0 0 0 0')
    .split(/\s+/)
    .map(Number)
  if (!widthUnits || !heightUnits) {
    throw new Error('exportImage: the map has no usable viewBox')
  }

  const clone = svg.cloneNode(true) as SVGSVGElement
  bakeStyles(svg, clone)

  /*
   * The invisible click targets have no business in a picture.
   *
   * They trace every connection at an 11px non-scaling stroke and are kept out
   * of sight by `stroke: transparent`, which bakes as `rgba(0, 0, 0, 0)` — CSS
   * Color 4 syntax in an SVG presentation attribute, which a renderer is under
   * no obligation to accept. Anything that falls back to the default paints 297
   * black bands across the map, so leaving them in was a hazard with no upside.
   */
  for (const hit of clone.querySelectorAll("[data-layer='edge-hit']")) {
    hit.remove()
  }

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(widthUnits))
  clone.setAttribute('height', String(heightUnits))

  // The white behind the map is a CSS background on the element, which is not
  // part of the SVG and would export as transparency. Painted explicitly, and
  // first, so it sits behind every layer.
  const background = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'rect',
  )
  background.setAttribute('x', '0')
  background.setAttribute('y', '0')
  background.setAttribute('width', String(widthUnits))
  background.setAttribute('height', String(heightUnits))
  background.setAttribute('fill', '#ffffff')
  clone.insertBefore(background, clone.firstChild)

  const markup = new XMLSerializer().serializeToString(clone)
  // A blob URL rather than a data URL: the serialised map runs to megabytes, and
  // encodeURIComponent on that is both slow and near the length limits.
  const url = URL.createObjectURL(
    new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }),
  )

  try {
    const image = new Image()
    image.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () =>
        reject(new Error('exportImage: the map could not be rasterised'))
      image.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(widthUnits * scale)
    canvas.height = Math.round(heightUnits * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('exportImage: no 2d canvas available')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error('exportImage: the canvas produced no image')),
        'image/png',
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Hands a blob to the browser as a download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
