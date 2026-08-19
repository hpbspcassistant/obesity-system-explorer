import { describe, expect, it } from 'vitest'

import { testGate, type Gate } from './reach'

describe('testGate', () => {
  it('admits an everyone gate', () => {
    expect(testGate('everyone', {})).toBe('applies')
  })

  it('keeps missing characteristics distinct from exclusions', () => {
    const gate = { age_band: ['40-49', '50-59'] }

    expect(testGate(gate, {})).toBe('undetermined')
    expect(testGate(gate, { age_band: '25-39' })).toBe('excluded')
    expect(testGate(gate, { age_band: '50-59' })).toBe('applies')
  })

  it('requires every field in a clause', () => {
    const gate = { role: 'working', work_type: 'manual-industrial' }

    expect(
      testGate(gate, { role: 'working', work_type: 'manual-industrial' }),
    ).toBe('applies')
    expect(testGate(gate, { role: 'working', work_type: 'employee' })).toBe(
      'excluded',
    )
  })

  it('admits any matching OR clause and overlaps multi-valued conditions', () => {
    const gate: Gate = [
      { role: 'retired' },
      { conditions: ['frailty-or-falls-risk', 'overweight-high-risk'] },
    ]

    expect(testGate(gate, { role: 'working', conditions: ['frailty-or-falls-risk'] })).toBe(
      'applies',
    )
    expect(testGate(gate, { role: 'working', conditions: ['myopic'] })).toBe(
      'excluded',
    )
  })
})
