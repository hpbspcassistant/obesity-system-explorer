/**
 * Content for the guided walkthroughs.
 *
 * Kept as data rather than markup so the copy can be read and revised in one
 * place, and so the card that renders it stays a single component no matter how
 * many sections there are.
 *
 * The tour deliberately never points at a screen position. The legend shifts by
 * the width of whatever panel is open, and the header wraps to two rows in
 * Trace, so a bubble pinned to "the key, bottom right" would be wrong in half
 * the modes and would break again the next time the layout moves. Steps instead
 * make the thing they describe *do* something, and attention follows the change.
 */

import type { MapMode } from '../types'

/**
 * Sections run separately rather than as one queue.
 *
 * Covering the basics and all three modes properly takes about nineteen steps,
 * and nobody finishes a nineteen-step tour. Split up, the longest run is six, and
 * somebody stuck on Profile in three months can open just that.
 */
export type GuideSectionId = 'basics' | 'explore' | 'trace'

/**
 * A demonstration a step can offer. Performed by App, which owns the map handle
 * and every piece of state involved — and only ever when the reader asks for it.
 */
export type GuideActionId =
  | 'frameOneVariable'
  | 'prefillSearch'
  | 'hideLargestGroup'
  | 'openDemoVariable'
  | 'openDemoConnection'
  | 'traceForwards'
  | 'startDemoTrace'
  | 'widenTrace'
  | 'exceedListCap'
  | 'playDemoRoute'

export interface GuideStep {
  title: string
  /** Short paragraphs. Plain text: the card renders each as its own <p>. */
  body: readonly string[]
  action?: { label: string; id: GuideActionId }
}

export interface GuideSection {
  id: GuideSectionId
  /** Named above the progress dots, so a long guide reads as structured. */
  label: string
  /** One line in the contents list, saying what the section covers. */
  blurb: string
  /**
   * The mode the section describes, switched to when it starts. Its
   * demonstrations act on that mode's interface, so running it anywhere else
   * would show nothing.
   */
  mode?: MapMode
  /**
   * Whether finishing lands on the contents rather than closing. True for the
   * first-run tour, whose last step introduces the three modes — the moment to
   * offer a closer look at one.
   */
  endsAtContents?: boolean
  steps: readonly GuideStep[]
}

/**
 * The variable the tour frames to prove labels become readable. Resolved by
 * label rather than id so it survives the data being rebuilt, with a fallback if
 * it ever disappears.
 */
export const DEMO_VARIABLE_LABEL = 'TV Watching'

/** What the tour types into the search box on the reader's behalf. */
export const DEMO_QUERY = 'walkability'

const BASICS: GuideSection = {
  id: 'basics',
  label: 'Getting started',
  blurb: 'What the map is, and how to move around it.',
  endsAtContents: true,
  steps: [
    {
      title: 'The Foresight obesity map',
      body: [
        '108 variables that influence obesity, joined by 296 arrows. Each arrow says that more of one thing leads to more — or less — of another.',
        "It is adapted from the UK Government's Foresight programme, 2007.",
      ],
    },
    {
      title: 'Getting around',
      body: [
        'The map opens with everything in view, which is far too small to read. Zoom in and the labels appear.',
        'Scroll to zoom, drag to move around, or use the + and − buttons at the top right. Fit puts the whole map back in view.',
      ],
      action: { label: 'Zoom in', id: 'frameOneVariable' },
    },
    {
      title: 'Finding a variable',
      body: [
        'Type part of a name into the search box and pick it from the list. The map goes straight to that variable and opens what it says.',
      ],
      action: { label: 'Try the search', id: 'prefillSearch' },
    },
    {
      title: 'Colours and filtering',
      body: [
        "Every variable belongs to one of ten colour groups. The key at the bottom right shows them, and can switch between the map's own grouping and the atlas's.",
        'Click a group in the key to hide it — the quickest way to cut the map down to what you care about.',
      ],
      action: { label: 'Hide a group', id: 'hideLargestGroup' },
    },
    {
      title: 'Three ways to work',
      body: [
        'Explore is for reading: click anything to find out what it is. Trace follows cause and effect from one variable. Profile marks up the variables that matter for one person.',
        'Switch between them with the buttons at the top. You can reopen this guide whenever you like with the question mark button.',
      ],
    },
  ],
}

const EXPLORE: GuideSection = {
  id: 'explore',
  label: 'Explore',
  blurb: 'Reading variables and connections.',
  mode: 'explore',
  steps: [
    {
      title: 'Reading a variable',
      body: [
        'Click any box on the map. A panel opens with what that variable means, the groups it belongs to, and every connection running into and out of it.',
        'The rest of the map fades while it is open, so you are left looking at that variable and its immediate neighbours.',
      ],
      action: { label: 'Open one for me', id: 'openDemoVariable' },
    },
    {
      title: 'Reading a connection',
      body: [
        'Click an arrow instead and you get the link itself: which variable affects which.',
      ],
      action: { label: 'Open a connection', id: 'openDemoConnection' },
    },
    {
      title: 'Following the connections',
      body: [
        "The two lists in a variable's panel are clickable. Choosing one opens that connection, and from there you can open either end of it.",
      ],
    },
  ],
}

const TRACE: GuideSection = {
  id: 'trace',
  label: 'Trace',
  blurb: 'Following cause and effect from one variable.',
  mode: 'trace',
  steps: [
    {
      title: 'Pick a direction first',
      body: [
        'The three buttons at the top decide what clicking a variable means: follow the arrows forward from a cause, follow them backward from an outcome, or look for loops that come back round to where they started.',
        'Choose before you click, because the same variable answers a different question in each.',
      ],
      action: { label: 'Show me forwards', id: 'traceForwards' },
    },
    {
      title: 'Choose a starting variable',
      body: [
        'Click a variable on the map, or search for one. It takes a teal ring, and the panel says how much of the map lies downstream of it.',
        'Clicking it again, or clicking empty space, clears the trace.',
      ],
      action: { label: 'Start a trace for me', id: 'startDemoTrace' },
    },
    {
      title: 'How far to follow',
      body: [
        'A step is one arrow. The slider limits how long a chain may be.',
        'The counts underneath say how many variables and arrows are lit.',
      ],
      action: { label: 'Widen the trace', id: 'widenTrace' },
    },
    {
      title: 'Why the list stops short',
      body: [
        'The map draws every path within the limit you set. The list cannot: past six steps there are tens of thousands of routes, more than anyone could read.',
        'So the list sticks to routes of six steps or fewer, and says how many lit variables it has left out.',
      ],
      action: { label: 'Go past six steps', id: 'exceedListCap' },
    },
    {
      title: 'Follow one path',
      body: [
        'Hover a route in the list to preview it on the map, and click it to keep it there.',
        'Then press Trace on that route to walk it one arrow at a time. Each line says whether that link pushes its target up or down, and orange marks arrival at the energy core.',
      ],
      action: { label: 'Walk a route', id: 'playDemoRoute' },
    },
  ],
}

export const GUIDE_SECTIONS: Record<GuideSectionId, GuideSection> = {
  basics: BASICS,
  explore: EXPLORE,
  trace: TRACE,
}

/** Contents order. The mode you are in is floated to the top by the card. */
export const GUIDE_ORDER: readonly GuideSectionId[] = [
  'basics',
  'explore',
  'trace',
]
