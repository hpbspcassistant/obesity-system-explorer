import type { MapMode, TraceDirection } from '../types'

/**
 * The three tools. Explore is home base and the default: read-only looking
 * around. Trace and Profile change what a click does.
 */
export interface ModeMeta {
  id: MapMode
  label: string
}

export const MODES: readonly ModeMeta[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'trace', label: 'Trace' },
  { id: 'profile', label: 'Profile' },
  { id: 'intervention', label: 'Intervention' },
]

export const DEFAULT_MODE: MapMode = 'explore'

export interface TraceDirectionMeta {
  id: TraceDirection
  label: string
  /** Plain-language expansion, surfaced as the control's tooltip. */
  description: string
}

/**
 * Each direction asks a different question of the same starting variable. The
 * panel defaults to downstream, then offers all three together after a variable
 * is chosen.
 */
export const TRACE_DIRECTIONS: readonly TraceDirectionMeta[] = [
  {
    id: 'downstream',
    label: 'Affects →',
    description: 'Follow the arrows outward from a cause to what it influences.',
  },
  {
    id: 'upstream',
    label: '← Affected by',
    description: 'Follow the arrows backward from an outcome to what feeds into it.',
  },
  {
    id: 'loops',
    label: '↻ Loops',
    description:
      'Find loops that leave a variable and come back to it, strengthening themselves on the way round.',
  },
]

export const DEFAULT_TRACE_DIRECTION: TraceDirection = 'downstream'
