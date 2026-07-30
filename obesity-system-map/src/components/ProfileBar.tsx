import { useEffect, useRef, useState } from 'react'

import { downloadProfile } from '../lib/profile'
import type { Profile } from '../lib/profile'
import { ImportButton } from './ProfilePersonaDialog'

/**
 * Profile's permanent chrome, reduced to a strip along the bottom.
 *
 * Which persona, how much is marked, and the way in to everything else. It
 * costs 48px of a 720px-tall viewport instead of 368px of a 1280px-wide one,
 * and — unlike a right-hand panel over a 3370px-wide map — it never strands a
 * region of the map underneath itself.
 */

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

export interface ProfileBarProps {
  profiles: readonly Profile[]
  profile: Profile
  markedNodes: number
  markedEdges: number
  unmarkedLinks: number
  reviewOpen: boolean
  onToggleReview: () => void
  /** Whether the map is showing the profile alone. */
  markedOnly: boolean
  onMarkedOnlyChange: (markedOnly: boolean) => void
  /** Saves the map as it currently looks. */
  onExportPng: () => void
  /** 'working' while rasterising, 'failed' briefly if it did not. */
  exportState: 'idle' | 'working' | 'failed'
  onSelectProfile: (id: string | null) => void
  onNewProfile: () => void
  onEditPersona: () => void
  onImportProfile: (profile: Profile) => void
  onDeleteProfile: (id: string) => void
}

