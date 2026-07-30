import { connectionsById, nodesById } from '../data/systemMap'
import type { EdgeSelection } from '../data/systemMap'
import { DetailPanel, PanelSection } from './DetailPanel'

interface EdgeDetailPanelProps {
  edge: EdgeSelection | null
  onClose: () => void
  onSelectNode: (nodeId: number) => void
  onSelectConnection: (connectionId: string) => void
}

function DirectionBadge({ positive }: { positive: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
        positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
      ].join(' ')}
    >
      <span className="font-bold">{positive ? '+' : '−'}</span>
      {positive ? 'Positive' : 'Negative'}
    </span>
  )
}

/** Miniature of the legend's influence glyphs, so the panel matches the map. */
function InfluenceGlyph({ positive }: { positive: boolean }) {
  return (
    <svg viewBox="0 0 44 10" className="h-2.5 w-11 shrink-0" aria-hidden="true">
      {positive ? (
        <>
          <path d="M0 5h34" stroke="#231f20" strokeWidth="1" fill="none" />
          <path d="M33 1.6 42 5l-9 3.4z" fill="#231f20" />
        </>
      ) : (
        <>
          <path
            d="M0 5h35"
            stroke="#231f20"
            strokeWidth="1"
            strokeDasharray="2.2 1.8"
            fill="none"
          />
          <rect x="36" y="1.8" width="6.4" height="6.4" fill="#231f20" />
        </>
      )}
    </svg>
  )
}

function NodeButton({
  label,
  cluster,
  role,
  onClick,
}: {
  label: string
  cluster?: string
  role: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded border border-gray-200 px-2.5 py-2 text-left hover:bg-gray-50"
    >
      <span className="block text-[10px] uppercase tracking-wide text-gray-400">
        {role}
      </span>
      <span className="mt-0.5 block text-sm text-gray-800">{label}</span>
      {cluster && (
        <span className="mt-0.5 block text-[11px] text-gray-500">{cluster}</span>
      )}
    </button>
  )
}

export function EdgeDetailPanel({
  edge,
  onClose,
  onSelectNode,
  onSelectConnection,
}: EdgeDetailPanelProps) {
  const positive = edge?.connection.sign === 1

  return (
    <DetailPanel
      open={edge !== null}
      title={edge ? 'Connection' : ''}
      subtitle={
        edge && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-500">
              {edge.connection.id}
            </span>
            <DirectionBadge positive={positive} />
          </div>
        )
      }
      onClose={onClose}
    >
      {edge && (
        <>
          <PanelSection title="Source → Target">
            <div className="space-y-1.5">
              <NodeButton
                role="Source"
                label={edge.source?.label ?? `Node ${edge.connection.sourceId}`}
                cluster={edge.source?.mapCluster}
                onClick={() => onSelectNode(edge.connection.sourceId)}
              />
              <div className="flex items-center gap-2 pl-1 text-gray-500">
                <InfluenceGlyph positive={positive} />
                <span className="text-[11px]">
                  {positive ? 'positively influences' : 'negatively influences'}
                </span>
              </div>
              <NodeButton
                role="Target"
                label={edge.target?.label ?? `Node ${edge.connection.targetId}`}
                cluster={edge.target?.mapCluster}
                onClick={() => onSelectNode(edge.connection.targetId)}
              />
            </div>
          </PanelSection>

          {/* No prose "Direction" section: the +/− badge in the header and the
              arrow glyph between the two nodes already carry it. */}

          {edge.sharesLineWith.length > 0 && (
            <PanelSection
              title="Shares this line with"
              count={edge.sharesLineWith.length}
            >
              <p className="mb-2 text-xs text-gray-500">
                One drawn trunk carries these connections, so clicking it cannot
                distinguish between them.
              </p>
              <ul className="space-y-1">
                {edge.sharesLineWith.map((id) => {
                  const other = connectionsById.get(id)
                  const target = other && nodesById.get(other.targetId)
                  const source = other && nodesById.get(other.sourceId)
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => onSelectConnection(id)}
                        className="flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-gray-100"
                      >
                        <span className="font-mono text-[11px] text-gray-400">
                          {id}
                        </span>
                        <span className="flex-1 text-gray-700">
                          {source?.label} → {target?.label}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </PanelSection>
          )}
        </>
      )}
    </DetailPanel>
  )
}
