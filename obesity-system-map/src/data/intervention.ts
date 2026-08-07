/**
 * Typed access to the intervention inputs.
 *
 * `programmes.json` is generated — see tools/import_inventory.py, which reads the
 * tagged HPB inventory spreadsheet. Edit the spreadsheet and re-run it; anything
 * typed into the JSON by hand is lost on the next export.
 *
 * Nothing outside this module names a behaviour, a programme or a node from
 * these files. This is the only place that knows they exist at all.
 */

import { behavioursById } from '../lib/reach'
import type { Behaviour, Programme } from '../lib/reach'
import { nodes } from './systemMap'

import behavioursRaw from './intervention/behaviours.json'
import characteristicsRaw from './intervention/characteristics.json'
import programmesRaw from './intervention/programmes.json'

export const behaviours = behavioursRaw as readonly Behaviour[]

/** Every programme in the inventory, including the ones that have ended. */
export const allProgrammes = programmesRaw as unknown as readonly Programme[]

/**
 * What the overlay reasons about.
 *
 * Ended programmes are kept in the file and dropped here: a map of what HPB
 * reaches should not count something nobody can join. 'verify' stays in — that
 * flags a detail nobody has confirmed yet, not a programme that is not running,
 * and excluding those would understate reach on a technicality.
 */
export const programmes: readonly Programme[] = allProgrammes.filter(
  (programme) => programme.status !== 'ended',
)

/**
 * The controlled vocabulary, split as the source file splits it.
 *
 * `core` is single-valued per persona — one life stage, one age band — and every
 * persona is expected to carry all of them. `conditions` is a set of optional
 * flags most personas will not have, so it is the one multi-valued field.
 */
export const coreCharacteristics = characteristicsRaw.core as Readonly<
  Record<string, readonly (string | boolean)[]>
>

export const conditionValues: readonly string[] = characteristicsRaw.conditions

/** The key the multi-valued flags live under, on gates and on personas alike. */
export const CONDITIONS_KEY = 'conditions'

export const behaviourIndex = behavioursById([...behaviours])

/** Every id on the map, which is what "untouched" is measured against. */
export const allNodeIds: readonly number[] = nodes.map((n) => n.id)
