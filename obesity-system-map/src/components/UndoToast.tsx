export interface UndoAction {
  /** What just happened, in the past tense: "Marked Physical Activity". */
  text: string
  undo: () => void
}

/**
 * What just happened to the profile, and one press to take it back.
 *
 * Marking is a toggle, so nothing here is unrecoverable — clicking the same box
 * again already reverses it. The problem it solves is a different one: a mark
 * lands on a map of 108 boxes, and a mis-click puts a quiet change somewhere you
 * were not looking. This says which variable moved, which is the part you cannot
 * get back by guessing.
 *
 * Above the bar and centred, so it clears the key on the left and the menus that
 * open upward on the right. It fades itself after a few seconds because it is a
 * receipt, not a decision: ignoring it has to be the same as accepting it.
 */
export function UndoToast({
  action,
  onUndo,
  onDismiss,
  bottomInset,
}: {
  action: UndoAction
  onUndo: () => void
  onDismiss: () => void
  /** Px covered by the bar underneath, so it sits above rather than on it. */
  bottomInset: number
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-gray-800 bg-gray-900 py-1.5 pl-4 pr-1.5 shadow-lg"
      style={{ bottom: bottomInset + 12 }}
    >
      <span className="pointer-events-auto max-w-[22rem] truncate text-sm text-white">
        {action.text}
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="pointer-events-auto rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white hover:bg-white/25"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-gray-300 hover:bg-white/10 hover:text-white"
      >
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
          <path
            d="M3 3l6 6M9 3l-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}
