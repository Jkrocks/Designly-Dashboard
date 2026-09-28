import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CornerDownLeft, FolderPlus, ListPlus, Sparkles, Tag as TagIcon, User } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { parseCapture, CAPTURE_EXAMPLES } from '../lib/parse'
import { isFinishedKind, kindOf, useCurrentUser } from '../lib/selectors'
import { addDays } from 'date-fns'
import { cn, fmtDate, toISODate, todayISO } from '../lib/utils'
import { Modal, Button, inputCls, PriorityTag, Segmented, Kbd } from './ui'

/** The universal "+": type a sentence, get a structured task or project. */
export default function QuickCapture() {
  const open = useUI((s) => s.quickCapture)
  const setUI = useUI((s) => s.set)
  const notify = useUI((s) => s.notify)
  const navigate = useUI((s) => s.navigate)
  const { clients, projects, statuses, addTask, addProject, addClient } = useStore()
  const me = useCurrentUser()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'auto' | 'task' | 'project'>('auto')
  const [projectOverride, setProjectOverride] = useState<string>('')
  const [split, setSplit] = useState(true)

  useEffect(() => {
    if (open) {
      setText('')
      setMode('auto')
      setProjectOverride('')
    }
  }, [open])

  const parsed = useMemo(() => parseCapture(text, clients, projects), [text, clients, projects])
  const openProjects = projects.filter((p) => !isFinishedKind(kindOf(statuses, p.statusId)))
  const clientProject = parsed.projectId
    ? projects.find((p) => p.id === parsed.projectId)
    : parsed.clientId
      ? openProjects.filter((p) => p.clientId === parsed.clientId).sort((a, b) => a.deadline.localeCompare(b.deadline))[0]
      : undefined
  const targetProject = projectOverride ? projects.find((p) => p.id === projectOverride) : clientProject
  const kind = mode === 'auto' ? (targetProject ? 'task' : 'project') : mode
  const qty = parsed.quantity && parsed.quantity > 1 && parsed.quantity <= 20 ? parsed.quantity : null

  const firstActive = statuses.find((s) => s.kind === 'active') ?? statuses[0]!
  const firstBacklog = statuses.find((s) => s.kind === 'backlog') ?? statuses[0]!

  const submit = () => {
    if (!text.trim()) return
    let clientId = parsed.clientId
    if (!clientId && parsed.clientName) {
      clientId = addClient({ name: parsed.clientName, contact: '', email: '', phone: '', website: '', location: '', industry: '', notes: 'Added from Quick add.', hue: Math.floor(Math.random() * 360) }).id
    }
    if (kind === 'task') {
      const project = targetProject ?? openProjects[0]
      if (!project) return
      const base = { projectId: project.id, statusId: firstActive.id, deadline: parsed.deadline, priority: parsed.priority, estimate: 2, assigneeId: me.id, notes: parsed.tags.length ? `Tags: ${parsed.tags.map((t) => '#' + t).join(' ')}` : '' }
      addTask({ ...base, title: parsed.title })
      notify(`Added to ${project.name}`, { label: 'Open', run: () => navigate({ name: 'project', id: project.id }) })
    } else {
      const project = addProject({
        name: parsed.title,
        clientId,
        type: parsed.type,
        description: text.trim(),
        brief: text.trim(),
        startDate: todayISO(),
        deadline: parsed.deadline ?? toISODate(addDays(new Date(), 14)),
        priority: parsed.priority,
        statusId: firstBacklog.id,
        tags: parsed.tags,
        memberIds: [me.id],
        software: [],
        attachments: [],
        links: [],
        notes: '',
        cover: { hue: Math.floor(Math.random() * 360), shape: Math.floor(Math.random() * 4) },
      })
      if (qty && split) {
        const noun = parsed.title.replace(/^.*?\b\d+\s+/, '').replace(/s\b$/, '')
        for (let i = 1; i <= qty; i++) {
          addTask({ projectId: project.id, title: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${i}`, statusId: firstBacklog.id, deadline: parsed.deadline, priority: parsed.priority, estimate: 2, assigneeId: me.id, notes: '' })
        }
      }
      notify(`Project “${project.name}” created`, { label: 'Open', run: () => navigate({ name: 'project', id: project.id }) })
    }
    setUI({ quickCapture: false })
  }

  return (
    <Modal open={open} onClose={() => setUI({ quickCapture: false })} title="Quick add" wide>
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Sparkles size={18} className="absolute top-3.5 left-3.5 text-accent-text" />
          <textarea
            id="quick-capture"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={2}
            placeholder="Need to create 3 Instagram posts for Client X by Friday"
            className={cn(inputCls, 'h-auto resize-none py-3 pl-11 text-base leading-snug')}
          />
        </div>

        {!text && (
          <div className="flex flex-col gap-2">
            <p className="eyebrow">Try one</p>
            <div className="flex flex-wrap gap-2">
              {CAPTURE_EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
                  {ex}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-3">
              Understands clients, dates like “Friday”, “tomorrow” or “14 Oct”, <span className="font-mono">#tags</span> and <span className="font-mono">!urgent</span>.
            </p>
          </div>
        )}

        {text && (
          <div className="anim-pop rounded-[22px] border border-line bg-surface-2 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">We’ll create</p>
              <Segmented
                label="Create as"
                value={mode === 'auto' ? kind : mode}
                onChange={(v) => setMode(v)}
                options={[
                  { value: 'task', label: <><ListPlus size={14} /> Task</> },
                  { value: 'project', label: <><FolderPlus size={14} /> Project</> },
                ]}
              />
            </div>
            <p className="text-lg font-medium tracking-tight">{parsed.title}</p>
            <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <dt className="flex w-20 items-center gap-1.5 text-ink-3"><User size={13} /> Client</dt>
                <dd className="font-medium">{parsed.clientName ?? <span className="text-ink-3">None</span>}{parsed.clientName && !parsed.clientId && <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-text">new</span>}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="flex w-20 items-center gap-1.5 text-ink-3"><CalendarDays size={13} /> Due</dt>
                <dd className="font-medium">{parsed.deadline ? `${fmtDate(parsed.deadline, 'EEE d MMM')}` : <span className="text-ink-3">No date</span>}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="w-20 text-ink-3">Priority</dt>
                <dd><PriorityTag priority={parsed.priority} /></dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="flex w-20 items-center gap-1.5 text-ink-3"><TagIcon size={13} /> {kind === 'project' ? 'Type' : 'Tags'}</dt>
                <dd className="font-medium">{kind === 'project' ? parsed.type : parsed.tags.length ? parsed.tags.map((t) => '#' + t).join(' ') : <span className="text-ink-3">None</span>}</dd>
              </div>
            </dl>
            {kind === 'task' && (
              <label className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="text-ink-3">Add to project</span>
                <select id="qc-project" className={cn(inputCls, 'h-9 w-auto min-w-0 flex-1 bg-surface')} value={targetProject?.id ?? ''} onChange={(e) => setProjectOverride(e.target.value)}>
                  {!targetProject && <option value="">Choose a project…</option>}
                  {openProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            )}
            {kind === 'project' && qty && (
              <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
                <input id="qc-split" type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                Also create {qty} separate tasks inside it
              </label>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-ink-3 sm:flex">
            <Kbd><CornerDownLeft size={11} /></Kbd> to add · <Kbd>Esc</Kbd> to close
          </span>
          <Button variant="accent" onClick={submit} disabled={!text.trim() || (kind === 'task' && !targetProject && !openProjects.length)} className="ml-auto">
            Add {kind === 'task' ? 'task' : 'project'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
