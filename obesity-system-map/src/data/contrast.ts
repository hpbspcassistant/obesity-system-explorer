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

/**
 * Hub markers whose label sits on them in white.
 *
 * The type table above leaves every hub marker alone on purpose: they are
 * already saturated, and they are what marks a node as a key variable. That is
 * right for four of the six. Two carry a white label, and white on them was the
 * worst text on the map — 2.90 on the purple and 3.33 on the blue, against 6.4:1
 * or better everywhere else and a 15.02 best. High contrast left both exactly as
 * they were, so the one mode meant to help skipped the two nodes that needed it.
 *
 * Darker rather than brighter, because the label is white and cannot move: it is
 * baked at build time from the artwork fill, so a lighter hub would need the ink
 * recomputed per mode. Each stays inside its artwork hue, so a hub still reads as
 * a hub and the node keeps its identity.
 *
 * The other four are deliberately still absent. Their labels are dark ink and
 * already clear 7:1, and the orange one shows why brightening is not free: every
 * lighter orange tested scored between 1.47 and 1.98 against Activity's own
 * fill, dissolving the marker into the cluster it is supposed to stand out from.
 */
export interface ContrastHub {
  /** The artwork hub fill this replaces, matched exactly in the SVG markup. */
  from: string
  to: string
}

export const CONTRAST_HUBS: readonly ContrastHub[] = [
  // Force of Dietary Habits. White ink 2.90 -> 8.72, and 6.41 against the pale
  // Food fill it sits among.
  { from: '#AB8DB8', to: '#6B21A8' },
  // Degree of Primary Appetite Control. White ink 3.33 -> 7.56. Also carried by
  // two other nodes as a small marker, where it is not under the label; there it
  // simply deepens with the rest.
  { from: '#0096D4', to: '#075985' },
]

/**
 * The four key variables, which keep their own colour under high contrast.
 *
 * The artwork singles these out with a saturated hub fill among the pale type
 * colours, and that is the map's way of saying "this one is a hub". Everywhere
 * else the distinction survives high contrast, because Explore and Trace paint
 * the artwork's own fills. Profile is where it was lost: marking repaints a
 * variable to its *type* swatch, so under high contrast all four flattened into
 * the pale palette and became indistinguishable from the 104 ordinary variables
 * around them.
 *
 * Two keep the artwork's hub colour outright. The other two take the deepened
 * versions from CONTRAST_HUBS, so a key variable looks the same in Profile as it
 * does in Explore rather than changing colour when you switch modes.
 */
export interface KeyVariable {
  /** Node id in obesity_system_data.json. */
  id: number
  /** Named for the reader of this table; nothing matches on it. */
  label: string
  /** Its hub colour under high contrast. */
  fill: string
  /** True where that fill is dark enough to need the white label back. */
  lightInk: boolean
}

export const KEY_VARIABLES: readonly KeyVariable[] = [
  { id: 32, label: 'Psychological Ambivalence', fill: '#FAE129', lightInk: false },
  { id: 71, label: 'Physical Activity', fill: '#E09E5D', lightInk: false },
  { id: 73, label: 'Force of Dietary Habits', fill: '#6B21A8', lightInk: true },
  {
    id: 91,
    label: 'Degree of Primary Appetite Control',
    fill: '#075985',
    lightInk: true,
  },
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
 * Most hub markers (#FAE129, #303636, #7ABF82, #E09E5D) and the grey outline
 * ring (#95A0A9) are deliberately absent: they are already saturated, and they
 * are what marks a node as a key variable. The two that carry a white label are
 * handled separately — see CONTRAST_HUBS.
 *
 * Two halves, because Profile does not want a repainted map — it wants a GREY
 * one, with colour reserved to mean "marked". Repainting every box there put
 * bright amber on unmarked variables and collapsed all three of Profile's states
 * into "everything is coloured", which is the exact problem the grey exists to
 * solve. So outside Profile the fills are rewritten as before, and inside it
 * the palette is published as custom properties instead and map.css decides
 * which variables are allowed to spend them.
 */
export function contrastFillCss(): string {
  const repaint = CONTRAST_TYPES.flatMap((type) =>
    type.fills.map(
      (fill) =>
        `.map-svg.high-contrast:not(.has-profile):not(.has-intervention) ` +
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

  // Not scoped by data-type: a hub fill means the same thing wherever it appears,
  // and unlike the type fills no two hubs share a hex. Confined to non-Profile
  // for the same reason as the repaints — Profile flattens a marked node to its
  // type colour, so a hub never shows there.
  const hubs = CONTRAST_HUBS.map(
    (hub) =>
      `.map-svg.high-contrast:not(.has-profile):not(.has-intervention) ` +
      `g[data-node-id] path[fill="${hub.from}"]{fill:${hub.to}}`,
  )

  /*
   * Per-node overrides for the four key variables, which must beat the per-type
   * rule above. `[data-type]` is carried only for the specificity it adds: the
   * type rule names a value and so scores one attribute higher, and a key
   * variable losing that tie is the whole bug this fixes.
   *
   * Not in Intervention. Two of these colours are dark, and that mode forces every
   * label to the ink on the stated grounds that all of its fills are light —
   * letting a #6B21A8 box through there would put dark text on dark purple, the
   * same failure already fixed twice elsewhere. Intervention is about reach, not
   * about which variables are hubs, so they fall back to the type swatch.
   */
  const keys = KEY_VARIABLES.map(
    (key) =>
      `.map-svg.high-contrast:not(.has-intervention) ` +
      `g[data-node-id="${key.id}"][data-type]` +
      `{--node-colour-hc:${key.fill};--node-ring-hc:${ringFrom(key.fill)}}`,
  )

  // Two of them are dark enough to need the artwork's white label back, against
  // the rule in map.css that sends every marked label to the ink under high
  // contrast. Specificity again rather than source order, so this holds wherever
  // the generated sheet ends up relative to map.css.
  const keyInk = KEY_VARIABLES.filter((key) => key.lightInk).map(
    (key) =>
      `.map-svg.has-profile.high-contrast ` +
      `g[data-node-id="${key.id}"][data-type].is-marked .node-label` +
      `{fill:#ffffff}`,
  )

  return [...repaint, ...hubs, ...variables, ...keys, ...keyInk].join('\n')
}
