import { useMemo, useState } from 'react'
import { Columns3, List, ListChecks, Search } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { TASK_FILTERS, isClosedKind, kindOf, useCan, useCurrentUser, useLookups } from '../lib/selectors'
import { cn, daysUntil, priorityRank } from '../lib/utils'
import { Avatar, Card, Chip, EmptyState, inputCls, PageHeader, PriorityTag, Segmented } from '../components/ui'
import { DueBadge, TaskRow } from '../components/items'
import { Kanban } from '../components/Kanban'
import { AddButton } from '../components/forms'
import type { Task } from '../lib/types'

export default function Tasks() {
  const { tasks, statuses, projects, members, moveTask } = useStore()
  const { project, member } = useLookups()
  const me = useCurrentUser()
  const can = useCan()
  const setUI = useUI((s) => s.set)
  const [view, setView] = useState<'list' | 'board'>('list')
  const [filter, setFilter] = useState('open')
  const [projectId, setProjectId] = useState('')
  const [assignee, setAssignee] = useState('')
  const [q, setQ] = useState('')
  const ctx = { statuses, me: me.id }

  const list = useMemo(() => {
    const f = TASK_FILTERS.find((x) => x.id === filter)!
    const query = q.trim().toLowerCase()
    return tasks
      .filter((t) => (view === 'board' && filter === 'open' ? true : f.test(t, ctx)))
      .filter((t) => !projectId || t.projectId === projectId)
      .filter((t) => !assignee || t.assigneeId === assignee)
      .filter((t) => !query || t.title.toLowerCase().includes(query) || project.get(t.projectId)?.name.toLowerCase().includes(query))
  }, [tasks, filter, projectId, assignee, q, statuses, me.id, view, project])

  const groups = useMemo(() => {
    const g: { id: string; label: string; items: Task[] }[] = [
      { id: 'overdue', label: 'Overdue', items: [] },
      { id: 'today', label: 'Today', items: [] },
      { id: 'week', label: 'Next 7 days', items: [] },
      { id: 'later', label: 'Later', items: [] },
      { id: 'none', label: 'No date', items: [] },
      { id: 'done', label: 'Done', items: [] },
    ]
    for (const t of list) {
      const done = isClosedKind(kindOf(statuses, t.statusId))
      const d = t.deadline ? daysUntil(t.deadline) : null
      const key = done ? 'done' : d === null ? 'none' : d < 0 ? 'overdue' : d === 0 ? 'today' : d <= 7 ? 'week' : 'later'
      g.find((x) => x.id === key)!.items.push(t)
    }
    for (const x of g) x.items.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '') || priorityRank[a.priority] - priorityRank[b.priority])
    return g.filter((x) => x.items.length)
  }, [list, statuses])

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Tasks"
        sub={`${tasks.filter((t) => !isClosedKind(kindOf(statuses, t.statusId))).length} open across ${projects.length} projects`}
        actions={
          <>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: <><List size={15} /> List</> },
                { value: 'board', label: <><Columns3 size={15} /> Board</> },
              ]}
            />
            {can('edit') && <AddButton onClick={() => setUI({ taskForm: { open: true } })}>New task</AddButton>}
          </>
        }
      />

      <div className="scroll-thin -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {TASK_FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)} count={tasks.filter((t) => f.test(t, ctx)).length}>
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input id="tasks-q" className={cn(inputCls, 'rounded-full pl-9')} placeholder="Filter tasks" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select id="tasks-project" aria-label="Project" className={cn(inputCls, 'w-auto max-w-[240px] rounded-full')} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select id="tasks-assignee" aria-label="Assignee" className={cn(inputCls, 'w-auto rounded-full')} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Anyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === me.id ? 'Me' : m.name}
            </option>
          ))}
        </select>
      </div>

      {view === 'list' ? (
        groups.length ? (
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <Card key={g.id} className="p-4">
                <h2 className={cn('mb-1 flex items-center gap-2 px-2 text-sm font-medium', g.id === 'overdue' && 'text-bad')}>
                  {g.label} <span className="tnum text-xs text-ink-3">{g.items.length}</span>
                </h2>
                <div className="-mx-1 flex flex-col">
                  {g.items.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<ListChecks size={20} />} title="No tasks here" body="Change the filter, or add a task with Quick add." />
        )
      ) : (
        <Kanban
          statuses={statuses.filter((s) => s.kind !== 'archived')}
          items={list}
          label={(t) => t.title}
          onMove={moveTask}
          onAdd={can('edit') ? (statusId) => setUI({ taskForm: { open: true, preset: { statusId } } }) : undefined}
          renderCard={(t) => (
            <button type="button" tabIndex={-1} onClick={() => setUI({ taskDetail: t.id })} className="block w-full text-left">
              <p className="truncate pr-12 text-xs text-ink-3">{project.get(t.projectId)?.name}</p>
              <p className="mt-0.5 text-sm font-medium">{t.title}</p>
              <div className="mt-3 flex items-center gap-2">
                <PriorityTag priority={t.priority} compact />
                <DueBadge date={t.deadline} done={isClosedKind(kindOf(statuses, t.statusId))} />
                <span className="ml-auto">
                  <Avatar member={t.assigneeId ? member.get(t.assigneeId) : null} size={22} />
                </span>
              </div>
            </button>
          )}
        />
      )}
    </div>
  )
}
