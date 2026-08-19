import {
  CONDITIONS_KEY,
  conditionValues,
  coreCharacteristics,
} from '../data/intervention'
import type { PersonaCharacteristics as Characteristics } from '../lib/reach'

/**
 * The persona's characteristics: what Intervention's gates are tested against.
 *
 * Separate from the marks on the map, and deliberately so. These decide which
 * programmes apply to this person; the marks decide what matters to them. A
 * profile can have either without the other, and neither is derived from the
 * other.
 *
 * Every core field has three states, and the third is the reason each is a
 * select rather than a checkbox:
 *
 *   Not set yet     nobody has decided. Any gate testing it comes back
 *                   undecided, and Intervention says so rather than quietly
 *                   dropping the programme.
 *   a value         the persona is this.
 *   Does not apply  the field is meaningless for this person. Gates testing it
 *                   exclude, they do not pass — marking a young child's smoking
 *                   status "does not apply" must not match a cessation
 *                   programme.
 */

/** Turns 'lower-income' into 'Lower income' for display; ids stay as authored. */
function humanise(value: string | boolean): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const words = value.replace(/[-_]/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Values round-trip through the DOM as strings, so they are tagged going out. */
function encode(value: string | boolean): string {
  return typeof value === 'boolean' ? `bool:${value}` : `str:${value}`
}

function decode(raw: string): string | boolean | null | undefined {
  if (raw === '') return undefined
  if (raw === 'n/a') return null
  return raw.startsWith('bool:') ? raw === 'bool:true' : raw.slice(4)
}

export interface PersonaCharacteristicsFormProps {
  value: Characteristics
  onChange: (next: Characteristics) => void
}

export function PersonaCharacteristicsForm({
  value,
  onChange,
}: PersonaCharacteristicsFormProps) {
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
    // Always written, even when empty: absent means "not asked", an empty list
    // means "asked, and this person has none", and gates read them differently.
    onChange({ ...value, [CONDITIONS_KEY]: next })
  }

  const unset = Object.keys(coreCharacteristics).filter(
    (key) => value[key] === undefined,
  ).length

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium text-gray-600">
          Characteristics{' '}
          <span className="text-gray-400">(who programmes are aimed at)</span>
        </p>
        {unset > 0 && (
          <span className="text-[10.5px] text-amber-700">{unset} not set</span>
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
              <span className="mb-0.5 block text-[10.5px] text-gray-500">
                {humanise(key)}
              </span>
              <select
                value={current}
                onChange={(event) => set(key, decode(event.target.value))}
                className="w-full rounded border border-gray-300 px-1.5 py-1 text-[12px] text-gray-800 focus:border-gray-800 focus:outline-none"
              >
                <option value="">Not set yet</option>
                {values.filter((v): v is string | boolean => v !== null).map((v) => (
                  <option key={String(v)} value={encode(v)}>
                    {humanise(v)}
                  </option>
                ))}
                <option value="n/a">Does not apply</option>
              </select>
            </label>
          )
        })}
      </div>

      <p className="mb-1 mt-2.5 text-[10.5px] text-gray-500">
        Conditions <span className="text-gray-400">(tick any that apply)</span>
      </p>
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
                'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
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
  )
}
