/**
 * Which HPB programmes apply to a persona, and which parts of the map they reach.
 *
 * Two links, deliberately kept apart:
 *
 *   persona -> programme   decided by the programme's gate, a rule over the
 *                          persona's characteristics. Computed every time and
 *                          never stored.
 *   programme -> map       via behaviours. A programme names behaviours, a
 *                          behaviour owns node ids. This is what lights up.
 *
 * The behaviour layer is the point and must not be collapsed. Several programmes
 * address the same behaviour, so defining its node set once is what makes every
 * programme that addresses it light the same nodes — and what makes the
 * whitespace view trustworthy rather than an artefact of how each programme
 * happened to be tagged.
 *
 * Everything here takes its data as arguments. The four JSON files behind
 * data/coverage are placeholders that will be replaced wholesale, so nothing in
 * this module knows a single behaviour id, programme name or node number.
 */

export type CharacteristicValue = string | boolean

/**
 * Either "everyone", or characteristic -> the value(s) that satisfy it.
 *
 * A persona passes when every key in the gate is satisfied, so the keys are
 * an AND and the values within a key are an OR. Enough for the inventory as it
 * stands; ranges and nesting can be added when a real programme needs them.
 */
export type Gate =
  | 'everyone'
  | Readonly<Record<string, CharacteristicValue | readonly CharacteristicValue[]>>

export interface Behaviour {
  id: string
  label: string
  nodes: readonly number[]
}

export interface Programme {
  id: string
  name: string
  source: string
  gate: Gate
  addresses: readonly string[]
  /**
   * The escape hatch: node ids lit directly, on top of whatever the behaviours
   * cover, for the rare programme that hits something no behaviour owns. Kept
   * separate from `addresses` so a reader can always see which nodes were
   * reasoned about and which were pinned by hand.
   */
  extraNodes?: readonly number[]
}

export interface CoveragePersona {
  id: string
  name: string
  characteristics: Readonly<Record<string, CharacteristicValue>>
  applicabilityNodes: readonly number[]
}

/**
 * Three outcomes, not two.
 *
 * A gate over a characteristic the persona has not been given cannot be
 * answered, and treating that as "no" would drop the programme silently — the
 * reader would see a shorter list with no way to know an unfinished persona
 * caused it. Undetermined programmes light nothing, but they are counted and
 * named, which turns a hidden gap into a prompt to finish the persona.
 */
export type GateVerdict = 'applies' | 'excluded' | 'undetermined'

const asList = (
  value: CharacteristicValue | readonly CharacteristicValue[],
): readonly CharacteristicValue[] => (Array.isArray(value) ? value : [value as CharacteristicValue])

export function testGate(
  gate: Gate,
  characteristics: Readonly<Record<string, CharacteristicValue>>,
): GateVerdict {
  if (gate === 'everyone') return 'applies'

  let undetermined = false
  for (const [characteristic, allowed] of Object.entries(gate)) {
    const held = characteristics[characteristic]
    if (held === undefined) {
      // Keep testing: a later key may rule the programme out outright, which is
      // a firmer answer than "cannot say" and should win.
      undetermined = true
      continue
    }
    if (!asList(allowed).includes(held)) return 'excluded'
  }
  return undetermined ? 'undetermined' : 'applies'
}

export interface Applicability {
  applies: Programme[]
  excluded: Programme[]
  undetermined: Programme[]
}

export function classifyProgrammes(
  persona: Pick<CoveragePersona, 'characteristics'>,
  programmes: readonly Programme[],
): Applicability {
  const out: Applicability = { applies: [], excluded: [], undetermined: [] }
  for (const programme of programmes) {
    out[testGate(programme.gate, persona.characteristics)].push(programme)
  }
  return out
}

/* --------------------------------------------------------------- reach */

/** Index of behaviours by id, so lookups do not rescan the list. */
export function behavioursById(
  behaviours: readonly Behaviour[],
): Map<string, Behaviour> {
  return new Map(behaviours.map((b) => [b.id, b]))
}

/**
 * Every node one programme reaches: the union of its behaviours' nodes, plus
 * anything pinned directly. A behaviour it names but which does not exist is
 * skipped rather than throwing — the inventory and the vocabulary are edited by
 * hand and will drift, and a typo should cost one behaviour, not the whole view.
 */
