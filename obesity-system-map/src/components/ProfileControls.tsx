import { nodesById } from '../data/systemMap'
import type { Connection } from '../types'

/**
 * The small pieces Profile's card and review sheet both use.
 *
 * They live together because the mark control has to look and behave
 * identically everywhere it appears: wherever you tick a variable — on the card,
 * in the review sheet, in the unmarked-links list — it is the same control
 * doing the same binary thing.
 */

/**
 * The mark control. Binary by construction — it is a checkbox, so there is no
 * shape for a level or a score to take.
 */
export function MarkToggle({
  marked,
  onChange,
  label,
  size = 'sm',
}: {
  marked: boolean
  onChange: () => void
  label: string
  size?: 'sm' | 'md'
}) {
  const box = size === 'md' ? 'h-[18px] w-[18px]' : 'h-4 w-4'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marked}
      aria-label={label}
      title={label}
      onClick={onChange}
      className={[
        box,
        'flex shrink-0 items-center justify-center rounded border transition-colors',
        marked
          ? 'border-gray-900 bg-gray-900 text-white hover:bg-gray-700'
          : 'border-gray-400 bg-white text-transparent hover:border-gray-600 hover:bg-gray-100',
      ].join(' ')}
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
        <path
          d="M2.5 6.5l2.5 2.5 4.5-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </button>
  )
}

/** Which way a connection pushes. Colour and glyph both, never colour alone. */
export function InfluenceTag({ connection }: { connection: Connection }) {
  const positive = connection.sign === 1
  return (
    <span
      title={positive ? 'Increases' : 'Decreases'}
      className={[
        'ml-1 shrink-0 rounded px-1 text-[10px] font-medium leading-4',
        positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
      ].join(' ')}
    >
      {positive ? '+' : '−'}
    </span>
  )
}

/**
 * One connection, tickable. Clicking the label walks to the other variable
 * without touching the mark; only the checkbox marks.
 */
export function ConnectionRow({
  connection,
  direction,
  marked,
  onToggle,
  onSelectNode,
}: {
  connection: Connection
  direction: 'out' | 'in'
  marked: boolean
  onToggle: () => void
  onSelectNode: (nodeId: number) => void
}) {
  const otherId = direction === 'out' ? connection.targetId : connection.sourceId
  const other = nodesById.get(otherId)
  const label = other?.label ?? `Variable ${otherId}`
  return (
    <li
      className={[
        'flex items-center gap-1.5 rounded px-1 py-[3px]',
        marked ? 'bg-gray-100' : 'hover:bg-gray-50',
      ].join(' ')}
    >
      <MarkToggle
        marked={marked}
        onChange={onToggle}
        label={`Mark the connection to ${label}`}
      />
      <span aria-hidden="true" className="shrink-0 text-[11px] text-gray-400">
        {direction === 'out' ? '→' : '←'}
      </span>
      <button
        type="button"
        onClick={() => onSelectNode(otherId)}
        title={`Open ${label}`}
        className="flex-1 truncate text-left text-[12px] text-gray-700 hover:text-gray-900 hover:underline"
      >
        {label}
      </button>
      <InfluenceTag connection={connection} />
    </li>
  )
}
