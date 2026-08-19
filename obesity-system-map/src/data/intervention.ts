/**
 * Typed access to the intervention inputs.
 *
 * `programmes.json` is generated — see tools/import_inventory.py, which reads the
 * tagged HPB inventory spreadsheet. Edit the spreadsheet and re-run it; anything
 * typed into the JSON by hand is lost on the next export.
 */

import type { Programme } from '../lib/reach'
import { nodes } from './systemMap'

import characteristicsRaw from './intervention/characteristics.json'
import programmesRaw from './intervention/programmes.json'

/** Every programme in the inventory, including the ones that have ended. */
export const allProgrammes = programmesRaw as unknown as readonly Programme[]

/**
 * What the overlay reasons about.
 *
 * Ended programmes are kept in the file and dropped here: a map of what HPB
 * reaches should not count something nobody can join. 'verify' stays in — that
 * flags a detail nobody has confirmed yet, not a programme that is not running,
 * and excluding those would understate reach on a technicality.
 *
 * Programmes mapped to no variable are dropped too. Six of the forty-two are
 * dental, optical and screening services with nothing on this map to point at,
 * and a programme that can never light a box cannot answer the only question
 * this mode asks. Kept in, they padded the denominator — "23 of 42" — and could
 * be reported undetermined for a persona missing a characteristic, sending the
 * reader off to complete a persona to resolve a programme that would still light
 * nothing. They stay in the file, and in `allProgrammes`, because they are part
 * of the inventory; they are just not part of the reach question.
 */
export const programmes: readonly Programme[] = allProgrammes.filter(
  (programme) => programme.status !== 'ended' && programme.nodes.length > 0,
)

/**
 * The controlled vocabulary, split as the source file splits it.
 *
 * `core` is single-valued per persona — one role, one age band — and every
 * persona is expected to carry all of them. `conditions` is a set of optional
 * flags most personas will not have, so it is the one multi-valued field.
 */
export const coreCharacteristics = characteristicsRaw.core as Readonly<
  Record<string, readonly (string | boolean | null)[]>
>

export const conditionValues: readonly string[] = characteristicsRaw.conditions

/** The key the multi-valued flags live under, on gates and on personas alike. */
export const CONDITIONS_KEY = 'conditions'

/** Every id on the map, which is what "untouched" is measured against. */
export const allNodeIds: readonly number[] = nodes.map((n) => n.id)
