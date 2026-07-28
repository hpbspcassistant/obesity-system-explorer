import type { Connection, Node } from '../types'
import { nodesById } from '../data/systemMap'

interface NodeDetailPanelProps {
  node: Node | null
  outgoing: readonly Connection[]
  incoming: readonly Connection[]
  onClose: () => void
  onSelectNode: (nodeId: number) => void
}

function InfluenceTag({ connection }: { connection: Connection }) {
  const positive = connection.sign === 1
  return (
    <span
      className={[
        'ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        positive
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-rose-50 text-rose-700',
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
  onSelectNode,
}: {
  title: string
  connections: readonly Connection[]
  direction: 'out' | 'in'
  onSelectNode: (nodeId: number) => void
}) {
  return (
    <section className="border-t border-gray-200 px-5 py-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
        <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
          {connections.length}
        </span>
      </h3>

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
                <button
                  type="button"
                  onClick={() => onSelectNode(otherId)}
                  className="flex w-full items-start rounded px-1.5 py-1 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  <span className="mr-1.5 shrink-0 text-gray-400">
                    {direction === 'out' ? '→' : '←'}
                  </span>
                  <span className="flex-1">{other?.label ?? `Node ${otherId}`}</span>
                  <InfluenceTag connection={connection} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function NodeDetailPanel({
  node,
  outgoing,
  incoming,
  onClose,
  onSelectNode,
}: NodeDetailPanelProps) {
  return (
    <aside
      aria-hidden={!node}
      className={[
        'absolute inset-y-0 right-0 z-10 flex w-[22rem] max-w-[85vw] flex-col',
        'border-l border-gray-200 bg-white shadow-xl',
        'transition-transform duration-300 ease-out',
        node ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
    >
      {node && (
        <>
          <header className="flex items-start justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold leading-snug text-gray-900">
                {node.label}
              </h2>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                {node.mapCluster}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="-mr-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <section className="border-t border-gray-200 px-5 py-4">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Definition
              </h3>
              <p className="text-sm leading-relaxed text-gray-700">
                {node.definition}
              </p>
            </section>

            <ConnectionList
              title="Outgoing"
              connections={outgoing}
              direction="out"
              onSelectNode={onSelectNode}
            />
            <ConnectionList
              title="Incoming"
              connections={incoming}
              direction="in"
              onSelectNode={onSelectNode}
            />
          </div>
        </>
      )}
    </aside>
  )
}
