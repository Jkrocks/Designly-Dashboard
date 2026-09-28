import { useEffect, useMemo, useState } from 'react'
import { Columns3, FolderOpen, LayoutGrid, List, Search, X } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { PROJECT_FILTERS, isClosedKind, kindOf, projectProgress, useCan, useCurrentUser, useLookups } from '../lib/selectors'
import { PROJECT_TYPES } from '../lib/demo'
import { cn, priorityRank } from '../lib/utils'
import { AvatarStack, Bar, Chip, ClientMark, EmptyState, inputCls, PageHeader, PriorityTag, Segmented, StatusPill } from '../components/ui'
import { DueBadge, ProjectCard } from '../components/items'
import { Kanban } from '../components/Kanban'
import { AddButton } from '../components/forms'

type View = 'grid' | 'list' | 'board'
type Sort = 'deadline' | 'priority' | 'recent' | 'name'

function readPref<T extends string>(k: string, fallback: T): T {
  try {
    return (localStorage.getItem(k) as T) || fallback
  } catch {
    return fallback
  }
}
function writePref(k: string, v: string) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* preference simply isn't remembered */
  }
}

export default function Projects() {
  const { projects, tasks, statuses, clients, updateProject } = useStore()
  const { status, client, member } = useLookups()
  const me = useCurrentUser()
  const can = useCan()
  const setUI = useUI((s) => s.set)
  const navigate = useUI((s) => s.navigate)
  const presetTag = useUI((s) => s.projectsTag)
  const [view, setView] = useState<View>(() => readPref('df:projects-view', 'grid'))
  const [filter, setFilter] = useState('all')
  const [clientId, setClientId] = useState('')
  const [type, setType] = useState('')
  const [tag, setTag] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('deadline')

  useEffect(() => {
    if (presetTag) {
      setTag(presetTag)
      setFilter('everything')
      setUI({ projectsTag: null })
    }
  }, [presetTag])
  useEffect(() => writePref('df:projects-view', view), [view])

  const ctx = { statuses, me: me.id }
  const allTags = useMemo(() => Array.from(new Set(projects.flatMap((p) => p.tags))).sort(), [projects])

  const list = useMemo(() => {
    const f = PROJECT_FILTERS.find((x) => x.id === filter)!
    const query = q.trim().toLowerCase()
    return projects
      .filter((p) => f.test(p, ctx))
      .filter((p) => !clientId || p.clientId === clientId)
      .filter((p) => !type || p.type === type)
      .filter((p) => !tag || p.tags.includes(tag))
      .filter((p) => !query || [p.name, p.type, client.get(p.clientId ?? '')?.name, ...p.tags].some((x) => x?.toLowerCase().includes(query)))
      .sort((a, b) =>
        sort === 'deadline'
          ? a.deadline.localeCompare(b.deadline)
          : sort === 'priority'
            ? priorityRank[a.priority] - priorityRank[b.priority]
            : sort === 'recent'
              ? b.createdAt.localeCompare(a.createdAt)
              : a.name.localeCompare(b.name),
      )
  }, [projects, filter, clientId, type, tag, q, sort, statuses, me.id, client])

  const activeExtras = [clientId && client.get(clientId)?.name, type, tag && `#${tag}`].filter(Boolean)

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Projects"
        sub={`${projects.filter((p) => !isClosedKind(kindOf(statuses, p.statusId))).length} open · ${projects.length} total`}
        actions={
          <>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'grid', label: <><LayoutGrid size={15} /><span className="sr-only sm:not-sr-only">Grid</span></> },
                { value: 'list', label: <><List size={15} /><span className="sr-only sm:not-sr-only">List</span></> },
                { value: 'board', label: <><Columns3 size={15} /><span className="sr-only sm:not-sr-only">Board</span></> },
              ]}
            />
            {can('edit') && <AddButton onClick={() => setUI({ projectForm: { open: true } })}>New project</AddButton>}
          </>
        }
      />

      <div className="scroll-thin -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {PROJECT_FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)} count={projects.filter((p) => f.test(p, ctx)).length}>
            {f.label}
          </Chip>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input id="projects-q" className={cn(inputCls, 'rounded-full pl-9')} placeholder="Filter by name, client, tag" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select id="projects-client" aria-label="Client" className={cn(inputCls, 'w-auto rounded-full')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              Client: {c.name}
            </option>
          ))}
        </select>
        <select id="projects-type" aria-label="Project type" className={cn(inputCls, 'w-auto rounded-full')} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select id="projects-tag" aria-label="Tag" className={cn(inputCls, 'w-auto rounded-full')} value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
        {view !== 'board' && (
          <select id="projects-sort" aria-label="Sort" className={cn(inputCls, 'w-auto rounded-full')} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="deadline">Sort: Deadline</option>
            <option value="priority">Sort: Priority</option>
            <option value="recent">Sort: Newest</option>
            <option value="name">Sort: Name</option>
          </select>
        )}
        {activeExtras.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setClientId('')
              setType('')
              setTag('')
              setQ('')
            }}
            className="flex h-10 items-center gap-1 rounded-full px-3 text-[13px] text-ink-3 hover:text-ink"
          >
            <X size={14} /> Clear {activeExtras.join(', ')}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<FolderOpen size={20} />} title="No projects match" body="Try another filter, or create a new project." action={can('edit') ? <AddButton onClick={() => setUI({ projectForm: { open: true } })}>New project</AddButton> : undefined} />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-5">
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : view === 'list' ? (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Priority</th>
                  <th className="px-3 py-3 font-medium">Deadline</th>
                  <th className="px-3 py-3 font-medium">Progress</th>
                  <th className="px-5 py-3 font-medium">Team</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const c = p.clientId ? client.get(p.clientId) : null
                  const pt = tasks.filter((t) => t.projectId === p.id)
                  const prog = projectProgress(pt, statuses)
                  return (
                    <tr key={p.id} onClick={() => navigate({ name: 'project', id: p.id })} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {c ? <ClientMark name={c.name} hue={c.hue} size={34} /> : <span className="size-[34px] rounded-[30%] bg-surface-3" />}
                          <div className="min-w-0">
                            <button type="button" className="block truncate text-left font-medium" onClick={() => navigate({ name: 'project', id: p.id })}>
                              {p.name}
                            </button>
                            <p className="truncate text-xs text-ink-3">
                              {c?.name ?? 'Personal'} · {p.type}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={status.get(p.statusId)} />
                      </td>
                      <td className="px-3 py-3">
                        <PriorityTag priority={p.priority} />
                      </td>
                      <td className="px-3 py-3">
                        <DueBadge date={p.deadline} done={isClosedKind(kindOf(statuses, p.statusId))} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex w-32 items-center gap-2">
                          <Bar value={prog} className="flex-1" />
                          <span className="tnum w-9 text-right text-xs text-ink-3">{Math.round(prog * 100)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <AvatarStack members={p.memberIds.map((id) => member.get(id)!).filter(Boolean)} size={24} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Kanban
          statuses={statuses.filter((s) => s.kind !== 'archived')}
          items={list}
          label={(p) => p.name}
          onMove={(id, statusId) => updateProject(id, { statusId })}
          onAdd={can('edit') ? (statusId) => setUI({ projectForm: { open: true, preset: { statusId } } }) : undefined}
          renderCard={(p) => {
            const c = p.clientId ? client.get(p.clientId) : null
            return (
              <button type="button" tabIndex={-1} onClick={() => navigate({ name: 'project', id: p.id })} className="block w-full text-left">
                <p className="pr-12 text-sm font-medium">{p.name}</p>
                <p className="mt-0.5 text-xs text-ink-3">
                  {c?.name ?? 'Personal'} · {p.type}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <DueBadge date={p.deadline} done={isClosedKind(kindOf(statuses, p.statusId))} />
                  <AvatarStack members={p.memberIds.map((id) => member.get(id)!).filter(Boolean)} size={22} max={3} />
                </div>
              </button>
            )
          }}
        />
      )}
    </div>
  )
}
