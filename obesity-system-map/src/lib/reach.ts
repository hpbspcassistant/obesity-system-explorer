/**
 * Which HPB programmes apply to a persona, and which parts of the map they reach.
 *
 * Two links, deliberately kept apart:
 *
 *   persona -> programme   decided by the programme's gate, a rule over the
 *                          persona's characteristics. Computed every time and
 *                          never stored.
 *   programme -> map       direct. A programme names node ids and each carries a
 *                          human-readable reason for the link.
 *
 * Everything here takes its data as arguments, and nothing in this module knows
 * a single programme name or node number. The inventory is generated from a
 * spreadsheet that is still being corrected, so it has to be replaceable without
 * touching a line of this file.
 */

/**
 * What a persona holds for one characteristic.
 *
 * Three states, not two, and the third is the reason this is not just a string:
 *
 *   a value      the persona is this
 *   null         the characteristic does not apply to this person
 *   absent       nobody has decided yet
 *
 * `conditions` is the one multi-valued field — a persona carries the flags it
 * has — so its value is an array and a gate matches on any overlap.
 */
export type CharacteristicValue = string | boolean | null | readonly string[]

export type PersonaCharacteristics = Readonly<
  Record<string, CharacteristicValue>
>

/**
 * Either "everyone", one clause, or a list of clauses any one of which lets a
 * persona in.
 *
 * Within a clause, keys are an AND and the values within a key are an OR. Gates
 * never name null: "does not apply" is something a persona says about itself,
 * not something a programme asks for.
 *
 * The list exists because the real inventory has audiences a single clause
 * cannot describe. "Students, staff and parents" is three unrelated groups, and
 * a clause can only AND them — which would mean a parent who is also a teacher
 * and a child, matching nobody. Narrowing to the first-named group instead was
 * the other option, and it silently states as fact that the programme does not
 * reach the other two.
 */
export type GateValue = string | boolean
export type GateClause = Readonly<
  Record<string, GateValue | readonly GateValue[]>
>
export type Gate = 'everyone' | GateClause | readonly GateClause[]

export interface ProgrammeNode {
  id: number
  reason: string
}

export interface Programme {
  id: string
  name: string
  source: string
  gate: Gate
  nodes: readonly ProgrammeNode[]
  /**
   * Where the eligibility rule came from, in the words of the inventory. Carried
   * so the machine gate beside it can be checked rather than trusted: every one
   * was translated by hand out of a sentence like "adults aged 50 and over".
   */
  gateSource?: string
  /** 'ended' programmes are kept for the record and reach nothing. */
  status?: 'current' | 'verify' | 'ended'
}

export interface InterventionPersona {
  id: string
  name: string
  characteristics: PersonaCharacteristics
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
  value: GateValue | readonly GateValue[],
): readonly GateValue[] => (Array.isArray(value) ? value : [value as GateValue])

/**
 * Whether one characteristic satisfies one clause of a gate.
 *
 * `null` — the characteristic does not apply to this person — excludes rather
 * than passes. It is tempting to read "not applicable" as "do not judge me on
 * this", but that makes a young child whose smoker status is marked N/A match a
 * smoking-cessation programme, which is the opposite of what marking it N/A
 * meant. A deliberate N/A is a definite negative for that trait; only an
 * undecided one is a question.
 */
function clauseVerdict(
  held: CharacteristicValue | undefined,
  allowed: GateValue | readonly GateValue[],
): GateVerdict {
  if (held === undefined) return 'undetermined'
  if (held === null) return 'excluded'
  const wanted = asList(allowed)
  // The multi-valued field: the persona carries a set, so any overlap matches.
  if (Array.isArray(held)) {
    return held.some((flag) => wanted.includes(flag)) ? 'applies' : 'excluded'
  }
  return wanted.includes(held as GateValue) ? 'applies' : 'excluded'
}

/** One clause: every key must be satisfied, so a single failure ends it. */
function testClause(
  clause: GateClause,
  characteristics: PersonaCharacteristics,
): GateVerdict {
  let undetermined = false
  for (const [characteristic, allowed] of Object.entries(clause)) {
    const verdict = clauseVerdict(characteristics[characteristic], allowed)
    // Keep testing rather than returning on the first unknown: a later key
    // may rule the programme out outright, which is a firmer answer than
    // "cannot say" and should win.
    if (verdict === 'excluded') return 'excluded'
    if (verdict === 'undetermined') undetermined = true
  }
  return undetermined ? 'undetermined' : 'applies'
}

/**
 * Clauses are an OR, so the certainties invert: one clause that lets the persona
 * in settles it, and "cannot say" only survives when no clause admits them and
 * at least one could not be judged.
 */
export function testGate(
  gate: Gate,
  characteristics: PersonaCharacteristics,
): GateVerdict {
  if (gate === 'everyone') return 'applies'
  const clauses: readonly GateClause[] = Array.isArray(gate)
    ? (gate as readonly GateClause[])
    : [gate as GateClause]

  let undetermined = false
  for (const clause of clauses) {
    const verdict = testClause(clause, characteristics)
    if (verdict === 'applies') return 'applies'
    if (verdict === 'undetermined') undetermined = true
  }
  return undetermined ? 'undetermined' : 'excluded'
}

export interface Applicability {
  applies: Programme[]
  excluded: Programme[]
  undetermined: Programme[]
}

export function classifyProgrammes(
  persona: Pick<InterventionPersona, 'characteristics'>,
  programmes: readonly Programme[],
): Applicability {
  const out: Applicability = { applies: [], excluded: [], undetermined: [] }
  for (const programme of programmes) {
    out[testGate(programme.gate, persona.characteristics)].push(programme)
  }
  return out
}

/* --------------------------------------------------------------- reach */

/** Every node one programme reaches. */
export function nodesOfProgramme(programme: Programme): number[] {
  return programme.nodes.map((n) => n.id)
}

/** The union across a set of programmes. */
export function reachOf(programmes: readonly Programme[]): Set<number> {
  const reached = new Set<number>()
  for (const programme of programmes) {
    for (const n of programme.nodes) reached.add(n.id)
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
): Set<number> {
  const reached = reachOf(programmes)
  return new Set(allNodeIds.filter((id) => !reached.has(id)))
}

/* ----------------------------------------------------- per-node accounting */

/**
 * How a node stands relative to one persona: two questions crossed.
 *
 *                        reached          not reached
 *   in their map         covered          gap
 *   not in their map     beyond           untouched
 *
 * `gap` is the one the view is built around, and it means exactly what the grid
 * says — in this persona's map, and nothing that applies to them reaches it. No
 * further qualification.
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
 * lights everything its nodes address, so the overlay can show reach beyond
 * the life the persona currently describes.
 */
export function summariseForPersona(
  persona: Pick<InterventionPersona, 'characteristics' | 'applicabilityNodes'>,
  programmes: readonly Programme[],
  allNodeIds: readonly number[],
): ReachSummary & { applicability: Applicability } {
  const applicability = classifyProgrammes(persona, programmes)
  const reached = reachOf(applicability.applies)
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
  /** Programmes reaching this node, with the reason each maps to it. */
  via: { programme: Programme; reason: string }[]
}

/**
 * Why a node is lit: which programmes reach it, and why each one claims to.
 */
export function provenanceOf(
  nodeId: number,
  programmes: readonly Programme[],
): NodeProvenance {
  const via: NodeProvenance['via'] = []
  for (const programme of programmes) {
    const match = programme.nodes.find((n) => n.id === nodeId)
    if (match) via.push({ programme, reason: match.reason })
  }
  return { via }
}
