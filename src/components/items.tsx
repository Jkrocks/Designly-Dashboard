import { Check, MessageSquare, Paperclip, Play, Square } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { isClosedKind, kindOf, projectProgress, useLookups } from '../lib/selectors'
import type { Project, Task } from '../lib/types'
import { cn, dueLabel, dueTone } from '../lib/utils'
import { Cover } from './art'
import { Avatar, AvatarStack, Bar, PriorityTag, StatusPill } from './ui'

export function DueBadge({ date, done }: { date: string | null | undefined; done?: boolean }) {
  const tone = done ? 'neutral' : dueTone(date)
  return (
    <span
      className={cn(
        'tnum inline-flex h-6 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap',
        tone === 'bad' && 'bg-bad-soft text-bad',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'neutral' && 'bg-surface-2 text-ink-2',
      )}
    >
      {dueLabel(date)}
    </span>
  )
}

export function useToggleDone() {
  const statuses = useStore((s) => s.statuses)
  const updateTask = useStore((s) => s.updateTask)
  const notify = useUI((s) => s.notify)
  return (t: Task) => {
    const closed = isClosedKind(kindOf(statuses, t.statusId))
    const target = closed ? statuses.find((s) => s.kind === 'active') : statuses.find((s) => s.kind === 'done')
    if (!target) return
    const prev = t.statusId
    updateTask(t.id, { statusId: target.id })
    if (!closed) notify(`Nice. “${t.title}” is done.`, { label: 'Undo', run: () => updateTask(t.id, { statusId: prev }) })
  }
}

export function TimerButton({ projectId, taskId, size = 32 }: { projectId: string; taskId?: string | null; size?: number }) {
  const timer = useStore((s) => s.timer)
  const start = useStore((s) => s.startTimer)
  const stop = useStore((s) => s.stopTimer)
  const running = timer && timer.projectId === projectId && (taskId ? timer.taskId === taskId : !timer.taskId)
  return (
    <button
      type="button"
      aria-label={running ? 'Stop timer' : 'Start timer'}
      title={running ? 'Stop timer' : 'Start timer'}
      onClick={(e) => {
        e.stopPropagation()
        running ? stop() : start(projectId, taskId ?? null)
      }}
      className={cn(
        'grid shrink-0 place-items-center rounded-full transition-all active:scale-90',
        running ? 'bg-accent text-accent-ink shadow-[0_0_20px_-4px_var(--accent-glow)]' : 'bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink',
      )}
      style={{ width: size, height: size }}
    >
      {running ? <Square size={size * 0.34} fill="currentColor" /> : <Play size={size * 0.4} fill="currentColor" className="translate-x-[1px]" />}
    </button>
  )
}

export function TaskRow({ task, showProject = true, dense }: { task: Task; showProject?: boolean; dense?: boolean }) {
  const { status, project, member } = useLookups()
  const statuses = useStore((s) => s.statuses)
  const setUI = useUI((s) => s.set)
  const toggle = useToggleDone()
  const solo = useStore((s) => s.settings.mode === 'solo')
  const done = isClosedKind(kindOf(statuses, task.statusId))
  const p = project.get(task.projectId)
  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-2xl border border-transparent px-2 transition-colors hover:border-line hover:bg-surface-2',
        dense ? 'py-2' : 'py-2.5',
      )}
    >
      <button
        type="button"
        onClick={() => toggle(task)}
        aria-label={done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all active:scale-90',
          done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-transparent hover:border-accent-text hover:text-accent-text',
        )}
      >
        <Check size={13} strokeWidth={3} />
      </button>
      <button type="button" onClick={() => setUI({ taskDetail: task.id })} className="min-w-0 flex-1 text-left">
        <span className={cn('block truncate text-sm font-medium', done && 'text-ink-3 line-through decoration-ink-3/50')}>{task.title}</span>
        {showProject && p && <span className="block truncate text-xs text-ink-3">{p.name}</span>}
      </button>
      <div className="hidden items-center gap-3 text-ink-3 lg:flex">
        {task.comments.length > 0 && (
          <span className="flex items-center gap-1 text-xs">
            <MessageSquare size={13} /> {task.comments.length}
          </span>
        )}
        {task.attachments.length > 0 && (
          <span className="flex items-center gap-1 text-xs">
            <Paperclip size={13} /> {task.attachments.length}
          </span>
        )}
      </div>
      {!dense && <StatusPill status={status.get(task.statusId)} className="hidden sm:inline-flex" />}
      <PriorityTag priority={task.priority} compact />
      <DueBadge date={task.deadline} done={done} />
      {!dense && !solo && <span className="hidden sm:block"><Avatar member={task.assigneeId ? member.get(task.assigneeId) : null} size={26} /></span>}
      {!done && <TimerButton projectId={task.projectId} taskId={task.id} />}
    </div>
  )
}

export function ProjectCard({ project: p }: { project: Project }) {
  const { status, client, member } = useLookups()
  const statuses = useStore((s) => s.statuses)
  const tasks = useStore((s) => s.tasks).filter((t) => t.projectId === p.id)
  const navigate = useUI((s) => s.navigate)
  const solo = useStore((s) => s.settings.mode === 'solo')
  const progress = projectProgress(tasks, statuses)
  const c = p.clientId ? client.get(p.clientId) : null
  const done = isClosedKind(kindOf(statuses, p.statusId))
  return (
    <article className="card group flex flex-col overflow-hidden p-0 transition-transform duration-200 hover:-translate-y-0.5">
      <button type="button" onClick={() => navigate({ name: 'project', id: p.id })} className="text-left" aria-label={`Open ${p.name}`}>
        <Cover hue={p.cover.hue} shape={p.cover.shape} className="m-2 mb-0 h-32 rounded-[18px]" />
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={() => navigate({ name: 'project', id: p.id })} className="min-w-0 text-left">
            <h3 className="truncate text-[15px] font-medium tracking-tight">{p.name}</h3>
            <p className="truncate text-[13px] text-ink-3">
              {c?.name ?? 'Personal'} · {p.type}
            </p>
          </button>
          <PriorityTag priority={p.priority} compact />
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={status.get(p.statusId)} />
          <DueBadge date={p.deadline} done={done} />
        </div>
        <div className="mt-auto flex items-center gap-3 pt-1">
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-xs text-ink-3">
              <span>{tasks.length ? `${tasks.filter((t) => isClosedKind(kindOf(statuses, t.statusId))).length}/${tasks.length} tasks` : 'No tasks yet'}</span>
              <span className="tnum">{Math.round(progress * 100)}%</span>
            </div>
            <Bar value={progress} />
          </div>
          {!solo && <AvatarStack members={p.memberIds.map((id) => member.get(id)!).filter(Boolean)} max={3} size={24} />}
        </div>
      </div>
    </article>
  )
}
