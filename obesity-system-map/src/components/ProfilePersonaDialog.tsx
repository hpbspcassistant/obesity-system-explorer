import { useEffect, useRef, useState } from 'react'

import { PersonaCharacteristicsForm } from './PersonaCharacteristics'
import type { PersonaCharacteristics } from '../lib/reach'
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
  onSave: (
    name: string,
    details: string,
    characteristics: PersonaCharacteristics,
  ) => void
  onImport: (result: ParseResult) => void
  /** Absent while there is no profile to fall back to. */
  onCancel?: () => void
  /**
   * Leaves Profile mode altogether. The way out on a first visit, when there is
   * no profile behind the dialog to cancel back to — without it the dialog is a
   * dead end, and the only escape is realising the mode switcher still works.
   */
  onLeave?: () => void
}

export function ProfilePersonaDialog({
  profile,
  onSave,
  onImport,
  onCancel,
  onLeave,
}: ProfilePersonaDialogProps) {
  const [name, setName] = useState(profile?.name ?? '')
  const [details, setDetails] = useState(profile?.details ?? '')
  const [characteristics, setCharacteristics] = useState<PersonaCharacteristics>(
    profile?.characteristics ?? {},
  )
  const nameRef = useRef<HTMLInputElement | null>(null)
  /** Import is a rare route in, so it starts folded away. */
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  /**
   * Escape leaves, by whichever exit exists. The app's own Escape handler knows
   * about the guide, the card and the review sheet but never this, so a dialog
   * that looks dismissable was not.
   */
  useEffect(() => {
    const leave = onCancel ?? onLeave
    if (!leave) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      leave()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onCancel, onLeave])

  const editing = profile !== null

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/45 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Rename persona' : 'New profile'}
        className="max-h-[88vh] w-[26rem] max-w-[92vw] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.28)]"
      >
        <h2 className="text-base font-semibold text-gray-900">
          {editing ? 'Edit persona' : 'New profile'}
        </h2>
        {!editing && (
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            A profile is a point of view: mark the variables and connections you
            judge to be significant for one person. It is your judgement, not
            the map's.
          </p>
        )}

        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim())
              onSave(name.trim(), details.trim(), characteristics)
          }}
        >
          <label
            htmlFor="persona-name"
            className="mb-1 block text-xs font-medium text-gray-600"
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
            className="mb-1 block text-xs font-medium text-gray-600"
          >
            Details <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            id="persona-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={3}
            placeholder="50, taxi driver, 12-hour shifts"
            className="mb-3 w-full resize-none rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-800 focus:outline-none"
          />

          {/* Optional, and the dialog says so: a profile is usable for marking
              with none of these set. They only decide which programmes Intervention
              considers, and leaving one unset is reported there rather than
              guessed at here. */}
          <div className="mb-3 rounded border border-gray-200 bg-gray-50 p-2">
            <PersonaCharacteristicsForm
              value={characteristics}
              onChange={setCharacteristics}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400"
            >
              {editing ? 'Save' : 'Start profile'}
            </button>
            {/* Cancel where there is something to go back to, and otherwise a
                way out of the mode entirely. One of the two is always present. */}
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            ) : (
              onLeave && (
                <button
                  type="button"
                  onClick={onLeave}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Back to Explore
                </button>
              )
            )}
          </div>
        </form>

        {/* Folded away rather than offered as an equal alternative. Almost
            everyone arrives here to start a profile; importing one is how a
            colleague's file gets in, which is rare and worth a click. */}
        {!editing && (
          <div className="mt-3 border-t border-gray-200 pt-3">
            {importOpen ? (
              <ImportButton onImport={onImport} />
            ) : (
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="text-xs text-gray-600 underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
              >
                Import a profile someone sent you
              </button>
            )}
          </div>
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
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const tryParse = (raw: string) => {
    try {
      const result = parseProfile(JSON.parse(raw))
      if (!result) {
        setNote({ ok: false, text: 'That JSON is not a profile (it needs a name).' })
        return
      }
      setPasteText('')
      setPasteOpen(false)
      onImport(result)
    } catch {
      setNote({ ok: false, text: 'Could not parse as JSON.' })
    }
  }

  return (
    <>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 ${className}`}
        >
          Import file
        </button>
        <button
          type="button"
          onClick={() => { setPasteOpen((v) => !v); setNote(null) }}
          className={[
            'rounded border px-3 py-1.5 text-sm transition-colors',
            pasteOpen
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50',
          ].join(' ')}
        >
          Paste JSON
        </button>
      </div>
      {pasteOpen && (
        <div className="mt-1.5">
          <textarea
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setNote(null) }}
            placeholder='Paste profile JSON here…'
            rows={4}
            className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs text-gray-800 placeholder:text-gray-500 focus:border-gray-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={pasteText.trim().length === 0}
            onClick={() => tryParse(pasteText.trim())}
            className={[
              'mt-1 w-full rounded border px-3 py-1.5 text-sm transition-colors',
              pasteText.trim().length === 0
                ? 'cursor-not-allowed border-gray-200 text-gray-300'
                : 'border-gray-900 bg-gray-900 text-white hover:bg-gray-800',
            ].join(' ')}
          >
            Import
          </button>
        </div>
      )}
      {note && (
        <p
          role="status"
          className={`mt-1 text-xs ${note.ok ? 'text-emerald-700' : 'text-rose-600'}`}
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
            onImport(result)
          } catch {
            setNote({ ok: false, text: 'That file could not be read as JSON.' })
          }
        }}
      />
    </>
  )
}
