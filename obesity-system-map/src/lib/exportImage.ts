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

export interface LegendEntry {
  fill: string
  stroke: string
  label: string
}

export interface InfluenceEntry {
  kind: 'positive' | 'negative'
  label: string
}

export interface ExportOverlay {
  mode: string
  persona: string | null
  legend: LegendEntry[]
  influence?: InfluenceEntry[]
}

export interface ExportOptions {
  /**
   * Output pixels per map unit. The map is 3370 units wide, so 3 gives a
   * 10111px image — A3 at 611dpi. See EXPORT_SCALES in App.
   */
  scale?: number
  overlay?: ExportOverlay
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
  { scale = 1, overlay }: ExportOptions,
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

    if (overlay) drawOverlay(context, canvas.width, canvas.height, overlay)

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

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  overlay: ExportOverlay,
): void {
  // Scale all measurements relative to the image width so the overlay looks
  // proportional at any export resolution (scale 1, 2 or 3).
  const unit = canvasW / 200
  const margin = unit * 3
  const radius = unit * 0.8

  // ── Title badge (top-left) ────────────────────────────────────────────
  const titleFont = `600 ${unit * 2.2}px sans-serif`
  const subtitleFont = `400 ${unit * 1.7}px sans-serif`
  ctx.font = titleFont
  const modeText = overlay.mode
  const modeWidth = ctx.measureText(modeText).width
  let badgeW = modeWidth
  let badgeH = unit * 3
  let subtitleText = ''
  if (overlay.persona) {
    subtitleText = overlay.persona
    ctx.font = subtitleFont
    const subWidth = ctx.measureText(subtitleText).width
    badgeW = Math.max(badgeW, subWidth)
    badgeH += unit * 2.4
  }
  badgeW += unit * 3
  badgeH += unit * 1.5

  const bx = margin
  const by = margin
  roundRect(ctx, bx, by, badgeW, badgeH, radius)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fill()
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = Math.max(1, unit * 0.12)
  ctx.stroke()

  ctx.fillStyle = '#111827'
  ctx.font = titleFont
  ctx.textBaseline = 'top'
  ctx.fillText(modeText, bx + unit * 1.5, by + unit * 1)
  if (subtitleText) {
    ctx.fillStyle = '#4b5563'
    ctx.font = subtitleFont
    ctx.fillText(subtitleText, bx + unit * 1.5, by + unit * 3.6)
  }

  // ── Legend (bottom-right) ─────────────────────────────────────────────
  const hasLegend = overlay.legend.length > 0
  const influence = overlay.influence ?? []
  const hasInfluence = influence.length > 0
  if (!hasLegend && !hasInfluence) return

  const legendFont = `400 ${unit * 1.4}px sans-serif`
  ctx.font = legendFont
  const swatchW = unit * 3.2
  const swatchH = unit * 1.8
  const rowH = unit * 2.6
  const gap = unit * 1
  const textLeft = swatchW + gap
  const arrowW = unit * 4.5

  let maxLabelW = 0
  for (const entry of overlay.legend) {
    maxLabelW = Math.max(maxLabelW, ctx.measureText(entry.label).width)
  }
  for (const entry of influence) {
    maxLabelW = Math.max(maxLabelW, ctx.measureText(entry.label).width)
  }
  const iconTextLeft = arrowW + gap
  const symbolCol = hasLegend && hasInfluence
    ? Math.max(textLeft, iconTextLeft)
    : hasLegend ? textLeft : iconTextLeft
  const legendPad = unit * 1.5
  const totalRows = overlay.legend.length + influence.length
  const dividerH = hasLegend && hasInfluence ? unit * 1.2 : 0
  const legendW = Math.max(
    hasLegend ? textLeft + maxLabelW : 0,
    hasInfluence ? iconTextLeft + maxLabelW : 0,
  ) + legendPad * 2
  const legendH = totalRows * rowH + dividerH + legendPad * 2

  const lx = canvasW - margin - legendW
  const ly = canvasH - margin - legendH
  roundRect(ctx, lx, ly, legendW, legendH, radius)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fill()
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = Math.max(1, unit * 0.12)
  ctx.stroke()

  ctx.font = legendFont
  ctx.textBaseline = 'middle'

  // Swatch rows
  for (let i = 0; i < overlay.legend.length; i++) {
    const entry = overlay.legend[i]
    const rowY = ly + legendPad + i * rowH
    const sy = rowY + (rowH - swatchH) / 2

    ctx.fillStyle = entry.fill
    ctx.strokeStyle = entry.stroke
    ctx.lineWidth = Math.max(1, unit * 0.2)
    roundRect(ctx, lx + legendPad, sy, swatchW, swatchH, unit * 0.3)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#374151'
    ctx.fillText(entry.label, lx + legendPad + symbolCol, rowY + rowH / 2)
  }

  // Influence rows
  const influenceStart = ly + legendPad + overlay.legend.length * rowH + dividerH
  if (hasLegend && hasInfluence) {
    const divY = influenceStart - dividerH / 2
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = Math.max(1, unit * 0.08)
    ctx.beginPath()
    ctx.moveTo(lx + legendPad, divY)
    ctx.lineTo(lx + legendW - legendPad, divY)
    ctx.stroke()
  }

  const inkColour = '#231f20'
  for (let i = 0; i < influence.length; i++) {
    const entry = influence[i]
    const rowY = influenceStart + i * rowH
    const iy = rowY + rowH / 2
    const ix = lx + legendPad
    const lineEnd = ix + arrowW

    ctx.strokeStyle = inkColour
    ctx.fillStyle = inkColour
    ctx.lineWidth = Math.max(1, unit * 0.12)

    if (entry.kind === 'positive') {
      // Solid line with arrowhead
      ctx.beginPath()
      ctx.moveTo(ix, iy)
      ctx.lineTo(lineEnd - unit * 0.8, iy)
      ctx.stroke()
      // Arrowhead
      const tipX = lineEnd
      const sz = unit * 0.6
      ctx.beginPath()
      ctx.moveTo(tipX - sz * 1.6, iy - sz)
      ctx.lineTo(tipX, iy)
      ctx.lineTo(tipX - sz * 1.6, iy + sz)
      ctx.closePath()
      ctx.fill()
    } else {
      // Dashed line with filled square
      ctx.setLineDash([unit * 0.4, unit * 0.35])
      ctx.beginPath()
      ctx.moveTo(ix, iy)
      ctx.lineTo(lineEnd - unit * 1.0, iy)
      ctx.stroke()
      ctx.setLineDash([])
      // Filled square
      const sq = unit * 0.7
      ctx.fillRect(lineEnd - sq, iy - sq / 2, sq, sq)
    }

    ctx.fillStyle = '#374151'
    ctx.fillText(entry.label, lx + legendPad + symbolCol, iy)
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
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
