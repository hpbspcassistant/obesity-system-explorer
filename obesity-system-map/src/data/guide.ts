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
 * Covering the basics and all four modes properly takes more than twenty steps,
 * and nobody finishes a tour that long. Split up, the longest run is six, and
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
  blurb: 'Learn what the map shows and how to move around.',
  endsAtContents: true,
  steps: [
    {
      title: 'What this map shows',
      body: [
        'This map shows 108 variables that can affect obesity.',
        "Arrows show how one variable can change another. The map is adapted from the UK Government's Foresight programme, 2007.",
      ],
    },
    {
      title: 'Move around the map',
      body: [
        'Zoom in to read the labels. Scroll or use the + and − buttons.',
        'Drag the map to move around. Select Fit to see the whole map again.',
      ],
      action: { label: 'Zoom in', id: 'frameOneVariable' },
    },
    {
      title: 'Finding a variable',
      body: [
        'Type a name in the search box. Choose a result to go straight to that variable.',
      ],
      action: { label: 'Try the search', id: 'prefillSearch' },
    },
    {
      title: 'Use colours and filters',
      body: [
        'Colours put similar variables into groups. The key tells you what each colour means.',
        'Use Filter to show only the groups you want. You can group variables by Type or Cluster.',
      ],
      action: { label: 'Hide a group', id: 'hideLargestGroup' },
    },
    {
      title: 'Choose a mode',
      body: [
        'Explore helps you read the map. Trace follows pathways between variables.',
        'Profile lets you mark what matters to one person. Intervention shows what HPB programmes reach.',
        'Use the buttons at the top to change mode. Select ? to open these guides again.',
      ],
    },
  ],
}

const EXPLORE: GuideSection = {
  id: 'explore',
  label: 'Explore',
  blurb: 'Learn how to read variables and connections.',
  mode: 'explore',
  steps: [
    {
      title: 'Open a variable',
      body: [
        'Select any variable. A panel shows what it means and which variables connect to it.',
        'The rest of the map fades so you can focus on this part.',
      ],
      action: { label: 'Open one for me', id: 'openDemoVariable' },
    },
    {
      title: 'Open a connection',
      body: [
        'Select an arrow to see which variable affects the other one.',
      ],
      action: { label: 'Open a connection', id: 'openDemoConnection' },
    },
    {
      title: 'Following the connections',
      body: [
        "Select a connection in the variable's panel to open it. You can then open either variable at its ends.",
      ],
    },
  ],
}

const TRACE: GuideSection = {
  id: 'trace',
  label: 'Trace',
  blurb: 'Follow pathways from one variable.',
  mode: 'trace',
  steps: [
    {
      title: 'Choose a starting variable',
      body: [
        'Select a variable on the map, or find one with search. A teal ring marks where the trace starts.',
      ],
      action: { label: 'Choose one for me', id: 'startDemoTrace' },
    },
    {
      title: 'Ask a question',
      body: [
        'Affects shows what this variable can change. Affected by shows what can change it.',
        'Loops shows reinforcing paths that return to the same variable.',
      ],
      action: { label: 'Show what it affects', id: 'traceForwards' },
    },
    {
      title: 'How far to follow',
      body: [
        'Direct shows short paths. Nearby and Wider show more of the system.',
        'One step means one arrow. Use More distance options for a longer path.',
      ],
      action: { label: 'Widen the trace', id: 'widenTrace' },
    },
    {
      title: 'Follow a pathway',
      body: [
        'Select a pathway to highlight it on the map. Select Show more to see more pathways.',
        'Select Play path to follow it one arrow at a time.',
      ],
      action: { label: 'Play a pathway', id: 'playDemoRoute' },
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
  blurb: 'Build a map of what matters to one person.',
  mode: 'profile',
  steps: [
    {
      title: 'What a profile is',
      body: [
        'A profile is a smaller map for one person. You choose which variables and connections matter to them.',
        'There are no scores or right answers.',
      ],
      awaits: {
        id: 'hasProfile',
        prompt: 'Give the profile a name to begin.',
        done: 'Your profile is ready.',
      },
    },
    {
      title: 'Marking a variable',
      body: [
        'Select a variable to open its card. Then select Mark this variable.',
        'Opening a variable does not mark it. You can read it without changing your profile.',
      ],
      awaits: {
        id: 'markedVariable',
        prompt: 'Mark one variable to continue.',
        done: 'It is now coloured to show that it is marked.',
      },
    },
    {
      title: 'What the colours mean',
      body: [
        'Grey variables are not in the profile. Coloured variables are marked.',
        'A white variable with a coloured ring is a suggestion. It connects to something you already marked.',
      ],
      action: {
        label: 'Show me the suggestions',
        id: 'frameMarkedNeighbourhood',
      },
    },
    {
      title: 'Add another variable',
      body: [
        'Choose a ringed variable and mark it. This grows the profile one connection at a time.',
      ],
      awaits: {
        id: 'markedVariable',
        prompt: 'Mark one of the ringed variables.',
        done: 'Two connected variables are now marked. Look at the line between them.',
      },
    },
    {
      title: 'Mark a connection',
      body: [
        'A dot appears when both variables are marked but the connection between them is not.',
        'Select the dot to mark the connection. You can also mark it in a variable card.',
      ],
      awaits: {
        id: 'markedConnection',
        prompt: 'Select a dot on the map, or mark a connection in a card.',
        done: 'The connection is now marked with a solid black line.',
      },
    },
    {
      title: 'Check your work',
      body: [
        'Review shows all marked variables and connections. You can remove marks or add missing connections there.',
        'Your profile saves automatically. Use Export to download a copy.',
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
  blurb: 'See what HPB programmes cover and where gaps remain.',
  mode: 'intervention',
  steps: [
    {
      title: 'See what programmes cover',
      body: [
        'This mode compares HPB programmes with variables on the map.',
        'A coloured variable is reached by a programme. An empty variable is not reached.',
      ],
      action: { label: 'Show me', id: 'showWhitespace' },
    },
    {
      title: 'Choose a profile',
      body: [
        'Choose a profile to see which programmes are relevant to that person.',
        'The map then shows what is covered and where there may be an opportunity.',
      ],
      action: { label: 'Use a persona', id: 'showGuidePersona' },
    },
    {
      title: 'Check a variable',
      body: [
        'Select any variable to see which programmes reach it.',
        'The card also explains why each programme is linked to that variable.',
      ],
      action: { label: 'Open a reached one', id: 'openReachedVariable' },
    },
    {
      title: 'Find opportunity areas',
      body: [
        "An opportunity area is a variable in the person's profile that no relevant programme reaches.",
        'Open it to see whether a programme covers it for other people, or no programme covers it at all.',
      ],
      action: { label: 'Open an opportunity area', id: 'openUnreachedVariable' },
    },
    {
      title: 'Who a programme is for',
      body: [
        'Some programmes are only for certain people, such as an age group, a parent, or a smoker.',
        'Profile details help the tool decide which programmes apply. If a detail is missing, the programme is marked Undetermined instead of being removed.',
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

/** Fixed contents order, regardless of which mode is currently open. */
export const GUIDE_ORDER: readonly GuideSectionId[] = [
  'basics',
  'explore',
  'trace',
  'profile',
  'intervention',
]
