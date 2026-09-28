import { useMemo, useState } from 'react'
import { format, parseISO, subMonths } from 'date-fns'
import { CalendarRange, Download, Eye, FileBarChart2, Loader2, Presentation, Trash2 } from 'lucide-react'
import { useStore, useUI, type ReportRequest } from '../lib/store'
import { useCan } from '../lib/selectors'
import { buildReportData, completedIn, currentMonth, customPeriod, defaultSelection, designerOf, finalArtwork, monthPeriod, previousMonth, yearPeriod, type Period } from '../lib/report'
import { loadArtwork, names, renderPptx, saveBlob } from '../lib/reportDeck'
import type { ID } from '../lib/types'
import { cn, toISODate } from '../lib/utils'
import { Avatar, Button, Card, CardHeader, EmptyState, Field, inputCls, PageHeader, Segmented } from '../components/ui'
import { PillBars } from '../components/charts'

type Tab = 'monthly' | 'yearly' | 'designers' | 'projects'

/** Builds and downloads a PPT straight away, with the saved or default artwork choices. */
function useQuickDownload() {
  const notify = useUI((u) => u.notify)
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (key: string, req: ReportRequest) => {
    const s = useStore.getState()
    setBusy(key)
    try {
      const projects = req.record
        ? req.record.projectIds.map((id) => s.projects.find((p) => p.id === id)).filter((p) => !!p)
        : completedIn(s.projects, s.statuses, req.from, req.to).filter((p) => (!req.designerId || designerOf(p) === req.designerId) && (!req.projectIds || req.projectIds.includes(p.id)))
      if (!projects.length) {
        notify('No completed projects in this period yet.')
        return
      }
      const selection = Object.fromEntries(projects.map((p) => [p.id, req.record?.images[p.id] ?? defaultSelection(p)]))
      const data = buildReportData({ period: { title: req.title, from: req.from, to: req.to }, projects, allProjects: s.projects, tasks: s.tasks, clients: s.clients, members: s.members, statuses: s.statuses, studio: s.settings.workspaceName, selection })
      const { art, logo } = await loadArtwork(data)
      saveBlob(await renderPptx(data, art, logo), names(req.title).pptx)
    } catch (e) {
      notify(e instanceof Error ? `Couldn’t build the report: ${e.message}` : 'Couldn’t build the report.')
    } finally {
      setBusy(null)
    }
  }
  return { run, busy }
}

function usePeriodStats(p: Period) {
  const s = useStore()
  return useMemo(() => {
    const projects = completedIn(s.projects, s.statuses, p.from, p.to)
    return {
      projects,
      finals: projects.reduce((a, x) => a + finalArtwork(x).length, 0),
      missing: projects.filter((x) => !finalArtwork(x).length).length,
      designers: new Set(projects.map(designerOf).filter(Boolean)).size,
    }
  }, [s.projects, s.statuses, p.from, p.to])
}

function MonthCard({ period, highlight }: { period: Period; highlight?: boolean }) {
  const st = usePeriodStats(period)
  const setUI = useUI((u) => u.set)
  const { run, busy } = useQuickDownload()
  const open = () => setUI({ reportBuilder: period })
  return (
    <Card className={cn('flex flex-col gap-4', highlight && 'ring-1 ring-accent-text/40')}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold tracking-tight">{period.title}</h3>
        {highlight && <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-ink">Last month</span>}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {[
          ['Projects', st.projects.length],
          ['Final designs', st.finals],
          ['Designers', st.designers],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-ink-3">{k}</dt>
            <dd className="tnum text-2xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {st.missing > 0 && <p className="text-xs text-warn">{st.missing} missing a final JPG</p>}
      <div className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={open}>
          View report
        </Button>
        <Button size="sm" variant={highlight ? 'accent' : 'secondary'} icon={<Presentation size={14} />} onClick={open} disabled={!st.projects.length}>
          Generate PPT
        </Button>
        <Button size="sm" variant="ghost" icon={busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} disabled={!st.projects.length || !!busy} onClick={() => run('m', period)}>
          Download PPT
        </Button>
      </div>
    </Card>
  )
}

function PeriodPicker({ onPick }: { onPick: (p: Period) => void }) {
  const [mode, setMode] = useState<'prev' | 'current' | 'custom'>('prev')
  const [from, setFrom] = useState(toISODate(subMonths(new Date(), 1)))
  const [to, setTo] = useState(toISODate(new Date()))
  const period = mode === 'prev' ? previousMonth() : mode === 'current' ? currentMonth() : customPeriod(from <= to ? from : to, from <= to ? to : from)
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Report period"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'prev', label: 'Previous month' },
          { value: 'current', label: 'Current month' },
          { value: 'custom', label: 'Custom range' },
        ]}
      />
      {mode === 'custom' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From">
            <input id="rp-from" type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input id="rp-to" type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="accent" icon={<FileBarChart2 size={16} />} onClick={() => onPick(period)}>
          Generate {period.title} report
        </Button>
        <span className="text-xs text-ink-3">
          {format(parseISO(period.from), 'd MMM')} – {format(parseISO(period.to), 'd MMM yyyy')}
        </span>
      </div>
    </div>
  )
}

