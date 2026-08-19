import { useEffect, useRef, useState } from 'react'

/** One thing the reader can walk away with. */
export interface ExportChoice {
  /** Heading it sits under. Consecutive choices sharing one are grouped. */
  group: string
  label: string
  /**
   * What actually lands in the downloads folder. The reason the menu is worth
   * opening: a row of buttons all called "Export something" cannot say this.
   */
  note: string
  /** Runs straight away. Omit when `chooser` is set. */
  onSelect?: () => void
  /** A second step, picking which of these to include. */
  chooser?: {
    items: readonly { id: string; name: string }[]
    onConfirm: (ids: string[]) => void
    /** Label on the confirm button, e.g. "Download". */
    confirmLabel?: string
  }
}

export interface ExportMenuProps {
  choices: readonly ExportChoice[]
  /**
   * `working` disables the button. Rasterising 108 boxes and 296 arrows takes
   * long enough to click twice, and two exports of one view is a confusing thing
   * to find in a downloads folder.
   */
  state: 'idle' | 'working' | 'failed'
  /** Small print under the menu, e.g. where the work is actually kept. */
  footnote?: string
}

/**
 * One Export button for what used to be several scattered controls.
 *
 * Intervention had three side by side on its bar; Profile had one on the bar and
 * two more buried in a "…" menu next to Edit persona, Import and Delete. Between
 * them that is six controls, none of which said what would arrive, several of
 * which had to be found before they could be chosen.
 *
 * They are not a list of choices, they are two questions: save the picture or
 * the data, and how much of it. The menu asks them in that order, so a reader
 * finds their row by what they want to end up with rather than by elimination.
 *
 * Shared by both bars rather than written twice, which is also what makes the
 * popover behave the same in both — Escape closes and returns focus, a click
 * outside dismisses, and closing resets to the first step so reopening never
 * lands halfway through last time's answer.
 */
export function ExportMenu({ choices, state, footnote }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  /** Index of the choice whose second step is showing, or null for the menu. */
  const [choosing, setChoosing] = useState<number | null>(null)
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
      setChoosing(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Stopped here so the app's own Escape does not also clear a selection
      // behind this menu — one press, one dismissal.
      event.stopPropagation()
      setOpen(false)
      setChoosing(null)
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
    setChoosing(null)
  }

  const working = state === 'working'
  const active = choosing === null ? null : choices[choosing]

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        data-testid="export-menu"
        disabled={working}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          'flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
          state === 'failed'
            ? 'border-rose-300 bg-rose-50 text-rose-700'
            : working
              ? 'cursor-wait border-gray-200 text-gray-500'
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
          {active?.chooser ? (
            <Chooser
              title={active.label}
              items={active.chooser.items}
              chosen={chosen}
              onChosenChange={setChosen}
              confirmLabel={active.chooser.confirmLabel ?? 'Download'}
              onBack={() => setChoosing(null)}
              onConfirm={() => {
                active.chooser?.onConfirm([...chosen])
                close()
              }}
            />
          ) : (
            <div role="menu" aria-label="Export">
              {choices.map((choice, index) => (
                <div key={choice.label}>
                  {choice.group !== choices[index - 1]?.group && (
                    <p className="px-2 pb-0.5 pt-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {choice.group}
                    </p>
                  )}
                  <Item
                    note={choice.note}
                    more={Boolean(choice.chooser)}
                    onClick={() => {
                      if (choice.chooser) {
                        // Everything ticked on arrival, so the common case is one
                        // press past the menu and narrowing is still possible.
                        setChosen(new Set(choice.chooser.items.map((i) => i.id)))
                        setChoosing(index)
                        return
                      }
                      choice.onSelect?.()
                      close()
                    }}
                  >
                    {choice.label}
                  </Item>
                </div>
              ))}
              {footnote && (
                <p className="border-t border-gray-100 px-2 pb-1 pt-1.5 text-xs leading-snug text-gray-500">
                  {footnote}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** The second step: which of these to include. */
function Chooser({
  title,
  items,
  chosen,
  onChosenChange,
  confirmLabel,
  onBack,
  onConfirm,
}: {
  title: string
  items: readonly { id: string; name: string }[]
  chosen: ReadonlySet<string>
  onChosenChange: (next: ReadonlySet<string>) => void
  confirmLabel: string
  onBack: () => void
  onConfirm: () => void
}) {
  const all = chosen.size === items.length
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
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
        {title}
      </button>

      <ul className="max-h-48 space-y-0.5 overflow-y-auto border-t border-gray-100 pt-1">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-gray-800 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={chosen.has(item.id)}
                onChange={() => {
                  const next = new Set(chosen)
                  if (next.has(item.id)) next.delete(item.id)
                  else next.add(item.id)
                  onChosenChange(next)
                }}
                className="accent-gray-900"
              />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-gray-100 px-1 pt-1.5">
        <button
          type="button"
          onClick={() =>
            onChosenChange(all ? new Set() : new Set(items.map((i) => i.id)))
          }
          className="text-xs text-gray-600 underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
        >
          {all ? 'Deselect all' : 'Select all'}
        </button>
        <button
          type="button"
          disabled={chosen.size === 0}
          onClick={onConfirm}
          className={[
            'rounded-md border px-2.5 py-1 text-xs transition-colors',
            chosen.size === 0
              ? 'cursor-not-allowed border-gray-200 text-gray-500'
              : 'border-gray-900 bg-gray-900 text-white hover:bg-gray-800',
          ].join(' ')}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

/** One export: what it is called, and what it leaves you with. */
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
        <span className="block text-sm text-gray-900">{children}</span>
        <span className="mt-0.5 block text-xs leading-snug text-gray-500">
          {note}
        </span>
      </span>
      {more && (
        <svg
          viewBox="0 0 10 10"
          className="h-2.5 w-2.5 shrink-0 text-gray-500"
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
