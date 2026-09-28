import { useMemo, useState } from 'react'
import { Archive as ArchiveIcon, FileCheck2, X } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { isFinishedKind, kindOf, useLookups } from '../lib/selectors'
import { cn, fmtDate } from '../lib/utils'
import { EmptyState, inputCls, PageHeader, Tag } from '../components/ui'
import { Cover } from '../components/art'

export default function Archive() {
  const { projects, statuses } = useStore()
  const { client } = useLookups()
  const navigate = useUI((u) => u.navigate)
  const [f, setF] = useState({ client: '', year: '', type: '', industry: '', software: '', tag: '' })

  const done = useMemo(
    () => projects.filter((p) => p.completedAt && isFinishedKind(kindOf(statuses, p.statusId))).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!)),
    [projects, statuses],
  )
  const opts = useMemo(() => {
    const uniq = (xs: (string | undefined | null)[]) => Array.from(new Set(xs.filter(Boolean) as string[])).sort()
    return {
      client: uniq(done.map((p) => p.clientId)).map((id) => [id, client.get(id)?.name ?? id] as const),
      year: uniq(done.map((p) => p.completedAt!.slice(0, 4))).reverse().map((y) => [y, y] as const),
      type: uniq(done.map((p) => p.type)).map((x) => [x, x] as const),
      industry: uniq(done.map((p) => client.get(p.clientId ?? '')?.industry)).map((x) => [x, x] as const),
      software: uniq(done.flatMap((p) => p.software)).map((x) => [x, x] as const),
      tag: uniq(done.flatMap((p) => p.tags)).map((x) => [x, `#${x}`] as const),
    }
  }, [done, client])

  const list = done.filter(
    (p) =>
      (!f.client || p.clientId === f.client) &&
      (!f.year || p.completedAt!.startsWith(f.year)) &&
      (!f.type || p.type === f.type) &&
      (!f.industry || client.get(p.clientId ?? '')?.industry === f.industry) &&
      (!f.software || p.software.includes(f.software)) &&
      (!f.tag || p.tags.includes(f.tag)),
  )
  const years = Array.from(new Set(list.map((p) => p.completedAt!.slice(0, 4))))
  const active = Object.values(f).some(Boolean)
  const labels: Record<keyof typeof f, string> = { client: 'All clients', year: 'All years', type: 'All types', industry: 'All industries', software: 'All software', tag: 'All tags' }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Archive" sub={`${done.length} finished projects, organised automatically. Your portfolio, ready when you need it.`} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(Object.keys(labels) as (keyof typeof f)[]).map((k) => (
          <select key={k} id={`archive-${k}`} aria-label={labels[k]} className={cn(inputCls, 'w-auto rounded-full', f[k] && 'border-accent-text/60')} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
            <option value="">{labels[k]}</option>
            {opts[k].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        ))}
        {active && (
          <button type="button" onClick={() => setF({ client: '', year: '', type: '', industry: '', software: '', tag: '' })} className="flex h-10 items-center gap-1 rounded-full px-3 text-[13px] text-ink-3 hover:text-ink">
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<ArchiveIcon size={20} />} title={done.length ? 'Nothing matches these filters' : 'Your archive is empty'} body={done.length ? 'Loosen a filter to see more work.' : 'Completed projects land here automatically.'} />
      ) : (
        years.map((y) => (
          <section key={y} className="mb-10">
            <div className="mb-4 flex items-baseline gap-3 px-1">
              <h2 className="tnum text-[26px] font-semibold tracking-tight">{y}</h2>
              <span className="text-[13px] text-ink-3">{list.filter((p) => p.completedAt!.startsWith(y)).length} projects</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {list
                .filter((p) => p.completedAt!.startsWith(y))
                .map((p) => {
                  const c = p.clientId ? client.get(p.clientId) : null
                  const finals = p.attachments.filter((a) => a.final)
                  return (
                    <article key={p.id} className="card group overflow-hidden p-0">
                      <button type="button" onClick={() => navigate({ name: 'project', id: p.id })} className="block w-full text-left" aria-label={`Open ${p.name}`}>
                        <Cover hue={p.cover.hue} shape={p.cover.shape} className="m-2 mb-0 aspect-[16/10] max-w-full rounded-[18px] transition-transform duration-500 group-hover:scale-[1.01]" />
                      </button>
                      <div className="p-4 pt-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-[16px] font-medium tracking-tight">{p.name}</h3>
                            <p className="truncate text-[13px] text-ink-3">
                              {c?.name ?? 'Personal'} · {p.type}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-ink-3">{fmtDate(p.completedAt!.slice(0, 10), 'd MMM')}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[13px] text-ink-2">{p.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {p.tags.slice(0, 3).map((t) => (
                            <Tag key={t}>{t}</Tag>
                          ))}
                          <span className="ml-auto flex items-center gap-1 text-xs text-ink-3">
                            <FileCheck2 size={13} /> {finals.length} final file{finals.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    </article>
                  )
                })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
