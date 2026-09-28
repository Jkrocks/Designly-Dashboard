import { useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { isClosedKind, kindOf, useCan, useLookups } from '../lib/selectors'
import type { EventKind } from '../lib/types'
import { cn, parseDay, toISODate } from '../lib/utils'
import { Button, Card, Chip, Field, IconButton, inputCls, Modal, PageHeader } from '../components/ui'

type Kind = 'project' | 'task' | EventKind
const KINDS: { id: Kind; label: string; color: string }[] = [
  { id: 'project', label: 'Project deadlines', color: 'var(--accent)' },
  { id: 'task', label: 'Task deadlines', color: 'var(--ink-3)' },
  { id: 'review', label: 'Reviews', color: '#f59e0b' },
  { id: 'approval', label: 'Approvals', color: '#14b8a6' },
  { id: 'milestone', label: 'Milestones', color: '#a78bfa' },
]
const colorOf = (k: Kind) => KINDS.find((x) => x.id === k)!.color

interface Item {
  id: string
  date: string
  kind: Kind
  title: string
  sub: string
  done?: boolean
  run: () => void
  eventId?: string
}

export default function Calendar() {
  const s = useStore()
  const { project } = useLookups()
  const navigate = useUI((u) => u.navigate)
  const setUI = useUI((u) => u.set)
  const can = useCan()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const [hidden, setHidden] = useState<Kind[]>([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ title: '', kind: 'review' as EventKind, projectId: '', date: toISODate(new Date()) })

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    for (const p of s.projects) out.push({ id: p.id, date: p.deadline, kind: 'project', title: p.name, sub: 'Project deadline', done: isClosedKind(kindOf(s.statuses, p.statusId)), run: () => navigate({ name: 'project', id: p.id }) })
    for (const t of s.tasks) if (t.deadline) out.push({ id: t.id, date: t.deadline, kind: 'task', title: t.title, sub: project.get(t.projectId)?.name ?? '', done: isClosedKind(kindOf(s.statuses, t.statusId)), run: () => setUI({ taskDetail: t.id }) })
    for (const e of s.events) out.push({ id: e.id, eventId: e.id, date: e.date, kind: e.kind, title: e.title, sub: (e.projectId && project.get(e.projectId)?.name) || 'Event', run: () => e.projectId && navigate({ name: 'project', id: e.projectId }) })
    return out.filter((i) => !hidden.includes(i.kind))
  }, [s.projects, s.tasks, s.events, s.statuses, hidden, project])

  const weekStartsOn = s.settings.weekStartsOn
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn }), end: endOfWeek(endOfMonth(month), { weekStartsOn }) })
  const byDay = (d: Date) => items.filter((i) => isSameDay(parseDay(i.date), d)).sort((a, b) => KINDS.findIndex((k) => k.id === a.kind) - KINDS.findIndex((k) => k.id === b.kind))
  const selItems = byDay(selected)

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Calendar"
        sub="Deadlines, reviews, approvals and milestones"
        actions={
          can('edit') && (
            <Button variant="accent" icon={<Plus size={17} strokeWidth={2.4} />} onClick={() => { setDraft((d) => ({ ...d, date: toISODate(selected) })); setAdding(true) }}>
              Add event
            </Button>
          )
        }
      />
      <div className="scroll-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {KINDS.map((k) => (
          <Chip key={k.id} active={!hidden.includes(k.id)} onClick={() => setHidden((h) => (h.includes(k.id) ? h.filter((x) => x !== k.id) : [...h, k.id]))}>
            <span className="size-2 rounded-full" style={{ background: k.color }} />
            {k.label}
          </Chip>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:gap-5">
        <Card className="p-3 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">{format(month, 'MMMM yyyy')}</h2>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(new Date()) }}>
                Today
              </Button>
              <IconButton label="Previous month" onClick={() => setMonth((m) => subMonths(m, 1))}>
                <ChevronLeft size={18} />
              </IconButton>
              <IconButton label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
                <ChevronRight size={18} />
              </IconButton>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-3" aria-hidden>
            {days.slice(0, 7).map((d) => (
              <span key={d.toISOString()} className="pb-2">
                {format(d, 'EEE')}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={format(month, 'MMMM yyyy')}>
            {days.map((d) => {
              const list = byDay(d)
              const inMonth = isSameMonth(d, month)
              const sel = isSameDay(d, selected)
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  role="gridcell"
                  aria-selected={sel}
                  aria-label={`${format(d, 'EEEE d MMMM')}, ${list.length} items`}
                  onClick={() => setSelected(d)}
                  className={cn(
                    'flex min-h-14 flex-col gap-1 rounded-2xl border p-1.5 text-left transition-colors sm:min-h-24 sm:p-2',
                    sel ? 'border-accent-text/60 bg-surface-2' : 'border-transparent hover:bg-surface-2',
                    !inMonth && 'opacity-40',
                  )}
                >
                  <span className={cn('tnum grid size-7 place-items-center rounded-full text-[13px]', isToday(d) ? 'bg-accent font-semibold text-accent-ink' : 'text-ink-2')}>{format(d, 'd')}</span>
                  <span className="hidden flex-col gap-0.5 sm:flex">
                    {list.slice(0, 3).map((i) => (
                      <span key={i.kind + i.id} className={cn('flex items-center gap-1 truncate rounded-md px-1 text-[11px] leading-5', i.done && 'line-through opacity-50')} style={{ background: `color-mix(in oklab, ${colorOf(i.kind)} 16%, transparent)` }}>
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: colorOf(i.kind) }} />
                        <span className="truncate">{i.title}</span>
                      </span>
                    ))}
                    {list.length > 3 && <span className="px-1 text-[11px] text-ink-3">+{list.length - 3} more</span>}
                  </span>
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((i) => (
                      <span key={i.kind + i.id} className="size-1.5 rounded-full" style={{ background: colorOf(i.kind) }} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        <Card>
          <p className="text-[13px] text-ink-3">{isToday(selected) ? 'Today' : format(selected, 'EEEE')}</p>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">{format(selected, 'd MMMM yyyy')}</h2>
          <ul className="flex flex-col gap-2">
            {selItems.map((i) => (
              <li key={i.kind + i.id} className="group flex items-center gap-2">
                <button type="button" onClick={i.run} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left hover:border-line-strong">
                  <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: colorOf(i.kind) }} />
                  <span className="min-w-0">
                    <span className={cn('block truncate text-sm font-medium', i.done && 'text-ink-3 line-through')}>{i.title}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {KINDS.find((k) => k.id === i.kind)!.label.replace(/s$/, '')} · {i.sub}
                    </span>
                  </span>
                </button>
                {i.eventId && can('edit') && (
                  <IconButton label="Delete event" onClick={() => s.removeEvent(i.eventId!)} className="size-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
                    <Trash2 size={14} />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
          {!selItems.length && <p className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-3">Nothing scheduled. A clear day.</p>}
        </Card>
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add event"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={!draft.title.trim()}
              onClick={() => {
                s.addEvent({ title: draft.title.trim(), kind: draft.kind, date: draft.date, projectId: draft.projectId || null })
                setAdding(false)
                setSelected(parseDay(draft.date))
                setDraft((d) => ({ ...d, title: '' }))
              }}
            >
              Add event
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <input id="ev-title" className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Logo presentation" />
          </Field>
          <Field label="Type">
            <select id="ev-kind" className={inputCls} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as EventKind })}>
              <option value="review">Review</option>
              <option value="approval">Approval</option>
              <option value="milestone">Milestone</option>
            </select>
          </Field>
          <Field label="Date">
            <input id="ev-date" type="date" className={inputCls} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </Field>
          <Field label="Project" className="sm:col-span-2">
            <select id="ev-project" className={inputCls} value={draft.projectId} onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}>
              <option value="">No project</option>
              {s.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