function History() {
  const s = useStore()
  const setUI = useUI((u) => u.set)
  const can = useCan()
  const { run, busy } = useQuickDownload()
  const member = (id: ID) => s.members.find((m) => m.id === id)
  if (!s.reports.length) return <p className="text-sm text-ink-3">Reports you generate are saved here so anyone on the team can view or download them again.</p>
  return (
    <ul className="flex flex-col divide-y divide-line">
      {[...s.reports]
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
        .map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2">
              <Presentation size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.title}</p>
              <p className="text-xs text-ink-3">
                Generated {format(new Date(r.generatedAt), 'd MMM yyyy')}
                {member(r.generatedBy) && ` by ${member(r.generatedBy)!.name.split(' ')[0]}`} · {r.stats.projects} projects · {r.stats.finals} final designs
              </p>
            </div>
            <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setUI({ reportBuilder: { title: r.title, from: r.from, to: r.to, record: r } })}>
              View
            </Button>
            <Button size="sm" variant="ghost" icon={busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} disabled={!!busy} onClick={() => run(r.id, { title: r.title, from: r.from, to: r.to, record: r })}>
              Download
            </Button>
            {can('delete') && (
              <button type="button" aria-label={`Delete ${r.title} report`} onClick={() => s.removeReport(r.id)} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-bad">
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
    </ul>
  )
}

function Monthly() {
  const setUI = useUI((u) => u.set)
  const months = Array.from({ length: 6 }, (_, i) => monthPeriod(subMonths(new Date(), i + 1)))
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:gap-5">
        <Card>
          <CardHeader title="Month-end report" sub="Builds a presentation from every project completed or approved in the period, using its final JPG artwork." />
          <PeriodPicker onPick={(p) => setUI({ reportBuilder: p })} />
        </Card>
        <Card>
          <CardHeader title="Report history" />
          <History />
        </Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 lg:gap-5">
        {months.map((m, i) => (
          <MonthCard key={m.from} period={m} highlight={i === 0} />
        ))}
      </div>
    </div>
  )
}

