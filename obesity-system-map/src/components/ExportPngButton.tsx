/**
 * Saves the map as it currently stands.
 *
 * Shared by Profile's bar and Intervention's, because both of them export the
 * same thing — whatever the map is showing — and only the filename differs.
 * Duplicating the markup would have been thirty lines twice, including the
 * three-state label that is the only feedback the action gives.
 *
 * There is no separate "what should the image contain" control. The image is the
 * view, so the map's own state decides: marked-only in Profile, and the persona,
 * programme filter and gaps-only in Intervention.
 */

export interface ExportPngButtonProps {
  onExport: () => void
  /**
   * `working` also disables the button. Rasterising 108 boxes and 296 arrows
   * takes long enough to click twice, and two exports of one view is a confusing
   * thing to find in a downloads folder.
   */
  state: 'idle' | 'working' | 'failed'
}

export function ExportPngButton({ onExport, state }: ExportPngButtonProps) {
  return (
    <button
      type="button"
      data-testid="export-png"
      disabled={state === 'working'}
      onClick={onExport}
      title="Save the whole map as a PNG image"
      className={[
        'flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors',
        state === 'failed'
          ? 'border-rose-300 bg-rose-50 text-rose-700'
          : state === 'working'
            ? 'cursor-wait border-gray-200 text-gray-400'
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
      {state === 'working'
        ? 'Saving…'
        : state === 'failed'
          ? 'Export failed'
          : 'Export PNG'}
    </button>
  )
}
