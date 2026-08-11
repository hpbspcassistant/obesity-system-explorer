/**
 * Small subsequence fuzzy matcher, sized for the 108 node labels on this map.
 *
 * Query whitespace is ignored, so "phys act" matches "Physical Activity" the
 * same way "physact" would. Scoring favours matches that land on word starts
 * and run consecutively, which keeps whole-word hits above scattered ones.
 */

export interface FuzzyResult {
  score: number
  /** Indices into the original text that matched, for highlighting. */
  indices: number[]
}

const NON_WORD = /[^a-z0-9]/

const CONSECUTIVE_BONUS = 12
const WORD_START_BONUS = 10
const LEADING_BONUS = 6
const GAP_PENALTY = 0.6
const MAX_GAP_PENALTY = 6
/** Mild preference for shorter labels when scores are otherwise close. */
const LENGTH_WEIGHT = 0.06

function isWordStart(haystack: string, index: number): boolean {
  return index === 0 || NON_WORD.test(haystack[index - 1])
}

/**
 * One greedy pass. With `preferWordStart`, each character prefers the next
 * occurrence that begins a word, falling back to the nearest occurrence.
 *
 * The plain pass alone mis-ranks queries like "motor trans", because the
 * leading "m" greedily binds to "do(m)inance" and scatters the rest; the
 * word-start pass binds it to "Motorised" instead. Running both and keeping
 * the better score costs one extra linear scan and fixes that class of query.
 */
function greedyPass(
  needle: string,
  haystack: string,
  preferWordStart: boolean,
): FuzzyResult | null {
  const indices: number[] = []
  let score = 0
  let cursor = 0
  let previous = -2

  for (const char of needle) {
    let found = haystack.indexOf(char, cursor)
    if (found === -1) return null

    // Only hunt for a word start when this character is not already extending
    // the previous match. Jumping away from a consecutive run costs far more
    // than the word-start bonus is worth.
    if (
      preferWordStart &&
      found !== previous + 1 &&
      !isWordStart(haystack, found)
    ) {
      for (let k = found; k !== -1; k = haystack.indexOf(char, k + 1)) {
        if (isWordStart(haystack, k)) {
          found = k
          break
        }
      }
    }

    if (found === previous + 1) {
      score += CONSECUTIVE_BONUS
    } else {
      score -= Math.min((found - cursor) * GAP_PENALTY, MAX_GAP_PENALTY)
    }

    if (found === 0) score += WORD_START_BONUS + LEADING_BONUS
    else if (isWordStart(haystack, found)) score += WORD_START_BONUS

    indices.push(found)
    previous = found
    cursor = found + 1
  }

  return { score, indices }
}

export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const needle = query.toLowerCase().replace(/\s+/g, '')
  if (!needle) return null

  const haystack = text.toLowerCase()
  const plain = greedyPass(needle, haystack, false)
  if (!plain) return null // not a subsequence at all — no pass can match

  const wordly = greedyPass(needle, haystack, true)
  const best = wordly && wordly.score > plain.score ? wordly : plain

  // A literal substring is almost always what the user meant.
  const literal = haystack.indexOf(needle)
  let score = best.score
  if (literal === 0) score += 40
  else if (literal > 0) score += 20

  score -= text.length * LENGTH_WEIGHT
  return { score, indices: best.indices }
}

export interface Ranked<T> {
  item: T
  score: number
  indices: number[]
}

/**
 * Relevance floor, measured as score per character of the query.
 *
 * Being a subsequence is far too weak a test on labels this long: "portion" is a
 * subsequence of "Appropriateness of Maternal Body Composition", and "school" of
 * "Psychological Ambivalence" — which was that query's *only* match, so the field
 * confidently offered one unrelated variable and nothing else.
 *
 * The scores already separate the two cleanly; they just were not being used to
 * reject anything. Measured against all 108 real labels, every match a person
 * would want scores at least 9.5 per character and every match they would not
 * scores at most 8.4, so the gap is wide and 9 sits inside it.
 *
 * Per character rather than absolute, because the bonuses accumulate as the query
 * grows: one fixed floor would judge "tv" and "genetic predisposition" by
 * completely different standards.
 */
const MIN_SCORE_PER_CHAR = 9

/**
 * Ranks items best-first, dropping non-matches and matches too weak to be worth
 * offering. Ties break alphabetically.
 */
export function fuzzyRank<T>(
  query: string,
  items: readonly T[],
  toText: (item: T) => string,
  limit = 8,
): Ranked<T>[] {
  // Same normalisation fuzzyMatch applies, so the floor scales with what was
  // actually matched rather than with the spaces the user happened to type.
  const needle = query.toLowerCase().replace(/\s+/g, '')
  if (!needle) return []
  const floor = needle.length * MIN_SCORE_PER_CHAR

  const ranked: Ranked<T>[] = []

  for (const item of items) {
    const match = fuzzyMatch(query, toText(item))
    if (match && match.score >= floor) {
      ranked.push({ item, score: match.score, indices: match.indices })
    }
  }

  ranked.sort(
    (a, b) => b.score - a.score || toText(a.item).localeCompare(toText(b.item)),
  )
  return ranked.slice(0, limit)
}
