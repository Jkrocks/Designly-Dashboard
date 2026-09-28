import { useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeft, CalendarDays, CheckCircle2, Columns3, ExternalLink, List, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { entryMs, isClosedKind, kindOf, projectProgress, useCan, useLookups } from '../lib/selectors'
import { cn, fmtDate, fmtHours, parseDay } from '../lib/utils'
import { Avatar, Button, Card, CardHeader, ClientMark, EmptyState, inputCls, PriorityTag, Ring, Segmented, Tag } from '../components/ui'
import { DueBadge, TaskRow, TimerButton } from '../components/items'
import { Kanban } from '../components/Kanban'
import { Cover } from '../components/art'
import { FileChip } from '../components/forms'

export default function ProjectDetail({ id }: { id: string }) {
  const s = useStore()
  const { client, member } = useLookups()
  const navigate = useUI((u) => u.navigate)
  const setUI = useUI((u) => u.set)
  const notify = useUI((u) => u.notify)
  const can = useCan()
  const [tab, setTab] = useState<'tasks' | 'brief' | 'files' | 'time'>('tasks')
  const [taskView, setTaskView] = useState<'list' | 'board'>('list')
  const [quick, setQuick] = useState('')
  const [confirm, setConfirm] = useState(false)
  const p = s.projects.find((x) => x.id === id)

  if (!p)
    return (
      <EmptyState
        title="This project doesn’t exist anymore"
        body="It may have been deleted."
        action={<Button onClick={() => navigate({ name: 'projects' })}>Back to projects</Button>}
      />
    )

  const c = p.clientId ? client.get(p.clientId) : null
  const tasks = s.tasks.filter((t) => t.projectId === p.id)
  const progress = projectProgress(tasks, s.statuses)
  const spent = s.entries.filter((e) => e.projectId === p.id).reduce((a, e) => a + entryMs(e), 0)
  const estimate = tasks.reduce((a, t) => a + t.estimate, 0)
  const closed = isClosedKind(kindOf(s.statuses, p.statusId))
  const doneStatus = s.statuses.find((x) => x.kind === 'done')
  const archiveStatus = s.statuses.find((x) => x.kind === 'archived')
  const events = s.events.filter((e) => e.projectId === p.id).sort((a, b) => a.date.localeCompare(b.date))
  const firstActive = s.statuses.find((x) => x.kind === 'active') ?? s.statuses[0]!

  const addQuick = () => {
    if (!quick.trim()) return
    s.addTask({ projectId: p.id, title: quick.trim(), statusId: firstActive.id, deadline: p.deadline, priority: 'medium', estimate: 2, assigneeId: p.memberIds[0] ?? null, notes: '' })
    setQuick('')
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <button type="button" onClick={() => navigate({ name: 'projects' })} className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft size={15} /> Projects
      </button>

      <div className="card mb-5 overflow-hidden p-2">
        <div className="grid gap-2 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col justify-between gap-6 p-4 sm:p-5">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {c && (
                  <button type="button" onClick={() => navigate({ name: 'client', id: c.id })} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pr-3 pl-1 text-[13px] hover:border-line-strong">
                    <ClientMark name={c.name} hue={c.hue} size={22} /> {c.name}
                  </button>
                )}
                <span className="rounded-full border border-line px-3 py-1 text-[13px] text-ink-2">{p.type}</span>
                <PriorityTag priority={p.priority} />
              </div>
              <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em] sm:text-[38px]">{p.name}</h1>
              <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{p.description}</p>
              {p.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="pd-status"
                aria-label="Project status"
                className={cn(inputCls, 'w-auto rounded-full')}
                value={p.statusId}
                disabled={!can('edit') && !can('approve')}
                onChange={(e) => s.updateProject(p.id, { statusId: e.target.value })}
              >
                {s.statuses.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <TimerButton projectId={p.id} size={40} />
              {can('edit') && (
                <Button icon={<Pencil size={15} />} onClick={() => setUI({ projectForm: { open: true, id: p.id } })}>
                  Edit
                </Button>
              )}
              {can('edit') && !closed && doneStatus && (
                <Button
                  variant="accent"
                  icon={<CheckCircle2 size={16} />}
                  onClick={() => {
                    s.updateProject(p.id, { statusId: doneStatus.id })
                    notify('Project completed. It’s in your archive now.', { label: 'View', run: () => navigate({ name: 'archive' }) })
                  }}
                >
                  Mark complete
                </Button>
              )}
              {can('edit') && closed && archiveStatus && p.statusId !== archiveStatus.id && (
                <Button onClick={() => s.updateProject(p.id, { statusId: archiveStatus.id })}>Archive</Button>
              )}
            </div>
          </div>
          <Cover hue={p.cover.hue} shape={p.cover.shape} className="min-h-48 rounded-[20px]" label={`${p.name} cover`} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 lg:gap-5">
        <Card className="flex items-center gap-4">
          <Ring value={progress} size={84} stroke={9}>
            <span className="tnum text-base font-semibold">{Math.round(progress * 100)}%</span>
          </Ring>
          <div>
            <p className="text-[13px] text-ink-3">Progress</p>
            <p className="text-lg font-medium">
              {tasks.filter((t) => isClosedKind(kindOf(s.statuses, t.statusId))).length} of {tasks.length} tasks
            </p>
          </div>
        </Card>
        <Card>
          <p className="text-[13px] text-ink-3">Deadline</p>
          <p className="mt-1 text-lg font-medium">{fmtDate(p.deadline, 'EEE d MMM yyyy')}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-3">
            <DueBadge date={p.deadline} done={closed} /> Started {fmtDate(p.startDate, 'd MMM')}
          </div>
        </Card>
        <Card>
          <p className="text-[13px] text-ink-3">Time tracked</p>
          <p className="tnum mt-1 text-lg font-medium">{fmtHours(spent, true)}</p>
          <p className="mt-2 text-xs text-ink-3">{estimate}h estimated across tasks</p>
        </Card>
        <Card>
          <p className="mb-2 text-[13px] text-ink-3">Team</p>
          <div className="flex flex-wrap gap-2">
            {p.memberIds.map((mid) => {
              const m = member.get(mid)
              return m ? (
                <button key={mid} type="button" onClick={() => navigate({ name: 'profile', id: mid })} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-3 pl-1 text-[13px] hover:bg-surface-3">
                  <Avatar member={m} size={24} /> {m.name.split(' ')[0]}
                </button>
              ) : null
            })}
          </div>
        </Card>
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'tasks', label: `Tasks · ${tasks.length}` },
            { value: 'brief', label: 'Brief & notes' },
            { value: 'files', label: `Files · ${p.attachments.length}` },
            { value: 'time', label: 'Timeline' },
          ]}
        />
        {tab === 'tasks' && (
          <Segmented
            label="Task view"
            value={taskView}
            onChange={setTaskView}
            options={[
              { value: 'list', label: <List size={15} aria-label="List" /> },
              { value: 'board', label: <Columns3 size={15} aria-label="Board" /> },
            ]}
          />
        )}
      </div>

      {tab === 'tasks' && (
        <>
          {taskView === 'list' ? (
            <Card>
              {can('edit') && (
                <form
                  className="mb-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    addQuick()
                  }}
                >
                  <input id="pd-quick" className={inputCls} placeholder="Add a task and press Enter, e.g. Social media posts" value={quick} onChange={(e) => setQuick(e.target.value)} />
                  <Button type="submit" variant="accent" icon={<Plus size={16} />} disabled={!quick.trim()}>
                    Add
                  </Button>
                </form>
              )}
              <div className="-mx-2 flex flex-col">
                {[...tasks]
                  .sort((a, b) => Number(isClosedKind(kindOf(s.statuses, a.statusId))) - Number(isClosedKind(kindOf(s.statuses, b.statusId))) || (a.deadline ?? '').localeCompare(b.deadline ?? ''))
                  .map((t) => (
                    <TaskRow key={t.id} task={t} showProject={false} />
                  ))}
              </div>
              {!tasks.length && <EmptyState title="No tasks yet" body="Break the project into deliverables: key visual, social posts, packaging…" />}
            </Card>
          ) : (
            <Kanban
              statuses={s.statuses.filter((x) => x.kind !== 'archived')}
              items={tasks}
              label={(t) => t.title}
              onMove={(tid, statusId) => s.moveTask(tid, statusId)}
              onAdd={can('edit') ? (statusId) => setUI({ taskForm: { open: true, preset: { projectId: p.id, statusId } } }) : undefined}
              renderCard={(t) => (
                <button type="button" tabIndex={-1} onClick={() => setUI({ taskDetail: t.id })} className="block w-full text-left">
                  <p className="pr-12 text-sm font-medium">{t.title}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <PriorityTag priority={t.priority} compact />
                    <DueBadge date={t.deadline} />
                    <span className="ml-auto">
                      <Avatar member={t.assigneeId ? member.get(t.assigneeId) : null} size={22} />
                    </span>
                  </div>
                </button>
              )}
            />
          )}
        </>
      )}

      {tab === 'brief' && (
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          <Card>
            <CardHeader title="Brief" />
            <p className="max-w-prose text-[15px] leading-relaxed whitespace-pre-wrap text-ink-2">{p.brief || 'No brief yet.'}</p>
            {p.software.length > 0 && (
              <>
                <p className="eyebrow mt-6 mb-2">Software</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.software.map((x) => (
                    <span key={x} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2">
                      {x}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>
          <Card>
            <CardHeader title="Notes" sub="Saved as you type" />
            <textarea
              id="pd-notes"
              aria-label="Project notes"
              readOnly={!can('edit')}
              className="min-h-[220px] w-full resize-y rounded-2xl border border-line bg-surface-2 p-4 text-[15px] leading-relaxed outline-none focus:border-accent-text/60"
              value={p.notes}
              onChange={(e) => s.updateProject(p.id, { notes: e.target.value })}
            />
          </Card>
        </div>
      )}

      {tab === 'files' && (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:gap-5">
          <Card>
            <CardHeader title="Attachments" sub="Final files are marked" />
            <div className="grid gap-2 sm:grid-cols-2">
              {p.attachments.map((f) => (
                <FileChip key={f.id} file={f} />
              ))}
            </div>
            {!p.attachments.length && <EmptyState title="No files yet" body="Add files from Edit." />}
          </Card>
          <Card>
            <CardHeader title="Links" />
            <ul className="flex flex-col gap-2">
              {p.links.map((l) => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-3 py-2.5 text-sm hover:border-line-strong">
                    <ExternalLink size={14} className="text-ink-3" />
                    <span className="flex-1 truncate">{l.label || l.url}</span>
                  </a>
                </li>
              ))}
            </ul>
            {!p.links.length && <p className="text-sm text-ink-3">No links yet.</p>}
          </Card>
        </div>
      )}

      {tab === 'time' && (
        <Card>
          <CardHeader title="Timeline" sub="Milestones, reviews and task deadlines" />
          <ol className="relative ml-3 border-l border-line">
            {[
              { date: p.startDate, title: 'Project started', kind: 'Start' },
              ...events.map((e) => ({ date: e.date, title: e.title, kind: e.kind[0]!.toUpperCase() + e.kind.slice(1) })),
              ...tasks.filter((t) => t.deadline).map((t) => ({ date: t.deadline!, title: t.title, kind: 'Task due' })),
              { date: p.deadline, title: 'Project deadline', kind: 'Deadline' },
            ]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((x, i) => (
                <li key={i} className="relative pb-4 pl-6 last:pb-0">
                  <span className={cn('absolute top-1.5 -left-[5px] size-2.5 rounded-full', x.kind === 'Deadline' ? 'bg-accent' : 'bg-line-strong')} />
                  <p className="flex items-center gap-2 text-xs text-ink-3">
                    <CalendarDays size={12} /> {format(parseDay(x.date), 'EEE d MMM')} · {x.kind}
                  </p>
                  <p className="text-sm font-medium">{x.title}</p>
                </li>
              ))}
          </ol>
        </Card>
      )}

      {can('delete') && (
        <div className="mt-10 flex items-center gap-3 border-t border-line pt-5">
          {confirm ? (
            <>
              <span className="text-[13px] text-ink-2">Delete “{p.name}” with its tasks and tracked time? This can’t be undone.</span>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  s.removeProject(p.id)
                  navigate({ name: 'projects' })
                  notify('Project deleted')
                }}
              >
                Delete project
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
              Delete project
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
