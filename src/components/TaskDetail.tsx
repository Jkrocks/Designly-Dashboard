import { useState } from 'react'
import { ArrowUpRight, Pencil, Send, Trash2, X } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { entryMs, useCan, useCurrentUser, useLookups } from '../lib/selectors'
import { ago, cn, fmtHours } from '../lib/utils'
import { Avatar, Bar, Button, Drawer, IconButton, inputCls, PriorityTag, textareaCls } from './ui'
import { DueBadge, TimerButton } from './items'
import { FileChip, FilePicker } from './forms'

export default function TaskDetail() {
  const id = useUI((s) => s.taskDetail)
  const setUI = useUI((s) => s.set)
  const navigate = useUI((s) => s.navigate)
  const notify = useUI((s) => s.notify)
  const { tasks, statuses, entries, updateTask, removeTask, addComment, pushNotification } = useStore()
  const { project, member } = useLookups()
  const me = useCurrentUser()
  const can = useCan()
  const [comment, setComment] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const task = tasks.find((t) => t.id === id)
  const close = () => {
    setUI({ taskDetail: null })
    setConfirmDelete(false)
  }
  if (!task) return <Drawer open={false} onClose={close} label="Task">{null}</Drawer>
  const p = project.get(task.projectId)
  const spent = entries.filter((e) => e.taskId === task.id).reduce((a, e) => a + entryMs(e), 0)
  const est = task.estimate * 3600000
  const reviewStatus = statuses.find((s) => s.kind === 'review')
  const approvedStatus = statuses.find((s) => s.kind === 'approved')
  const revisionStatus = statuses.find((s) => s.name.toLowerCase().includes('revision'))
  const isReview = statuses.find((s) => s.id === task.statusId)?.kind === 'review'

  const send = () => {
    if (!comment.trim()) return
    addComment(task.id, comment.trim())
    setComment('')
  }

  return (
    <Drawer open={!!task} onClose={close} label={task.title}>
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => p && (close(), navigate({ name: 'project', id: p.id }))} className="flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
            {p?.name} <ArrowUpRight size={13} />
          </button>
          <input
            id="td-title"
            aria-label="Task title"
            className="mt-1 w-full bg-transparent text-xl font-medium tracking-tight outline-none"
            value={task.title}
            readOnly={!can('edit')}
            onChange={(e) => updateTask(task.id, { title: e.target.value })}
          />
        </div>
        <TimerButton projectId={task.projectId} taskId={task.id} size={40} />
        <IconButton label="Close" onClick={close}>
          <X size={18} />
        </IconButton>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5">
        <dl className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-3 text-sm">
          <dt className="text-ink-3">Status</dt>
          <dd>
            <select id="td-status" className={cn(inputCls, 'h-9 w-auto')} value={task.statusId} disabled={!can('edit') && !can('approve')} onChange={(e) => updateTask(task.id, { statusId: e.target.value })}>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </dd>
          <dt className="text-ink-3">Deadline</dt>
          <dd className="flex items-center gap-2">
            <input id="td-deadline" type="date" className={cn(inputCls, 'h-9 w-auto')} value={task.deadline ?? ''} disabled={!can('edit')} onChange={(e) => updateTask(task.id, { deadline: e.target.value || null })} />
            <DueBadge date={task.deadline} />
          </dd>
          <dt className="text-ink-3">Priority</dt>
          <dd className="flex items-center gap-2">
            <select id="td-priority" className={cn(inputCls, 'h-9 w-auto')} value={task.priority} disabled={!can('edit')} onChange={(e) => updateTask(task.id, { priority: e.target.value as typeof task.priority })}>
              {(['urgent', 'high', 'medium', 'low'] as const).map((x) => (
                <option key={x} value={x}>
                  {x[0]!.toUpperCase() + x.slice(1)}
                </option>
              ))}
            </select>
            <PriorityTag priority={task.priority} compact />
          </dd>
          <dt className="text-ink-3">Assignee</dt>
          <dd className="flex items-center gap-2">
            <Avatar member={task.assigneeId ? member.get(task.assigneeId) : null} size={26} />
            <select
              id="td-assignee"
              className={cn(inputCls, 'h-9 w-auto')}
              value={task.assigneeId ?? ''}
              disabled={!can('edit')}
              onChange={(e) => {
                updateTask(task.id, { assigneeId: e.target.value || null })
                const m = member.get(e.target.value)
                if (m) pushNotification({ kind: 'assignment', title: 'Assignment changed', body: `${me.name.split(' ')[0]} assigned “${task.title}” to ${m.name}.`, taskId: task.id, projectId: task.projectId })
              }}
            >
              <option value="">Unassigned</option>
              {[...member.values()].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </dd>
          <dt className="text-ink-3">Time</dt>
          <dd>
            <div className="flex items-center gap-3">
              <span className="tnum text-sm">
                <span className="font-medium">{fmtHours(spent, true)}</span> <span className="text-ink-3">of</span>
              </span>
              <input id="td-estimate" aria-label="Estimated hours" type="number" min={0} step={0.5} className={cn(inputCls, 'h-9 w-20')} value={task.estimate} disabled={!can('edit')} onChange={(e) => updateTask(task.id, { estimate: Number(e.target.value) })} />
              <span className="text-ink-3">h estimated</span>
            </div>
            <Bar value={est ? spent / est : 0} tone={spent > est ? 'warn' : 'accent'} className="mt-2" />
          </dd>
        </dl>

        {(reviewStatus || approvedStatus) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {!isReview && reviewStatus && can('edit') && (
              <Button
                size="sm"
                onClick={() => {
                  updateTask(task.id, { statusId: reviewStatus.id })
                  pushNotification({ kind: 'review', title: 'Review requested', body: `${me.name.split(' ')[0]} asked for a review of “${task.title}”.`, taskId: task.id, projectId: task.projectId })
                  notify('Review requested')
                }}
              >
                Request review
              </Button>
            )}
            {isReview && approvedStatus && can('approve') && (
              <Button
                size="sm"
                variant="accent"
                onClick={() => {
                  updateTask(task.id, { statusId: approvedStatus.id })
                  notify('Approved')
                }}
              >
                Approve
              </Button>
            )}
            {isReview && revisionStatus && can('approve') && (
              <Button size="sm" onClick={() => updateTask(task.id, { statusId: revisionStatus.id })}>
                Request changes
              </Button>
            )}
          </div>
        )}

        <h3 className="eyebrow mt-7 mb-2">Notes</h3>
        <textarea id="td-notes" className={textareaCls} value={task.notes} readOnly={!can('edit')} placeholder="Add notes, references, export specs…" onChange={(e) => updateTask(task.id, { notes: e.target.value })} />

        <h3 className="eyebrow mt-7 mb-2">Attachments</h3>
        {can('edit') ? (
          <FilePicker id="td-files" value={task.attachments} onChange={(a) => updateTask(task.id, { attachments: a })} />
        ) : (
          <div className="grid gap-2">{task.attachments.map((f) => <FileChip key={f.id} file={f} />)}</div>
        )}

        <h3 className="eyebrow mt-7 mb-3">Comments · {task.comments.length}</h3>
        <ol className="flex flex-col gap-4">
          {task.comments.map((c) => {
            const a = member.get(c.authorId)
            return (
              <li key={c.id} className="flex gap-3">
                <Avatar member={a} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px]">
                    <span className="font-medium">{a?.name ?? 'Someone'}</span> <span className="text-ink-3">· {ago(c.at)}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-2">{c.body}</p>
                </div>
              </li>
            )
          })}
        </ol>
        {can('comment') && (
          <div className="mt-4 flex items-end gap-2">
            <Avatar member={me} size={30} />
            <textarea
              id="td-comment"
              aria-label="Write a comment"
              rows={1}
              className={cn(textareaCls, 'min-h-10 flex-1')}
              placeholder="Write a comment…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
              }}
            />
            <IconButton label="Send comment" onClick={send} className="bg-accent text-accent-ink hover:bg-accent hover:text-accent-ink">
              <Send size={16} />
            </IconButton>
          </div>
        )}
      </div>

      {can('edit') && (
        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-ink-2">Delete this task?</span>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  removeTask(task.id)
                  close()
                  notify('Task deleted')
                }}
              >
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          <Button size="sm" icon={<Pencil size={14} />} onClick={() => setUI({ taskForm: { open: true, id: task.id } })}>
            Edit all fields
          </Button>
        </div>
      )}
    </Drawer>
  )
}
