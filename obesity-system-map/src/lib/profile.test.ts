import { describe, expect, it } from 'vitest'

import { connections, nodes } from '../data/systemMap'
import {
  createProfile,
  parseProfile,
  profileToJson,
  toggleEdge,
  toggleNode,
} from './profile'

describe('profiles', () => {
  it('toggles marks without mutating the original profile', () => {
    const original = createProfile('Persona A')
    const nodeId = nodes[0].id
    const connectionId = connections[0].id
    const marked = toggleEdge(toggleNode(original, nodeId), connectionId)

    expect(original.nodeIds.size).toBe(0)
    expect(original.edgeIds.size).toBe(0)
    expect(marked.nodeIds.has(nodeId)).toBe(true)
    expect(marked.edgeIds.has(connectionId)).toBe(true)
  })

  it('rejects JSON without a non-empty profile name', () => {
    expect(parseProfile(null)).toBeNull()
    expect(parseProfile({ name: '   ' })).toBeNull()
  })

  it('drops identifiers that are not in the current map', () => {
    const validNodeId = nodes[0].id
    const validEdgeId = connections[0].id
    const parsed = parseProfile({
      name: 'Imported',
      nodeIds: [validNodeId, 999_999],
      edgeIds: [validEdgeId, 'C-NOT-REAL'],
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.profile.nodeIds).toEqual(new Set([validNodeId]))
    expect(parsed?.profile.edgeIds).toEqual(new Set([validEdgeId]))
    expect(parsed?.droppedNodeIds).toEqual([999_999])
    expect(parsed?.droppedEdgeIds).toEqual(['C-NOT-REAL'])
  })

  it('auto-links variables only when edgeIds is omitted', () => {
    const connection = connections.find((item) => item.sourceId !== item.targetId)
    expect(connection).toBeDefined()

    const input = {
      name: 'Variables only',
      nodeIds: [connection!.sourceId, connection!.targetId],
    }
    const inferred = parseProfile(input)
    const explicit = parseProfile({ ...input, edgeIds: [] })

    expect(inferred?.profile.edgeIds.has(connection!.id)).toBe(true)
    expect(inferred?.autoLinkedEdgeIds).toContain(connection!.id)
    expect(explicit?.profile.edgeIds.size).toBe(0)
    expect(explicit?.autoLinkedEdgeIds).toEqual([])
  })

  it('exports a re-importable JSON representation', () => {
    const source = {
      ...createProfile('Persona A', 'Optional context'),
      characteristics: { age_band: '40-49', conditions: ['myopic'] },
      nodeIds: new Set([nodes[0].id]),
    }
    const restored = parseProfile(JSON.parse(profileToJson(source)))

    expect(restored?.profile.name).toBe(source.name)
    expect(restored?.profile.details).toBe(source.details)
    expect(restored?.profile.characteristics).toEqual(source.characteristics)
    expect(restored?.profile.nodeIds).toEqual(source.nodeIds)
  })
})
