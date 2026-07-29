import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ClusterLegend } from './components/ClusterLegend'
import { MapHeader } from './components/MapHeader'
import { MapView, type MapViewHandle } from './components/MapView'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { SearchBar } from './components/SearchBar'
import {
  clusterNames,
  incomingByNode,
  nodesById,
  outgoingByNode,
} from './data/systemMap'
import type { Connection } from './types'

const EMPTY: readonly Connection[] = Object.freeze([])
const NONE_HIDDEN: ReadonlySet<string> = Object.freeze(new Set<string>())

export default function App() {
  const mapRef = useRef<MapViewHandle | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null)
  const [hiddenClusters, setHiddenClusters] =
    useState<ReadonlySet<string>>(NONE_HIDDEN)

  /** Clicking the selected node again, or empty space, clears the selection. */
  const handleNodeClick = useCallback((nodeId: number | null) => {
    setSelectedNodeId((current) => (nodeId === current ? null : nodeId))
  }, [])

  const clearSelection = useCallback(() => setSelectedNodeId(null), [])

  const toggleCluster = useCallback((name: string) => {
    setHiddenClusters((current) => {
      const next = new Set(current)
      if (!next.delete(name)) next.add(name)
      return next
    })
  }, [])

  /**
   * Search can surface a node whose cluster is filtered out. Selecting it would
   * otherwise be a dead click — the filter effect clears the selection straight
   * away — so reveal that cluster first.
   */
  const selectFromSearch = useCallback((nodeId: number) => {
    const cluster = nodesById.get(nodeId)?.mapCluster
    if (cluster) {
      setHiddenClusters((current) => {
        if (!current.has(cluster)) return current
        const next = new Set(current)
        next.delete(cluster)
        return next
      })
    }
    setSelectedNodeId(nodeId)
  }, [])

  const showAllClusters = useCallback(() => setHiddenClusters(NONE_HIDDEN), [])
  const hideAllClusters = useCallback(
    () => setHiddenClusters(new Set(clusterNames)),
    [],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedNodeId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectedNode =
    selectedNodeId === null ? null : (nodesById.get(selectedNodeId) ?? null)

  // A node whose cluster is filtered out should not keep the panel open.
  useEffect(() => {
    if (selectedNode && hiddenClusters.has(selectedNode.mapCluster)) {
      setSelectedNodeId(null)
    }
  }, [selectedNode, hiddenClusters])

  const outgoing = useMemo(
    () =>
      selectedNodeId === null
        ? EMPTY
        : (outgoingByNode.get(selectedNodeId) ?? EMPTY),
    [selectedNodeId],
  )
  const incoming = useMemo(
    () =>
      selectedNodeId === null
        ? EMPTY
        : (incomingByNode.get(selectedNodeId) ?? EMPTY),
    [selectedNodeId],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <MapHeader onResetView={() => mapRef.current?.resetView()}>
        <SearchBar
          onSelectNode={selectFromSearch}
          onClear={clearSelection}
          hiddenClusters={hiddenClusters}
        />
      </MapHeader>

      <div className="relative min-h-0 flex-1">
        <MapView
          ref={mapRef}
          selectedNodeId={selectedNodeId}
          onNodeClick={handleNodeClick}
          hiddenClusters={hiddenClusters}
        />
        <ClusterLegend
          hiddenClusters={hiddenClusters}
          onToggleCluster={toggleCluster}
          onShowAll={showAllClusters}
          onHideAll={hideAllClusters}
          hidden={selectedNode !== null}
        />
        <NodeDetailPanel
          node={selectedNode}
          outgoing={outgoing}
          incoming={incoming}
          onClose={clearSelection}
          onSelectNode={setSelectedNodeId}
        />
      </div>
    </div>
  )
}
