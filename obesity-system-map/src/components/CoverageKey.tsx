import { REACH_INK } from '../data/coverageStyle'
import type { CoverageVariant } from './CoverageBar'

/**
 * What the boxes mean, on the screen rather than in someone's head.
 *
 * The swatches are real node groups carrying the real classes inside a
 * `.map-svg.has-coverage.variant-x` wrapper, so they are painted by the same
 * rules that paint the map. A key that restates the colours in its own copy of
 * them is a key that goes quietly wrong the first time one is adjusted.
 */

/** Stands in for the per-node cluster colour the map supplies. */
const SAMPLE_CLUSTER = '#f2e4cc'

function Swatch({
  variant,
  standing,
}: {
  variant: CoverageVariant
  standing: 'is-covered' | 'is-gap' | 'is-beyond' | 'is-untouched'
}) {
  // The halo is an SVG layer on the map rather than a CSS rule, so it cannot be
  // inherited the way the fills are. Redrawn here from the same constants, which
  // is the closest this can get to being unable to drift.
  const reached = standing === 'is-covered' || standing === 'is-beyond'

  return (
    <svg
      viewBox="-6 -6 46 32"
      className={`map-svg has-coverage variant-${variant} h-6 w-[46px] shrink-0 overflow-visible`}
      aria-hidden="true"
    >
      <g data-node-id="0" data-type="sample" className={standing}>
        <path
          d="M1.6 1.6h30.8v16.8H1.6z"
          style={{ ['--node-colour' as string]: SAMPLE_CLUSTER }}
        />
      </g>
      {reached && (
        // Same construction as the map: a white disc, then a blue one, centred
        // on the boundary so half of it hangs outside the box.
        <g>
          {[
            { w: 9, colour: '#ffffff' },
            { w: 6, colour: REACH_INK },
          ].map((disc) => (
            <path
              key={disc.w}
              d={
                variant === 'a'
                  ? 'M32.4 1.6h0'
                  : variant === 'b'
                    ? 'M1.6 10h0'
                    : 'M17 1.6h0'
              }
              fill="none"
              stroke={disc.colour}
              strokeWidth={disc.w}
              strokeLinecap="round"
            />
          ))}
        </g>
      )}
    </svg>
  )
}

function Row({
  variant,
  standing,
  children,
}: {
  variant: CoverageVariant
  standing: 'is-covered' | 'is-gap' | 'is-beyond' | 'is-untouched'
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-2">
      <Swatch variant={variant} standing={standing} />
      <span className="text-[11px] leading-snug text-gray-700">{children}</span>
    </li>
  )
}

export function CoverageKey({
  variant,
  personaName,
  bottomInset = 0,
}: {
  variant: CoverageVariant
  /** Null in the whitespace view, where only two states can occur. */
  personaName: string | null
  bottomInset?: number
}) {
  return (
    <div
      className="absolute left-4 z-30 w-64 rounded-lg border border-gray-200 bg-white/97 p-3 shadow-lg backdrop-blur"
      style={{ bottom: 16 + bottomInset }}
    >
      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">
        What the boxes mean
      </p>

      {personaName === null ? (
        <ul className="space-y-1.5">
          <Row variant={variant} standing="is-beyond">
            An HPB programme reaches this
          </Row>
          <Row variant={variant} standing="is-untouched">
            Nothing reaches it — <strong className="font-semibold">whitespace</strong>
          </Row>
        </ul>
      ) : (
        <ul className="space-y-1.5">
          <Row variant={variant} standing="is-covered">
            Matters for {personaName}, and a programme reaches it
          </Row>
          <Row variant={variant} standing="is-gap">
            Matters for {personaName} —{' '}
            <strong className="font-semibold">nothing reaches it</strong>
          </Row>
          <Row variant={variant} standing="is-beyond">
            A programme reaches it, but it is outside their map
          </Row>
          <Row variant={variant} standing="is-untouched">
            Neither
          </Row>
        </ul>
      )}
    </div>
  )
}
