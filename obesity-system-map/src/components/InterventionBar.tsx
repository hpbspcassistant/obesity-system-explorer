import { useEffect, useRef, useState } from 'react'

import { ExportMenu, type ExportChoice } from './ExportMenu'
import type {
  Applicability,
  PersonaCharacteristics,
  ReachSummary,
} from '../lib/reach'
import type { Profile } from '../lib/profile'
import {
  CONDITIONS_KEY,
  conditionValues,
  coreCharacteristics,
} from '../data/intervention'

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
  onExportPng: () => void
  onBulkExportPng: () => void
  exportState: 'idle' | 'working' | 'failed'
  onExportCoverage: (profileIds: string[]) => void
  quickCharacteristics: PersonaCharacteristics
  onQuickCharacteristicsChange: (next: PersonaCharacteristics) => void
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <strong className="font-semibold tabular-nums text-gray-900">{n}</strong>{' '}
      {label}
    </span>
  )
}

/* ------------------------------------------------------------ standings */

/**
 * The two standings the bar no longer shows, and what all four actually mean.
 *
 * Every one of them was a bare word beside a number — "beyond", "untouched" —
 * which reads as jargon to everyone who did not build the mode. Demoting them
 * without explaining them would only have hidden the problem, so this is where
 * the sentences live.
 */
function StandingDetails({
  summary,
  personaName,
}: {
  summary: ReachSummary
  personaName: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as globalThis.Node))
        setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const rows = [
    {
      label: 'Covered',
      n: summary.covered.length,
      note: `Applies to ${personaName}, and a programme reaches it`,
    },
    {
      label: 'Opportunity area',
      n: summary.gaps.length,
      note: `Applies to ${personaName}, and nothing reaching them addresses it`,
    },
    {
      label: 'Reached, outside their map',
      n: summary.beyond.length,
      note: 'A programme reaches it, but it is not part of this persona',
    },
    {
      label: 'Not in their map',
      n: summary.untouched.length,
      note: 'Nothing marked here, so the mode makes no claim either way',
    },
  ]

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((c) => !c)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          'rounded-md border px-2.5 py-1 text-xs transition-colors',
          open
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        Details
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="What each state means"
          className="absolute bottom-full right-0 mb-1.5 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-[0_10px_32px_-8px_rgba(0,0,0,0.28)]"
        >
          <ul className="space-y-1.5">
            {rows.map((row) => (
              <li key={row.label} className="px-1">
                <p className="flex items-baseline justify-between gap-2 text-sm text-gray-900">
                  <span>{row.label}</span>
                  <strong className="shrink-0 font-semibold tabular-nums">
                    {row.n}
                  </strong>
                </p>
                <p className="text-xs leading-snug text-gray-500">{row.note}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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

/* ---------------------------------------------------- characteristic picker */

function humanise(value: string | boolean): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const words = value.replace(/[-_]/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function encode(value: string | boolean): string {
  return typeof value === 'boolean' ? `bool:${value}` : `str:${value}`
}

function decode(raw: string): string | boolean | null | undefined {
  if (raw === '') return undefined
  if (raw === 'n/a') return null
  return raw.startsWith('bool:') ? raw === 'bool:true' : raw.slice(4)
}

function QuickCharacteristicPicker({
  value,
  onChange,
}: {
  value: PersonaCharacteristics
  onChange: (next: PersonaCharacteristics) => void
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

  const set = (key: string, next: string | boolean | null | undefined) => {
    const characteristics = { ...value }
    if (next === undefined) delete characteristics[key]
    else characteristics[key] = next
    onChange(characteristics)
  }

  const conditions = Array.isArray(value[CONDITIONS_KEY])
    ? (value[CONDITIONS_KEY] as readonly string[])
    : []

  const toggleCondition = (condition: string) => {
    const next = conditions.includes(condition)
      ? conditions.filter((c) => c !== condition)
      : [...conditions, condition]
    onChange({ ...value, [CONDITIONS_KEY]: next })
  }

  const filledCount = Object.keys(value).filter(
    (k) => k !== CONDITIONS_KEY || (Array.isArray(value[k]) && (value[k] as readonly string[]).length > 0),
  ).length
  const hasAny = filledCount > 0

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        className={[
          'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
          hasAny
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        {hasAny ? `Filter: ${filledCount} set` : 'Filter by characteristics'}
        <Chevron />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1.5 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-[0_10px_32px_-8px_rgba(0,0,0,0.28)]">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-xs font-medium text-gray-600">
              Quick filter
            </p>
            {hasAny && (
              <button
                type="button"
                onClick={() => onChange({})}
                className="text-xs text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-gray-700"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            {Object.entries(coreCharacteristics).map(([key, values]) => {
              const held = value[key]
              const current =
                held === undefined
                  ? ''
                  : held === null
                    ? 'n/a'
                    : encode(held as string | boolean)
              return (
                <label key={key} className="block">
                  <span className="mb-0.5 block text-xs text-gray-500">
                    {humanise(key)}
                  </span>
                  <select
                    value={current}
                    onChange={(event) => set(key, decode(event.target.value))}
                    className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-800 focus:border-gray-800 focus:outline-none"
                  >
                    <option value="">Any</option>
                    {values
                      .filter((v): v is string | boolean => v !== null)
                      .map((v) => (
                        <option key={String(v)} value={encode(v)}>
                          {humanise(v)}
                        </option>
                      ))}
                  </select>
                </label>
              )
            })}
          </div>

          <p className="mb-1 mt-2.5 text-xs text-gray-500">Conditions</p>
          <div className="flex flex-wrap gap-1">
            {conditionValues.map((condition) => {
              const on = conditions.includes(condition)
              return (
                <button
                  key={condition}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggleCondition(condition)}
                  className={[
                    'rounded-full border px-2 py-0.5 text-xs transition-colors',
                    on
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {humanise(condition)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- main bar */

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
  onExportPng,
  onBulkExportPng,
  exportState,
  onExportCoverage,
  quickCharacteristics,
  onQuickCharacteristicsChange,
}: InterventionBarProps) {
  const withPersona = personaId !== null
  const activePersonaName =
    profiles.find((p) => p.id === personaId)?.name ?? 'this persona'
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

      {!withPersona && (
        <QuickCharacteristicPicker
          value={quickCharacteristics}
          onChange={onQuickCharacteristicsChange}
        />
      )}

      <span className="min-w-0 flex-1" />

      {/* Two numbers, not four. Covered and opportunity areas are the two a
          reader acts on; "beyond" and "untouched" describe the rest of the map
          and were sitting at the same weight, in words that mean nothing until
          somebody explains them. Details does the explaining, which is the part
          that was missing rather than the numbers themselves. */}
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

      {/* Only with a persona: without one the map has two states and both are
          already named in full beside this. */}
      {withPersona && (
        <StandingDetails summary={summary} personaName={activePersonaName} />
      )}

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

      {withPersona && (
        <button
          type="button"
          role="switch"
          aria-checked={gapsOnly}
          disabled={summary.gaps.length === 0}
          onClick={() => onGapsOnlyChange(!gapsOnly)}
          title={
            summary.gaps.length === 0
              ? 'No opportunity areas for this persona'
              : 'Fade everything except opportunity areas'
          }
          className={[
            'shrink-0 rounded-md border px-2.5 py-1 text-xs transition-colors',
            summary.gaps.length === 0
              ? 'cursor-not-allowed border-gray-200 text-gray-300'
              : gapsOnly
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50',
          ].join(' ')}
        >
          Opportunities only
        </button>
      )}

      <ExportMenu state={exportState} choices={exportChoices} />
    </div>
  )
}
