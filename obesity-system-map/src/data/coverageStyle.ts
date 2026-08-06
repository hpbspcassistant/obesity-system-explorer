/**
 * How "a programme reaches this" is drawn, shared by the map and the key.
 *
 * Three attempts got here. A thin outline measured 18 from an empty box and
 * vanished at fit zoom; a halo was the same idea louder, and read as the same
 * thing; a dot inside the corner was the right kind of mark but too quiet and in
 * the wrong place — sitting within the fill, it competed with the label and
 * still read as part of the box's edge.
 *
 * So the dot now straddles the boundary. Half of it hangs outside, which breaks
 * the box's silhouette rather than decorating its inside, and it clears the
 * label entirely. It carries a white backing disc because 296 connection lines
 * cross this map and a bare dot sitting on one would disappear — the same
 * two-disc construction the accept-this-link target uses.
 */

/** Strong enough to read against ten pale cluster fills and white. */
export const REACH_INK = '#2563eb'

/** Screen px, so the mark holds its size at any zoom. */
export const REACH_DOT_PX = 10
/** The white disc behind it, giving separation from whatever it lands on. */
export const REACH_DOT_BACKING_PX = 15

/** Where the dot sits relative to the box; each straddles the boundary. */
export type ReachDotPlacement = 'corner' | 'left' | 'above'
