import { useEffect, useRef } from 'react'

/**
 * What the boxes mean, on the screen rather than in someone's head.
 *
 * The swatches are real node groups carrying the real classes inside a
 * `.map-svg.has-intervention` wrapper, so they are painted by the same
 * rules that paint the map. A key that restates the colours in its own copy of
 * them is a key that goes quietly wrong the first time one is adjusted.
 */

/** Stands in for the per-node cluster colour the map supplies. */
const SAMPLE_CLUSTER = '#f2e4cc'

function Swatch({
  standing,
}: {
  standing: 'is-covered' | 'is-gap' | 'is-beyond' | 'is-untouched'
}) {
  return (
    <svg
      viewBox="-6 -6 46 32"
      className="map-svg has-intervention h-6 w-[46px] shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <g data-node-id="0" data-type="sample" className={standing}>
        <path
          d="M1.6 1.6h30.8v16.8H1.6z"
          style={{ ['--node-colour' as string]: SAMPLE_CLUSTER }}
        />
      </g>
    </svg>
  )
}

function Row({
  standing,
  children,
}: {
  standing: 'is-covered' | 'is-gap' | 'is-beyond' | 'is-untouched'
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-2">
      <Swatch standing={standing} />
      <span className="text-[11px] leading-snug text-gray-700">{children}</span>
    </li>
  )
}

export function InterventionKey({
  personaName,
  bottomInset = 0,
  rightInset = 0,
  onHeightChange,
}: {
  /** Null in the whitespace view, where only two states can occur. */
  personaName: string | null
  bottomInset?: number
  /** Px of the right edge covered by a panel, so this sits beside it. */
  rightInset?: number
  /**
   * Measured height, so the colour key can be stacked on top of this one rather
   * than guessing at an offset. It changes with the persona — two rows without
   * one, four with — so a constant would be wrong half the time.
   */
  onHeightChange?: (height: number) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  // `personaName` is in the deps, not just left to the observer: it is the one
  // thing that changes this box's height — two rows become four — and measuring
  // on the render that changes it means the stack is never briefly overlapping.
  // The observer stays for everything else, chiefly the text wrapping at a
  // narrower window or on a long persona name.
  useEffect(() => {
    const box = ref.current
    if (!box || !onHeightChange) return
    const report = () => onHeightChange(box.offsetHeight)
    report()
    const observer = new ResizeObserver(report)
    observer.observe(box)
    return () => observer.disconnect()
  }, [onHeightChange, personaName])

  return (
    <div
      ref={ref}
      // Right-hand side, stacked under the colour key. It sat bottom-left until
      // the two keys being in opposite corners meant reading the map involved
      // looking in both. The minimap is what kept it there, and is why the old
      // offset had to clear 145px of navigator that no longer applies.
      className="absolute z-30 w-56 rounded-lg border border-gray-200 bg-white/97 p-3 shadow-lg backdrop-blur"
      style={{ bottom: 16 + bottomInset, right: 16 + rightInset }}
    >
      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">
        What the boxes mean
      </p>

      {personaName === null ? (
        <ul className="space-y-1.5">
          <Row standing="is-beyond">
            An HPB programme reaches this
          </Row>
          <Row standing="is-untouched">
            Nothing reaches it — <strong className="font-semibold">whitespace</strong>
          </Row>
        </ul>
      ) : (
        <ul className="space-y-1.5">
          <Row standing="is-covered">
            Matters for {personaName}, and a programme reaches it
          </Row>
          <Row standing="is-gap">
            Matters for {personaName} —{' '}
            <strong className="font-semibold">nothing reaches it</strong>
            {(
              <span className="block text-gray-500">the gap — act here</span>
            )}
          </Row>
          <Row standing="is-beyond">
            A programme reaches it, but it is outside their map
            {(
              <span className="block text-gray-500">worth reviewing</span>
            )}
          </Row>
          <Row standing="is-untouched">
            Neither
          </Row>
        </ul>
      )}

      {/* The card is the most useful thing in this mode and, outside the
          walkthrough, nothing announced it. A legend is the right place to say
          so: it is already the surface a reader consults to work out what they
          are looking at, and one quiet line costs no new chrome. */}
      <p className="mt-2 border-t border-gray-100 pt-2 text-[10.5px] leading-snug text-gray-500">
        Click any variable to see which programmes reach it.
      </p>
    </div>
  )
}
