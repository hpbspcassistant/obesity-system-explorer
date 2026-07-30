/**
 * A higher-contrast fill palette for the ten variable types.
 *
 * WHY: the artwork's own fills sit in a twelve-point lightness band at the very
 * top of the range (L* 84.5-96.5) and 22 of the 45 pairs are under dE2000 10 —
 * five of them under 5, which is "the same colour" to most eyes. Media against
 * Psychological measured dE 4.3; Biological against Medical, 5.0. Against the
 * white page they range 1.09:1 to 1.50:1, so the boxes barely separate from the
 * paper either.
 *
 * HOW THESE WERE CHOSEN: shades 100-300 of a designed palette, searched for the
 * *calmest* combination that still clears a dE2000 floor of 14 on every pair.
 * Two other objectives were tried and rejected: maximising separation drove it
 * to neon (#2EDFFD, #B4F2AD), and minimising chroma drove it to mud (#8898A2,
 * #989688). The brief was "easier to tell apart", not "maximum contrast", so the
 * floor is a constraint and calmness is what gets optimised.
 *
 * RESULT: worst pair dE2000 14.2 (was 2.9), median 26.8 (was 9.1), zero
 * confusable pairs. Dark label ink (#231f20) clears 6.4:1 on every fill, so the
 * labels baked in at build time stay legible without being recomputed.
 *
 * Hue families follow the artwork where it had one — Economic stays green,
 * Medical blue, Food purple, Infrastructure grey. The three types that were all
 * pale blue and the three that were all pale yellow had to diverge; there is no
 * way to keep ten categories both faithful and distinguishable.
 */

import { ringFrom } from '../lib/ringColour'

export interface ContrastFill {
  /** The artwork fill this replaces, matched exactly in the SVG markup. */
  from: string
  to: string
}

export interface ContrastType {
  name: string
  /** What the legend shows, and the node box's main fill. */
  swatch: string
  /**
   * Every fill to repaint for this type. Usually one; Social and Economic carry
   * a second fill a shade off their main one (dE 0.4 and 0.5 — the same colour
   * to any eye), and leaving those behind would strand a few boxes pale.
   */
  fills: ContrastFill[]
}

export const CONTRAST_TYPES: readonly ContrastType[] = [
  { name: 'Social', swatch: '#FECDD3', fills: [
    { from: '#F1E3CC', to: '#FECDD3' },
    { from: '#F2E4CC', to: '#FECDD3' },
  ] },
  { name: 'Activity', swatch: '#FFEDD5', fills: [
    { from: '#F3E4D9', to: '#FFEDD5' },
  ] },
  { name: 'Media', swatch: '#FDE68A', fills: [
    { from: '#ECEBDC', to: '#FDE68A' },
  ] },
  { name: 'Psychological', swatch: '#ECFCCB', fills: [
    { from: '#F6F4DF', to: '#ECFCCB' },
  ] },
  { name: 'Economic', swatch: '#6EE7B7', fills: [
    { from: '#E4EDE8', to: '#6EE7B7' },
    { from: '#E4EDE9', to: '#6EE7B7' },
  ] },
  { name: 'Biological', swatch: '#CCFBF1', fills: [
    { from: '#DBDFE6', to: '#CCFBF1' },
    // Biological borrows Developmental's exact pale blue for a few boxes. Left
    // alone it would read as the wrong type, so it moves to a deeper teal —
    // still inside Biological, still distinct from its main fill.
    { from: '#C3D5E8', to: '#99F6E4' },
  ] },
  { name: 'Medical', swatch: '#BAE6FD', fills: [
    { from: '#DFECF4', to: '#BAE6FD' },
  ] },
  { name: 'Developmental', swatch: '#A5B4FC', fills: [
    { from: '#C3D5E8', to: '#A5B4FC' },
  ] },
  { name: 'Food', swatch: '#E9D5FF', fills: [
    { from: '#EBEAF0', to: '#E9D5FF' },
  ] },
  { name: 'Infrastructure', swatch: '#9CA3AF', fills: [
    { from: '#F4F5F6', to: '#9CA3AF' },
  ] },
]

const swatchByType = new Map(CONTRAST_TYPES.map((t) => [t.name, t.swatch]))

/** The legend must agree with the map, so it reads its swatches from here. */
export function contrastSwatch(typeName: string): string | undefined {
  return swatchByType.get(typeName)
}

/**
 * CSS for the retint, generated from the table above so the map and the legend
 * cannot drift apart.
 *
 * Scoped by `data-type` as well as by the old fill, because two types share a
 * hex: Developmental's swatch is also one of Biological's fills. Matching on
 * fill alone would repaint the wrong boxes.
 *
 * Hub markers (#FAE129, #0096D4, #303636, #7ABF82, #E09E5D, #AB8DB8) and the
 * grey outline ring (#95A0A9) are deliberately absent: they are already
 * saturated, and they are what marks a node as a key variable.
 *
 * Two halves, because Profile does not want a repainted map — it wants a GREY
 * one, with colour reserved to mean "marked". Repainting every box there put
 * bright amber on unmarked factors and collapsed all three of Profile's states
 * into "everything is coloured", which is the exact problem the grey exists to
 * solve. So outside Profile the fills are rewritten as before, and inside it
 * the palette is published as custom properties instead and map.css decides
 * which factors are allowed to spend them.
 */
export function contrastFillCss(): string {
  const repaint = CONTRAST_TYPES.flatMap((type) =>
    type.fills.map(
      (fill) =>
        `.map-svg.high-contrast:not(.has-profile) ` +
        `g[data-node-id][data-type="${type.name}"] ` +
        `path[fill="${fill.from}"]{fill:${fill.to}}`,
    ),
  )

  // One value per type rather than per source fill: Profile flattens a node to
  // a single colour anyway, and the swatch is what the legend promises. It also
  // quietly fixes the two Biological boxes that borrow Developmental's blue —
  // in Profile they now read as Biological instead of as the wrong type.
  const variables = CONTRAST_TYPES.map(
    (type) =>
      `.map-svg.high-contrast g[data-node-id][data-type="${type.name}"]` +
      `{--node-colour-hc:${type.swatch};--node-ring-hc:${ringFrom(type.swatch)}}`,
  )

  return [...repaint, ...variables].join('\n')
}
