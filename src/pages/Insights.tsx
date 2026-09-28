import { useMemo, useState } from 'react'
import { differenceInCalendarDays, format, startOfMonth, subMonths, addMonths } from 'date-fns'
import { HeartHandshake } from 'lucide-react'
import { useStore } from '../lib/store'
import { entryMs, isClosedKind, kindOf, useCurrentUser, useLookups } from '../lib/selectors'
import { hoursOf, parseDay } from '../lib/utils'
import { Card, CardHeader, PageHeader, Ring, Segmented } from '../components/ui'
import { AreaChart, PillBars, RankBars } from '../components/charts'

export default function Insights() {
  const s = useStore()
  const { client } = useLookups()
  const me = useCurrentUser()
  const solo = useStore((st) => st.settings.mode === 'solo')
  const [scope, setScope] = useState<'me' | 'team'>('me')
  const [months, setMonths] = useState<6 | 12>(12)

  const d = useMemo(() => {
    const from = startOfMonth(subMonths(new Date(), months - 1))
    const inRange = (iso?: string) => !!iso && new Date(iso) >= from
    const entries = s.entries.filter((e) => e.start >= from.getTime() && (scope === 'team' || e.memberId === me.id))
    const projects = s.projects.filter((p) => scope === 'team' || p.memberIds.includes(me.id))
    const pids = new Set(projects.map((p) => p.id))
    const tasks = s.tasks.filter((t) => pids.has(t.projectId) && (scope === 'team' || !t.assigneeId || t.assigneeId === me.id))

    const completedProjects = projects.filter((p) => inRange(p.completedAt))
    const completedTasks = tasks.filter((t) => inRange(t.completedAt))
    const hours = hoursOf(entries.reduce((a, e) => a + entryMs(e), 0))
    const durations = completedProjects.map((p) => differenceInCalendarDays(new Date(p.completedAt!), parseDay(p.startDate)))
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
    const dueTasks = tasks.filter((t) => t.deadline && parseDay(t.deadline) >= from && parseDay(t.deadline) <= new Date())
    const doneDue = dueTasks.filter((t) => isClosedKind(kindOf(s.statuses, t.statusId)))
    const onTime = doneDue.filter((t) => t.completedAt && t.completedAt.slice(0, 10) <= t.deadline!)
    const completionRate = dueTasks.length ? doneDue.length / dueTasks.length : 0

    const monthly = Array.from({ length: months }, (_, i) => {
      const m = addMonths(from, i)
      const next = addMonths(m, 1)
      const ms = entries.filter((e) => e.start >= m.getTime() && e.start < next.getTime()).reduce((a, e) => a + entryMs(e), 0)
      const done = completedProjects.filter((p) => new Date(p.completedAt!) >= m && new Date(p.completedAt!) < next).length + completedTasks.filter((t) => new Date(t.completedAt!) >= m && new Date(t.completedAt!) < next).length
      return { label: format(m, 'MMM'), hint: format(m, 'MMMM yyyy'), hours: hoursOf(ms), done }
    })

    const clientHours = new Map<string, number>()
    for (const e of entries) {
      const cid = s.projects.find((p) => p.id === e.projectId)?.clientId
      if (cid) clientHours.set(cid, (clientHours.get(cid) ?? 0) + entryMs(e))
    }
    const topClients = [...clientHours.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, ms]) => ({ label: client.get(id)?.name ?? 'Unknown', value: hoursOf(ms) }))

    const typeCount = new Map<string, number>()
    for (const p of projects.filter((p) => inRange(p.createdAt) || inRange(p.completedAt) || !p.completedAt)) typeCount.set(p.type, (typeCount.get(p.type) ?? 0) + 1)
    const topTypes = [...typeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }))

    return { completedProjects, completedTasks, hours, avgDuration, completionRate, onTime: doneDue.length ? onTime.length / doneDue.length : 0, monthly, topClients, topTypes, dueTasks }
  }, [s.entries, s.projects, s.tasks, s.statuses, scope, months, me.id, client])

  const kpis = [
    { label: 'Projects completed', value: d.completedProjects.length },
    { label: 'Tasks completed', value: d.completedTasks.length },
    { label: 'Hours worked', value: `${Math.round(d.hours)}h` },
    { label: 'Average project', value: `${d.avgDuration} days` },
  ]
  const busiest = [...d.monthly].sort((a, b) => b.hours - a.hours)[0]

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Insights"
        sub={`The last ${months} months, at a glance`}
        actions={
          <>
            {!solo && <Segmented label="Whose work" value={scope} onChange={setScope} options={[{ value: 'me', label: 'Just me' }, { value: 'team', label: 'Whole studio' }]} />}
            <Segmented label="Period" value={String(months) as '6' | '12'} onChange={(v) => setMonths(Number(v) as 6 | 12)} options={[{ value: '6', label: '6 months' }, { value: '12', label: '12 months' }]} />
          </>
        }
      />

      <div className="mb-5 flex items-start gap-3 rounded-[20px] border border-line bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
        <HeartHandshake size={17} className="mt-0.5 shrink-0 text-accent-text" />
        <p>These numbers are here to help you notice patterns and plan better. They aren’t a score, and nobody is ranked.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <p className="text-[13px] text-ink-3">{k.label}</p>
            <p className="tnum mt-2 text-[34px] leading-none font-semibold tracking-[-0.03em]">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Monthly workload" sub={busiest && busiest.hours > 0 ? `Busiest month: ${busiest.hint} with ${Math.round(busiest.hours)}h` : 'Hours tracked per month'} />
          <AreaChart data={d.monthly.map((m) => ({ label: m.label, hint: m.hint, value: m.hours }))} format={(v) => `${Math.round(v)}h`} height={220} />
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Completion rate" sub={`${d.dueTasks.length} tasks were due in this period`} />
          <div className="grid flex-1 grid-cols-2 items-center gap-2">
            <div className="flex flex-col items-center gap-3">
              <Ring value={d.completionRate} size={120}>
                <span className="tnum text-2xl font-semibold">{Math.round(d.completionRate * 100)}%</span>
              </Ring>
              <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                <span className="size-2 rounded-full bg-accent" /> Finished
              </span>
            </div>
            <div className="flex flex-col items-center gap-3 border-l border-line">
              <Ring value={d.onTime} size={120}>
                <span className="tnum text-2xl font-semibold">{Math.round(d.onTime * 100)}%</span>
              </Ring>
              <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                <span className="size-2 rounded-full bg-accent" /> On time
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Card>
          <CardHeader title="Things finished" sub="Projects and tasks per month" />
          <PillBars data={d.monthly.slice(-6).map((m) => ({ label: m.label, hint: m.hint, value: m.done }))} highlight={5} height={140} />
        </Card>
        <Card>
          <CardHeader title="Most active clients" sub="By hours tracked" />
          {d.topClients.length ? <RankBars data={d.topClients} format={(v) => `${Math.round(v)}h`} /> : <p className="text-sm text-ink-3">No client time yet.</p>}
        </Card>
        <Card>
          <CardHeader title="Most common project types" />
          {d.topTypes.length ? <RankBars data={d.topTypes} /> : <p className="text-sm text-ink-3">No projects yet.</p>}
        </Card>
      </div>
    </div>
  )
}
