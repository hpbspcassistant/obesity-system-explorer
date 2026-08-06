import type { Applicability, CoveragePersona, ReachSummary } from '../lib/reach'

/**
 * PROTOTYPE chrome for Coverage mode.
 *
 * Deliberately not the panel we discussed — no programme list, no behaviour
 * list, no click-through. Just enough to switch persona and encoding, because
 * the only question it exists to answer is which of the three encodings reads
 * best on the real map at real density. The panel comes after that is settled.
 */

export type CoverageVariant = 'a' | 'b' | 'c'

/**
 * All three now share one encoding — fill is the persona's map — and differ only
 * in how programme reach is marked. The structure is settled; this is the mark.
 */
const VARIANTS: { id: CoverageVariant; label: string; hint: string }[] = [
  { id: 'a', label: 'Corner', hint: 'Reach = a dot straddling the top-right corner' },
  { id: 'b', label: 'Left', hint: 'Reach = a dot on the left edge, halfway down' },
  { id: 'c', label: 'Above', hint: 'Reach = a dot centred on the top edge' },
]

export interface CoverageBarProps {
  personas: readonly CoveragePersona[]
  /** null means the persona-independent whitespace view. */
  personaId: string | null
  onPersonaChange: (id: string | null) => void
  variant: CoverageVariant
  onVariantChange: (variant: CoverageVariant) => void
  gapsOnly: boolean
  onGapsOnlyChange: (on: boolean) => void
  summary: ReachSummary
  applicability: Applicability | null
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <strong className="font-semibold tabular-nums text-gray-900">{n}</strong>{' '}
      {label}
    </span>
  )
}

export function CoverageBar({
  personas,
  personaId,
  onPersonaChange,
  variant,
  onVariantChange,
  gapsOnly,
  onGapsOnlyChange,
  summary,
  applicability,
}: CoverageBarProps) {
  const withPersona = personaId !== null

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex h-12 items-center gap-3 border-t border-gray-200 bg-white/97 px-3 backdrop-blur">
      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
        Prototype
      </span>

      <select
        value={personaId ?? ''}
        onChange={(e) => onPersonaChange(e.target.value || null)}
        className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-[12px] text-gray-800"
      >
        <option value="">Whitespace — no persona</option>
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div
        role="radiogroup"
        aria-label="Encoding"
        className="inline-flex shrink-0 rounded-full bg-gray-100 p-0.5"
      >
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={v.id === variant}
            data-variant={v.id}
            title={v.hint}
            onClick={() => onVariantChange(v.id)}
            className={[
              'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
              v.id === variant
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800',
            ].join(' ')}
          >
            {v.label}
          </button>
        ))}
      </div>

      <p className="min-w-0 flex-1 truncate text-[11.5px] text-gray-500">
        {VARIANTS.find((v) => v.id === variant)?.hint}
      </p>

      <p className="flex shrink-0 items-center gap-2 text-[12px] text-gray-600">
        {withPersona ? (
          <>
            <Count n={summary.covered.length} label="covered" />
            <span className="text-gray-300">·</span>
            <Count n={summary.gaps.length} label="gaps" />
            <span className="text-gray-300">·</span>
            <Count n={summary.beyond.length} label="beyond" />
            <span className="text-gray-300">·</span>
            <Count n={summary.untouched.length} label="untouched" />
          </>
        ) : (
          <>
            <Count n={summary.beyond.length} label="reached" />
            <span className="text-gray-300">·</span>
            <Count n={summary.untouched.length} label="whitespace" />
          </>
        )}
      </p>

      {applicability && (
        <p
          className="shrink-0 text-[11.5px] text-gray-500"
          title={applicability.applies.map((p) => p.name).join('\n')}
        >
          {applicability.applies.length} of{' '}
          {applicability.applies.length +
            applicability.excluded.length +
            applicability.undetermined.length}{' '}
          programmes
          {applicability.undetermined.length > 0 && (
            <span className="ml-1 text-amber-700">
              · {applicability.undetermined.length} undetermined
            </span>
          )}
        </p>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={gapsOnly}
        disabled={!withPersona || summary.gaps.length === 0}
        onClick={() => onGapsOnlyChange(!gapsOnly)}
        title={
          !withPersona
            ? 'Choose a persona first'
            : summary.gaps.length === 0
              ? 'No gaps for this persona'
              : 'Fade everything that is not a gap'
        }
        className={[
          'shrink-0 rounded-md border px-2.5 py-1 text-[12px] transition-colors',
          !withPersona || summary.gaps.length === 0
            ? 'cursor-not-allowed border-gray-200 text-gray-300'
            : gapsOnly
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        Gaps only
      </button>
    </div>
  )
}
