import { useEffect, useRef, useState } from 'react'

import { parseProfile } from '../lib/profile'
import type { ParseResult, Profile } from '../lib/profile'

/**
 * Naming a persona — for a new profile, or renaming one that exists.
 *
 * A profile has to start with a name, so on first use this is a gate rather
 * than a panel: it sits in the middle of the map, says what a profile is, and
 * gets out of the way once you have answered.
 */

export interface ProfilePersonaDialogProps {
  /** Null when creating; the profile being renamed otherwise. */
  profile: Profile | null
  onSave: (name: string, details: string) => void
  onImport: (result: ParseResult) => void
  /** Absent while there is no profile to fall back to, so there is no escape. */
  onCancel?: () => void
}

export function ProfilePersonaDialog({
  profile,
  onSave,
  onImport,
  onCancel,
}: ProfilePersonaDialogProps) {
  const [name, setName] = useState(profile?.name ?? '')
  const [details, setDetails] = useState(profile?.details ?? '')
  const nameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const editing = profile !== null

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/45 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Rename persona' : 'New profile'}
        className="w-[22rem] max-w-[90vw] rounded-xl border border-gray-200 bg-white p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.28)]"
      >
        <h2 className="text-[14px] font-semibold text-gray-900">
          {editing ? 'Edit persona' : 'New profile'}
        </h2>
        {!editing && (
          <p className="mt-1 text-[12px] leading-relaxed text-gray-600">
            A profile is a point of view: mark the factors and connections you
            judge to be significant for one person. It is your judgement, not
            the map's.
          </p>
        )}

        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) onSave(name.trim(), details.trim())
          }}
        >
          <label
            htmlFor="persona-name"
            className="mb-1 block text-[11px] font-medium text-gray-600"
          >
            Persona name
          </label>
          <input
            id="persona-name"
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Raj"
            className="mb-3 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-800 focus:outline-none"
          />
          <label
            htmlFor="persona-details"
            className="mb-1 block text-[11px] font-medium text-gray-600"
          >
            Details <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="persona-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={3}
            placeholder="50, taxi driver, 12-hour shifts"
            className="mb-3 w-full resize-none rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-800 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400"
            >
              {editing ? 'Save' : 'Start profile'}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {!editing && (
          <>
            <div className="my-3 flex items-center gap-2">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-[10px] uppercase tracking-wide text-gray-400">
                or
              </span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <ImportButton onImport={onImport} />
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Reading a profile file. Success and failure get different colours: the old
 * build routed the "imported, some marks skipped" message through the same
 * slot as parse errors, so a working import was reported in red.
 */
export function ImportButton({
  onImport,
  className = '',
}: {
  onImport: (result: ParseResult) => void
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 ${className}`}
      >
        Import a profile file
      </button>
      {note && (
        <p
          role="status"
          className={`mt-1 text-[11px] ${note.ok ? 'text-emerald-700' : 'text-rose-600'}`}
        >
          {note.text}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          try {
            const result = parseProfile(JSON.parse(await file.text()))
            if (!result) {
              setNote({
                ok: false,
                text: 'That file is not a profile (it needs a name).',
              })
              return
            }
            // Reported by the caller, not here. A successful import from the
            // first-run dialog replaces that dialog with the map, so a note set
            // on this component is unmounted in the same tick and never read —
            // which is how an import that fills in connections says nothing
            // about having done so.
            onImport(result)
          } catch {
            setNote({ ok: false, text: 'That file could not be read as JSON.' })
          }
        }}
      />
    </>
  )
}
