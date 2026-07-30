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
]

export const DEFAULT_MODE: MapMode = 'explore'

export interface TraceDirectionMeta {
  id: TraceDirection
  label: string
  /** Plain-language expansion, surfaced as the control's tooltip. */
  description: string
}

/**
 * Direction is chosen before tracing, because it decides what the click means:
 * picking a cause and looking outward is a different question from picking an
 * outcome and looking back at what feeds it.
 */
export const TRACE_DIRECTIONS: readonly TraceDirectionMeta[] = [
  {
    id: 'downstream',
    label: 'This affects what →',
    description: 'Follow the arrows outward from a cause to what it influences.',
  },
  {
    id: 'upstream',
    label: '← This is affected by what',
    description: 'Follow the arrows backward from an outcome to what feeds into it.',
  },
  {
    id: 'loops',
    label: '↻ Reinforcing loops',
    description:
      'Find loops that leave a factor and come back to it, strengthening themselves on the way round.',
  },
]

export const DEFAULT_TRACE_DIRECTION: TraceDirection = 'downstream'
