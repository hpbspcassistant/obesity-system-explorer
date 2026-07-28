/**
 * Helpers for inlining SVG files imported with Vite's `?raw` suffix.
 *
 * The two map layers ship as standalone documents with their own <svg> root.
 * To composite them into one interactive document we strip each root and keep
 * the inner markup (including <defs>, which the edges layer needs for its
 * clip path), then mount it under a <g> in a single parent <svg>.
 */

const SVG_OPEN = /<svg\b[^>]*>/i
const SVG_CLOSE = /<\/svg\s*>/i
const XML_DECL = /<\?xml[^?]*\?>/gi
const DOCTYPE = /<!DOCTYPE[^>]*>/gi
/** Inkscape's namespaced attrs are editor metadata and carry no rendering meaning. */
const INKSCAPE_ATTR = /\sinkscape:[\w-]+="[^"]*"/gi

/**
 * Returns everything between the outermost <svg> and </svg> tags.
 * Throws rather than silently rendering nothing if the file is not an SVG.
 */
export function extractSvgInner(source: string, label: string): string {
  const withoutProlog = source.replace(XML_DECL, '').replace(DOCTYPE, '')

  const open = withoutProlog.match(SVG_OPEN)
  if (!open || open.index === undefined) {
    throw new Error(`inlineSvg: no <svg> root found in ${label}`)
  }

  const closeIndex = withoutProlog.search(SVG_CLOSE)
  if (closeIndex === -1) {
    throw new Error(`inlineSvg: no closing </svg> found in ${label}`)
  }

  const inner = withoutProlog.slice(open.index + open[0].length, closeIndex)
  return inner.replace(INKSCAPE_ATTR, '').trim()
}

/** Reads width/height/viewBox off an SVG root so we can assert the layers agree. */
export function readSvgViewBox(source: string): string | null {
  const open = source.match(SVG_OPEN)
  if (!open) return null
  const viewBox = open[0].match(/viewBox="([^"]+)"/i)
  return viewBox ? viewBox[1].trim() : null
}
