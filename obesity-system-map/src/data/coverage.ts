/**
 * Typed access to the coverage inputs.
 *
 * The four files under `data/coverage/` are placeholders with real node ids and
 * invented content. They will be replaced wholesale, so nothing outside this
 * module names a behaviour, a programme or a node from them — this file is the
 * only place that knows they exist at all.
 */

import { behavioursById } from '../lib/reach'
import type { Behaviour, Programme } from '../lib/reach'
import { nodes } from './systemMap'

import behavioursRaw from './coverage/behaviours.json'
import characteristicsRaw from './coverage/characteristics.json'
import programmesRaw from './coverage/programmes.json'

export const behaviours = behavioursRaw as readonly Behaviour[]
export const programmes = programmesRaw as unknown as readonly Programme[]

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
