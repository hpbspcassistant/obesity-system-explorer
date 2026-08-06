/**
 * Typed access to the coverage inputs.
 *
 * The four files under `data/coverage/` are placeholders with real node ids and
 * invented content. They will be replaced wholesale, so nothing outside this
 * module names a behaviour, a programme or a node from them — this file is the
 * only place that knows they exist at all.
 */

import { behavioursById } from '../lib/reach'
import type { Behaviour, CoveragePersona, Programme } from '../lib/reach'
import { nodes } from './systemMap'

import behavioursRaw from './coverage/behaviours.json'
import characteristicsRaw from './coverage/characteristics.json'
import personasRaw from './coverage/personas.json'
import programmesRaw from './coverage/programmes.json'

export const behaviours = behavioursRaw as readonly Behaviour[]
export const programmes = programmesRaw as unknown as readonly Programme[]
export const personas = personasRaw as unknown as readonly CoveragePersona[]

/** characteristic -> the values a gate may test for. */
export const characteristics = characteristicsRaw as Readonly<
  Record<string, readonly (string | boolean)[]>
>

export const behaviourIndex = behavioursById([...behaviours])

/** Every id on the map, which is what "untouched" is measured against. */
export const allNodeIds: readonly number[] = nodes.map((n) => n.id)
