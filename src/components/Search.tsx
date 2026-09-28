import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, FileText, FolderKanban, Hash, ListChecks, NotebookPen, Paperclip, Plus, Search as SearchIcon, Timer, Users } from 'lucide-react'
import { useStore, useUI, type Route } from '../lib/store'
import { useLookups } from '../lib/selectors'
import { cn } from '../lib/utils'
import { Kbd, ClientMark } from './ui'
import { NAV } from './Shell'

interface Result {
  id: string
  group: string
  title: string
  sub?: string
  icon: ReactNode
  run: () => void
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function snippet(text: string, q: string) {
  const i = norm(text).indexOf(q)
  if (i < 0) return text.slice(0, 80)
  const start = Math.max(0, i - 30)
  return `${start > 0 ? '…' : ''}${text.slice(start, i + q.length + 50)}${i + q.length + 50 < text.length ? '…' : ''}`
}

export default function Search() {
  const open = useUI((s) => s.search)
  const setUI = useUI((s) => s.set)
  const navigate = useUI((s) => s.navigate)
  const { projects, tasks, clients, startTimer } = useStore()
  const { project } = useLookups()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const close = () => setUI({ search: false })
  const go = (r: Route) => {
    navigate(r)
    close()
  }

  const results = useMemo<Result[]>(() => {
    const query = norm(q.trim().replace(/^#/, ''))
    const out: Result[] = []
    if (!query) {
      out.push({ id: 'a_new', group: 'Actions', title: 'Quick add a task or project', icon: <Plus size={16} />, run: () => setUI({ search: false, quickCapture: true }) })
      out.push({ id: 'a_proj', group: 'Actions', title: 'Create a project', icon: <FolderKanban size={16} />, run: () => setUI({ search: false, projectForm: { open: true } }) })
      for (const n of NAV) out.push({ id: 'nav_' + n.name, group: 'Go to', title: n.label, icon: <n.icon size={16} />, run: () => go({ name: n.name } as Route) })
      return out
    }
    const has = (s: string | undefined | null) => !!s && norm(s).includes(query)

    for (const p of projects) {
      if (has(p.name) || has(p.type)) out.push({ id: p.id, group: 'Projects', title: p.name, sub: `${p.clientId ? clients.find((c) => c.id === p.clientId)?.name : 'Personal'} · ${p.type}`, icon: <FolderKanban size={16} />, run: () => go({ name: 'project', id: p.id }) })
    }
    for (const t of tasks) {
      if (has(t.title)) out.push({ id: t.id, group: 'Tasks', title: t.title, sub: project.get(t.projectId)?.name, icon: <ListChecks size={16} />, run: () => { setUI({ search: false, taskDetail: t.id }) } })
    }
    for (const c of clients) {
      if (has(c.name) || has(c.contact) || has(c.industry) || has(c.location)) out.push({ id: c.id, group: 'Clients', title: c.name, sub: [c.contact, c.location].filter(Boolean).join(' · '), icon: <ClientMark name={c.name} hue={c.hue} size={20} />, run: () => go({ name: 'client', id: c.id }) })
    }
    for (const p of projects) {
      for (const [label, text] of [['Brief', p.brief], ['Notes', p.notes], ['Description', p.description]] as const) {
        if (has(text) && !has(p.name)) {
          out.push({ id: `${p.id}_${label}`, group: 'Notes', title: snippet(text, query), sub: `${label} · ${p.name}`, icon: <NotebookPen size={16} />, run: () => go({ name: 'project', id: p.id }) })
          break
        }
      }
    }
    for (const t of tasks) {
      if (has(t.notes)) out.push({ id: `${t.id}_n`, group: 'Notes', title: snippet(t.notes, query), sub: `Task note · ${t.title}`, icon: <NotebookPen size={16} />, run: () => setUI({ search: false, taskDetail: t.id }) })
      for (const c of t.comments) if (has(c.body)) out.push({ id: c.id, group: 'Notes', title: snippet(c.body, query), sub: `Comment · ${t.title}`, icon: <NotebookPen size={16} />, run: () => setUI({ search: false, taskDetail: t.id }) })
    }
    for (const p of projects) for (const f of p.attachments) if (has(f.name)) out.push({ id: f.id, group: 'Files', title: f.name, sub: `${f.size} · ${p.name}`, icon: <Paperclip size={16} />, run: () => go({ name: 'project', id: p.id }) })
    for (const t of tasks) for (const f of t.attachments) if (has(f.name)) out.push({ id: f.id, group: 'Files', title: f.name, sub: `${f.size} · ${t.title}`, icon: <FileText size={16} />, run: () => setUI({ search: false, taskDetail: t.id }) })
    for (const c of clients) for (const f of c.files) if (has(f.name)) out.push({ id: f.id, group: 'Files', title: f.name, sub: `${f.size} · ${c.name}`, icon: <Paperclip size={16} />, run: () => go({ name: 'client', id: c.id }) })
    const tagSet = new Set(projects.flatMap((p) => p.tags).filter((t) => norm(t).includes(query)))
    for (const tag of tagSet) {
      const n = projects.filter((p) => p.tags.includes(tag)).length
      out.push({ id: 'tag_' + tag, group: 'Tags', title: `#${tag}`, sub: `${n} project${n === 1 ? '' : 's'}`, icon: <Hash size={16} />, run: () => { setUI({ projectsTag: tag }); go({ name: 'projects' }) } })
    }
    for (const p of projects.filter((p) => has(p.name)).slice(0, 2)) {
      out.push({ id: 'timer_' + p.id, group: 'Actions', title: `Start timer on ${p.name}`, icon: <Timer size={16} />, run: () => { startTimer(p.id); close() } })
    }
    for (const n of NAV) if (has(n.label)) out.push({ id: 'nav_' + n.name, group: 'Go to', title: n.label, icon: <n.icon size={16} />, run: () => go({ name: n.name } as Route) })
    if (has('team') || has('people') || has('members')) out.push({ id: 'nav_team', group: 'Go to', title: 'Team', icon: <Users size={16} />, run: () => go({ name: 'settings', tab: 'team' }) })
    return out.slice(0, 60)
  }, [q, projects, tasks, clients, project])

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!open) return null
  const groups = Array.from(new Set(results.map((r) => r.group)))
  let idx = -1

  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 pt-[10vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="anim-pop w-full max-w-2xl overflow-hidden rounded-[28px] border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-5">
          <SearchIcon size={18} className="text-ink-3" />
          <input
            ref={inputRef}
            id="global-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSel((s) => Math.min(results.length - 1, s + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSel((s) => Math.max(0, s - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                results[sel]?.run()
              } else if (e.key === 'Escape') close()
            }}
            placeholder="Search projects, tasks, clients, notes, files, #tags"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} id="search-results" role="listbox" className="scroll-thin max-h-[60vh] overflow-y-auto p-2">
          {groups.map((g) => (
            <div key={g} className="mb-1">
              <p className="eyebrow px-3 pt-2 pb-1">{g}</p>
              {results
                .filter((r) => r.group === g)
                .map((r) => {
                  idx++
                  const i = idx
                  return (
                    <button
                      key={r.group + r.id}
                      data-idx={i}
                      type="button"
                      role="option"
                      aria-selected={i === sel}
                      onMouseMove={() => setSel(i)}
                      onClick={r.run}
                      className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left', i === sel ? 'bg-surface-2' : '')}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface-3 text-ink-2">{r.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.title}</span>
                        {r.sub && <span className="block truncate text-xs text-ink-3">{r.sub}</span>}
                      </span>
                      {i === sel && <ArrowRight size={16} className="text-ink-3" />}
                    </button>
                  )
                })}
            </div>
          ))}
          {!results.length && <p className="px-4 py-10 text-center text-sm text-ink-3">Nothing matches “{q}”. Try a client name, a tag, or a file name.</p>}
        </div>
      </div>
    </div>
  )
}

