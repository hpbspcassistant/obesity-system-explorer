import type { Connection, Node } from '../types'
import { nodesById } from '../data/systemMap'
import { DetailPanel, PanelSection } from './DetailPanel'

interface NodeDetailPanelProps {
  node: Node | null
  outgoing: readonly Connection[]
  incoming: readonly Connection[]
  onClose: () => void
  onSelectNode: (nodeId: number) => void
  onSelectConnection: (connectionId: string) => void
}

function InfluenceTag({ connection }: { connection: Connection }) {
  const positive = connection.sign === 1
  return (
    <span
      className={[
        'ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
      ].join(' ')}
    >
      {connection.influence}
    </span>
  )
}

function ConnectionList({
  title,
  connections,
  direction,
  onSelectConnection,
}: {
  title: string
  connections: readonly Connection[]
  direction: 'out' | 'in'
  onSelectConnection: (connectionId: string) => void
}) {
  return (
    <PanelSection title={title} count={connections.length}>
      {connections.length === 0 ? (
        <p className="text-sm text-gray-400">None</p>
      ) : (
        <ul className="space-y-1">
          {connections.map((connection) => {
            const otherId =
              direction === 'out' ? connection.targetId : connection.sourceId
            const other = nodesById.get(otherId)
            return (
              <li key={connection.id}>
                {/* Selects the connection, not the node: the list is about
                    edges, and the edge panel links on to both endpoints. */}
                <button
                  type="button"
                  onClick={() => onSelectConnection(connection.id)}
                  className="flex w-full items-start rounded px-1.5 py-1 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  <span className="mr-1.5 shrink-0 text-gray-400">
                    {direction === 'out' ? '→' : '←'}
                  </span>
                  <span className="flex-1">
                    {other?.label ?? `Node ${otherId}`}
                  </span>
                  <InfluenceTag connection={connection} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </PanelSection>
  )
}

export function NodeDetailPanel({
  node,
  outgoing,
  incoming,
  onClose,
  onSelectConnection,
}: NodeDetailPanelProps) {
  return (
    <DetailPanel
      open={node !== null}
      title={node?.label ?? ''}
      subtitle={
        node && (
          // Two distinct taxonomies, so both are named rather than one being
          // shown bare as "the cluster": mapCluster is the artwork's colour
          // grouping, atlasCluster is the Foresight atlas's own classification.
          <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
            <div className="flex gap-1">
              <dt className="text-gray-400">Cluster</dt>
              <dd className="font-medium text-gray-700">{node.atlasCluster}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-gray-400">Type</dt>
              <dd className="font-medium text-gray-700">{node.mapCluster}</dd>
            </div>
          </dl>
        )
      }
      onClose={onClose}
    >
      {node && (
        <>
          <PanelSection title="Definition">
            <p className="text-sm leading-relaxed text-gray-700">
              {node.definition}
            </p>
          </PanelSection>

          <ConnectionList
            title="Outgoing"
            connections={outgoing}
            direction="out"
            onSelectConnection={onSelectConnection}
          />
          <ConnectionList
            title="Incoming"
            connections={incoming}
            direction="in"
            onSelectConnection={onSelectConnection}
          />
        </>
      )}
    </DetailPanel>
  )
}
