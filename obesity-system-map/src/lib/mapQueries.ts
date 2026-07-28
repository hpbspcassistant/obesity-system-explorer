/**
 * Lookups from logical ids to the SVG elements that draw them.
 *
 * Edge paths use `data-connection-ids` (a space-separated list) because one
 * drawn line can serve several connections, so the `~=` attribute selector is
 * the correct matcher — `=` would miss shared paths.
 */

/** Every path drawing a given node's box (fill, outline ring, extra layers). */
export function nodeElements(
  root: ParentNode,
  nodeId: number,
): SVGPathElement[] {
  return Array.from(
    root.querySelectorAll<SVGPathElement>(
      `[data-layer="nodes"] path[data-node-id="${CSS.escape(String(nodeId))}"]`,
    ),
  )
}

/** Every path drawing a given connection: its line plus both marker parts. */
export function connectionElements(
  root: ParentNode,
  connectionId: string,
): SVGPathElement[] {
  return Array.from(
    root.querySelectorAll<SVGPathElement>(
      `[data-layer="edges"] path[data-connection-ids~="${CSS.escape(connectionId)}"]`,
    ),
  )
}

/** Resolves the node id from any element inside a node's artwork. */
export function nodeIdFromElement(target: Element | null): number | null {
  const path = target?.closest<SVGPathElement>('path[data-node-id]')
  if (!path) return null
  const value = Number(path.dataset.nodeId)
  return Number.isFinite(value) ? value : null
}

/** Resolves the connection ids from any element inside an edge's artwork. */
export function connectionIdsFromElement(target: Element | null): string[] {
  const path = target?.closest<SVGPathElement>('path[data-connection-ids]')
  return path?.dataset.connectionIds?.split(' ').filter(Boolean) ?? []
}
