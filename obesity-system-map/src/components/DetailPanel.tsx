import type { ReactNode } from 'react'

interface DetailPanelProps {
  open: boolean
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children?: ReactNode
}

/**
 * Slide-out shell shared by the node and edge panels, so both animate
 * identically and only one set of layout rules exists.
 */
export function DetailPanel({
  open,
  title,
  subtitle,
  onClose,
  children,
}: DetailPanelProps) {
  return (
    <aside
      aria-hidden={!open}
      className={[
        'absolute inset-y-0 right-0 z-10 flex w-[22rem] max-w-[85vw] flex-col',
        'border-l border-gray-200 bg-white shadow-xl',
        'transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
    >
      {open && (
        <>
          <header className="flex items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-snug text-gray-900">
                {title}
              </h2>
              {subtitle && <div className="mt-1">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="-mr-1 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </>
      )}
    </aside>
  )
}

/** Shared section wrapper so both panels read the same. */
export function PanelSection({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: ReactNode
}) {
  return (
    <section className="border-t border-gray-200 px-5 py-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
        {count !== undefined && (
          <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
            {count}
          </span>
        )}
      </h3>
      {children}
    </section>
  )
}
