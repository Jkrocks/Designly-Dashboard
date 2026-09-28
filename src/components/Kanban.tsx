import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { Status } from '../lib/types'
import { cn } from '../lib/utils'

interface Props<T extends { id: string; statusId: string }> {
  statuses: Status[]
  items: T[]
  onMove: (id: string, statusId: string) => void
  renderCard: (item: T) => ReactNode
  onAdd?: (statusId: string) => void
  label: (item: T) => string
}

/**
 * Drag cards between columns with a mouse, or focus a card and use ← / → on a keyboard.
 * On touch screens the small arrows on each card do the same.
 */
export function Kanban<T extends { id: string; statusId: string }>({ statuses, items, onMove, renderCard, onAdd, label }: Props<T>) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')

  const move = (item: T, dir: -1 | 1) => {
    const i = statuses.findIndex((s) => s.id === item.statusId)
    const next = statuses[i + dir]
    if (!next) return
    onMove(item.id, next.id)
    setAnnounce(`${label(item)} moved to ${next.name}`)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-card="${item.id}"]`)?.focus())
  }

  return (
    <div className="scroll-thin -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className="flex min-w-max gap-3">
        {statuses.map((s, si) => {
          const col = items.filter((x) => x.statusId === s.id)
          return (
            <section
              key={s.id}
              aria-label={`${s.name}, ${col.length} items`}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(s.id)
              }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain') || dragId
                if (id) onMove(id, s.id)
                setDragId(null)
                setOver(null)
              }}
              className={cn(
                'flex w-[292px] shrink-0 flex-col rounded-[24px] border p-2 transition-colors',
                over === s.id ? 'border-accent-text/60 bg-accent-soft/60' : 'border-line bg-surface/50',
              )}
            >
              <header className="flex items-center gap-2 px-2.5 pt-1.5 pb-2.5">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                <h3 className="text-sm font-medium">{s.name}</h3>
                <span className="tnum rounded-full bg-surface-3 px-2 py-0.5 text-xs text-ink-3">{col.length}</span>
                {onAdd && (
                  <button type="button" onClick={() => onAdd(s.id)} aria-label={`Add to ${s.name}`} className="ml-auto grid size-7 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink">
                    <Plus size={15} />
                  </button>
                )}
              </header>
              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {col.map((item) => (
                  <div
                    key={item.id}
                    data-card={item.id}
                    draggable
                    tabIndex={0}
                    aria-label={`${label(item)}. Use left and right arrow keys to move between columns.`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id)
                      e.dataTransfer.effectAllowed = 'move'
                      setDragId(item.id)
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setOver(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return
                      if (e.key === 'ArrowRight') {
                        e.preventDefault()
                        move(item, 1)
                      } else if (e.key === 'ArrowLeft') {
                        e.preventDefault()
                        move(item, -1)
                      }
                    }}
                    className={cn(
                      'group/card relative cursor-grab rounded-[18px] border border-line bg-surface p-3.5 shadow-card transition-all hover:border-line-strong active:cursor-grabbing',
                      dragId === item.id && 'rotate-[1.5deg] opacity-50',
                    )}
                  >
                    {renderCard(item)}
                    <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100 [@media(hover:none)]:opacity-100">
                      {si > 0 && (
                        <button type="button" tabIndex={-1} aria-label="Move left" onClick={() => move(item, -1)} className="grid size-6 place-items-center rounded-full bg-surface-2 text-ink-3 hover:text-ink">
                          <ChevronLeft size={13} />
                        </button>
                      )}
                      {si < statuses.length - 1 && (
                        <button type="button" tabIndex={-1} aria-label="Move right" onClick={() => move(item, 1)} className="grid size-6 place-items-center rounded-full bg-surface-2 text-ink-3 hover:text-ink">
                          <ChevronRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!col.length && <div className="grid flex-1 place-items-center rounded-[18px] border border-dashed border-line py-6 text-xs text-ink-3">Drop here</div>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
