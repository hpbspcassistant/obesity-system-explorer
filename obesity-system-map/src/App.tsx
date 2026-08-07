import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ClusterLegend } from './components/ClusterLegend'
import { EdgeDetailPanel } from './components/EdgeDetailPanel'
import { InterventionBar } from './components/InterventionBar'
import { InterventionKey } from './components/InterventionKey'
import { GuideCard, GuideContents } from './components/GuideCard'
import { MapHeader } from './components/MapHeader'
import {
  MapView,
  type AnchorRect,
  type MapViewHandle,
} from './components/MapView'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { SearchBar, type SearchBarHandle } from './components/SearchBar'
import { ProfileBar } from './components/ProfileBar'
import { ProfileCard } from './components/ProfileCard'
import { ProfilePersonaDialog } from './components/ProfilePersonaDialog'
import { ProfileReviewSheet } from './components/ProfileReviewSheet'
import { TracePanel } from './components/TracePanel'
import {
  DEMO_QUERY,
  DEMO_VARIABLE_LABEL,
  GUIDE_SECTIONS,
  type GuideActionId,
  type GuideSectionId,
} from './data/guide'
import { downloadBlob } from './lib/exportImage'
import {
  allNodeIds,
  behaviourIndex,
  programmes,
} from './data/intervention'
import {
  provenanceOf,
  reachOf,
  summariseForPersona,
  type NodeStanding,
  type PersonaCharacteristics,
} from './lib/reach'
import { InterventionCard } from './components/InterventionCard'
import { DEFAULT_MODE, DEFAULT_TRACE_DIRECTION } from './data/modes'
import {
  edgeSelectionOf,
  groupOfNode,
  incomingByNode,
  namesForTaxonomy,
  nodes,
  nodesById,
  outgoingByNode,
  variableTypes,
  atlasClusters,
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
  type ParseResult,
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
const GUIDE_KEY = 'obesity-system-map.guideSeen'
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
/** The navigator plus its gap, so the intervention key can stack above it. */
const MINIMAP_STACK_PX = 145
/**
 * Output pixels per map unit for an exported PNG. At 1 the image is 3370px wide,
 * which is already beyond what A4 needs at 300dpi; 2 quadruples the file for a
 * size nobody has asked for.
 */
const EXPORT_SCALE = 1

/** Either the menu of walkthroughs, or a place within one of them. */
type GuideView =
  | { kind: 'contents' }
  | { kind: 'section'; id: GuideSectionId; step: number }

export default function App() {
  const mapRef = useRef<MapViewHandle | null>(null)
  const searchRef = useRef<SearchBarHandle | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [mode, setMode] = useState<MapMode>(DEFAULT_MODE)
  const [selection, setSelection] = useState<Selection | null>(null)
  // One hidden set per taxonomy, so switching between them does not discard
  // the filter you already built on the other.
  const [taxonomy, setTaxonomy] = useState<Taxonomy>('type')
  // Whether the colour key is shrunk to a pill. A preference about the screen
  // rather than about the work, so it is kept across modes like High contrast.
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  // The walkthrough. Opens itself once, on the first visit only: this is a tool
  // the same few people use repeatedly, so it must never nag. The question mark
  // in the header brings it back for a workshop or a new colleague.
  //
  // A first visit goes straight into the tour rather than to the contents: being
  // asked to choose a guide before you know what the thing is answers a question
  // you cannot yet have.
  const [guide, setGuide] = useState<GuideView | null>(() =>
    localStorage.getItem(GUIDE_KEY) === '1'
      ? null
      : { kind: 'section', id: 'basics', step: 0 },
  )
  /** A group the guide hid to demonstrate filtering, to be put back after. */
  const [guideHidGroup, setGuideHidGroup] = useState<string | null>(null)
  /** Measured height of the guide card, reported by the card itself. */
  const [guideHeight, setGuideHeight] = useState(0)
  /**
   * Whether the map shows the profile alone. Profile-only, and a view of the work
   * rather than the work itself, so it is not stored with the profile.
   */
  const [markedOnly, setMarkedOnly] = useState(false)
  const [exportState, setExportState] = useState<'idle' | 'working' | 'failed'>(
    'idle',
  )
  /** What the last import did, shown briefly above the profile bar. */
  const [importNotice, setImportNotice] = useState<string | null>(null)
  // Intervention does not keep its own idea of who we are talking about: it
  // reads the active profile, the same one Profile mode edits. All this holds is
  // whether the persona is being applied at all — the whitespace view asks what
  // HPB touches in general, which is nobody's question in particular.
  const [interventionWhitespace, setInterventionWhitespace] = useState(true)
  const [gapsOnly, setGapsOnly] = useState(false)
  /**
   * Marked counts as they stood when the current guide step opened.
   *
   * A step that waits for a mark has to mean "mark one now", not "have one
   * marked" — otherwise a reader who already has a profile finds the step
   * satisfied before they have done anything, and learns nothing.
   */
  const [guideBaseline, setGuideBaseline] = useState({ nodes: 0, edges: 0 })
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
    (name: string, details: string, characteristics: PersonaCharacteristics) =>
      editActive((p) => ({ ...p, name, details, characteristics })),
    [editActive],
  )

  const addProfile = useCallback(
    (name: string, details: string, characteristics: PersonaCharacteristics) => {
      const profile = { ...createProfile(name, details), characteristics }
      setProfiles((current) => [...current, profile])
      setActiveProfileId(profile.id)
    },
    [],
  )

  /**
   * Takes the whole parse result, not just the profile, so what the import did
   * can be said out loud.
   *
   * A factors-only file has its connections filled in, and a file written against
   * an older map may lose marks. Both change what you end up with, and reporting
   * them here rather than in the dialog is the only way anyone reads it: a
   * successful import from the first-run dialog replaces that dialog with the
   * map, taking any message inside it along.
   */
  const importProfile = useCallback((result: ParseResult) => {
    const { profile } = result
    const dropped =
      result.droppedNodeIds.length + result.droppedEdgeIds.length
    const linked = result.autoLinkedEdgeIds.length
    const notes = [
      linked > 0 &&
        `It listed no connections, so the ${linked} running between its variables ${linked === 1 ? 'was' : 'were'} marked for you.`,
      dropped > 0 &&
        `${dropped} mark${dropped === 1 ? '' : 's'} referred to variables this map does not have and ${dropped === 1 ? 'was' : 'were'} skipped.`,
    ].filter(Boolean)
    setImportNotice(
      [`Imported “${profile.name}”.`, ...notes].join(' '),
    )

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
    (
      name: string,
      details: string,
      characteristics: PersonaCharacteristics,
    ) => {
      if (personaForm === 'edit' && activeProfile)
        renameActive(name, details, characteristics)
      else addProfile(name, details, characteristics)
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

  // Long enough to read two sentences, short enough not to become furniture.
  useEffect(() => {
    if (!importNotice) return
    const timer = window.setTimeout(() => setImportNotice(null), 9000)
    return () => window.clearTimeout(timer)
  }, [importNotice])

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

  /**
   * Reveals whichever filtered-out groups these factors belong to.
   *
   * Following a link to something the cluster filter has hidden is otherwise a
   * dead click: the effect above clears the selection on the next render, so the
   * card shuts itself and the view has moved for nothing. An edge needs both
   * ends revealed, because that effect drops an edge if either endpoint is
   * hidden.
   */
  const revealGroupsFor = useCallback(
    (nodeIds: readonly number[]) => {
      setHiddenByTaxonomy((current) => {
        const hidden = current[taxonomy]
        const reveal = nodeIds.flatMap((id) => {
          const node = nodesById.get(id)
          if (!node) return []
          const group = groupOfNode(node, taxonomy)
          return hidden.has(group) ? [group] : []
        })
        if (!reveal.length) return current
        const next = new Set(hidden)
        for (const group of reveal) next.delete(group)
        return { ...current, [taxonomy]: next }
      })
    },
    [taxonomy],
  )

  /**
   * Selecting from inside a card rather than from the map.
   *
   * A map click needs no framing: you clicked where you were already looking.
   * A card link is the opposite — the factor or connection it names is usually
   * off screen, or a pixel wide at the current zoom, so following the link
   * without moving the view leaves the reader hunting for the thing they just
   * asked to see.
   *
   * Framing is Explore-only. Profile's card is anchored to the factor it
   * describes and travels with the map, so moving the map there would have the
   * card chase its own anchor. Revealing a hidden group is not mode-specific: a
   * dead click is a dead click everywhere.
   */
  /**
   * Frames factors clear of everything currently covering the stage.
   *
   * Every caller already cleared the side panels; none of them knew about the
   * guide, which sits along the bottom. So a route framed to the middle of the
   * viewport could land underneath it — which is exactly how the last variable of
   * a walked route ended up hidden behind the card describing the walk.
   *
   * The card's height is measured rather than assumed, because it follows the
   * copy of whichever step is showing.
   */
  const frameNodes = useCallback(
    (nodeIds: readonly number[], rightInset = 0) => {
      const guideSpace =
        guide !== null && guideHeight > 0
          ? guideHeight + 16 + (mode === 'profile' ? PROFILE_BAR_PX : 0) + 12
          : 0
      mapRef.current?.focusOnNodes(nodeIds, {
        rightInset,
        bottomInset: guideSpace,
      })
    },
    [guide, guideHeight, mode],
  )

  const selectNode = useCallback(
    (nodeId: number) => {
      revealGroupsFor([nodeId])
      setSelection({ kind: 'node', nodeId })
      if (mode === 'explore') {
        frameNodes([nodeId], DETAIL_PANEL_PX)
      }
    },
    [mode, revealGroupsFor, frameNodes],
  )

  const selectConnection = useCallback(
    (connectionId: string) => {
      const edge = edgeSelectionOf(connectionId)
      // Both ends, so the arrow's direction is visible rather than only where
      // it happens to land.
      const ends = edge
        ? [edge.connection.sourceId, edge.connection.targetId]
        : []
      revealGroupsFor(ends)
      setSelection({ kind: 'edge', connectionId })
      if (mode === 'explore' && ends.length) {
        frameNodes(ends, DETAIL_PANEL_PX)
      }
    },
    [mode, revealGroupsFor, frameNodes],
  )

  /**
   * Sets a group's visibility outright. The guide needs this rather than a
   * toggle: it hides a group to show what filtering does and puts it back
   * afterwards, and a toggle would hide the group again if the reader had already
   * revealed it themselves in between.
   */
  const setGroupHidden = useCallback(
    (name: string, hidden: boolean) => {
      setHiddenByTaxonomy((current) => {
        const groups = current[taxonomy]
        if (groups.has(name) === hidden) return current
        const next = new Set(groups)
        if (hidden) next.add(name)
        else next.delete(name)
        return { ...current, [taxonomy]: next }
      })
    },
    [taxonomy],
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
      revealGroupsFor([nodeId])
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
      frameNodes([nodeId], mode === 'explore' ? DETAIL_PANEL_PX : 0)
    },
    [mode, revealGroupsFor, frameNodes],
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

  /* -------------------------------------------------------------- the guide */

  const closeGuide = useCallback(() => {
    setGuide(null)
    try {
      localStorage.setItem(GUIDE_KEY, '1')
    } catch {
      // Private browsing refuses writes; showing the tour twice is not worth
      // interrupting anyone for.
    }
  }, [])

  /** The header's question mark opens the menu, not the first-run tour. */
  /**
   * Turning the marked-only view on closes any open card. The card is anchored to
   * a factor's box, and if that factor is one of the ones about to disappear the
   * card is left describing something no longer on screen.
   */
  const changeMarkedOnly = useCallback((next: boolean) => {
    setMarkedOnly(next)
    if (next) setSelection(null)
  }, [])

  /**
   * Saves the map as a PNG, named after the profile it belongs to.
   *
   * Rasterising 2,100 elements takes a moment, so the button reports that rather
   * than appearing to have ignored the press — and reports a failure rather than
   * leaving someone waiting for a file that is never going to arrive.
   */
  const exportPng = useCallback(async () => {
    setExportState('working')
    try {
      const blob = await mapRef.current?.exportPng(EXPORT_SCALE)
      if (!blob) throw new Error('no image produced')
      const safe = (activeProfile?.name ?? 'map')
        .replace(/[^a-z0-9]+/gi, '-')
        .toLowerCase()
      downloadBlob(blob, `profile-${safe || 'map'}${markedOnly ? '-marked' : ''}.png`)
      setExportState('idle')
    } catch {
      setExportState('failed')
      window.setTimeout(() => setExportState('idle'), 4000)
    }
  }, [activeProfile, markedOnly])

  const openGuide = useCallback(() => setGuide({ kind: 'contents' }), [])

  const showGuideContents = useCallback(
    () => setGuide({ kind: 'contents' }),
    [],
  )

  const setGuideStep = useCallback((step: number) => {
    setGuide((current) =>
      current?.kind === 'section' ? { ...current, step } : current,
    )
  }, [])

  /**
   * Starts a section, moving to the mode it describes. Its demonstrations act on
   * that mode's interface, so running Explore's guide from inside Trace would
   * narrate things that are not on screen.
   */
  const startGuideSection = useCallback(
    (id: GuideSectionId) => {
      const needed = GUIDE_SECTIONS[id].mode
      if (needed && needed !== mode) changeMode(needed)
      setGuide({ kind: 'section', id, step: 0 })
    },
    [mode, changeMode],
  )


  /**
   * Puts the demonstrated filter back once the reader leaves that step or closes
   * the guide. A tour that quietly leaves a fifth of the map switched off would
   * be worse than no tour at all.
   */
  useEffect(() => {
    if (!guideHidGroup) return
    const onFilterStep =
      guide?.kind === 'section' &&
      GUIDE_SECTIONS[guide.id].steps[guide.step]?.action?.id ===
        'hideLargestGroup'
    if (onFilterStep) return
    setGroupHidden(guideHidGroup, false)
    setGuideHidGroup(null)
  }, [guide, guideHidGroup, setGroupHidden])

  // Escape works inward-out: the guide first, then the card, then the review
  // sheet. The guide is outermost because it is the thing most likely to be in
  // the way, and the only one a reader may not realise they can dismiss.
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const guideOpenRef = useRef(guide !== null)
  guideOpenRef.current = guide !== null

  /* ---------------------------------------------- what a step is waiting for */

  const guideSectionId = guide?.kind === 'section' ? guide.id : null
  const guideStepIndex = guide?.kind === 'section' ? guide.step : null
  const guideStep =
    guideSectionId !== null && guideStepIndex !== null
      ? (GUIDE_SECTIONS[guideSectionId].steps[guideStepIndex] ?? null)
      : null

  // Read through a ref so the snapshot below depends on the step alone. Listing
  // the profile itself would re-snapshot on every mark, which is precisely what
  // the baseline exists to measure against.
  const markedCountsRef = useRef({ nodes: 0, edges: 0 })
  markedCountsRef.current = {
    nodes: activeProfile?.nodeIds.size ?? 0,
    edges: activeProfile?.edgeIds.size ?? 0,
  }

  useEffect(() => {
    setGuideBaseline(markedCountsRef.current)
  }, [guideSectionId, guideStepIndex])

  const guideAwaitMet = useMemo(() => {
    const awaits = guideStep?.awaits
    if (!awaits) return false
    if (awaits.id === 'hasProfile') return activeProfile !== null
    const counts = {
      nodes: activeProfile?.nodeIds.size ?? 0,
      edges: activeProfile?.edgeIds.size ?? 0,
    }
    if (awaits.id === 'markedVariable') return counts.nodes > guideBaseline.nodes
    return counts.edges > guideBaseline.edges
  }, [guideStep, activeProfile, guideBaseline])

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
      if (guideOpenRef.current) closeGuide()
      else if (selectionRef.current) setSelection(null)
      else setReviewOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeGuide])

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

  /**
   * The whole intervention picture for whichever persona is chosen.
   *
   * With no persona the summary is still computed, against an empty
   * applicability map — so every reached node lands in `beyond` and everything
   * else in `untouched`, which is exactly the whitespace view. One code path,
   * no special case.
   */
  /**
   * The active profile seen as a persona. Its marks answer what matters to this
   * person; its characteristics decide which programmes reach them. Two inputs
   * to two different questions, which is why neither is derived from the other.
   */
  const interventionPersona = useMemo(
    () =>
      interventionWhitespace || !activeProfile
        ? null
        : {
            characteristics: activeProfile.characteristics,
            applicabilityNodes: [...activeProfile.nodeIds],
          },
    [interventionWhitespace, activeProfile],
  )

  const interventionSummary = useMemo(() => {
    if (interventionPersona) {
      return summariseForPersona(
        interventionPersona,
        programmes,
        behaviourIndex,
        allNodeIds,
      )
    }
    // Whitespace ignores gates outright. Running it through an empty persona
    // instead looked equivalent and is not: with no characteristics every gated
    // programme comes back undetermined rather than applying, so the view
    // counted only the ungated programmes and reported 19 reached where the
    // answer is 28.
    const reached = reachOf(programmes, behaviourIndex)
    return {
      reached,
      covered: [],
      gaps: [],
      beyond: allNodeIds.filter((id) => reached.has(id)),
      untouched: allNodeIds.filter((id) => !reached.has(id)),
      // Nothing to be outside of: `outside` means "in this persona's map and
      // unreachable", and there is no persona here.
      outside: [],
      applicability: {
        applies: [...programmes],
        excluded: [],
        undetermined: [],
      },
    }
  }, [interventionPersona])

  const interventionStanding = useMemo(() => {
    const byNode = new Map<number, NodeStanding>()
    for (const id of interventionSummary.covered) byNode.set(id, 'covered')
    for (const id of interventionSummary.gaps) byNode.set(id, 'gap')
    for (const id of interventionSummary.beyond) byNode.set(id, 'beyond')
    for (const id of interventionSummary.untouched) byNode.set(id, 'untouched')
    // MapView toggles only the four named classes, so this one matches nothing
    // and the box draws plain — which is the intent. The standing is still
    // recorded because the card reads this map, and it is the only place the
    // difference from `untouched` is stated.
    for (const id of interventionSummary.outside) byNode.set(id, 'outside')
    return byNode
  }, [interventionSummary])

  /**
   * Which programmes reach the open variable, split by whether this persona is
   * eligible for them.
   *
   * The second list is empty except on a gap. Everywhere else it would either
   * duplicate the first or answer a question nobody asked — on an `outside`
   * variable there is nothing to list, which is the point of the state.
   */
  const interventionReach = useMemo(() => {
    const nodeId = selection?.kind === 'node' ? selection.nodeId : null
    if (mode !== 'intervention' || nodeId === null) {
      return { reaching: [], ineligible: [] }
    }
    const applies = interventionSummary.applicability.applies
    const reaching = provenanceOf(nodeId, applies, behaviourIndex).via
    if (reaching.length > 0) return { reaching, ineligible: [] }

    // Every other programme, not just the excluded ones: an undetermined
    // programme belongs here too, since an unfinished persona should never make
    // a programme that covers this variable disappear from the card.
    const rest = programmes.filter((p) => !applies.includes(p))
    return {
      reaching,
      ineligible: provenanceOf(nodeId, rest, behaviourIndex).via,
    }
  }, [mode, selection, interventionSummary])

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
  /** Whether the persona naming/renaming dialog is on screen. */
  const personaDialogUp = profiling && (!activeProfile || personaForm !== null)

  /**
   * The factor the card hangs off. An edge card anchors to the connection's
   * target, which is where the eye already is after following an arrow.
   */
  const anchorNodeId = useMemo(() => {
    if (!selection) return null
    // Intervention hangs a card off factors only: its whole subject is which
    // programmes reach a variable, and a connection is not something a
    // programme reaches.
    if (mode === 'intervention') {
      return selection.kind === 'node' ? selection.nodeId : null
    }
    if (!profiling) return null
    if (selection.kind === 'node') return selection.nodeId
    return selectedEdge?.connection.targetId ?? null
  }, [mode, profiling, selection, selectedEdge])

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
   * The demonstrations.
   *
   * Every one runs only because the reader pressed the button, and none of them
   * throws work away: the guide frames and reveals, but never clears a trace, a
   * selection or a profile.
   */
  const runGuideAction = useCallback(
    (id: GuideActionId) => {
      if (id === 'frameOneVariable') {
        // Framing one variable lands at the follow-zoom ceiling, which is the
        // point labels become readable — the whole claim the step is making.
        const node =
          nodes.find((n) => n.label === DEMO_VARIABLE_LABEL) ?? nodes[0]
        if (node) frameNodes([node.id])
        return
      }
      if (id === 'prefillSearch') {
        searchRef.current?.prefill(DEMO_QUERY)
        return
      }
      if (id === 'openDemoVariable') {
        const node =
          nodes.find((n) => n.label === DEMO_VARIABLE_LABEL) ?? nodes[0]
        if (!node) return
        setSelection({ kind: 'node', nodeId: node.id })
        frameNodes([node.id], DETAIL_PANEL_PX)
        return
      }
      if (id === 'openDemoConnection') {
        // A connection leaving the same variable the previous step opened, so the
        // two steps read as one walk rather than jumping across the map.
        const node =
          nodes.find((n) => n.label === DEMO_VARIABLE_LABEL) ?? nodes[0]
        const connection = node
          ? (outgoingByNode.get(node.id)?.[0] ??
            incomingByNode.get(node.id)?.[0])
          : undefined
        if (!connection) return
        setSelection({ kind: 'edge', connectionId: connection.id })
        frameNodes([connection.sourceId, connection.targetId], DETAIL_PANEL_PX)
        return
      }
      if (id === 'traceForwards') {
        setTraceDirection('downstream')
        return
      }
      if (id === 'startDemoTrace') {
        // Forwards as well as a start: every step after this one talks about
        // what lies downstream and about arriving at the energy core, and
        // neither is true of a backward trace or a loop search.
        setTraceDirection('downstream')
        const node =
          nodes.find((n) => n.label === DEMO_VARIABLE_LABEL) ?? nodes[0]
        if (!node) return
        setTraceStartId(node.id)
        setFocusedRouteKey(null)
        setAnimatedHops(null)
        // Reset the limit explicitly rather than relying on the effect that does
        // it when the start changes: run the walkthrough twice and the start is
        // already this variable, so that effect never fires and the slider is left
        // wherever it was. It was sitting at maximum, which left the next step's
        // "widen the trace" with nothing to widen and the step after it pushing
        // the slider backwards.
        setMaxSteps(DEFAULT_MAX_STEPS)
        return
      }
      if (id === 'widenTrace') {
        // Two steps further out, capped at this start's full reach so the slider
        // is never pushed past its own end.
        setMaxSteps((current) =>
          Math.min(current + 2, tracePaths?.stepsForAll ?? current),
        )
        return
      }
      if (id === 'exceedListCap') {
        // Just past the point the list gives up, which is the whole subject of
        // the step: the map keeps drawing, the list stops writing.
        setMaxSteps(
          Math.min(LIST_MAX_HOPS + 2, tracePaths?.stepsForAll ?? LIST_MAX_HOPS),
        )
        return
      }
      if (id === 'frameMarkedNeighbourhood') {
        // The marked variables together with the ring of suggestions around them,
        // which is what the step is asking the reader to look at. Read-only: it
        // moves the view and touches nothing in the profile.
        if (!activeProfile) return
        const marked = [...activeProfile.nodeIds]
        if (!marked.length) return
        // frontierOf directly rather than the memo below, which is declared after
        // this callback; it is pure and one button press is not worth the ordering
        // it would impose on the file.
        frameNodes([...marked, ...frontierOf(activeProfile)])
        return
      }
      if (id === 'openReview') {
        setReviewOpen(true)
        return
      }
      if (id === 'showWhitespace') {
        // The reader may arrive with a persona already chosen from a previous
        // visit, and the step's whole subject is the view without one.
        setInterventionWhitespace(true)
        setGapsOnly(false)
        setSelection(null)
        return
      }
      if (id === 'showGuidePersona') {
        // Whichever profile is active, or the first one there is. Does nothing
        // at all when the reader has none, which the step's copy allows for —
        // this mode cannot create a profile, and inventing one here would put
        // work in their store that they did not ask for.
        const profile = activeProfile ?? profiles[0]
        if (!profile) return
        setActiveProfileId(profile.id)
        setInterventionWhitespace(false)
        return
      }
      if (id === 'openReachedVariable' || id === 'openUnreachedVariable') {
        // Chosen from the data every time rather than named here. The inventory
        // is regenerated from a spreadsheet that is still being corrected, and a
        // hardcoded variable would eventually demonstrate the opposite of what
        // its step claims.
        const wanted =
          id === 'openReachedVariable'
            ? // The most-reached variable, so the card has a substantial list
              // to show rather than a lone programme.
              [...interventionSummary.reached].sort(
                (a, b) =>
                  provenanceOf(b, programmes, behaviourIndex).via.length -
                  provenanceOf(a, programmes, behaviourIndex).via.length,
              )[0]
            : // Prefer one in the persona's own map, where the card can draw the
              // distinction the step is about; otherwise any unreached variable.
              (interventionSummary.gaps[0] ??
              interventionSummary.outside[0] ??
              interventionSummary.untouched[0])
        if (wanted === undefined) return
        setSelection({ kind: 'node', nodeId: wanted })
        frameNodes([wanted])
        return
      }
      if (id === 'playDemoRoute') {
        // Routes are sorted shortest first, and the shortest here is two hops —
        // barely a walk. Prefer the first route long enough to watch advance,
        // while staying short enough not to outstay the step.
        const routes = search?.routes ?? []
        const route =
          routes.find((r) => r.length >= 3 && r.length <= 5) ?? routes[0]
        if (!route) return
        setFocusedRouteKey(route.key)
        setAnimatedHops(0)
      }
      if (id === 'hideLargestGroup') {
        // The biggest group, so the change is impossible to miss on a map of 108
        // boxes. Remembered so it can be put back when the reader moves on.
        const groups =
          taxonomy === 'type'
            ? variableTypes.map((t) => ({ name: t.name, count: t.nodeCount }))
            : atlasClusters.map((c) => ({ name: c.name, count: c.nodeCount }))
        const biggest = groups.reduce(
          (best, entry) => (entry.count > best.count ? entry : best),
          groups[0],
        )
        if (!biggest) return
        setGroupHidden(biggest.name, true)
        setGuideHidGroup(biggest.name)
      }
    },
    [
      taxonomy,
      setGroupHidden,
      tracePaths,
      search,
      frameNodes,
      activeProfile,
      profiles,
      interventionSummary,
    ],
  )

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
      frameNodes(framed, TRACE_PANEL_PX)
    }
  }, [mode, tracePaths, search, focusedRouteKey, animatedHops, frameNodes])

  /**
   * Intervention's whitespace view is persona-independent by design — it asks
   * what HPB reaches for anyone — so it is given no marks at all. Otherwise the
   * active profile's connections would be drawn across a view that is not about
   * that profile, and would be the only thing on screen claiming a persona.
   */
  const showingMarks = !(mode === 'intervention' && interventionWhitespace)
  const markedNodeIds =
    showingMarks ? (activeProfile?.nodeIds ?? NO_MARKS) : NO_MARKS
  const markedEdgeIds =
    showingMarks ? (activeProfile?.edgeIds ?? NO_EDGE_MARKS) : NO_EDGE_MARKS

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
        onOpenGuide={openGuide}
        guideOpen={guide !== null}
        highContrast={highContrast}
        onHighContrastChange={setHighContrast}
      >
        <SearchBar
          ref={searchRef}
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
          markedOnly={markedOnly}
          intervention={
            mode === 'intervention' ? interventionStanding : undefined
          }
          gapsOnly={gapsOnly}
          bottomInset={
            profiling || mode === 'intervention' ? PROFILE_BAR_PX : 0
          }
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

            {importNotice && (
              <div
                role="status"
                className="absolute inset-x-0 bottom-12 z-30 flex items-start gap-2 border-t border-gray-200 bg-white/97 px-3 py-2 text-[12px] leading-snug text-gray-700 backdrop-blur"
              >
                <span className="min-w-0 flex-1">{importNotice}</span>
                <button
                  type="button"
                  onClick={() => setImportNotice(null)}
                  aria-label="Dismiss"
                  className="-mr-1 shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
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
            )}

            <ProfileBar
              profiles={profiles}
              profile={activeProfile}
              markedNodes={activeProfile.nodeIds.size}
              markedEdges={activeProfile.edgeIds.size}
              unmarkedLinks={links.length}
              reviewOpen={reviewOpen}
              onToggleReview={() => setReviewOpen((open) => !open)}
              markedOnly={markedOnly}
              onMarkedOnlyChange={changeMarkedOnly}
              onExportPng={exportPng}
              exportState={exportState}
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
        {personaDialogUp && (
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
          // Intervention carries a bar of its own, the same height as Profile's.
          // It was left out here, so the legend sat on top of the persona picker.
          bottomInset={
            profiling || mode === 'intervention' ? PROFILE_BAR_PX : 0
          }
          highContrast={highContrast}
          showSwatches={mode !== 'intervention'}
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

        {mode === 'intervention' && (
          <InterventionCard
            anchor={anchor}
            container={stage}
            node={selectedNode}
            standing={
              selectedNode ? interventionStanding.get(selectedNode.id) : undefined
            }
            reaching={interventionReach.reaching}
            ineligible={interventionReach.ineligible}
            withPersona={interventionPersona !== null}
            onClose={clearSelection}
          />
        )}

        {mode === 'intervention' && (
          <InterventionKey
            personaName={interventionPersona ? (activeProfile?.name ?? null) : null}
            bottomInset={PROFILE_BAR_PX + MINIMAP_STACK_PX}
          />
        )}

        {mode === 'intervention' && (
          <InterventionBar
            profiles={profiles}
            personaId={interventionWhitespace ? null : activeProfileId}
            onPersonaChange={(id) => {
              // Selecting a persona here selects it everywhere: one answer to
              // "who are we talking about" for the whole app.
              if (id) {
                setActiveProfileId(id)
                setInterventionWhitespace(false)
              } else {
                setInterventionWhitespace(true)
                setGapsOnly(false)
              }
            }}
            gapsOnly={gapsOnly}
            onGapsOnlyChange={setGapsOnly}
            summary={interventionSummary}
            applicability={
              interventionPersona ? interventionSummary.applicability : null
            }
          />
        )}

        {/* Last, so it sits above every panel it might be describing. */}
        {guide?.kind === 'contents' && (
          <GuideContents
            mode={mode}
            onStart={startGuideSection}
            onClose={closeGuide}
            warnLosingTrace={tracing && traceStartId !== null}
            bottomInset={profiling ? PROFILE_BAR_PX : 0}
            onHeightChange={setGuideHeight}
          />
        )}
        {/* Stands aside for the persona dialog rather than overlapping it. The
            card is 440px at the bottom-centre and the dialog is 352px in the
            middle, so the two collide exactly where the dialog keeps its Start
            profile button — a guide covering the control it is asking you to press.
            No copy is lost by waiting: the dialog opens by explaining what a
            profile is, which is what this step says, and the step's tick appears
            the moment a persona is named. */}
        {guide?.kind === 'section' && !personaDialogUp && (
          <GuideCard
            section={GUIDE_SECTIONS[guide.id]}
            index={guide.step}
            onIndexChange={setGuideStep}
            onClose={closeGuide}
            onAction={runGuideAction}
            onFinish={showGuideContents}
            bottomInset={profiling ? PROFILE_BAR_PX : 0}
            onHeightChange={setGuideHeight}
            awaitMet={guideAwaitMet}
          />
        )}
      </div>
    </div>
  )
}
