import { describe, expect, it } from 'vitest'

import {
  CONDITIONS_KEY,
  allProgrammes,
  conditionValues,
  coreCharacteristics,
} from './intervention'
import { connections, nodes } from './systemMap'
import type { GateClause, GateValue } from '../lib/reach'

const asValues = (value: GateValue | readonly GateValue[]): readonly GateValue[] =>
  Array.isArray(value) ? (value as readonly GateValue[]) : [value as GateValue]

describe('shipped data integrity', () => {
  it('has unique nodes and connections with valid endpoints', () => {
    const nodeIds = new Set(nodes.map((node) => node.id))
    const connectionIds = new Set(connections.map((connection) => connection.id))

    expect(nodeIds.size).toBe(nodes.length)
    expect(connectionIds.size).toBe(connections.length)
    for (const connection of connections) {
      expect(nodeIds.has(connection.sourceId), connection.id).toBe(true)
      expect(nodeIds.has(connection.targetId), connection.id).toBe(true)
      expect(['positive', 'negative']).toContain(connection.influence)
    }
  })

  it('maps every programme to valid nodes with an explanation', () => {
    const nodeIds = new Set(nodes.map((node) => node.id))
    const programmeIds = new Set(allProgrammes.map((programme) => programme.id))

    expect(programmeIds.size).toBe(allProgrammes.length)
    for (const programme of allProgrammes) {
      expect(programme.name.trim(), programme.id).not.toBe('')
      for (const node of programme.nodes) {
        expect(nodeIds.has(node.id), `${programme.id} -> ${node.id}`).toBe(true)
        expect(node.reason.trim(), `${programme.id} -> ${node.id}`).not.toBe('')
      }
    }
  })

  it('uses only controlled characteristic names and values in gates', () => {
    const allowed = new Map<string, Set<GateValue>>(
      Object.entries(coreCharacteristics).map(([key, values]) => [
        key,
        new Set(values.filter((value): value is GateValue => value !== null)),
      ]),
    )
    allowed.set(CONDITIONS_KEY, new Set(conditionValues))

    for (const programme of allProgrammes) {
      if (programme.gate === 'everyone') continue
      const clauses: readonly GateClause[] = Array.isArray(programme.gate)
        ? (programme.gate as readonly GateClause[])
        : [programme.gate as GateClause]

      for (const clause of clauses) {
        for (const [key, gateValue] of Object.entries(clause)) {
          expect(allowed.has(key), `${programme.id}: ${key}`).toBe(true)
          for (const value of asValues(gateValue)) {
            expect(
              allowed.get(key)?.has(value),
              `${programme.id}: ${key}=${String(value)}`,
            ).toBe(true)
          }
        }
      }
    }
  })
})
