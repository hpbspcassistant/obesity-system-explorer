import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ClusterLegend } from './components/ClusterLegend'
import { EdgeDetailPanel } from './components/EdgeDetailPanel'
import { MapHeader } from './components/MapHeader'
import {
  MapView,
  type AnchorRect,
  type MapViewHandle,
} from './components/MapView'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { SearchBar } from './components/SearchBar'
import { ProfileBar } from './components/ProfileBar'
import { ProfileCard } from './components/ProfileCard'
import { ProfilePersonaDialog } from './components/ProfilePersonaDialog'
import { ProfileReviewSheet } from './components/ProfileReviewSheet'
import { TracePanel } from './components/TracePanel'
import { DEFAULT_MODE, DEFAULT_TRACE_DIRECTION } from './data/modes'
import {
  edgeSelectionOf,
  groupOfNode,
  incomingByNode,
  namesForTaxonomy,
  nodesById,
  outgoingByNode,
} from './data/systemMap'
import {
  DEFAULT_LOOP_LENGTH,
  loopPathSet,
  reinforcingLoopsThrough,
} from './lib/loops'
import {
  DEFAULT_MAX_STEPS,
  LIST_MAX_HOPS,
  buildFocus,
  pathSetWithin,
  routesWithin,
} from './lib/trace'
import {
  createProfile,
  frontierOf,
  loadProfiles,
  missingLinks,
  saveProfiles,
  toggleEdge as toggleEdgeIn,
  toggleNode as toggleNodeIn,
  type Profile,
} from './lib/profile'
import type {
  Connection,
  MapMode,
  Selection,
  Taxonomy,
  TraceDirection,
} from './types'

const EMPTY: readonly Connection[] = Object.freeze([])
const CONTRAST_KEY = 'obesity-system-map.highContrast'
const NONE_HIDDEN: ReadonlySet<string> = Object.freeze(new Set<string>())
const NO_MARKS: ReadonlySet<number> = Object.freeze(new Set<number>())
const NO_EDGE_MARKS: ReadonlySet<string> = Object.freeze(new Set<string>())
const NO_LINKS: readonly string[] = Object.freeze([])
/** Width of the trace panel (w-[23rem]), so framing clears it. */
const TRACE_PANEL_PX = 368
/** Width of Explore's detail panel (w-[22rem]) — same job, different panel. */
const DETAIL_PANEL_PX = 352
/** Height of Profile's bottom bar (h-12), so the legend clears it. */
const PROFILE_BAR_PX = 48

