import { useMemo, useState } from 'react'
import { ArrowLeft, Copy, Globe, Mail, MapPin, Pencil, Phone, Search, Trash2, Users } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { entryMs, isClosedKind, isFinishedKind, kindOf, useCan } from '../lib/selectors'
import { cn, fmtHours } from '../lib/utils'
import { Button, Card, CardHeader, ClientMark, EmptyState, inputCls, PageHeader } from '../components/ui'
import { ProjectCard, TaskRow } from '../components/items'
import { AddButton, FileChip } from '../components/forms'

export function Clients() {
  const { clients, projects, tasks, statuses } = useStore()
  const navigate = useUI((u) => u.navigate)
  const setUI = useUI((u) => u.set)
  const can = useCan()
  const [q, setQ] = useState('')
  const rows = useMemo(
    () =>
      clients
        .filter((c) => !q || [c.name, c.contact, c.industry, c.location].some((x) => x.toLowerCase().includes(q.toLowerCase())))
        .map((c) => {
          const ps = projects.filter((p) => p.clientId === c.id)
          const active = ps.filter((p) => !isFinishedKind(kindOf(statuses, p.statusId)))
          const pending = tasks.filter((t) => active.some((p) => p.id === t.projectId) && !isClosedKind(kindOf(statuses, t.statusId))).length
          return { c, total: ps.length, active: active.length, done: ps.length - active.length, pending }
        })
        .sort((a, b) => b.active - a.active || b.total - a.total),
    [clients, projects, tasks, statuses, q],
  )
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Clients" sub={`${clients.length} clients`} actions={can('edit') && <AddButton onClick={() => setUI({ clientForm: { open: true } })}>New client</AddButton>} />
      <div className="relative mb-5 max-w-xs">
        <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
        <input id="clients-q" className={cn(inputCls, 'rounded-full pl-9')} placeholder="Find a client" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 lg:gap-5">
          {rows.map(({ c, total, active, done, pending }) => (
            <button key={c.id} type="button" onClick={() => navigate({ name: 'client', id: c.id })} className="card flex flex-col gap-4 p-5 text-left transition-transform hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <ClientMark name={c.name} hue={c.hue} size={46} />
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-medium tracking-tight">{c.name}</p>
                  <p className="truncate text-[13px] text-ink-3">
                    {[c.industry, c.location].filter(Boolean).join(' · ') || 'No details yet'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 border-t border-line pt-4 text-center">
                {[
                  ['Active', active],
                  ['Done', done],
                  ['Total', total],
                  ['Open tasks', pending],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <p className={cn('tnum text-xl font-semibold', l === 'Active' && Number(v) > 0 && 'text-accent-text')}>{v}</p>
                    <p className="text-[11px] text-ink-3">{l}</p>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Users size={20} />} title="No clients yet" body="Add the people and companies you design for." />
      )}
    </div>
  )
}

function CopyText({ icon, value, href }: { icon: React.ReactNode; value: string; href?: string }) {
  const notify = useUI((u) => u.notify)
  if (!value) return null
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm">
      <span className="text-ink-3">{icon}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate select-all hover:underline">
          {value}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate select-all">{value}</span>
      )}
      <button
        type="button"
        aria-label={`Copy ${value}`}
        className="grid size-7 place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => notify('Copied'), () => notify('Select the text to copy it'))
        }}
      >
        <Copy size={13} />
      </button>
    </div>
  )
}

