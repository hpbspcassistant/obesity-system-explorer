/**
 * Lays out node labels inside their box.
 *
 * The source SVGs contain no text at all, so labels are rendered from the JSON
 * `label` field. The original's manual line breaks are not recoverable from any
 * supplied file, so lines are wrapped to each node's real box width — close to
 * the original in most cases, but not guaranteed identical.
 *
 * Text is measured with a canvas context rather than estimated, so wrapping
 * matches what the browser will actually draw.
 */

export interface NodeBox {
  id: number
  x: number
  y: number
  w: number
  h: number
}

export interface LabelLayout {
  lines: string[]
  fontSize: number
  /** Horizontal centre of the node box, in map coordinates. */
  centreX: number
  /** Baseline y for the first line, in map coordinates. */
  firstBaseline: number
  lineHeight: number
  fill: string
}

export const LABEL_FONT_FAMILY =
  "'Segoe UI', 'Frutiger', 'Helvetica Neue', Arial, sans-serif"

/** Preferred size; shrinks per node only when the label will not otherwise fit. */
const MAX_FONT = 10
const MIN_FONT = 5.5
const FONT_STEP = 0.5
const LINE_HEIGHT_RATIO = 1.16
const PAD_X = 5
const PAD_Y = 3

let measureContext: CanvasRenderingContext2D | null = null

function measurer(): CanvasRenderingContext2D {
  if (!measureContext) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('labelLayout: 2d canvas context unavailable')
    measureContext = context
  }
  return measureContext
}

function widthOf(text: string, fontSize: number): number {
  const context = measurer()
  context.font = `${fontSize}px ${LABEL_FONT_FAMILY}`
  return context.measureText(text).width
}

/** Greedy word wrap. Over-long single words are allowed to overflow. */
function wrap(label: string, fontSize: number, maxWidth: number): string[] {
  const words = label.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let current = words[0]

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`
    if (widthOf(candidate, fontSize) <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = words[i]
    }
  }
  lines.push(current)
  return lines
}

/**
 * Luminance below which a fill needs light text. Calibrated against the
 * original sheet, which sets white on the blue (0.27) and purple (0.31) hubs
 * but keeps dark ink on the orange (0.41) and yellow ones.
 */
const LIGHT_TEXT_BELOW = 0.36

/** Relative luminance, used to pick readable text colour on accent fills. */
function isDark(hex: string): boolean {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim())
  if (!match) return false
  const raw =
    match[1].length === 3 ? match[1].replace(/./g, (c) => c + c) : match[1]
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(raw.slice(i, i + 2), 16) / 255
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < LIGHT_TEXT_BELOW
}

/**
 * Picks the largest font size (up to MAX_FONT) whose wrapped lines fit inside
 * the box, so most nodes share one size and only tight ones step down.
 */
export function layoutLabel(
  label: string,
  box: NodeBox,
  fill: string | undefined,
): LabelLayout | null {
  if (!label.trim()) return null

  const maxWidth = Math.max(box.w - PAD_X * 2, 8)
  const maxHeight = Math.max(box.h - PAD_Y * 2, 8)

  let chosen: { lines: string[]; fontSize: number } | null = null
  for (let size = MAX_FONT; size >= MIN_FONT; size -= FONT_STEP) {
    const lines = wrap(label, size, maxWidth)
    const height = lines.length * size * LINE_HEIGHT_RATIO
    const widest = Math.max(...lines.map((line) => widthOf(line, size)))
    if (height <= maxHeight && widest <= maxWidth) {
      chosen = { lines, fontSize: size }
      break
    }
  }
  // Nothing fit even at the floor: take the smallest and let it be tight.
  if (!chosen) {
    const lines = wrap(label, MIN_FONT, maxWidth)
    chosen = { lines, fontSize: MIN_FONT }
  }

  const lineHeight = chosen.fontSize * LINE_HEIGHT_RATIO
  const block = chosen.lines.length * lineHeight
  const centreY = box.y + box.h / 2
  // Baseline of the first line: top of the centred block, plus the cap offset
  // that puts glyphs optically centred within their line box.
  const firstBaseline = centreY - block / 2 + chosen.fontSize * 0.82

  return {
    lines: chosen.lines,
    fontSize: chosen.fontSize,
    centreX: box.x + box.w / 2,
    firstBaseline,
    lineHeight,
    fill: fill && isDark(fill) ? '#ffffff' : '#231f20',
  }
}