export function nodesOfProgramme(
  programme: Programme,
  behaviours: Map<string, Behaviour>,
): number[] {
  const nodes = new Set<number>()
  for (const id of programme.addresses) {
    for (const node of behaviours.get(id)?.nodes ?? []) nodes.add(node)
  }
  for (const node of programme.extraNodes ?? []) nodes.add(node)
  return [...nodes]
}

/** The union across a set of programmes. */
export function reachOf(
  programmes: readonly Programme[],
  behaviours: Map<string, Behaviour>,
): Set<number> {
  const reached = new Set<number>()
  for (const programme of programmes) {
    for (const node of nodesOfProgramme(programme, behaviours)) reached.add(node)
  }
  return reached
}

/**
 * Nodes no programme reaches, gates ignored.
 *
 * Persona-independent on purpose: this asks what HPB touches at all, not what it
 * touches for one person. The deep-physiology nodes are expected to stay in here
 * — nothing acts on them directly — so a large whitespace set is the correct
 * answer rather than a sign the mapping is incomplete.
 */
export function whitespaceOf(
  allNodeIds: readonly number[],
  programmes: readonly Programme[],
  behaviours: Map<string, Behaviour>,
): Set<number> {
  const reached = reachOf(programmes, behaviours)
  return new Set(allNodeIds.filter((id) => !reached.has(id)))
}

/* ----------------------------------------------------- per-node accounting */

/**
 * How a node stands relative to one persona.
 *
 * `gap` is the one worth building the view around: something judged significant
 * for this person that no applicable programme touches.
 */
export type NodeStanding = 'covered' | 'gap' | 'beyond' | 'untouched'

export function standingOf(
  nodeId: number,
  inPersonaMap: ReadonlySet<number>,
  reached: ReadonlySet<number>,
): NodeStanding {
  const inMap = inPersonaMap.has(nodeId)
  if (reached.has(nodeId)) return inMap ? 'covered' : 'beyond'
  return inMap ? 'gap' : 'untouched'
}

export interface ReachSummary {
  reached: Set<number>
  covered: number[]
  gaps: number[]
  beyond: number[]
  untouched: number[]
}

/**
 * The whole picture for one persona in a single pass.
 *
 * Reach is deliberately NOT intersected with the persona's own map: a programme
 * lights everything its behaviours address, so the overlay can show reach beyond
 * the life the persona currently describes.
 */
export function summariseForPersona(
  persona: Pick<CoveragePersona, 'characteristics' | 'applicabilityNodes'>,
  programmes: readonly Programme[],
  behaviours: Map<string, Behaviour>,
  allNodeIds: readonly number[],
): ReachSummary & { applicability: Applicability } {
  const applicability = classifyProgrammes(persona, programmes)
  const reached = reachOf(applicability.applies, behaviours)
  const inMap = new Set(persona.applicabilityNodes)

  const summary: ReachSummary = {
    reached,
    covered: [],
    gaps: [],
    beyond: [],
    untouched: [],
  }
  for (const id of allNodeIds) {
    const standing = standingOf(id, inMap, reached)
    if (standing === 'covered') summary.covered.push(id)
    else if (standing === 'gap') summary.gaps.push(id)
    else if (standing === 'beyond') summary.beyond.push(id)
    else summary.untouched.push(id)
  }
  return { ...summary, applicability }
}

/* ------------------------------------------------------------ provenance */

export interface NodeProvenance {
  /** Programmes reaching this node, with the behaviour that carried them there. */
  via: { programme: Programme; behaviour: Behaviour | null }[]
}

/**
 * Why a node is lit. `behaviour` is null where the programme pinned the node
 * directly, so the escape hatch stays visible rather than masquerading as a
 * behaviour mapping.
 */
export function provenanceOf(
  nodeId: number,
  programmes: readonly Programme[],
  behaviours: Map<string, Behaviour>,
): NodeProvenance {
  const via: NodeProvenance['via'] = []
  for (const programme of programmes) {
    for (const id of programme.addresses) {
      const behaviour = behaviours.get(id)
      if (behaviour?.nodes.includes(nodeId)) via.push({ programme, behaviour })
    }
    if (programme.extraNodes?.includes(nodeId)) via.push({ programme, behaviour: null })
  }
  return { via }
}
