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
  /** Variables the chosen programmes reach, shown only while the filter is on. */
  selectionReach: number
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
  selectionReach,
  onOpenProgrammes,
  programmePanelOpen,
}: InterventionBarProps) {
  const withPersona = personaId !== null
  const filtering = selectedProgrammes !== null

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex h-12 items-center gap-3 border-t border-gray-200 bg-white/97 px-3 backdrop-blur">
      <select
        value={personaId ?? ''}
        onChange={(e) => onPersonaChange(e.target.value || null)}
        className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-[12px] text-gray-800"
      >
        <option value="">Whitespace — no persona</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        {profiles.length === 0 && (
          <option value="" disabled>
            No profiles yet — make one in Profile
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

      {/* While filtering, the four counts still describe the whole persona — the
          filter fades boxes rather than recolouring them — so the selection gets
          its own figure instead of quietly changing theirs. */}
      <button
        type="button"
        onClick={onOpenProgrammes}
        aria-expanded={programmePanelOpen}
        title="Choose which programmes the map answers for"
        className={[
          'shrink-0 rounded-md border px-2.5 py-1 text-[12px] transition-colors',
          filtering
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        {filtering
          ? `${selectedProgrammes} programme${selectedProgrammes === 1 ? '' : 's'} · reaches ${selectionReach}`
          : 'All programmes'}
      </button>

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
