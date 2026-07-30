/**
 * Deriving a visible outline colour from a pale fill.
 *
 * Profile draws a suggested factor as a white box ringed in the colour it would
 * take if marked. That ring has to be legible on white, which the artwork's own
 * fills are nowhere near — and neither is `accentFrom`, which is tuned for a
 * drop-shadow and caps lightness at 0.62, leaving the yellow and cream clusters
 * at 1.2–2.0:1.
 *
 * Shared with src/data/contrast.ts, because high contrast repaints the ten
 * fills and the rings have to follow: several types change hue family there
 * (Social cream → pink, Biological blue → teal, Food pale → purple), so a ring
 * derived from the artwork fill would name the wrong colour.
 */

/** #RGB or #RRGGBB -> [h, s, l] with h/s/l in 0..1. */
export function hexToHsl(hex: string): [number, number, number] | null {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const raw =
    match[1].length === 3 ? match[1].replace(/./g, (c) => c + c) : match[1]
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

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
  }
  return [f(0), f(8), f(4)]
}

/** Relative luminance of an sRGB triple in 0..1. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

/**
 * Contrast a ring must clear against the white box it is drawn on. 3:1 is the
 * WCAG floor for a non-text graphical object; 3.5 leaves a little headroom for
 * the stroke being only 1.8px.
 */
const RING_MIN_CONTRAST = 3.5

/**
 * The fill's hue and saturation, darkened until the result is actually visible
 * on white.
 *
 * Only lightness moves, and only by however much that particular hue needs, so
 * each colour gives up as little as possible: yellows land in olive, blues
 * barely shift, and the ten stay distinguishable from one another.
 */
export function ringFrom(hex: string): string {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  const [h, s] = hsl
  const s2 = Math.min(1, Math.max(s, 0.15) * 2.6)
  const contrastAt = (l: number) =>
    1.05 / (relativeLuminance(hslToRgb(h, s2, l)) + 0.05)

  // Binary search the lightest value that still clears the floor.
  let lo = 0.12
  let hi = 0.62
  let best = lo
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2
    if (contrastAt(mid) >= RING_MIN_CONTRAST) {
      best = mid
      lo = mid
    } else {
      hi = mid
    }
  }
  return `hsl(${Math.round(h * 360)} ${Math.round(s2 * 100)}% ${Math.round(best * 100)}%)`
}
