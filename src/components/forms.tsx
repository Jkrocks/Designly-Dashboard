import { useEffect, useState, type ReactNode } from 'react'
import { addDays } from 'date-fns'
import { FileArchive, FileImage, FileText, FileVideo, PenTool, Link2, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { useCurrentUser } from '../lib/selectors'
import { INDUSTRIES } from '../lib/demo'
import type { Attachment, LinkRef, Priority, Project, Task } from '../lib/types'
import { cn, PRIORITIES, priorityLabel, toISODate, todayISO, uid } from '../lib/utils'
import { Avatar, Button, Field, inputCls, Modal, textareaCls } from './ui'

export function fileKind(name: string, mime = ''): Attachment['kind'] {
  const n = name.toLowerCase()
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|heic)$/.test(n)) return 'image'
  if (mime.startsWith('video/') || /\.(mp4|mov|webm)$/.test(n)) return 'video'
  if (/\.pdf$/.test(n)) return 'pdf'
  if (/\.fig$/.test(n)) return 'figma'
  if (/\.(zip|rar|7z)$/.test(n)) return 'archive'
  if (/\.(docx?|txt|md|pages|key|pptx?)$/.test(n)) return 'doc'
  return 'other'
}

const kindIcon: Record<Attachment['kind'], typeof FileText> = { image: FileImage, pdf: FileText, figma: PenTool, video: FileVideo, doc: FileText, archive: FileArchive, other: Paperclip }

