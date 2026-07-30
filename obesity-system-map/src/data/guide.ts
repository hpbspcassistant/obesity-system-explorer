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

/** Sections are separately runnable; more arrive with the per-mode guides. */
export type GuideSectionId = 'basics'

/**
 * A demonstration a step can offer. Performed by App, which owns the map handle
 * and every piece of state involved — and only ever when the reader asks for it.
 */
export type GuideActionId =
  | 'frameOneVariable'
  | 'prefillSearch'
  | 'hideLargestGroup'

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

export const GUIDE_SECTIONS: Record<GuideSectionId, GuideSection> = {
  basics: BASICS,
}