function Yearly() {
  const s = useStore()
  const setUI = useUI((u) => u.set)
  const { run, busy } = useQuickDownload()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const period = yearPeriod(year)
  const st = usePeriodStats(period)
  const bars = Array.from({ length: 12 }, (_, m) => {
    const p = monthPeriod(new Date(year, m, 1))
    return { label: format(new Date(year, m, 1), 'MMM'), value: completedIn(s.projects, s.statuses, p.from, p.to).length }
  })
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:gap-5">
      <Card>
        <CardHeader
          title={`${year} at a glance`}
          sub="Projects completed each month"
          action={
            <select aria-label="Year" className={cn(inputCls, 'h-9 w-auto rounded-full')} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          }
        />
        <PillBars data={bars} highlight={year === thisYear ? new Date().getMonth() : undefined} />
      </Card>
      <Card className="flex flex-col gap-4">
        <CardHeader title={`${year} design report`} />
        <dl className="grid grid-cols-3 gap-2">
          {[
            ['Projects', st.projects.length],
            ['Final designs', st.finals],
            ['Designers', st.designers],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-ink-3">{k}</dt>
              <dd className="tnum text-2xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button variant="accent" icon={<Presentation size={15} />} disabled={!st.projects.length} onClick={() => setUI({ reportBuilder: period })}>
            Generate PPT
          </Button>
          <Button icon={busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} disabled={!st.projects.length || !!busy} onClick={() => run('y', period)}>
            Download PPT
          </Button>
        </div>
      </Card>
    </div>
  )
}

function PeriodSelect({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const options = [previousMonth(), currentMonth(), ...Array.from({ length: 4 }, (_, i) => monthPeriod(subMonths(new Date(), i + 2))), yearPeriod(new Date().getFullYear())]
  return (
    <select aria-label="Period" className={cn(inputCls, 'h-9 w-auto rounded-full')} value={value.from + value.to} onChange={(e) => onChange(options.find((o) => o.from + o.to === e.target.value)!)}>
      {options.map((o) => (
        <option key={o.from + o.to} value={o.from + o.to}>
          {o.title}
        </option>
      ))}
    </select>
  )
}

function Designers() {
  const s = useStore()
  const setUI = useUI((u) => u.set)
  const [period, setPeriod] = useState(previousMonth())
  const st = usePeriodStats(period)
  const rows = s.members
    .map((m) => {
      const mine = st.projects.filter((p) => designerOf(p) === m.id)
      const deliverables = mine.reduce((a, p) => a + Math.max(1, s.tasks.filter((t) => t.projectId === p.id).length), 0)
      const onTime = mine.filter((p) => p.completedAt && p.completedAt.slice(0, 10) <= p.deadline).length
      return { m, projects: mine.length, deliverables, onTime, finals: mine.reduce((a, p) => a + finalArtwork(p).length, 0) }
    })
    .filter((r) => r.projects)
    .sort((a, b) => b.projects - a.projects)
  return (
    <Card>
      <CardHeader title="Designer reports" sub="Completed work by assigned designer" action={<PeriodSelect value={period} onChange={setPeriod} />} />
      {rows.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((r) => (
            <li key={r.m.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar member={r.m} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.m.name}</span>
                <span className="block text-xs text-ink-3">
                  {r.projects} projects · {r.deliverables} deliverables · {r.onTime}/{r.projects} on time · {r.finals} final designs
                </span>
              </span>
              <Button size="sm" icon={<Presentation size={14} />} onClick={() => setUI({ reportBuilder: { title: `${period.title} · ${r.m.name}`, from: period.from, to: period.to, designerId: r.m.id } })}>
                Designer PPT
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No completed projects" body={`Nothing was completed in ${period.title}.`} />
      )}
    </Card>
  )
}

function Projects() {
  const s = useStore()
  const setUI = useUI((u) => u.set)
  const navigate = useUI((u) => u.navigate)
  const [period, setPeriod] = useState(previousMonth())
  const st = usePeriodStats(period)
  return (
    <Card>
      <CardHeader title="Project reports" sub="One-project showcase decks" action={<PeriodSelect value={period} onChange={setPeriod} />} />
      {st.projects.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {st.projects.map((p) => {
            const finals = finalArtwork(p).length
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <button type="button" onClick={() => navigate({ name: 'project', id: p.id })} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium hover:underline">{p.name}</span>
                  <span className="block text-xs text-ink-3">
                    {s.clients.find((c) => c.id === p.clientId)?.name ?? 'Personal'} · {p.type} · completed {format(new Date(p.completedAt!), 'd MMM')}
                  </span>
                </button>
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', finals ? 'bg-good-soft text-good' : 'bg-warn-soft text-warn')}>{finals ? `${finals} final JPG${finals > 1 ? 's' : ''}` : 'Final JPG missing'}</span>
                <Button size="sm" icon={<Presentation size={14} />} onClick={() => setUI({ reportBuilder: { title: p.name, from: period.from, to: period.to, projectIds: [p.id] } })}>
                  Project PPT
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState title="No completed projects" body={`Nothing was completed in ${period.title}.`} />
      )}
    </Card>
  )
}

export default function Reports({ tab }: { tab?: string }) {
  const navigate = useUI((u) => u.navigate)
  const setUI = useUI((u) => u.set)
  const current = (['monthly', 'yearly', 'designers', 'projects'].includes(tab ?? '') ? tab : 'monthly') as Tab
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Reports"
        sub="Month-end decks built from your completed projects and their final artwork"
        actions={
          <Button variant="accent" icon={<CalendarRange size={16} />} onClick={() => setUI({ reportBuilder: previousMonth() })}>
            Generate month-end report
          </Button>
        }
      />
      <div className="mb-5">
        <Segmented
          label="Report type"
          value={current}
          onChange={(t) => navigate({ name: 'reports', tab: t })}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
            { value: 'designers', label: 'Designers' },
            { value: 'projects', label: 'Projects' },
          ]}
        />
      </div>
      {current === 'monthly' && <Monthly />}
      {current === 'yearly' && <Yearly />}
      {current === 'designers' && <Designers />}
      {current === 'projects' && <Projects />}
    </div>
  )
}