export function FileChip({ file, onRemove }: { file: Attachment; onRemove?: () => void }) {
  const Icon = kindIcon[file.kind]
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-2.5 pr-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-ink-2">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{file.name}</span>
        <span className="text-xs text-ink-3">
          {file.size}
          {file.final && ' · Final'}
        </span>
      </span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`} className="grid size-7 place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/** Files are recorded by name and size; this demo keeps everything in your browser. */
export function FilePicker({ value, onChange, id }: { value: Attachment[]; onChange: (v: Attachment[]) => void; id: string }) {
  const [drag, setDrag] = useState(false)
  const add = (files: FileList | null) => {
    if (!files?.length) return
    const next = Array.from(files).map<Attachment>((f) => ({
      id: uid('f'),
      name: f.name,
      kind: fileKind(f.name, f.type),
      size: f.size > 1e6 ? `${(f.size / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1e3))} KB`,
      addedAt: new Date().toISOString(),
    }))
    onChange([...value, ...next])
  }
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          add(e.dataTransfer.files)
        }}
        className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-4 text-[13px] text-ink-3 transition-colors', drag ? 'border-accent-text bg-accent-soft text-accent-text' : 'border-line-strong hover:border-ink-3')}
      >
        <Upload size={16} /> Drop files or <span className="font-medium text-ink">browse</span>
        <input id={id} type="file" multiple className="sr-only" onChange={(e) => add(e.target.files)} />
      </label>
      {value.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {value.map((f) => (
            <FileChip key={f.id} file={f} onRemove={() => onChange(value.filter((x) => x.id !== f.id))} />
          ))}
        </div>
      )}
    </div>
  )
}

export function LinksEditor({ value, onChange }: { value: LinkRef[]; onChange: (v: LinkRef[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((l, i) => (
        <div key={l.id} className="flex gap-2">
          <input aria-label="Link label" className={cn(inputCls, 'w-36 shrink-0')} value={l.label} placeholder="Label" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input aria-label="Link URL" className={inputCls} value={l.url} placeholder="https://" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
          <button type="button" aria-label="Remove link" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-3 hover:bg-surface-2">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <Button size="sm" variant="ghost" icon={<Link2 size={14} />} className="self-start" onClick={() => onChange([...value, { id: uid('l'), label: '', url: '' }])}>
        Add link
      </Button>
    </div>
  )
}

export function MemberPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const members = useStore((s) => s.members)
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => {
        const on = value.includes(m.id)
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id])}
            className={cn('flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-[13px] transition-colors', on ? 'border-accent-text/50 bg-accent-soft text-ink' : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong')}
          >
            <Avatar member={m} size={24} />
            {m.name.split(' ')[0]}
          </button>
        )
      })}
    </div>
  )
}

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Priority">
      {PRIORITIES.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          onClick={() => onChange(p)}
          className={cn('h-10 flex-1 rounded-xl border text-[13px] font-medium transition-colors', value === p ? 'border-transparent bg-ink text-bg' : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong')}
        >
          {priorityLabel[p]}
        </button>
      ))}
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-line pt-5 first:border-0 first:pt-0">
      <legend className="eyebrow float-left mb-1 w-full">{title}</legend>
      {children}
    </fieldset>
  )
}

export const blankProject = (statusId: string, me: string): Omit<Project, 'id' | 'createdAt'> => ({
  name: '',
  clientId: null,
  type: 'Branding',
  description: '',
  brief: '',
  startDate: todayISO(),
  deadline: toISODate(addDays(new Date(), 14)),
  priority: 'medium',
  statusId,
  tags: [],
  memberIds: [me],
  software: [],
  attachments: [],
  links: [],
  notes: '',
  cover: { hue: Math.floor(Math.random() * 360), shape: Math.floor(Math.random() * 4) },
})


export function TaskForm() {
  const form = useUI((s) => s.taskForm)
  const setUI = useUI((s) => s.set)
  const notify = useUI((s) => s.notify)
  const { projects, statuses, members, tasks, addTask, updateTask } = useStore()
  const me = useCurrentUser()
  const existing = form.id ? tasks.find((t) => t.id === form.id) : undefined
  const empty = (): Omit<Task, 'id' | 'createdAt' | 'comments'> => ({
    projectId: projects[0]?.id ?? '',
    title: '',
    statusId: (statuses.find((s) => s.kind === 'active') ?? statuses[0]!).id,
    deadline: toISODate(addDays(new Date(), 3)),
    priority: 'medium',
    estimate: 2,
    assigneeId: me.id,
    notes: '',
    attachments: [],
  })
  const [v, setV] = useState(empty)
  useEffect(() => {
    if (form.open) setV(existing ? { ...existing } : { ...empty(), ...form.preset })
  }, [form.open, form.id])
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((x) => ({ ...x, [k]: val }))
  const close = () => setUI({ taskForm: { open: false } })
  const save = () => {
    if (!v.title.trim() || !v.projectId) return
    if (existing) updateTask(existing.id, v)
    else addTask({ ...v, title: v.title.trim() })
    notify(existing ? 'Task updated' : 'Task added')
    close()
  }
  return (
    <Modal
      open={form.open}
      onClose={close}
      title={existing ? 'Edit task' : 'New task'}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save} disabled={!v.title.trim() || !v.projectId}>
            {existing ? 'Save' : 'Add task'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Task">
          <input id="tf-title" className={cn(inputCls, 'h-12 text-base')} value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="Key visual" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project">
            <select id="tf-project" className={inputCls} value={v.projectId} onChange={(e) => set('projectId', e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select id="tf-status" className={inputCls} value={v.statusId} onChange={(e) => set('statusId', e.target.value)}>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deadline">
            <input id="tf-deadline" type="date" className={inputCls} value={v.deadline ?? ''} onChange={(e) => set('deadline', e.target.value || null)} />
          </Field>
          <Field label="Estimated hours">
            <input id="tf-estimate" type="number" min={0} step={0.5} className={inputCls} value={v.estimate} onChange={(e) => set('estimate', Number(e.target.value))} />
          </Field>
          <Field label="Assignee">
            <select id="tf-assignee" className={inputCls} value={v.assigneeId ?? ''} onChange={(e) => set('assigneeId', e.target.value || null)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Priority">
          <PriorityPicker value={v.priority} onChange={(p) => set('priority', p)} />
        </Field>
        <Field label="Notes">
          <textarea id="tf-notes" className={textareaCls} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <Field label="Attachments">
          <FilePicker id="tf-files" value={v.attachments} onChange={(a) => set('attachments', a)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

export function ClientForm() {
  const form = useUI((s) => s.clientForm)
  const setUI = useUI((s) => s.set)
  const notify = useUI((s) => s.notify)
  const navigate = useUI((s) => s.navigate)
  const { clients, addClient, updateClient } = useStore()
  const existing = form.id ? clients.find((c) => c.id === form.id) : undefined
  const empty = { name: '', contact: '', email: '', phone: '', website: '', location: '', industry: INDUSTRIES[0]!, notes: '', hue: Math.floor(Math.random() * 360) }
  const [v, setV] = useState(empty)
  useEffect(() => {
    if (form.open) setV(existing ? { ...existing } : empty)
  }, [form.open, form.id])
  const set = (k: keyof typeof v, val: string) => setV((x) => ({ ...x, [k]: val }))
  const close = () => setUI({ clientForm: { open: false } })
  const save = () => {
    if (!v.name.trim()) return
    if (existing) {
      updateClient(existing.id, v)
      notify('Client updated')
    } else {
      const c = addClient(v)
      notify(`${c.name} added`, { label: 'Open', run: () => navigate({ name: 'client', id: c.id }) })
    }
    close()
  }
  const input = (k: keyof typeof v, label: string, type = 'text', placeholder = '') => (
    <Field label={label}>
      <input id={`cf-${k}`} type={type} className={inputCls} value={String(v[k])} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} />
    </Field>
  )
  return (
    <Modal
      open={form.open}
      onClose={close}
      title={existing ? 'Edit client' : 'New client'}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save} disabled={!v.name.trim()}>
            {existing ? 'Save' : 'Add client'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{input('name', 'Company name', 'text', 'iD Fresh')}</div>
        {input('contact', 'Main contact', 'text', 'Full name')}
        <Field label="Industry">
          <select id="cf-industry" className={inputCls} value={v.industry} onChange={(e) => set('industry', e.target.value)}>
            {INDUSTRIES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </Field>
        {input('email', 'Email', 'email', 'name@company.com')}
        {input('phone', 'Phone', 'tel', '+44 20 0000 0000')}
        {input('website', 'Website', 'text', 'company.com')}
        {input('location', 'City, country', 'text', 'Lisbon, Portugal')}
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea id="cf-notes" className={textareaCls} value={v.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Preferences, approval process, anything useful." />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="accent" icon={<Plus size={17} strokeWidth={2.4} />} onClick={onClick}>
      {children}
    </Button>
  )
}
