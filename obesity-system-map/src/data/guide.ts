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
 * Covering the basics and all four modes properly takes twenty-four steps, and
 * nobody finishes a twenty-four-step tour. Split up, the longest run is six, and
 * somebody stuck on Profile in three months can open just that.
 */
export type GuideSectionId =
  | 'basics'
  | 'explore'
  | 'trace'
  | 'profile'
  | 'intervention'

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
  | 'frameMarkedNeighbourhood'
  | 'openReview'
  | 'showWhitespace'
  | 'showGuidePersona'
  | 'openReachedVariable'
  | 'openUnreachedVariable'

/**
 * Something the reader has to do before a step is satisfied.
 *
 * Profile's steps wait rather than demonstrate. Marking edits real saved work, so
 * the guide will not do it on anyone's behalf — and marking is the one thing in
 * this mode you cannot learn by watching. Waiting is also what makes the sequence
 * hold together: each step leaves the profile in the state the next one explains.
 */
export type GuideAwaitId =
  | 'hasProfile'
  | 'markedVariable'
  | 'markedConnection'

export interface GuideStep {
  title: string
  /** Short paragraphs. Plain text: the card renders each as its own <p>. */
  body: readonly string[]
  action?: { label: string; id: GuideActionId }
  /**
   * Waits for the reader instead of doing it for them. `prompt` asks; `done`
   * confirms and says what to look at. Next is never blocked — a guide that traps
   * you until you comply is worse than one you can walk away from.
   */
  awaits?: { id: GuideAwaitId; prompt: string; done: string }
  /**
   * Where the card sits. Bottom by default; 'top' for the step that opens the
   * review sheet, which fills the bottom of the stage and would otherwise be
   * covered by the card describing it.
   */
  place?: 'top' | 'bottom'
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
   * first-run tour, whose last step introduces the four modes — the moment to
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
      title: 'Four ways to work',
      body: [
        'Explore is for reading: click anything to find out what it is. Trace follows cause and effect from one variable. Profile marks up the variables that matter for one person.',
        'Intervention is the only one that brings in something outside the map: it shows which variables HPB’s programmes reach, and which nothing reaches at all.',
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

/**
 * Profile's walkthrough, ordered so each step leaves behind what the next one
 * needs.
 *
 * Marking a variable makes the suggestion rings appear, which is what step three
 * is about; marking one of those rings puts two connected variables in the
 * profile, which is the only way the dot in step five can exist at all. Explaining
 * the dot before anything is marked would be describing something that is not on
 * screen — which is roughly the state the mode was in before this guide.
 */
const PROFILE: GuideSection = {
  id: 'profile',
  label: 'Profile',
  blurb: 'Marking up the variables that matter for one person.',
  mode: 'profile',
  steps: [
    {
      title: 'What a profile is',
      body: [
        'A profile is one point of view on the map: you mark the variables and connections you judge to matter for a single person.',
        "Marked or not — there is no scoring. And it is your judgement, not the map's.",
      ],
      awaits: {
        id: 'hasProfile',
        prompt: 'Name a persona in the box on the map to begin.',
        done: 'Ready.',
      },
    },
    {
      title: 'Marking a variable',
      body: [
        'Click any variable to open its card, then press "Mark this variable".',
        'Opening a variable never marks it. That is deliberate: you can read your way around the map without changing anything.',
      ],
      awaits: {
        id: 'markedVariable',
        prompt: 'Mark any variable to carry on.',
        done: 'Marked — and it has its colour back.',
      },
    },
    {
      title: 'Grey, colour, and rings',
      body: [
        'In this mode the whole map drains to grey, and marking a variable gives it its colour back. So colour means you chose it.',
        'A white box with a coloured ring is a suggestion: a variable one step away from something you have already marked.',
      ],
      action: {
        label: 'Show me the suggestions',
        id: 'frameMarkedNeighbourhood',
      },
    },
    {
      title: 'Follow a suggestion',
      body: [
        'The rings answer "where next?". Marking one extends the profile a step at a time, which is how a profile is meant to grow — by hand, not by asking the map to fill it in.',
      ],
      awaits: {
        id: 'markedVariable',
        prompt: 'Mark one of the ringed variables.',
        done: 'Two connected variables are marked now. Look at the line between them.',
      },
    },
    {
      title: 'The dot on a line',
      body: [
        'When both ends of a connection are marked but the connection itself is not, a small dot appears in the middle of that line. Clicking the dot marks the connection.',
        'It is the map noticing you probably meant to include the link. You can also tick connections directly in a variable’s card.',
      ],
      awaits: {
        id: 'markedConnection',
        prompt: 'Click a dot on the map, or tick a connection in a card.',
        done: 'Marked — that line is now solid black.',
      },
    },
    {
      title: 'Review, and keeping your work',
      body: [
        'Review lists everything you have marked — variables, connections, and any links still waiting, with "Mark all" to accept them together. Anything can be unticked from there.',
        'Profiles save in this browser as you work. Export JSON keeps a copy to share or reimport, and the three-dot menu renames and deletes.',
      ],
      action: { label: 'Open Review', id: 'openReview' },
      // The sheet fills the bottom of the stage, so the card moves out of its way.
      place: 'top',
    },
  ],
}

/**
 * Intervention's walkthrough.
 *
 * This mode needs more explaining than the other three, because it is the only
 * one showing something that is not in the map: an inventory of programmes, and
 * a claim about which variables each one touches. A reader who does not know
 * that chain exists reads the colours as facts about obesity rather than facts
 * about HPB, so the first step spends its whole length on where the colour comes
 * from.
 *
 * It ends on gates rather than opening with them. Eligibility is the part people
 * already have a mental model for, and it is meaningless until you have seen a
 * programme list to be eligible for.
 */
const INTERVENTION: GuideSection = {
  id: 'intervention',
  label: 'Intervention',
  blurb: 'Where HPB’s programmes reach, and where they do not.',
  mode: 'intervention',
  steps: [
    {
      title: 'What this mode is showing',
      body: [
        'Every HPB programme is tagged with the behaviours it addresses, and each behaviour covers a handful of variables on the map. Colour here means a programme reaches that variable — it says nothing about how well, or how much.',
        'With nobody chosen, the map answers one question: what does HPB touch at all? Everything left white is whitespace.',
      ],
      action: { label: 'Show me the whitespace', id: 'showWhitespace' },
    },
    {
      title: 'One person at a time',
      body: [
        'Pick a persona from the box at the bottom and the map splits four ways: what matters to them and is reached, what matters and is not, what is reached but is outside their map, and everything else.',
        'The list is the same profiles you make in Profile mode — this mode keeps no personas of its own.',
      ],
      action: { label: 'Use a persona', id: 'showGuidePersona' },
    },
    {
      title: 'Which programmes reach a variable',
      body: [
        'Click any box. The card names every programme that reaches it, grouped under the behaviour each one came through.',
        'That behaviour line is the working. A programme "reaching" a variable is a claim someone made when tagging the inventory, and the behaviour is how you check it.',
      ],
      action: { label: 'Open a reached one', id: 'openReachedVariable' },
    },
    {
      title: 'When nothing reaches it',
      body: [
        'An empty box is two different situations. Either no programme that applies to this person reaches it — a gap, and somewhere to act — or no programme reaches it for anyone, so there is nothing to point at it without adding a behaviour first.',
        'Most of the map is the second kind, and much of that is correct: nothing acts directly on resting metabolic rate. The card tells you which you are looking at.',
      ],
      action: { label: 'Open one nothing reaches', id: 'openUnreachedVariable' },
    },
    {
      title: 'Who a programme is for',
      body: [
        'Each programme carries a rule about who it is for — an age band, a life stage, being a parent or a smoker. The persona’s characteristics decide which ones count, and the bar says how many of the inventory applied.',
        'Leave a characteristic unset and any programme testing it is reported as undetermined rather than dropped, so an unfinished persona never quietly shrinks the map. Fill them in under Edit persona in Profile mode.',
      ],
    },
  ],
}

export const GUIDE_SECTIONS: Record<GuideSectionId, GuideSection> = {
  basics: BASICS,
  explore: EXPLORE,
  trace: TRACE,
  profile: PROFILE,
  intervention: INTERVENTION,
}

/** Contents order. The mode you are in is floated to the top by the card. */
export const GUIDE_ORDER: readonly GuideSectionId[] = [
  'basics',
  'explore',
  'trace',
  'profile',
  'intervention',
]
