import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Send } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { useLookups } from '../lib/selectors'
import { cloudEnabled } from '../lib/cloud'
import { fileUrl } from '../lib/files'
import { dimsText, isPackaging, latestKld, packSizeText, projectEmail, readiness } from '../lib/handoff'
import type { Project } from '../lib/types'
import { cn, fmtDate, priorityLabel } from '../lib/utils'
import { ShareSheet } from './ShareSheet'

export function ReadyBar({ pct, compact }: { pct: number; compact?: boolean }) {
  const done = pct === 100
  return (
    <div className="flex flex-col gap-1.5" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Project ready">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn('eyebrow', done && 'text-good')}>Project ready</span>
        <span className={cn('tnum font-semibold', compact ? 'text-xs' : 'text-sm')}>{pct}%</span>
      </div>
      <div className={cn('flex gap-[3px]', compact ? 'h-1.5' : 'h-2')}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cn('flex-1 rounded-full', i < Math.round(pct / 10) ? 'bg-accent' : 'bg-surface-3')} />
        ))}
      </div>
    </div>
  )
}

/** What a designer needs to see before starting: product, pack, size, KLD, deadline, priority. */
export function QuickInfo({ p }: { p: Project }) {
  const setUI = useUI((u) => u.set)
  const pack = p.pack
  const kld = latestKld(p)
  const packaging = isPackaging(p.type)
  const ready = readiness(p)
  const cells: { label: string; value: string; tone?: 'good' | 'warn' | 'bad'; icon?: React.ReactNode; step?: string }[] = packaging
    ? [
        { label: 'Product', value: [packSizeText(pack), pack?.productName].filter(Boolean).join(' ') || 'Not added', step: 'pack' },
        { label: 'Pack', value: pack?.packType || 'Not added', step: 'pack' },
        { label: 'Size', value: dimsText(pack) || 'Not added', step: 'pack' },
        {
          label: 'KLD',
          value: kld ? `Uploaded · ${kld.version}` : p.kld?.later ? 'Coming later' : 'Not uploaded',
          tone: kld ? 'good' : p.kld?.later ? 'warn' : 'bad',
          icon: kld ? <CheckCircle2 size={15} /> : p.kld?.later ? <Clock3 size={15} /> : <AlertTriangle size={15} />,
          step: 'kld',
        },
      ]
    : []
  cells.push({ label: 'Deadline', value: fmtDate(p.deadline, 'd MMM yyyy') }, { label: 'Priority', value: priorityLabel[p.priority] })
  const warnings = ready.missing.filter((m) => m.important && !m.deferred)
  return (
    <section className="card mb-5 p-5" aria-label="Project at a glance">
      <dl className={cn('grid grid-cols-2 gap-x-5 gap-y-4', packaging ? 'sm:grid-cols-3 xl:grid-cols-6' : 'sm:grid-cols-2')}>
        {cells.map((c) => (
          <div key={c.label} className="min-w-0">
            <dt className="eyebrow mb-1">{c.label}</dt>
            <dd className={cn('flex items-center gap-1.5 truncate text-[15px] font-medium', c.value === 'Not added' && 'text-ink-3', c.tone === 'good' && 'text-good', c.tone === 'warn' && 'text-warn', c.tone === 'bad' && 'text-bad')}>
              {c.icon}
              {c.value === 'Not added' && c.step ? (
                <button type="button" className="underline decoration-dotted underline-offset-4 hover:text-ink" onClick={() => setUI({ projectForm: { open: true, id: p.id, step: c.step } })}>
                  Add
                </button>
              ) : (
                <span className="truncate">{c.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 grid items-center gap-4 border-t border-line pt-4 md:grid-cols-[minmax(180px,260px)_1fr]">
        <ReadyBar pct={ready.pct} />
        <ul className="flex flex-wrap gap-1.5">
          {ready.missing.map((m) => (
            <li key={m.label}>
              <button
                type="button"
                onClick={() => setUI({ projectForm: { open: true, id: p.id, step: m.step } })}
                className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium', warnings.includes(m) ? 'border-warn/40 bg-warn-soft text-warn' : 'border-line text-ink-2 hover:border-line-strong')}
              >
                {warnings.includes(m) && <AlertTriangle size={12} />}
                {m.label}
                {m.deferred && ' (later)'}
              </button>
            </li>
          ))}
          {!ready.missing.length && <li className="text-sm text-good">Everything the designer needs is here.</li>}
        </ul>
      </div>
    </section>
  )
}

/** The handoff email for the assigned designer, opened from the project page or right after saving. */
export function ProjectEmailSheet() {
  const id = useUI((u) => u.projectEmail)
  const setUI = useUI((u) => u.set)
  const { projects, tasks } = useStore()
  const { client, member } = useLookups()
  const p = id ? projects.find((x) => x.id === id) : undefined
  const [kldUrl, setKldUrl] = useState<string | null>(null)
  const kld = p ? latestKld(p) : undefined
  useEffect(() => {
    setKldUrl(null)
    // A week-long link so the designer can open the KLD straight from the email.
    if (kld?.path && cloudEnabled) fileUrl(kld, { expiresIn: 7 * 24 * 3600 }).then(setKldUrl, () => setKldUrl(null))
  }, [kld?.id])
  if (!p) return null
  const designer = member.get(p.leadId ?? p.memberIds[0] ?? '') ?? null
  const mail = projectEmail({
    project: p,
    clientName: p.clientId ? client.get(p.clientId)?.name : undefined,
    designer,
    tasks: tasks.filter((t) => t.projectId === p.id),
    kldUrl,
    projectUrl: `${location.origin}${location.pathname}#project-${p.id}`,
  })
  return (
    <ShareSheet
      open
      onClose={() => setUI({ projectEmail: null })}
      title={designer ? `Send project to ${designer.name.split(' ')[0]}` : 'Send project email'}
      intro={
        <span className="flex items-center gap-2">
          <Send size={14} /> {designer?.email ? `Pick how to send it to ${designer.email}. The link opens the project directly.` : 'Pick how to send it. The link opens the project directly.'}
        </span>
      }
      subject={mail.subject}
      body={mail.body}
      to={designer?.email}
    />
  )
}