export default function App() {
  const mapRef = useRef<MapViewHandle | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [mode, setMode] = useState<MapMode>(DEFAULT_MODE)
  const [selection, setSelection] = useState<Selection | null>(null)
  // One hidden set per taxonomy, so switching between them does not discard
  // the filter you already built on the other.
  const [taxonomy, setTaxonomy] = useState<Taxonomy>('type')
  // Whether the colour key is shrunk to a pill. A preference about the screen
  // rather than about the work, so it is kept across modes like High contrast.
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  // A viewing preference, kept across modes and remembered between
  // sessions: whoever needs it needs it every time.
  const [highContrast, setHighContrast] = useState<boolean>(
    () => localStorage.getItem(CONTRAST_KEY) === '1',
  )
  const [hiddenByTaxonomy, setHiddenByTaxonomy] = useState<
    Record<Taxonomy, ReadonlySet<string>>
  >({ type: NONE_HIDDEN, cluster: NONE_HIDDEN })
  const hiddenGroups = hiddenByTaxonomy[taxonomy]

  // Profile work. Held above `mode` on purpose: switching modes must never
  // discard it. A trace is cheap to redo, so it may reset on leaving Trace.
  // Several profiles coexist; one is being edited at a time.
  const [profiles, setProfiles] = useState<Profile[]>(() => loadProfiles())
  // Reopen the profile last worked on. Landing on an empty "new profile" form
  // with yesterday's work hidden behind a dropdown reads as having lost it.
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    () => profiles.at(-1)?.id ?? null,
  )
  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? null
  /** Which persona form is up, if any. 'new' has no profile to go back to. */
  const [personaForm, setPersonaForm] = useState<'new' | 'edit' | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  /** Where the open factor's box currently sits, so the card can follow it. */
  const [anchor, setAnchor] = useState<AnchorRect | null>(null)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  // Trace work. Reset on leaving Trace — cheap to redo, unlike a profile.
  // A single start: multiple starts multiplied the route list without making
  // the map any easier to read.
  const [traceStartId, setTraceStartId] = useState<number | null>(null)
  const [maxSteps, setMaxSteps] = useState(DEFAULT_MAX_STEPS)
  const [focusedRouteKey, setFocusedRouteKey] = useState<string | null>(null)
  const [hoveredRouteKey, setHoveredRouteKey] = useState<string | null>(null)
  /** Non-null only while the Trace button is walking a route. */
  const [animatedHops, setAnimatedHops] = useState<number | null>(null)
  // A preference rather than work in progress, so it is deliberately kept when
  // leaving Trace — only the trace itself resets.
  const [traceDirection, setTraceDirection] = useState<TraceDirection>(
    DEFAULT_TRACE_DIRECTION,
  )

  const changeMode = useCallback((next: MapMode) => {
    setMode((current) => {
      // Leaving Trace clears the in-progress trace; marks are left untouched.
      if (next === 'trace') setSelection(null)
      // Profile's chrome is transient; the profile itself is not.
      if (current === 'profile' && next !== 'profile') {
        setReviewOpen(false)
        setPersonaForm(null)
      }
      if (current === 'trace' && next !== 'trace') {
        setTraceStartId(null)
        setFocusedRouteKey(null)
        setHoveredRouteKey(null)
        setAnimatedHops(null)
      }
      return next
    })
  }, [])

  /** Edits the active profile in place; every mark is a binary toggle. */
  const editActive = useCallback(
    (change: (profile: Profile) => Profile) => {
      setProfiles((current) =>
        current.map((p) => (p.id === activeProfileId ? change(p) : p)),
      )
    },
    [activeProfileId],
  )

  const toggleMark = useCallback(
    (nodeId: number) => editActive((p) => toggleNodeIn(p, nodeId)),
    [editActive],
  )
  const toggleEdgeMark = useCallback(
    (connectionId: string) => editActive((p) => toggleEdgeIn(p, connectionId)),
    [editActive],
  )

  /** Accepts every link whose two ends are already marked, in one go. */
  const markAllLinks = useCallback(
    () =>
      editActive((p) => {
        const edgeIds = new Set(p.edgeIds)
        for (const id of missingLinks(p)) edgeIds.add(id)
        return { ...p, edgeIds }
      }),
    [editActive],
  )

  const renameActive = useCallback(
    (name: string, details: string) =>
      editActive((p) => ({ ...p, name, details })),
    [editActive],
  )

  const addProfile = useCallback((name: string, details: string) => {
    const profile = createProfile(name, details)
    setProfiles((current) => [...current, profile])
    setActiveProfileId(profile.id)
  }, [])

  const importProfile = useCallback((profile: Profile) => {
    setProfiles((current) => {
      // An imported id may collide with one already held; keep both. Counting
      // up rather than appending a fixed suffix, because the same file imported
      // three times used to produce two profiles sharing an id — after which
      // editing one edited both and deleting one deleted both.
      let id = profile.id
      for (let n = 2; current.some((p) => p.id === id); n += 1) {
        id = `${profile.id}-${n}`
      }
      const added = id === profile.id ? profile : { ...profile, id }
      setActiveProfileId(added.id)
      return [...current, added]
    })
  }, [])

  const deleteProfile = useCallback((id: string) => {
    setProfiles((current) => current.filter((p) => p.id !== id))
    setActiveProfileId((current) => (current === id ? null : current))
    setReviewOpen(false)
    setSelection(null)
  }, [])

  /** One form serves both "name a new persona" and "rename this one". */
  const savePersona = useCallback(
    (name: string, details: string) => {
      if (personaForm === 'edit' && activeProfile) renameActive(name, details)
      else addProfile(name, details)
      setPersonaForm(null)
    },
    [personaForm, activeProfile, renameActive, addProfile],
  )

  /** The map is the whole stage now, so the card is placed against its box. */
  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const measure = () =>
      setStage({ width: element.clientWidth, height: element.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Marking is the work, so it is written back as it happens rather than on a
  // save button — closing the tab mid-profile must not lose it.
  useEffect(() => {
    saveProfiles(profiles)
  }, [profiles])

  /**
   * What a click means, per mode.
   *
   * Explore and Profile both just open the thing you clicked. Profile used to
   * toggle the mark here as well, which made the most natural gesture on a map
   * — click the box to read it — silently destroy work: clicking an already
   * marked factor unmarked it, and the change was written to storage in the
   * same tick with no undo and no confirmation. It also meant the same factor
   * behaved differently depending on how you reached it, since arriving via
   * search only ever selected. Marking now lives on the card's button, which is
   * the only control in the mode that changes a profile by itself.
   *
   * Trace is the exception: it is a dedicated workspace with its own panel, so
   * a click there only picks starting factors and never opens a detail panel.
   *
   * Click-again-to-deselect belongs to Explore only: in Profile the card is a
   * workspace you act in, so re-clicking its factor must not close it.
   */
  const handleSelect = useCallback(
    (next: Selection | null) => {
      if (next?.kind === 'node' && mode === 'trace') {
        // Trace is a dedicated workspace: a click sets the starting factor and
        // nothing else. No selection is set, so no detail panel appears.
        setTraceStartId((current) =>
          current === next.nodeId ? null : next.nodeId,
        )
        setFocusedRouteKey(null)
        setAnimatedHops(null)
        return
      }
      if (mode === 'trace') {
        // Clicking empty space clears the trace, as it clears a selection in
        // Explore. Without this the starting factor was the only way out.
        if (!next) {
          setTraceStartId(null)
          setFocusedRouteKey(null)
          setHoveredRouteKey(null)
          setAnimatedHops(null)
        }
        return
      }

      setSelection((current) => {
        if (!next) return null
        if (mode !== 'explore') return next
        if (current?.kind === 'node' && next.kind === 'node')
          return current.nodeId === next.nodeId ? null : next
        if (current?.kind === 'edge' && next.kind === 'edge')
          return current.connectionId === next.connectionId ? null : next
        return next
      })
    },
    [mode],
  )

  const clearSelection = useCallback(() => setSelection(null), [])
  const selectNode = useCallback(
    (nodeId: number) => setSelection({ kind: 'node', nodeId }),
    [],
  )
  const selectConnection = useCallback(
    (connectionId: string) => setSelection({ kind: 'edge', connectionId }),
    [],
  )

  const toggleGroup = useCallback(
    (name: string) => {
      setHiddenByTaxonomy((current) => {
        const next = new Set(current[taxonomy])
        if (!next.delete(name)) next.add(name)
        return { ...current, [taxonomy]: next }
      })
    },
    [taxonomy],
  )

  /**
   * Search can surface a node whose cluster is filtered out. Selecting it would
   * otherwise be a dead click — the filter effect clears the selection straight
   * away — so reveal that cluster first.
   */
  const selectFromSearch = useCallback(
    (nodeId: number) => {
      const node = nodesById.get(nodeId)
      if (node) {
        const group = groupOfNode(node, taxonomy)
        setHiddenByTaxonomy((current) => {
          if (!current[taxonomy].has(group)) return current
          const next = new Set(current[taxonomy])
          next.delete(group)
          return { ...current, [taxonomy]: next }
        })
      }
      if (mode === 'trace') {
        // In Trace the readable way to find a factor must also start the trace.
        setTraceStartId(nodeId)
        setFocusedRouteKey(null)
        setAnimatedHops(null)
        return
      }
      setSelection({ kind: 'node', nodeId })
      // Every mode now goes to what you searched for. Explore was the last one
      // that did not, and it was the worst place to leave it out: zoomed in, a
      // search opened a panel about a factor sitting thousands of pixels off
      // screen, so the map appeared not to have responded at all. Explore's
      // panel covers the right of the stage, so framing has to clear it the way
      // Trace's does; Profile's card floats beside the factor and follows it, so
      // it needs no inset.
      mapRef.current?.focusOnNodes(
        [nodeId],
        mode === 'explore' ? { rightInset: DETAIL_PANEL_PX } : undefined,
      )
    },
    [taxonomy, mode],
  )

  const showAllGroups = useCallback(
    () =>
      setHiddenByTaxonomy((current) => ({ ...current, [taxonomy]: NONE_HIDDEN })),
    [taxonomy],
  )
  const hideAllGroups = useCallback(
    () =>
      setHiddenByTaxonomy((current) => ({
        ...current,
        [taxonomy]: new Set(namesForTaxonomy(taxonomy)),
      })),
    [taxonomy],
  )

  // Escape works inward-out: the card first, then the review sheet.
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  useEffect(() => {
    try {
      localStorage.setItem(CONTRAST_KEY, highContrast ? '1' : '0')
    } catch {
      // Private browsing: the setting just will not survive the session.
    }
  }, [highContrast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (selectionRef.current) setSelection(null)
      else setReviewOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectedNode =
    selection?.kind === 'node' ? (nodesById.get(selection.nodeId) ?? null) : null
  const selectedEdge =
    selection?.kind === 'edge' ? edgeSelectionOf(selection.connectionId) : null

  // Anything hidden by the active filter must not stay selected.
  useEffect(() => {
    if (selectedNode && hiddenGroups.has(groupOfNode(selectedNode, taxonomy))) {
      setSelection(null)
    }
    if (selectedEdge) {
      const ends = [selectedEdge.source, selectedEdge.target]
      if (ends.some((n) => n && hiddenGroups.has(groupOfNode(n, taxonomy)))) {
        setSelection(null)
      }
    }
  }, [selectedNode, selectedEdge, hiddenGroups, taxonomy])

  const tracing = mode === 'trace'
  const loopMode = traceDirection === 'loops'

  /**
   * How far the legend has to sit in from the right to clear whatever panel is
   * open. Trace's panel is always there; Explore's only once something is
   * selected; Profile's card floats and moves, so it is left to overlap.
   */
  const legendRightInset =
    mode === 'trace'
      ? TRACE_PANEL_PX
      : mode === 'explore' && selection !== null
        ? DETAIL_PANEL_PX
        : 0
  const profiling = mode === 'profile'

  /**
   * The factor the card hangs off. An edge card anchors to the connection's
   * target, which is where the eye already is after following an arrow.
   */
  const anchorNodeId = useMemo(() => {
    if (!profiling || !selection) return null
    if (selection.kind === 'node') return selection.nodeId
    return selectedEdge?.connection.targetId ?? null
  }, [profiling, selection, selectedEdge])

  /** Everything on a route within the step limit — drawn in full on the map. */
  const tracePaths = useMemo(() => {
    if (!tracing || traceStartId === null) return null
    // `pathSetWithin` reads the direction as an axis to walk and cannot
    // interpret 'loops', so it is never reached in loop mode.
    return loopMode
      ? loopPathSet(traceStartId, maxSteps)
      : pathSetWithin(traceStartId, maxSteps, traceDirection)
  }, [tracing, loopMode, traceStartId, maxSteps, traceDirection])

  /**
   * The list can only hold short routes, so it is capped independently of the
   * map. The map stays complete; the list says what it is showing.
   */
  const search = useMemo(() => {
    if (!tracing || traceStartId === null) return null
    // Loops need no cap of their own: within the length limit the list is the
    // complete set, which is what a route list could never be.
    if (loopMode) return reinforcingLoopsThrough(traceStartId, maxSteps)
    return routesWithin(
      traceStartId,
      Math.min(maxSteps, LIST_MAX_HOPS),
      traceDirection,
    )
  }, [tracing, loopMode, traceStartId, maxSteps, traceDirection])

  // Hovering previews a route without committing to it.
  const activeRouteKey = hoveredRouteKey ?? focusedRouteKey
  const activeRoute = useMemo(
    () => search?.routes.find((r) => r.key === activeRouteKey) ?? null,
    [search, activeRouteKey],
  )

  const traceFocus = useMemo(
    () => buildFocus(activeRoute, animatedHops),
    [activeRoute, animatedHops],
  )

  // A route key only means something for the current start and cap.
  useEffect(() => {
    if (
      focusedRouteKey &&
      !search?.routes.some((r) => r.key === focusedRouteKey)
    ) {
      setFocusedRouteKey(null)
      setAnimatedHops(null)
    }
  }, [search, focusedRouteKey])

  /** Walks the focused route one hop at a time — the only animation left. */
  useEffect(() => {
    if (animatedHops === null) return
    const focused = search?.routes.find((r) => r.key === focusedRouteKey)
    if (!focused || animatedHops >= focused.length) return
    const timer = window.setTimeout(
      () => setAnimatedHops((h) => (h === null ? null : h + 1)),
      850,
    )
    return () => window.clearTimeout(timer)
  }, [animatedHops, search, focusedRouteKey])

  /**
   * A new starting factor is a new question, so the step limit goes back to the
   * default. Carrying it over was confusing: the useful range differs per start
   * (9 steps from Education, 17 from a core factor), so a limit tuned for one
   * would light a third of the map on the next.
   */
  useEffect(() => {
    setMaxSteps(loopMode ? DEFAULT_LOOP_LENGTH : DEFAULT_MAX_STEPS)
    setFocusedRouteKey(null)
    setAnimatedHops(null)
  }, [traceStartId, traceDirection, loopMode])

  // Never leave the slider past the end of the current start's range.
  useEffect(() => {
    if (tracePaths && maxSteps > tracePaths.stepsForAll) {
      setMaxSteps(tracePaths.stepsForAll)
    }
  }, [tracePaths, maxSteps])

  const focusRoute = useCallback((key: string | null) => {
    setFocusedRouteKey(key)
    setAnimatedHops(null)
  }, [])

  const playRoute = useCallback(() => setAnimatedHops(0), [])
  const stopRoute = useCallback(() => setAnimatedHops(null), [])

  const clearTrace = useCallback(() => {
    setTraceStartId(null)
    setFocusedRouteKey(null)
    setHoveredRouteKey(null)
    setAnimatedHops(null)
  }, [])

  /**
   * Re-frames the map on what the trace has revealed. Uses instant transforms:
   * the library animates with requestAnimationFrame, and a follow that only
   * sometimes lands is worse than one that always does.
   */
  useEffect(() => {
    if (mode !== 'trace' || !tracePaths) return
    // Deliberately keyed to the *committed* route, never the hover: re-framing
    // on mouse-over made the map lurch on every row of the list.
    const committed = search?.routes.find((r) => r.key === focusedRouteKey)
    const framed = committed
      ? buildFocus(committed, animatedHops)?.nodeIds
      : [tracePaths.startId, ...tracePaths.nodeIds]
    if (framed?.length) {
      mapRef.current?.focusOnNodes(framed, { rightInset: TRACE_PANEL_PX })
    }
  }, [mode, tracePaths, search, focusedRouteKey, animatedHops])

  const markedNodeIds = activeProfile?.nodeIds ?? NO_MARKS
  const markedEdgeIds = activeProfile?.edgeIds ?? NO_EDGE_MARKS

  /**
   * The suggestions. Only computed in Profile: elsewhere it would be work
   * nobody sees. Pure adjacency — one step out from what is marked.
   */
  const frontier = useMemo(
    () =>
      mode === 'profile' && activeProfile
        ? frontierOf(activeProfile)
        : undefined,
    [mode, activeProfile],
  )

  /** Connections whose two ends are both marked but which are not. */
  const links = useMemo(
    () =>
      mode === 'profile' && activeProfile
        ? missingLinks(activeProfile)
        : NO_LINKS,
    [mode, activeProfile],
  )

  const outgoing = useMemo(
    () =>
      selectedNode ? (outgoingByNode.get(selectedNode.id) ?? EMPTY) : EMPTY,
    [selectedNode],
  )
  const incoming = useMemo(
    () =>
      selectedNode ? (incomingByNode.get(selectedNode.id) ?? EMPTY) : EMPTY,
    [selectedNode],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <MapHeader
        mode={mode}
        onModeChange={changeMode}
        traceDirection={traceDirection}
        onTraceDirectionChange={setTraceDirection}
        onResetView={() => mapRef.current?.resetView()}
        onZoomBy={(factor) => mapRef.current?.zoomBy(factor)}
        highContrast={highContrast}
        onHighContrastChange={setHighContrast}
      >
        <SearchBar
          onSelectNode={selectFromSearch}
          onClear={clearSelection}
          hiddenGroups={hiddenGroups}
          taxonomy={taxonomy}
        />
      </MapHeader>

      <div ref={stageRef} className="relative min-h-0 flex-1">
        <MapView
          ref={mapRef}
          mode={mode}
          selection={selection}
          onSelect={handleSelect}
          taxonomy={taxonomy}
          hiddenGroups={hiddenGroups}
          markedNodeIds={markedNodeIds}
          markedEdgeIds={markedEdgeIds}
          candidateNodeIds={frontier}
          missingLinkIds={links}
          onAcceptLink={toggleEdgeMark}
          anchorNodeId={anchorNodeId}
          onAnchorChange={setAnchor}
          tracePaths={tracePaths}
          traceFocus={traceFocus}
          bottomInset={profiling ? PROFILE_BAR_PX : 0}
          highContrast={highContrast}
        />

        {/* Profile's chrome. The map keeps its full width underneath all of it
            — the card is transient and the bar is 48px of height, where the old
            panel took 368px of width for the whole session. */}
        {profiling && activeProfile && (
          <>
            <ProfileCard
              anchor={anchor}
              container={stage}
              node={selectedNode}
              edge={selectedEdge}
              outgoing={outgoing}
              incoming={incoming}
              markedNodeIds={markedNodeIds}
              markedEdgeIds={markedEdgeIds}
              onToggleNode={toggleMark}
              onToggleEdge={toggleEdgeMark}
              onSelectNode={selectNode}
              onClose={clearSelection}
            />

            {reviewOpen && (
              <ProfileReviewSheet
                profile={activeProfile}
                missingLinkIds={links}
                onToggleNode={toggleMark}
                onToggleEdge={toggleEdgeMark}
                onSelectNode={selectNode}
                onSelectConnection={selectConnection}
                onMarkAllLinks={markAllLinks}
                onClose={() => setReviewOpen(false)}
              />
            )}

            <ProfileBar
              profiles={profiles}
              profile={activeProfile}
              markedNodes={activeProfile.nodeIds.size}
              markedEdges={activeProfile.edgeIds.size}
              unmarkedLinks={links.length}
              reviewOpen={reviewOpen}
              onToggleReview={() => setReviewOpen((open) => !open)}
              onSelectProfile={setActiveProfileId}
              onNewProfile={() => setPersonaForm('new')}
              onEditPersona={() => setPersonaForm('edit')}
              onImportProfile={importProfile}
              onDeleteProfile={deleteProfile}
            />
          </>
        )}

        {/* With no profile there is nothing to mark, so naming one is the only
            thing on offer and there is no way to dismiss it. */}
        {profiling && (!activeProfile || personaForm !== null) && (
          <ProfilePersonaDialog
            profile={personaForm === 'edit' ? activeProfile : null}
            onSave={savePersona}
            onImport={importProfile}
            onCancel={
              activeProfile ? () => setPersonaForm(null) : undefined
            }
          />
        )}

        {mode === 'trace' && (
          <TracePanel
            direction={traceDirection}
            startId={traceStartId}
            paths={tracePaths}
            search={search}
            maxSteps={maxSteps}
            onMaxStepsChange={setMaxSteps}
            focusedRouteKey={focusedRouteKey}
            onFocusRoute={focusRoute}
            onHoverRoute={setHoveredRouteKey}
            animatedHops={animatedHops}
            onPlay={playRoute}
            onStop={stopRoute}
            onClear={clearTrace}
          />
        )}
        {/* Every mode, always. The filter it houses applies to the map in all
            three, so hiding the box in two of them left the filter switched on
            with no way to switch it off. */}
        <ClusterLegend
          taxonomy={taxonomy}
          onTaxonomyChange={setTaxonomy}
          hiddenGroups={hiddenGroups}
          onToggleGroup={toggleGroup}
          onShowAll={showAllGroups}
          onHideAll={hideAllGroups}
          collapsed={legendCollapsed}
          onCollapsedChange={setLegendCollapsed}
          rightInset={legendRightInset}
          bottomInset={profiling ? PROFILE_BAR_PX : 0}
          highContrast={highContrast}
        />
        {mode === 'explore' && (
        <NodeDetailPanel
          node={selectedNode}
          outgoing={outgoing}
          incoming={incoming}
          onClose={clearSelection}
          onSelectNode={selectNode}
          onSelectConnection={selectConnection}
        />
        )}
        {mode === 'explore' && (
        <EdgeDetailPanel
          edge={selectedEdge}
          onClose={clearSelection}
          onSelectNode={selectNode}
          onSelectConnection={selectConnection}
        />
        )}
      </div>
    </div>
  )
}
