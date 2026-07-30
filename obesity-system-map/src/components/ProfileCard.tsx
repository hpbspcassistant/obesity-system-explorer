import { useEffect, useRef } from 'react'

import { NO_DEFINITION, definitionOf } from '../data/systemMap'
import type { EdgeSelection } from '../data/systemMap'
import type { AnchorRect } from './MapView'
import { ConnectionRow, InfluenceTag } from './ProfileControls'
import type { Connection, Node } from '../types'

/**
 * The marking surface, floated beside the factor it describes.
 *
 * This replaces a 368px side panel that was pinned to the right edge for the
 * whole session. That panel cost the same screen area whether or not anything
 * was open, and at fit zoom it covered eleven factors — a coherent block of the
 * physical-activity environment — which could then never be clicked. A card
 * that appears at the thing you clicked and leaves when you dismiss it costs
 * nothing the rest of the time, and never hides a fixed region of the map.
 *
 * Everything here is explicit. Opening a factor does not mark it; the button
 * marks it. That is the whole difference between browsing and editing, and it
 * used to be missing — a click on the map toggled the mark, so re-reading a
 * factor you had already marked silently unmarked it.
 */

const CARD_W = 288
const MAX_H = 380
/** Gap between the node box and the card, and from the viewport edge. */
const GAP = 14
const EDGE_PAD = 10

interface Placement {
  left: number
  top: number
}

/**
 * Prefers the right of the box, flips left when that would overflow, and
 * finally clamps into view. Vertically it centres on the box and clamps, so a
 * factor near the top or bottom of the map still gets a whole card.
 */
function place(
  anchor: AnchorRect,
  container: { width: number; height: number },
  height: number,
): Placement {
  const roomRight = container.width - (anchor.x + anchor.w) - GAP
  const left =
    roomRight >= CARD_W + EDGE_PAD
      ? anchor.x + anchor.w + GAP
      : anchor.x - GAP - CARD_W

  const top = anchor.y + anchor.h / 2 - height / 2

  return {
    left: Math.min(
      Math.max(left, EDGE_PAD),
      Math.max(EDGE_PAD, container.width - CARD_W - EDGE_PAD),
    ),
    top: Math.min(
      Math.max(top, EDGE_PAD),
      Math.max(EDGE_PAD, container.height - height - EDGE_PAD),
    ),
  }
}

export interface ProfileCardProps {
  anchor: AnchorRect | null
  container: { width: number; height: number }
  /** Exactly one of these is set; the card shape is the same for both. */
  node: Node | null
  edge: EdgeSelection | null
  outgoing: readonly Connection[]
  incoming: readonly Connection[]
  markedNodeIds: ReadonlySet<number>
  markedEdgeIds: ReadonlySet<string>
  onToggleNode: (nodeId: number) => void
  onToggleEdge: (connectionId: string) => void
  onSelectNode: (nodeId: number) => void
  onClose: () => void
}

