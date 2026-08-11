import type { Applicability, ReachSummary } from '../lib/reach'
import type { Profile } from '../lib/profile'

/**
 * Intervention's chrome: which persona, and what it adds up to.
 *
 * Totals only. Which programmes reach a given variable is the card's job, and
 * naming them twice would leave two places to disagree.
 */

export interface InterventionBarProps {
  /** The user's own profiles: this mode keeps no persona list of its own. */
  profiles: readonly Profile[]
  /** null means the persona-independent whitespace view. */
  personaId: string | null
  onPersonaChange: (id: string | null) => void
  gapsOnly: boolean
  onGapsOnlyChange: (on: boolean) => void
  summary: ReachSummary
  applicability: Applicability | null
  /** How many programmes the filter is down to, or null when it is off. */
  selectedProgrammes: number | null
  totalProgrammes: number
  onOpenProgrammes: () => void
  programmePanelOpen: boolean
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <strong className="font-semibold tabular-nums text-gray-900">{n}</strong>{' '}
      {label}
    </span>
  )
}

export function InterventionBar({
  profiles,
  personaId,
  onPersonaChange,
  gapsOnly,
  onGapsOnlyChange,
  summary,
  applicability,
  selectedProgrammes,
  totalProgrammes,
  onOpenProgrammes,
  programmePanelOpen,
}: InterventionBarProps) {
  const withPersona = personaId !== null
  const filtering = selectedProgrammes !== null

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex h-12 items-center gap-3 border-t border-gray-200 bg-white/97 px-3">
      <select
        value={personaId ?? ''}
        onChange={(e) => onPersonaChange(e.target.value || null)}
        className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-[12px] text-gray-800"
      >
        {/* Named for what it shows, not for the persona it lacks. This is where
            the mode starts and it works on its own: what the inventory reaches,
            and what a chosen programme reaches. "Whitespace — no persona" read
            as a prerequisite nobody had met, and sat next to a greyed-out line
            apologising for it. */}
        <option value="">Anyone — no persona</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            For {p.name}
          </option>
        ))}
        {profiles.length === 0 && (
          <option value="" disabled>
            Add a persona in Profile to see what they are missing
          </option>
        )}
      </select>

      <span className="min-w-0 flex-1" />

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
            {/* "not reached" rather than "whitespace": the term is defined in
                the key, and a bare number beside a word only the key explains is
                the worst place to introduce it. */}
            <Count n={summary.beyond.length} label="reached" />
            <span className="text-gray-300">·</span>
            <Count n={summary.untouched.length} label="not reached" />
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

      {/* Filled in when a filter is on, because every other number in this bar
          then describes a smaller inventory than the reader may assume. The
          counts above already move with it — a variable only an unticked
          programme covered turns from covered to gap — so the state has to be
          visible rather than inferable. */}
      <button
        type="button"
        onClick={onOpenProgrammes}
        aria-expanded={programmePanelOpen}
        title="Choose which programmes to count"
        className={[
          'shrink-0 rounded-md border px-2.5 py-1 text-[12px] transition-colors',
          filtering
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        {filtering
          ? `${selectedProgrammes} of ${totalProgrammes} programmes`
          : 'All programmes'}
      </button>

      {/* Absent without a persona rather than present and disabled. A gap is
          "matters to this person and nothing reaches it", so with nobody chosen
          there is no such thing — and a greyed control advertising a state that
          cannot occur reads as something withheld. It appears when a persona
          does, which is also what tells you the persona brought it. */}
      {withPersona && (
        <button
          type="button"
          role="switch"
          aria-checked={gapsOnly}
          disabled={summary.gaps.length === 0}
          onClick={() => onGapsOnlyChange(!gapsOnly)}
          title={
            summary.gaps.length === 0
              ? 'No gaps for this persona'
              : 'Fade everything that is not a gap'
          }
          className={[
            'shrink-0 rounded-md border px-2.5 py-1 text-[12px] transition-colors',
            summary.gaps.length === 0
              ? 'cursor-not-allowed border-gray-200 text-gray-300'
              : gapsOnly
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50',
          ].join(' ')}
        >
          Gaps only
        </button>
      )}
    </div>
  )
}
