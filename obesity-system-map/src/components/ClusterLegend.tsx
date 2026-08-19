import { useEffect, useId, useRef } from 'react'

import { contrastSwatch } from '../data/contrast'
import { atlasClusters, variableTypes } from '../data/systemMap'
import type { Taxonomy } from '../types'

interface ClusterLegendProps {
  taxonomy: Taxonomy
  onTaxonomyChange: (taxonomy: Taxonomy) => void
  hiddenGroups: ReadonlySet<string>
  onToggleGroup: (name: string) => void
  onShowAll: () => void
  onHideAll: () => void
  /** Shrunk to a pill. A user preference, so it survives mode switches. */
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  /**
   * Whether the filter popover is open. Held by the caller so the walkthrough
   * can open it before demonstrating a filter the reader cannot otherwise see.
   */
  filterOpen: boolean
  onFilterOpenChange: (open: boolean) => void
  /** Px covered by a side panel, so the legend sits beside it, not under it. */
  rightInset?: number
  /** Px covered by a bottom bar, for the same reason. */
  bottomInset?: number
  /** Legend swatches follow the map's palette; see src/data/contrast.ts. */
  highContrast: boolean
  /**
   * False where the map is not painting variables by their group.
   *
   * Intervention paints every box by whether a programme reaches it, so a type
   * swatch there promises a colour that appears nowhere — and it does it beside
   * a second key that is telling the truth about the same boxes. The filter is
   * still worth having, so the swatches go and the box stays.
   */
  showSwatches?: boolean
}

/** Solid line ending in an arrowhead, as printed on the original legend. */
function PositiveIcon() {
  return (
    <svg viewBox="0 0 44 10" className="h-2.5 w-11 shrink-0" aria-hidden="true">
      <path d="M0 5h34" stroke="#231f20" strokeWidth="1" fill="none" />
      <path d="M33 1.6 42 5l-9 3.4z" fill="#231f20" />
    </svg>
  )
}

/** Dashed line ending in a filled square, as printed on the original legend. */
function NegativeIcon() {
  return (
    <svg viewBox="0 0 44 10" className="h-2.5 w-11 shrink-0" aria-hidden="true">
      <path
        d="M0 5h35"
        stroke="#231f20"
        strokeWidth="1"
        strokeDasharray="2.2 1.8"
        fill="none"
      />
      <rect x="36" y="1.8" width="6.4" height="6.4" fill="#231f20" />
    </svg>
  )
}

const TABS: { id: Taxonomy; label: string; hint: string }[] = [
  {
    id: 'type',
    label: 'Type',
    hint: "The map's colour groupings — what the printed legend shows",
  },
  {
    id: 'cluster',
    label: 'Cluster',
    hint: "The Foresight atlas's own classification",
  },
]

/**
 * The corner box: a colour key, and a way to reach the group filter.
 *
 * These used to be one thing, and the box carried fifteen controls in every
 * mode — over half of everything on screen in Explore. They are not one thing.
 * A key is reference: you read it, you never touch it, and a first-time reader
 * needs it most. A filter is a tool: it changes the map, it is stateful, and
 * most sessions never touch it. Fusing them meant you could not have the key
 * without twelve buttons, and could not put the buttons away without losing the
 * key, since collapsing the box hid both.
 *
 * So the key is now inert rows and the filter is one button that opens a
 * popover: two controls in the corner rather than fifteen, with nothing removed.
 *
 * The filter's own state is what forced the old arrangement. The box had to
 * render in every mode because hiding it "left the filter switched on with no
 * way to switch it off". A chip beside the button now reports anything hidden
 * and clears it in one press, so a filter can no longer be silently on.
 *
 * Taxonomy moved into the popover with the rest of the filter. It only ever
 * decided what the filter groups by — the map paints by type whichever is
 * chosen, which is why the atlas clusters have never had a swatch — so the key
 * has no business changing shape when it is switched.
 */