export function ProfileCard({
  anchor,
  container,
  node,
  edge,
  outgoing,
  incoming,
  markedNodeIds,
  markedEdgeIds,
  onToggleNode,
  onToggleEdge,
  onSelectNode,
  onClose,
}: ProfileCardProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // A card reused for a different factor must start at the top, or the new
  // factor's name is scrolled out of sight and it reads as a dead click.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [node?.id, edge?.connection.id])

  if (!node && !edge) return null

  // Edge cards are short and fixed-length; node cards grow with the
  // connection list, so they are measured against the cap instead.
  const rows = outgoing.length + incoming.length
  const height = edge ? 200 : Math.min(MAX_H, 186 + rows * 22)
  const { left, top } = anchor
    ? place(anchor, container, height)
    : { left: container.width - CARD_W - EDGE_PAD, top: EDGE_PAD }

  return (
    <div
      role="dialog"
      aria-label={node ? node.label : 'Connection'}
      style={{ left, top, width: CARD_W, maxHeight: height }}
      className="absolute z-20 flex flex-col overflow-hidden rounded-xl border border-gray-300 bg-white shadow-[0_8px_28px_-6px_rgba(0,0,0,0.26)]"
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {node ? (
          <NodeBody
            node={node}
            outgoing={outgoing}
            incoming={incoming}
            marked={markedNodeIds.has(node.id)}
            markedEdgeIds={markedEdgeIds}
            onToggleNode={onToggleNode}
            onToggleEdge={onToggleEdge}
            onSelectNode={onSelectNode}
          />
        ) : edge ? (
          <EdgeBody
            edge={edge}
            marked={markedEdgeIds.has(edge.connection.id)}
            markedNodeIds={markedNodeIds}
            onToggleEdge={onToggleEdge}
            onSelectNode={onSelectNode}
          />
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        title="Close (Esc)"
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
          <path
            d="M2.5 2.5l7 7M9.5 2.5l-7 7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}

/** The primary act of the whole mode, so it is the card's biggest control. */
function MarkButton({
  marked,
  onClick,
  what,
}: {
  marked: boolean
  onClick: () => void
  what: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={marked}
      className={[
        'flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
        marked
          ? 'bg-gray-900 text-white hover:bg-gray-700'
          : 'border border-gray-400 bg-white text-gray-900 hover:bg-gray-100',
      ].join(' ')}
    >
      {marked ? (
        <>
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
            <path
              d="M2.5 6.5l2.5 2.5 4.5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          Marked — click to remove
        </>
      ) : (
        `Mark this ${what}`
      )}
    </button>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </p>
  )
}

function NodeBody({
  node,
  outgoing,
  incoming,
  marked,
  markedEdgeIds,
  onToggleNode,
  onToggleEdge,
  onSelectNode,
}: {
  node: Node
  outgoing: readonly Connection[]
  incoming: readonly Connection[]
  marked: boolean
  markedEdgeIds: ReadonlySet<string>
  onToggleNode: (nodeId: number) => void
  onToggleEdge: (connectionId: string) => void
  onSelectNode: (nodeId: number) => void
}) {
  return (
    <div className="px-3 pb-3 pt-2.5">
      <h3 className="pr-6 text-[13.5px] font-semibold leading-tight text-gray-900">
        {node.label}
      </h3>
      <p className="mb-2 mt-0.5 text-[10.5px] uppercase tracking-wide text-gray-400">
        {node.mapCluster}
      </p>

      <MarkButton
        marked={marked}
        onClick={() => onToggleNode(node.id)}
        what="factor"
      />

      {definitionOf(node) ? (
        <p className="mt-2 text-[11.5px] leading-relaxed text-gray-600">
          {definitionOf(node)}
        </p>
      ) : (
        <p className="mt-2 text-[11.5px] italic leading-relaxed text-gray-400">
          {NO_DEFINITION}
        </p>
      )}

      {outgoing.length > 0 && (
        <>
          <Heading>Affects ({outgoing.length})</Heading>
          <ul>
            {outgoing.map((connection) => (
              <ConnectionRow
                key={connection.id}
                connection={connection}
                direction="out"
                marked={markedEdgeIds.has(connection.id)}
                onToggle={() => onToggleEdge(connection.id)}
                onSelectNode={onSelectNode}
              />
            ))}
          </ul>
        </>
      )}

      {incoming.length > 0 && (
        <>
          <Heading>Affected by ({incoming.length})</Heading>
          <ul>
            {incoming.map((connection) => (
              <ConnectionRow
                key={connection.id}
                connection={connection}
                direction="in"
                marked={markedEdgeIds.has(connection.id)}
                onToggle={() => onToggleEdge(connection.id)}
                onSelectNode={onSelectNode}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function EdgeBody({
  edge,
  marked,
  markedNodeIds,
  onToggleEdge,
  onSelectNode,
}: {
  edge: EdgeSelection
  marked: boolean
  markedNodeIds: ReadonlySet<number>
  onToggleEdge: (connectionId: string) => void
  onSelectNode: (nodeId: number) => void
}) {
  const { connection, source, target } = edge
  const end = (node: typeof source, role: string) =>
    node ? (
      <button
        type="button"
        onClick={() => onSelectNode(node.id)}
        title={`Open ${node.label}`}
        className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-gray-50"
      >
        <span
          aria-hidden="true"
          className={[
            'h-2 w-2 shrink-0 rounded-[2px]',
            markedNodeIds.has(node.id)
              ? 'bg-gray-900'
              : 'border border-gray-300 bg-white',
          ].join(' ')}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[9.5px] uppercase tracking-wide text-gray-400">
            {role}
          </span>
          <span className="block truncate text-[12px] text-gray-700">
            {node.label}
          </span>
        </span>
      </button>
    ) : null

  return (
    <div className="px-3 pb-3 pt-2.5">
      <div className="flex items-baseline gap-1.5 pr-6">
        <h3 className="text-[13.5px] font-semibold leading-tight text-gray-900">
          Connection
        </h3>
        <InfluenceTag connection={connection} />
      </div>
      <p className="mb-2 mt-0.5 text-[10.5px] text-gray-400">
        {connection.influence === 'positive'
          ? 'More of one, more of the other'
          : 'More of one, less of the other'}
      </p>

      <MarkButton
        marked={marked}
        onClick={() => onToggleEdge(connection.id)}
        what="connection"
      />

      <div className="mt-2">
        {end(source, 'from')}
        {end(target, 'to')}
      </div>

      {/* A single drawn line can carry several connections, so a click here
          resolved to one of them. Say so rather than implying it was exact. */}
      {edge.sharesLineWith.length > 0 && (
        <p className="mt-1.5 text-[10.5px] leading-snug text-amber-700">
          This line also carries {edge.sharesLineWith.length} other connection
          {edge.sharesLineWith.length === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  )
}
