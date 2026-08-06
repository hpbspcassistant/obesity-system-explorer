/**
 * How "a programme reaches this" is drawn, shared by the map and the key.
 *
 * A thin outline was the first attempt and was not enough: measured against an
 * empty box it came out 18 apart, all of it in a 2.8px line that disappears at
 * fit zoom. Fill is already spoken for — it carries whether a variable matters
 * for the persona — so reach needs a channel of its own that does not touch the
 * inside of the box. A halo does that, and being drawn in screen pixels it holds
 * the same weight zoomed out to the whole map as it does at 1:1.
 *
 * Blue on purpose. Teal belongs to Trace, the cluster pastels belong to the
 * types, and near-black already means "the thing you have open" in Profile.
 */

/** Strong enough to read against ten pale cluster fills and white. */
export const REACH_INK = '#2563eb'

/**
 * Outer band first. Widths are screen px: half of each sits outside the box and
 * the node paints over the inner half, so what is left is a clean outer glow.
 */
export const REACH_BANDS = [
  { width: 18, opacity: 0.2 },
  { width: 8, opacity: 0.5 },
] as const
