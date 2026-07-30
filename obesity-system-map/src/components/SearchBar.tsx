import { useCallback, useMemo, useRef, useState } from 'react'

import { groupOfNode, nodes } from '../data/systemMap'
import { fuzzyRank } from '../lib/fuzzy'
import type { Node, Taxonomy } from '../types'

interface SearchBarProps {
  onSelectNode: (nodeId: number) => void
  onClear: () => void
  /** Groups currently filtered out, so results can flag hidden nodes. */
  hiddenGroups: ReadonlySet<string>
  taxonomy: Taxonomy
}

const MAX_RESULTS = 8

/** Renders the label with the fuzzy-matched characters emphasised. */
function HighlightedLabel({
  label,
  indices,
}: {
  label: string
  indices: number[]
}) {
  const matched = new Set(indices)
  return (
    <span>
      {[...label].map((char, i) =>
        matched.has(i) ? (
          <mark key={i} className="bg-transparent font-semibold text-gray-900">
            {char}
          </mark>
        ) : (
          <span key={i}>{char}</span>
        ),
      )}
    </span>
  )
}

export function SearchBar({
  onSelectNode,
  onClear,
  hiddenGroups,
  taxonomy,
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const results = useMemo(
    () =>
      query.trim()
        ? fuzzyRank<Node>(query, nodes, (n) => n.label, MAX_RESULTS)
        : [],
    [query],
  )

  const reset = useCallback(() => {
    setQuery('')
    setOpen(false)
    setActiveIndex(0)
    onClear()
  }, [onClear])

  const choose = useCallback(
    (node: Node) => {
      setQuery(node.label)
      setOpen(false)
      setActiveIndex(0)
      onSelectNode(node.id)
      inputRef.current?.blur()
    },
    [onSelectNode],
  )

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value)
      setOpen(value.trim().length > 0)
      setActiveIndex(0)
      // Emptying the field is an explicit "show me everything again".
      if (value.trim().length === 0) onClear()
    },
    [onClear],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        reset()
        inputRef.current?.blur()
        return
      }
      if (!open || results.length === 0) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((i) => (i + 1) % results.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((i) => (i - 1 + results.length) % results.length)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const hit = results[activeIndex]
        if (hit) choose(hit.item)
      }
    },
    [open, results, activeIndex, choose, reset],
  )

  return (
    <div className="relative w-[26rem] max-w-full">
      <div>
        <div className="relative">
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          >
            <circle
              cx="9"
              cy="9"
              r="5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M13.2 13.2 17 17"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>

          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls="node-search-results"
            aria-autocomplete="list"
            placeholder="Search nodes…"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setOpen(query.trim().length > 0)}
            onBlur={() => setOpen(false)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-9 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-200"
          />

          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={reset}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
          )}
        </div>

        {open && (
          <ul
            id="node-search-results"
            role="listbox"
            className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
          >
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">
                No nodes match “{query.trim()}”
              </li>
            ) : (
              results.map((result, index) => {
                const node = result.item
                const hidden = hiddenGroups.has(groupOfNode(node, taxonomy))
                return (
                  <li key={node.id} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      // Keeps focus in the input so onBlur cannot fire first.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(node)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={[
                        'flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm',
                        index === activeIndex ? 'bg-gray-100' : 'hover:bg-gray-50',
                      ].join(' ')}
                    >
                      <span className="flex-1 text-gray-700">
                        <HighlightedLabel label={node.label} indices={result.indices} />
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400">
                        {node.mapCluster}
                        {hidden && ' · hidden'}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