export function ProfileBar({
  profiles,
  profile,
  markedNodes,
  markedEdges,
  unmarkedLinks,
  reviewOpen,
  onToggleReview,
  markedOnly,
  onMarkedOnlyChange,
  onExportPng,
  exportState,
  onSelectProfile,
  onNewProfile,
  onEditPersona,
  onImportProfile,
  onDeleteProfile,
}: ProfileBarProps) {
  const [open, setOpen] = useState<'persona' | 'more' | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)

  // One click-away listener for both menus. Pointerdown rather than click so a
  // press that begins on the map dismisses before the map acts on it.
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as globalThis.Node)) setOpen(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      ref={barRef}
      className="absolute inset-x-0 bottom-0 z-30 flex h-12 items-center gap-3 border-t border-gray-200 bg-white/97 px-3 backdrop-blur"
    >
      {/* Persona */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((c) => (c === 'persona' ? null : 'persona'))}
          aria-haspopup="menu"
          aria-expanded={open === 'persona'}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-gray-100"
        >
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-900"
          >
            {initialOf(profile.name)}
          </span>
          <span className="max-w-[13rem] text-left">
            <span className="block truncate text-[13px] font-medium leading-tight text-gray-900">
              {profile.name}
            </span>
            {profile.details && (
              <span className="block max-w-[13rem] truncate text-[10.5px] leading-tight text-gray-500">
                {profile.details}
              </span>
            )}
          </span>
          <Chevron />
        </button>

        {open === 'persona' && (
          <Menu label="Choose a profile">
            {profiles.map((entry) => (
              <MenuItem
                key={entry.id}
                selected={entry.id === profile.id}
                onClick={() => {
                  onSelectProfile(entry.id)
                  setOpen(null)
                }}
              >
                {entry.name}
              </MenuItem>
            ))}
            <Divider />
            <MenuItem
              onClick={() => {
                onNewProfile()
                setOpen(null)
              }}
            >
              New profile…
            </MenuItem>
          </Menu>
        )}
      </div>

      <span className="h-5 w-px shrink-0 bg-gray-200" />

      {/* Counts. The bare numbers, without the "of 108" denominator the old
          panel showed: a profile is a deliberately small curated set, and
          framing 12 factors as 11% of the map made a correct one feel unfinished. */}
      <p className="shrink-0 text-[12px] text-gray-600">
        <strong className="font-semibold tabular-nums text-gray-900">
          {markedNodes}
        </strong>{' '}
        {markedNodes === 1 ? 'factor' : 'factors'}
        <span className="mx-1.5 text-gray-300">·</span>
        <strong className="font-semibold tabular-nums text-gray-900">
          {markedEdges}
        </strong>{' '}
        {markedEdges === 1 ? 'connection' : 'connections'}
      </p>

      <span className="flex-1" />

      {/* Drops everything unmarked out of the picture, so the map shows the
          profile and nothing else — the view you would put in a report.
          Disabled with nothing marked, where it would only ever blank the map. */}
      <button
        type="button"
        role="switch"
        aria-checked={markedOnly}
        data-testid="marked-only"
        disabled={markedNodes === 0}
        onClick={() => onMarkedOnlyChange(!markedOnly)}
        title={
          markedNodes === 0
            ? 'Mark something first'
            : markedOnly
              ? 'Show the whole map again'
              : 'Hide everything that is not marked'
        }
        className={[
          'flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors',
          markedNodes === 0
            ? 'cursor-not-allowed border-gray-200 text-gray-300'
            : markedOnly
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M1 8s2.6-4.2 7-4.2S15 8 15 8s-2.6 4.2-7 4.2S1 8 1 8z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="8" r="1.8" fill="currentColor" />
        </svg>
        Marked only
      </button>

      {/* Saves whatever the map is currently showing — so with "Marked only" on
          this is the profile by itself, and with it off it is the profile in the
          context of the whole map. Both are wanted at different times, which is
          why there is one button rather than two. */}
      <button
        type="button"
        data-testid="export-png"
        disabled={exportState === 'working'}
        onClick={onExportPng}
        title="Save the whole map as a PNG image"
        className={[
          'flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors',
          exportState === 'failed'
            ? 'border-rose-300 bg-rose-50 text-rose-700'
            : exportState === 'working'
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
        {exportState === 'working'
          ? 'Saving…'
          : exportState === 'failed'
            ? 'Export failed'
            : 'Export PNG'}
      </button>

      <button
        type="button"
        onClick={onToggleReview}
        aria-expanded={reviewOpen}
        className={[
          'flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors',
          reviewOpen
            ? 'border-gray-400 bg-gray-100 text-gray-900'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50',
        ].join(' ')}
      >
        Review
        {unmarkedLinks > 0 && (
          <span
            title={`${unmarkedLinks} connection${unmarkedLinks === 1 ? '' : 's'} between two marked factors are not marked`}
            className="rounded-full bg-gray-900 px-1.5 text-[10px] font-medium tabular-nums text-white"
          >
            {unmarkedLinks}
          </span>
        )}
      </button>

      {/* More */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((c) => (c === 'more' ? null : 'more'))}
          aria-haspopup="menu"
          aria-expanded={open === 'more'}
          aria-label="Profile actions"
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          <svg viewBox="0 0 16 4" className="h-4 w-4" aria-hidden="true">
            <circle cx="2" cy="2" r="1.5" fill="currentColor" />
            <circle cx="8" cy="2" r="1.5" fill="currentColor" />
            <circle cx="14" cy="2" r="1.5" fill="currentColor" />
          </svg>
        </button>

        {open === 'more' && (
          <Menu label="Profile actions" align="right">
            <MenuItem
              onClick={() => {
                onEditPersona()
                setOpen(null)
              }}
            >
              Edit persona…
            </MenuItem>
            <MenuItem
              onClick={() => {
                downloadProfile(profile)
                setOpen(null)
              }}
            >
              Export JSON
            </MenuItem>
            <div className="px-1.5 py-1">
              <ImportButton onImport={onImportProfile} />
            </div>
            <Divider />
            <DeleteItem
              name={profile.name}
              onConfirm={() => {
                onDeleteProfile(profile.id)
                setOpen(null)
              }}
            />
            <p className="px-3 pb-2 pt-1 text-[10.5px] leading-snug text-gray-400">
              Saved in this browser as you work. Export to keep a copy.
            </p>
          </Menu>
        )}
      </div>
    </div>
  )
}

function Chevron() {
  return (
    <svg viewBox="0 0 10 6" className="h-2 w-2.5 text-gray-400" aria-hidden="true">
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
  align = 'left',
  children,
}: {
  label: string
  align?: 'left' | 'right'
  children: React.ReactNode
}) {
  return (
    <div
      role="menu"
      aria-label={label}
      className={[
        'absolute bottom-full mb-1.5 max-h-[60vh] w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-[0_10px_32px_-8px_rgba(0,0,0,0.28)]',
        align === 'right' ? 'right-0' : 'left-0',
      ].join(' ')}
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
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-50',
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

/**
 * Two-step, because the alternative was one click from a permanent, silent,
 * unrecoverable loss — and the button sat a few pixels from Export.
 */
function DeleteItem({
  name,
  onConfirm,
}: {
  name: string
  onConfirm: () => void
}) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={() => setArmed(true)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-rose-700 hover:bg-rose-50"
      >
        <span aria-hidden="true" className="text-transparent">
          ✓
        </span>
        <span>Delete profile…</span>
      </button>
    )
  }

  return (
    <div className="px-3 py-2">
      <p className="mb-1.5 text-[12px] leading-snug text-gray-700">
        Delete <strong className="font-semibold">{name}</strong> and every mark
        in it? This cannot be undone.
      </p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded bg-rose-600 px-2 py-1 text-[12px] font-medium text-white hover:bg-rose-700"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="rounded border border-gray-300 px-2 py-1 text-[12px] text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
