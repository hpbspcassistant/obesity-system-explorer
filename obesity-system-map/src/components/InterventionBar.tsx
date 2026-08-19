import { useEffect, useRef, useState } from 'react'

import { ExportMenu, type ExportChoice } from './ExportMenu'
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
  summary: ReachSummary
  applicability: Applicability | null
  /** How many programmes the filter is down to, or null when it is off. */
  selectedProgrammes: number | null
  totalProgrammes: number
  onOpenProgrammes: () => void
  programmePanelOpen: boolean
  onExportPng: () => void
  onBulkExportPng: () => void
  exportState: 'idle' | 'working' | 'failed'
  onExportCoverage: (profileIds: string[]) => void
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <strong className="font-semibold tabular-nums text-gray-900">{n}</strong>{' '}
      {label}
    </span>
  )
}

/* --------------------------------------------------------- shared menu parts */

function Chevron() {
  return (
    <svg viewBox="0 0 10 6" className="h-2 w-2.5 text-gray-500" aria-hidden="true">
      <path
        d="M1 1l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function Menu({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      role="menu"
      aria-label={label}
      className="absolute bottom-full left-0 mb-1.5 max-h-[60vh] w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-[0_10px_32px_-8px_rgba(0,0,0,0.28)]"
    >
      {children}
    </div>
  )
}

function MenuItem({
  children,
  onClick,
  selected = false,
}: {
  children: React.ReactNode
  onClick: () => void
  selected?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50',
        selected ? 'font-medium text-gray-900' : 'text-gray-700',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={selected ? 'text-gray-900' : 'text-transparent'}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  )
}

function Divider() {
  return <div className="my-1 h-px bg-gray-100" />
}

/* -------------------------------------------------------- persona dropdown */

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

function PersonaDropdown({
  profiles,
  personaId,
  onPersonaChange,
}: {
  profiles: readonly Profile[]
  personaId: string | null
  onPersonaChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as globalThis.Node))
        setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const activeProfile = profiles.find((p) => p.id === personaId)

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-gray-100"
      >
        {activeProfile ? (
          <>
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-900"
            >
              {initialOf(activeProfile.name)}
            </span>
            <span className="max-w-[13rem] text-left">
              <span className="block truncate text-sm font-medium leading-tight text-gray-900">
                {activeProfile.name}
              </span>
              {activeProfile.details && (
                <span className="block max-w-[13rem] truncate text-xs leading-tight text-gray-500">
                  {activeProfile.details}
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="text-sm text-gray-800">
            Anyone — no persona
          </span>
        )}
        <Chevron />
      </button>

      {open && (
        <Menu label="Choose a persona">
          <MenuItem
            selected={personaId === null}
            onClick={() => { onPersonaChange(null); setOpen(false) }}
          >
            Anyone — no persona
          </MenuItem>
          {profiles.length > 0 && <Divider />}
          {profiles.map((p) => (
            <MenuItem
              key={p.id}
              selected={p.id === personaId}
              onClick={() => { onPersonaChange(p.id); setOpen(false) }}
            >
              {p.name}
            </MenuItem>
          ))}
          {profiles.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-gray-500">
              Add a persona in Profile mode
            </p>
          )}
        </Menu>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- main bar */

export function InterventionBar({
  profiles,
  personaId,
  onPersonaChange,
  summary,
  applicability,
  selectedProgrammes,
  totalProgrammes,
  onOpenProgrammes,
  programmePanelOpen,
  onExportPng,
  onBulkExportPng,
  exportState,
  onExportCoverage,
}: InterventionBarProps) {
  const withPersona = personaId !== null
  const filtering = selectedProgrammes !== null

  const exportChoices: ExportChoice[] = [
    {
      group: 'The picture',
      label: 'This view, as a PNG',
      note: 'The map exactly as it looks now',
      onSelect: onExportPng,
    },
    ...(profiles.length > 0
      ? [
          {
            group: 'The picture',
            label: 'Every persona, as PNGs',
            note: `One image each, plus the Anyone view — ${profiles.length + 1} files`,
            onSelect: onBulkExportPng,
          },
        ]
      : []),
    {
      group: 'The numbers',
      label: 'Coverage data, as JSON',
      note: 'Which variables are covered, and which are not',
      // With no personas saved there is nothing to choose between, so it
      // downloads the whole inventory straight away.
      ...(profiles.length > 0
        ? {
            chooser: {
              items: profiles.map((p) => ({ id: p.id, name: p.name })),
              onConfirm: onExportCoverage,
            },
          }
        : { onSelect: () => onExportCoverage([]) }),
    },
  ]

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex h-12 items-center gap-3 border-t border-gray-200 bg-white/97 px-3">
      <PersonaDropdown
        profiles={profiles}
        personaId={personaId}
        onPersonaChange={onPersonaChange}
      />

      <span className="min-w-0 flex-1" />

      {/* Two numbers, not four. Covered and opportunity areas are the two a
          reader acts on; "beyond" and "untouched" describe the rest of the map
          and were sitting at the same weight, in words that mean nothing until
          somebody explains them. They are still on the map, in the key beside
          it, and in the card on a click — the bar just stops reciting them. */}
      <p className="flex shrink-0 items-center gap-2 text-xs text-gray-600">
        {withPersona ? (
          <>
            <Count n={summary.covered.length} label="covered" />
            <span className="text-gray-300">·</span>
            <Count
              n={summary.gaps.length}
              label={
                summary.gaps.length === 1
                  ? 'opportunity area'
                  : 'opportunity areas'
              }
            />
          </>
        ) : (
          <>
            <Count n={summary.beyond.length} label="reached" />
            <span className="text-gray-300">·</span>
            <Count n={summary.untouched.length} label="not reached" />
          </>
        )}
      </p>


      {applicability && (
        <p
          className="shrink-0 text-xs text-gray-500"
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
        onClick={onOpenProgrammes}
        aria-expanded={programmePanelOpen}
        title="Choose which programmes to count"
        className={[
          'shrink-0 rounded-md border px-2.5 py-1 text-xs transition-colors',
          filtering
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        {filtering
          ? `${selectedProgrammes} of ${totalProgrammes} programmes`
          : 'All programmes'}
      </button>


      <ExportMenu state={exportState} choices={exportChoices} />
    </div>
  )
}