export function ClientDetail({ id }: { id: string }) {
  const s = useStore()
  const navigate = useUI((u) => u.navigate)
  const setUI = useUI((u) => u.set)
  const notify = useUI((u) => u.notify)
  const can = useCan()
  const [confirm, setConfirm] = useState(false)
  const c = s.clients.find((x) => x.id === id)
  if (!c) return <EmptyState title="Client not found" action={<Button onClick={() => navigate({ name: 'clients' })}>Back to clients</Button>} />
  const ps = s.projects.filter((p) => p.clientId === c.id)
  const active = ps.filter((p) => !isFinishedKind(kindOf(s.statuses, p.statusId)))
  const completed = ps.filter((p) => isFinishedKind(kindOf(s.statuses, p.statusId)))
  const pending = s.tasks.filter((t) => active.some((p) => p.id === t.projectId) && !isClosedKind(kindOf(s.statuses, t.statusId)))
  const hours = s.entries.filter((e) => ps.some((p) => p.id === e.projectId)).reduce((a, e) => a + entryMs(e), 0)
  const files = [...c.files, ...ps.flatMap((p) => p.attachments.filter((f) => f.final))]

  return (
    <div className="mx-auto max-w-[1400px]">
      <button type="button" onClick={() => navigate({ name: 'clients' })} className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft size={15} /> Clients
      </button>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <ClientMark name={c.name} hue={c.hue} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">{c.name}</h1>
          <p className="text-sm text-ink-3">{[c.industry, c.location, c.contact && `Contact: ${c.contact}`].filter(Boolean).join(' · ')}</p>
        </div>
        {can('edit') && (
          <div className="flex gap-2">
            <Button icon={<Pencil size={15} />} onClick={() => setUI({ clientForm: { open: true, id: c.id } })}>
              Edit
            </Button>
            <AddButton onClick={() => setUI({ projectForm: { open: true, preset: { clientId: c.id } } })}>New project</AddButton>
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Active projects', active.length],
          ['Completed', completed.length],
          ['Total projects', ps.length],
          ['Pending tasks', pending.length],
          ['Hours invested', fmtHours(hours, true)],
        ].map(([l, v]) => (
          <div key={l as string} className="card p-4">
            <p className="text-[13px] text-ink-3">{l}</p>
            <p className="tnum mt-1 text-[28px] leading-none font-semibold tracking-tight">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:gap-5">
        <div className="flex flex-col gap-4 lg:gap-5">
          <section>
            <h2 className="mb-3 px-1 text-[17px] font-medium tracking-tight">Active projects</h2>
            {active.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {active.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            ) : (
              <EmptyState title="No active projects" />
            )}
          </section>
          <Card>
            <CardHeader title="Pending work" sub={`${pending.length} open tasks`} />
            <div className="-mx-2">
              {pending.slice(0, 10).map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
            {!pending.length && <p className="text-sm text-ink-3">Nothing pending for {c.name}.</p>}
          </Card>
          {completed.length > 0 && (
            <Card>
              <CardHeader title="Completed projects" />
              <ul className="flex flex-col divide-y divide-line">
                {completed.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => navigate({ name: 'project', id: p.id })} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:text-accent-text">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-ink-3">{p.type}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-4 lg:gap-5">
          <Card>
            <CardHeader title="Contact" />
            <div className="flex flex-col gap-2">
              <CopyText icon={<Mail size={15} />} value={c.email} />
              <CopyText icon={<Phone size={15} />} value={c.phone} />
              <CopyText icon={<Globe size={15} />} value={c.website} href={c.website ? `https://${c.website.replace(/^https?:\/\//, '')}` : undefined} />
              <CopyText icon={<MapPin size={15} />} value={c.location} />
              {!c.email && !c.phone && !c.website && <p className="text-sm text-ink-3">No contact details yet.</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Notes" />
            <textarea
              id="client-notes"
              aria-label="Client notes"
              readOnly={!can('edit')}
              className="min-h-[140px] w-full resize-y rounded-2xl border border-line bg-surface-2 p-3 text-sm leading-relaxed outline-none focus:border-accent-text/60"
              value={c.notes}
              onChange={(e) => s.updateClient(c.id, { notes: e.target.value })}
            />
          </Card>
          <Card>
            <CardHeader title="Files" sub="Brand assets and final deliverables" />
            <div className="flex flex-col gap-2">
              {files.map((f) => (
                <FileChip key={f.id} file={f} />
              ))}
            </div>
            {!files.length && <p className="text-sm text-ink-3">No files yet.</p>}
          </Card>
          {can('delete') && (
            <div className="flex items-center gap-2">
              {confirm ? (
                <>
                  <span className="text-[13px] text-ink-2">Remove this client? Their projects stay.</span>
                  <Button size="sm" variant="danger" onClick={() => { s.removeClient(c.id); navigate({ name: 'clients' }); notify('Client removed') }}>
                    Remove
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
                  Remove client
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
