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

export interface ExportOptions {
  /**
   * Output pixels per map unit. The map is 3370 units wide, so 1 gives a
   * 3370px image — already past what A4 needs at 300dpi.
   */
  scale?: number
  /**
   * Map scale the on-screen look is defined at, used to convert the profile
   * layers' screen-pixel strokes into map units. See `bakeStrokes`.
   */
  referenceScale: number
}

/**
 * Converts a `non-scaling-stroke` width into ordinary map units.
 *
 * Those strokes exist so a marked connection holds 2.6px on screen at any zoom.
 * Kept as-is in the export they would render 2.6px against a 3370px-wide image —
 * a hairline, on the one layer the whole picture is about. Dividing by the scale
 * the look was designed at restores the proportion instead: 2.6px at fit zoom
 * (~0.3) is about 8.7 map units, which is 8.7 units at any output size.
 *
 * The dash pattern is measured in screen pixels under the same flag, and carries
 * the artwork's meaning for "negative", so it is converted by the same factor.
 */
function bakeStrokes(
  source: Element,
  target: Element,
  computed: CSSStyleDeclaration,
  referenceScale: number,
): void {
  const nonScaling = computed.getPropertyValue('vector-effect').trim() ===
    'non-scaling-stroke'
  /*
   * The artwork's own edges are the exception, and getting this wrong is what
   * made an exported map look like it had been drawn with a marker pen.
   *
   * Their non-scaling stroke is a FLOOR, not a design width: high contrast pins
   * every edge to 0.85px so the web survives being zoomed out on a screen. Run
   * through the divisor that becomes 0.85 / 0.27 ≈ 3.2 map units, against the
   * 0.51-0.83 the artwork actually draws — four to six times too heavy, on all
   * 898 of them at once.
   *
   * The overlay layers are the opposite case. A marked connection is 2.6px
   * because that is how prominent it is meant to be at any zoom, so there the
   * proportion is the thing to preserve and the divisor is right.
   *
   * So: convert where a screen width is the intent, and leave it alone where it
   * is only a minimum. Undivided, these bake at 0.85 units — a shade bolder than
   * the artwork and correct at any print size.
   */
  const isBaseEdge = source.closest("[data-layer='edges']") !== null
  const divisor =
    nonScaling && !isBaseEdge && referenceScale > 0 ? referenceScale : 1

  const width = Number.parseFloat(computed.getPropertyValue('stroke-width'))
  if (Number.isFinite(width)) {
    target.setAttribute('stroke-width', String(width / divisor))
  }

  const dash = computed.getPropertyValue('stroke-dasharray').trim()
  if (dash && dash !== 'none') {
    target.setAttribute(
      'stroke-dasharray',
      dash
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((part) => Number.parseFloat(part) / divisor)
        .map((n) => (Number.isFinite(n) ? n.toFixed(3) : '0'))
        .join(' '),
    )
  }

  // Flattened, so the divided width is taken at face value.
  if (nonScaling) target.setAttribute('vector-effect', 'none')
  void source
}

/** Walks both trees in step, copying the live look onto the copy. */
function bakeStyles(
  source: Element,
  target: Element,
  referenceScale: number,
): void {
  const computed = window.getComputedStyle(source)
  for (const property of BAKED) {
    const value = computed.getPropertyValue(property)
    if (value) target.setAttribute(property, value)
  }
  bakeStrokes(source, target, computed, referenceScale)

  // Class names are dead weight once the styling is inline, and their absence
  // makes the exported file readable if anyone opens it.
  target.removeAttribute('class')

  const from = source.children
  const to = target.children
  for (let i = 0; i < from.length && i < to.length; i += 1) {
    bakeStyles(from[i], to[i], referenceScale)
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
  { scale = 1, referenceScale }: ExportOptions,
): Promise<Blob> {
  const viewBox = svg.getAttribute('viewBox')
  const [, , widthUnits, heightUnits] = (viewBox ?? '0 0 0 0')
    .split(/\s+/)
    .map(Number)
  if (!widthUnits || !heightUnits) {
    throw new Error('exportImage: the map has no usable viewBox')
  }

  const clone = svg.cloneNode(true) as SVGSVGElement
  bakeStyles(svg, clone, referenceScale)

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
