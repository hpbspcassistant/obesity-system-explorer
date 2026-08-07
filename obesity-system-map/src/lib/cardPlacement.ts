import type { AnchorRect } from '../components/MapView'

/**
 * Where a card hanging off a factor goes.
 *
 * Shared by Profile's marking card and Intervention's reach card. The rule is
 * fiddly enough — prefer one side, flip, then clamp on both axes — that a second
 * copy would drift, and the two cards appearing in different places for the same
 * click is exactly the kind of difference nobody can name but everybody feels.
 */

/** Gap between the node box and the card, and from the viewport edge. */
const GAP = 14
const EDGE_PAD = 10

export interface Placement {
  left: number
  top: number
}

/**
 * Prefers the right of the box, flips left when that would overflow, and
 * finally clamps into view. Vertically it centres on the box and clamps, so a
 * factor near the top or bottom of the map still gets a whole card.
 */
export function placeCard(
  anchor: AnchorRect,
  container: { width: number; height: number },
  width: number,
  height: number,
): Placement {
  const roomRight = container.width - (anchor.x + anchor.w) - GAP
  const left =
    roomRight >= width + EDGE_PAD
      ? anchor.x + anchor.w + GAP
      : anchor.x - GAP - width

  const top = anchor.y + anchor.h / 2 - height / 2

  return {
    left: Math.min(
      Math.max(left, EDGE_PAD),
      Math.max(EDGE_PAD, container.width - width - EDGE_PAD),
    ),
    top: Math.min(
      Math.max(top, EDGE_PAD),
      Math.max(EDGE_PAD, container.height - height - EDGE_PAD),
    ),
  }
}

/** The fallback corner, for a card opened with no anchor to hang off. */
export function cornerPlacement(
  container: { width: number; height: number },
  width: number,
): Placement {
  return { left: container.width - width - EDGE_PAD, top: EDGE_PAD }
}
