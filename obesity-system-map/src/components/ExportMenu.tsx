import { useEffect, useRef, useState } from 'react'

import type { Profile } from '../lib/profile'

export interface ExportMenuProps {
  profiles: readonly Profile[]
  /** The map as it currently stands, one image. */
  onExportPng: () => void
  /** One image per persona, plus the Anyone view. */
  onBulkExportPng: () => void
  /** Coverage report as JSON, for the profiles named. */
  onExportCoverage: (profileIds: string[]) => void
  /**
   * `working` disables everything. Rasterising 108 boxes and 296 arrows takes
   * long enough to click twice, and two exports of one view is a confusing thing
   * to find in a downloads folder.
   */
  state: 'idle' | 'working' | 'failed'
}

/**
 * One Export button for what used to be three side by side.
 *
 * "Export PNG", "Export all PNGs" and "Export coverage" sat in a row on the bar,
 * which put the rarest actions in the tool at the same volume as the persona
 * picker beside them, and asked the reader to tell three similarly-named things
 * apart before knowing what any of them did.
 *
 * They are two questions, not three choices: what to save — the picture or the
 * numbers — and how much of it. The menu asks them in that order, so the row a
 * reader wants is found by what they are trying to end up with rather than by
 * elimination.
 *
 * Coverage keeps its per-persona selection, on a second step rather than in a
 * popover of its own. Everything is ticked when it opens, so the common case is
 * still one press past the menu, and narrowing it stays possible instead of
 * being quietly dropped in the name of tidiness.
 */
export function ExportMenu({
  profiles,
  onExportPng,
  onBulkExportPng,
  onExportCoverage,
  state,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  // Which step is showing. Reset on close, so reopening always starts at the
  // question rather than halfway through last time's answer.
  const [step, setStep] = useState<'menu' | 'coverage'>('menu')
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(profiles.map((p) => p.id)),
  )
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // A profile added or deleted while this is shut must not leave a stale
  // selection behind; ticking everything is also the right default.
  useEffect(() => {
    setChosen(new Set(profiles.map((p) => p.id)))
  }, [profiles])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Stopped here so the app's own Escape does not also clear a selection
      // behind this menu — one press, one dismissal.
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    setStep('menu')
  }

  const working = state === 'working'
  const hasProfiles = profiles.length > 0

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        data-testid="export-menu"
        disabled={working}
        onClick={() => {
          if (open) close()
          else setOpen(true)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          'flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
          state === 'failed'
            ? 'border-rose-300 bg-rose-50 text-rose-700'
            : working
              ? 'cursor-wait border-gray-200 text-gray-400'
              : open
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M8 2v7.5M5 7l3 3 3-3M2.5 12.5h11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Failure is stated on the button rather than thrown away silently: the
            only other sign is a download that never arrives. It clears itself. */}
        {working ? 'Saving…' : state === 'failed' ? 'Export failed' : 'Export'}
      </button>

      {open && (
        <div
          ref={popoverRef}
          // Right-anchored: this sits at the end of the bar, so a menu growing
          // rightward would run off the window.
          className="absolute bottom-full right-0 mb-1.5 w-64 rounded-lg border border-gray-200 bg-white p-1 shadow-[0_10px_32px_-8px_rgba(0,0,0,0.28)]"
        >
          {step === 'menu' ? (
            <div role="menu" aria-label="Export">
              <Group>The picture</Group>
              <Item
                onClick={() => {
                  onExportPng()
                  close()
                }}
                note="The map exactly as it looks now"
              >
                This view, as a PNG
              </Item>
              {hasProfiles && (
                <Item
                  onClick={() => {
                    onBulkExportPng()
                    close()
                  }}
                  note={`One image each, plus the Anyone view — ${profiles.length + 1} files`}
                >
                  Every persona, as PNGs
                </Item>
              )}

              <Group>The numbers</Group>
              <Item
                onClick={() => {
                  if (!hasProfiles) {
                    onExportCoverage([])
                    close()
                    return
                  }
                  setStep('coverage')
                }}
                note="Which variables are covered, and which are not"
                more={hasProfiles}
              >
                Coverage data, as JSON
              </Item>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setStep('menu')}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
                  <path
                    d="M6.5 1 2.5 5l4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Coverage data
              </button>

              <ul className="max-h-48 space-y-0.5 overflow-y-auto border-t border-gray-100 pt-1">
                {profiles.map((profile) => (
                  <li key={profile.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-gray-800 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={chosen.has(profile.id)}
                        onChange={() =>
                          setChosen((prev) => {
                            const next = new Set(prev)
                            if (next.has(profile.id)) next.delete(profile.id)
                            else next.add(profile.id)
                            return next
                          })
                        }
                        className="accent-gray-900"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {profile.name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="mt-1 flex items-center justify-between gap-2 border-t border-gray-100 px-1 pt-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setChosen(
                      chosen.size === profiles.length
                        ? new Set()
                        : new Set(profiles.map((p) => p.id)),
                    )
                  }
                  className="text-xs text-gray-600 underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
                >
                  {chosen.size === profiles.length ? 'Deselect all' : 'Select all'}
                </button>
                <button
                  type="button"
                  disabled={chosen.size === 0}
                  onClick={() => {
                    onExportCoverage([...chosen])
                    close()
                  }}
                  className={[
                    'rounded-md border px-2.5 py-1 text-xs transition-colors',
                    chosen.size === 0
                      ? 'cursor-not-allowed border-gray-200 text-gray-400'
                      : 'border-gray-900 bg-gray-900 text-white hover:bg-gray-800',
                  ].join(' ')}
                >
                  Download
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** A heading over a run of items, naming what they have in common. */
function Group({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </p>
  )
}

/**
 * One export. The note under the label is what makes the menu worth opening —
 * three buttons called "Export something" told the reader nothing about what
 * would land in their downloads folder.
 */
function Item({
  children,
  note,
  onClick,
  more = false,
}: {
  children: React.ReactNode
  note: string
  onClick: () => void
  /** Whether choosing this leads to a second step rather than a download. */
  more?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-gray-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-gray-900">{children}</span>
        <span className="mt-0.5 block text-xs leading-snug text-gray-500">
          {note}
        </span>
      </span>
      {more && (
        <svg
          viewBox="0 0 10 10"
          className="h-2.5 w-2.5 shrink-0 text-gray-400"
          aria-hidden="true"
        >
          <path
            d="M3.5 1 7.5 5l-4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )
}