export function ClusterLegend({
  taxonomy,
  onTaxonomyChange,
  hiddenGroups,
  onToggleGroup,
  onShowAll,
  onHideAll,
  collapsed,
  onCollapsedChange,
  filterOpen,
  onFilterOpenChange,
  rightInset = 0,
  bottomInset = 0,
  highContrast,
  showSwatches = true,
}: ClusterLegendProps) {
  // The key always describes the artwork's own ten colours, because that is what
  // the map paints regardless of what the filter is grouping by.
  const keyEntries = variableTypes.map((t) => ({
    name: t.name,
    nodeCount: t.nodeCount,
    // A legend showing the artwork's pastel while the map shows the retint
    // would be worse than either on its own.
    swatch: (highContrast
      ? (contrastSwatch(t.name) ?? t.swatch)
      : t.swatch) as string,
  }))

  const groups =
    taxonomy === 'type'
      ? variableTypes.map((t) => ({ name: t.name, nodeCount: t.nodeCount }))
      : atlasClusters.map((c) => ({ name: c.name, nodeCount: c.nodeCount }))

  const hiddenCount = hiddenGroups.size
  const filtering = hiddenCount > 0

  // Sits below the review sheet and the profile bar on purpose (z-10): those are
  // deliberate full-attention surfaces, and a key that paints over them would be
  // worse than one briefly covered. Panels are cleared by the insets instead.
  //
  // The offsets snap rather than ease. Transitioning `right` animates layout, and
  // a half-finished slide leaves the box overlapping the very panel the offset
  // exists to clear — a position that is merely correct beats one that is
  // usually correct and prettier on the way.
  const shell = 'absolute z-10 flex flex-col'
  const position = { right: 16 + rightInset, bottom: 16 + bottomInset }
  /**
   * Never taller than the stage leaves room for. Percentages on an absolutely
   * positioned box resolve against its containing block, so this is the stage's
   * height less the offset it already sits at and a matching gap on top.
   */
  const maxHeight = `calc(100% - ${32 + bottomInset}px)`

  if (collapsed) {
    return (
      <div className={shell} style={position}>
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          aria-expanded={false}
          title="Show the key"
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 py-2 text-xs font-medium text-gray-700 shadow-lg hover:bg-gray-50"
        >
          {/* A few swatches, so the pill says "colour key" without the words —
              but only where those colours are on the map. In Intervention they
              are not, which is the whole point of `showSwatches`. */}
          {showSwatches && (
            <span aria-hidden="true" className="flex shrink-0 gap-0.5">
              {keyEntries.slice(0, 3).map((entry) => (
                <span
                  key={entry.name}
                  className="h-3 w-3 rounded-[2px] border border-gray-300"
                  style={{ backgroundColor: entry.swatch }}
                />
              ))}
            </span>
          )}
          Key
          {/* Only when something is hidden: otherwise the badge would imply a
              filter is active when nothing is filtered. */}
          {filtering && (
            <span className="rounded-full bg-gray-900 px-1.5 text-[11px] tabular-nums text-white">
              {hiddenCount} hidden
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className={shell} style={{ ...position, maxHeight }}>
      <div className="flex min-h-0 w-56 flex-col rounded-lg border border-gray-200 bg-white/95 p-3 shadow-lg">
        {/* Always rendered, swatches or not: without it Intervention had a box
            it could not put away. The heading follows what is actually below. */}
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {showSwatches ? 'Colour key' : 'Key'}
          </h2>
          <button
            type="button"
            onClick={() => onCollapsedChange(true)}
            aria-expanded
            aria-label="Hide the key"
            title="Hide the key"
            className="-mr-1 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
              <path
                d="M1 3.5 5 7.5l4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {showSwatches && (
          <>
            {/* Inert. The one part of this box that gives way when space is
                short — the influence key and the filter button stay put. */}
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {keyEntries.map((entry) => (
                <li
                  key={entry.name}
                  className="flex items-center gap-2 px-2 py-1 text-xs text-gray-800"
                >
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-6 shrink-0 rounded-[3px] border"
                    style={{
                      backgroundColor: entry.swatch,
                      borderColor: '#9EA4AB',
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  <span className="shrink-0 tabular-nums text-gray-500">
                    {entry.nodeCount}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div
          className={[
            'shrink-0 space-y-1',
            showSwatches ? 'mt-2 border-t border-gray-200 pt-2' : '',
          ].join(' ')}
        >
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <PositiveIcon />
            <span>Positive influence</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <NegativeIcon />
            <span>Negative influence</span>
          </div>
        </div>

        <div className="mt-2 flex shrink-0 items-center gap-1.5 border-t border-gray-200 pt-2">
          <GroupFilter
            taxonomy={taxonomy}
            onTaxonomyChange={onTaxonomyChange}
            groups={groups}
            hiddenGroups={hiddenGroups}
            onToggleGroup={onToggleGroup}
            onShowAll={onShowAll}
            onHideAll={onHideAll}
            open={filterOpen}
            onOpenChange={onFilterOpenChange}
          />
          {/* The whole reason the old box had to be everywhere: a filter left on
              with nothing on screen saying so. One press puts it back. */}
          {filtering && (
            <button
              type="button"
              onClick={onShowAll}
              title="Show every group again"
              className="flex min-w-0 items-center gap-1 rounded-full bg-gray-900 py-1 pl-2 pr-1.5 text-xs font-medium text-white hover:bg-gray-800"
            >
              <span className="truncate tabular-nums">{hiddenCount} hidden</span>
              <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ group filter */

interface GroupFilterProps {
  taxonomy: Taxonomy
  onTaxonomyChange: (taxonomy: Taxonomy) => void
  groups: readonly { name: string; nodeCount: number }[]
  hiddenGroups: ReadonlySet<string>
  onToggleGroup: (name: string) => void
  onShowAll: () => void
  onHideAll: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The filter, behind a button.
 *
 * Opens upward, because the box it hangs off sits in the bottom-right corner.
 * Escape closes it and returns focus to the button, which the tool's other three
 * popovers variously do not — worth getting right here, since this one is now
 * the only way to reach the filter at all.
 */
function GroupFilter({
  taxonomy,
  onTaxonomyChange,
  groups,
  hiddenGroups,
  onToggleGroup,
  onShowAll,
  onHideAll,
  open,
  onOpenChange,
}: GroupFilterProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const headingId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      onOpenChange(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Stopped here so the app's own Escape handler does not also close a card
      // or the guide behind this popover — one press, one dismissal.
      event.stopPropagation()
      onOpenChange(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, onOpenChange])

  const shown = groups.length - hiddenGroups.size

  return (
    <div className="relative flex-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={[
          'flex w-full items-center justify-center gap-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors',
          open
            ? 'border-gray-900 bg-gray-900 text-white'
            : 'border-gray-200 text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        Filter
        <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden="true">
          <path
            d="M1 6.5 5 2.5l4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-labelledby={headingId}
          // Right-anchored, not left: the popover is wider than the button it
          // hangs off, and the box already sits 16px from the window's right
          // edge — growing rightward put 13px of it off screen.
          className="absolute bottom-full right-0 z-30 mb-2 w-60 rounded-lg border border-gray-200 bg-white p-2 shadow-xl"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
            <h3
              id={headingId}
              className="text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Group by
            </h3>
            <div
              role="radiogroup"
              aria-label="Group nodes by"
              className="inline-flex rounded-full bg-gray-100 p-0.5"
            >
              {TABS.map((tab) => {
                const active = tab.id === taxonomy
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-taxonomy={tab.id}
                    title={tab.hint}
                    onClick={() => onTaxonomyChange(tab.id)}
                    className={[
                      'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {groups.map((group) => {
              const isHidden = hiddenGroups.has(group.name)
              return (
                <li key={group.name}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-gray-800 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => onToggleGroup(group.name)}
                      className="accent-gray-900"
                    />
                    <span className="min-w-0 flex-1 truncate">{group.name}</span>
                    <span className="shrink-0 tabular-nums text-gray-500">
                      {group.nodeCount}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-gray-100 px-1 pt-1.5">
            <span className="text-xs tabular-nums text-gray-500">
              {shown} of {groups.length} shown
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onShowAll}
                className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Show all
              </button>
              <button
                type="button"
                onClick={onHideAll}
                className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Hide all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
