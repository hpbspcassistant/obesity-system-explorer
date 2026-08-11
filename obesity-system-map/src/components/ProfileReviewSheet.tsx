import { connectionsById, nodesById, variableTypes } from '../data/systemMap'
import {
  TOTAL_CONNECTIONS,
  TOTAL_NODES,
  connectionLabel,
  markedByCluster,
} from '../lib/profile'
import type { Profile } from '../lib/profile'
import { InfluenceTag, MarkToggle } from './ProfileControls'

/**
 * Everything in the profile, on demand.
 *
 * The old panel kept this permanently open and permanently in the way, and it
 * was incomplete: marked connections were counted but never listed, so the only
 * way to remove one was to navigate back to a variable at one of its ends and
 * find it in that variable's list. Here both halves of the profile are reviewable
 * and both are undoable in place.
 */

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string
  count: number
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 flex-1 border-l border-gray-100 px-4 py-3 first:border-l-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {title}{' '}
          <span className="font-normal tabular-nums text-gray-400">{count}</span>
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] leading-relaxed text-gray-400">{children}</p>
  )
}

export interface ProfileReviewSheetProps {
  profile: Profile
  missingLinkIds: readonly string[]
  onToggleNode: (nodeId: number) => void
  onToggleEdge: (connectionId: string) => void
  onSelectNode: (nodeId: number) => void
  onSelectConnection: (connectionId: string) => void
  onMarkAllLinks: () => void
  onClose: () => void
}

export function ProfileReviewSheet({
  profile,
  missingLinkIds,
  onToggleNode,
  onToggleEdge,
  onSelectNode,
  onSelectConnection,
  onMarkAllLinks,
  onClose,
}: ProfileReviewSheetProps) {
  const groups = markedByCluster(profile)
  const edges = [...profile.edgeIds]
    .map((id) => connectionsById.get(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => connectionLabel(a).localeCompare(connectionLabel(b)))

  return (
    <div
      role="region"
      aria-label="Profile review"
      className="absolute inset-x-0 bottom-12 z-20 max-h-[45vh] overflow-y-auto border-t border-gray-200 bg-white/97 shadow-[0_-8px_28px_-10px_rgba(0,0,0,0.2)]"
    >
      <div className="flex items-start">
        <Section title="Variables" count={profile.nodeIds.size}>
          {groups.length === 0 ? (
            <Empty>
              Nothing marked yet. Click a variable on the map to open it.
            </Empty>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <div key={group.name}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {group.name} ({group.nodeIds.length})
                  </p>
                  <ul className="mt-0.5">
                    {group.nodeIds.map((id) => (
                      <li
                        key={id}
                        className="flex items-center gap-1.5 rounded px-1 py-[3px] hover:bg-gray-50"
                      >
                        <MarkToggle
                          marked
                          onChange={() => onToggleNode(id)}
                          label={`Unmark ${nodesById.get(id)?.label ?? id}`}
                        />
                        <button
                          type="button"
                          onClick={() => onSelectNode(id)}
                          className="flex-1 truncate text-left text-[12px] text-gray-700 hover:text-gray-900 hover:underline"
                        >
                          {nodesById.get(id)?.label ?? id}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 border-t border-gray-100 pt-1.5 text-[11px] text-gray-400">
            {profile.nodeIds.size} of {TOTAL_NODES} variables · {groups.length} of{' '}
            {variableTypes.length} clusters
          </p>
        </Section>

        <Section title="Connections" count={profile.edgeIds.size}>
          {edges.length === 0 ? (
            <Empty>
              Open a variable and tick the connections that matter for this person.
            </Empty>
          ) : (
            <ul>
              {edges.map((connection) => (
                <li
                  key={connection.id}
                  className="flex items-center gap-1.5 rounded px-1 py-[3px] hover:bg-gray-50"
                >
                  <MarkToggle
                    marked
                    onChange={() => onToggleEdge(connection.id)}
                    label={`Unmark ${connectionLabel(connection)}`}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectConnection(connection.id)}
                    className="flex-1 truncate text-left text-[12px] text-gray-700 hover:text-gray-900 hover:underline"
                  >
                    {connectionLabel(connection)}
                  </button>
                  <InfluenceTag connection={connection} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 border-t border-gray-100 pt-1.5 text-[11px] text-gray-400">
            {profile.edgeIds.size} of {TOTAL_CONNECTIONS} connections
          </p>
        </Section>

        <Section
          title="Unmarked links"
          count={missingLinkIds.length}
          action={
            missingLinkIds.length > 1 && (
              <button
                type="button"
                onClick={onMarkAllLinks}
                className="text-[11px] font-medium text-gray-900 hover:underline"
              >
                Mark all
              </button>
            )
          }
        >
          {missingLinkIds.length === 0 ? (
            <Empty>
              None. Every connection between two marked variables is either marked
              or does not exist.
            </Empty>
          ) : (
            <>
              <p className="mb-1.5 text-[11px] leading-relaxed text-gray-500">
                Both ends are marked but the link is not. Each one is drawn on
                the map with a dot on it — click the dot to accept, or leave it.
              </p>
              <ul>
                {missingLinkIds.map((id) => {
                  const connection = connectionsById.get(id)
                  if (!connection) return null
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-1.5 rounded px-1 py-[3px] hover:bg-gray-50"
                    >
                      <MarkToggle
                        marked={false}
                        onChange={() => onToggleEdge(id)}
                        label={`Mark ${connectionLabel(connection)}`}
                      />
                      <button
                        type="button"
                        onClick={() => onSelectConnection(id)}
                        className="flex-1 truncate text-left text-[12px] text-gray-700 hover:text-gray-900 hover:underline"
                      >
                        {connectionLabel(connection)}
                      </button>
                      <InfluenceTag connection={connection} />
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </Section>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close review"
        title="Close review"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
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
