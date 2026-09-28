import { useMemo, useState } from 'react'
import { addDays, format, isSameDay, startOfDay, subDays } from 'date-fns'
import { ArrowUpRight, CalendarClock, CheckCircle2, Clock3, Flag, Plus, Presentation, Sparkles, Trophy } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { entryMs, isClosedKind, isFinishedKind, kindOf, sumMs, useCurrentUser, useLookups } from '../lib/selectors'
import { cn, daysUntil, dueLabel, fmtDate, fmtHours, greeting, hoursOf, parseDay, pluralize } from '../lib/utils'
import { Button, Card, CardHeader, ClientMark, EmptyState, Ring, Segmented, StatusPill } from '../components/ui'
import { PillBars } from '../components/charts'
import { previousMonth } from '../lib/report'
import { DueBadge, ProjectCard, TaskRow, TimerButton } from '../components/items'
import { Cover } from '../components/art'

function Stat({ label, value, sub, onClick, accent }: { label: string; value: number | string; sub?: string; onClick?: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-[20px] border p-4 text-left transition-all hover:-translate-y-0.5',
        accent ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-surface-2 hover:border-line-strong',
      )}
    >
      <span className={cn('text-[13px]', accent ? 'text-accent-ink/70' : 'text-ink-3')}>{label}</span>
      <span className="tnum text-[34px] leading-none font-semibold tracking-[-0.03em]">{value}</span>
      {sub && <span className={cn('text-xs', accent ? 'text-accent-ink/70' : 'text-ink-3')}>{sub}</span>}
    </button>
  )
}

export default function Dashboard() {
  const s = useStore()
  const me = useCurrentUser()
  const { project, client } = useLookups()
  const navigate = useUI((u) => u.navigate)
  const setUI = useUI((u) => u.set)
  const [metric, setMetric] = useState<'hours' | 'tasks'>('hours')
  const now = new Date()

  const data = useMemo(() => {
    const k = (id: string) => kindOf(s.statuses, id)
    const openProjects = s.projects.filter((p) => !isFinishedKind(k(p.statusId)))
    const inProgress = openProjects.filter((p) => ['active', 'review'].includes(k(p.statusId)))
    const openTasks = s.tasks.filter((t) => !isClosedKind(k(t.statusId)))
    const dueToday = openTasks
      .filter((t) => t.deadline && daysUntil(t.deadline) <= 0)
      .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
    const approvals = [
      ...s.projects.filter((p) => k(p.statusId) === 'review').map((p) => ({ kind: 'project' as const, id: p.id, title: p.name, projectId: p.id, date: p.deadline })),
      ...s.tasks.filter((t) => k(t.statusId) === 'review').map((t) => ({ kind: 'task' as const, id: t.id, title: t.title, projectId: t.projectId, date: t.deadline })),
    ]
    const recent = s.projects
      .filter((p) => p.completedAt)
      .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))
      .slice(0, 4)
    const completed30 = s.projects.filter((p) => p.completedAt && new Date(p.completedAt) > subDays(now, 30)).length
      + s.tasks.filter((t) => t.completedAt && new Date(t.completedAt) > subDays(now, 30)).length

    // A rolling seven days reads better than a calendar week on a Monday morning.
    const weekStart = subDays(startOfDay(now), 6)
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i)
      const hours = hoursOf(s.entries.filter((e) => e.memberId === me.id && isSameDay(new Date(e.start), d)).reduce((a, e) => a + entryMs(e), 0))
      const tasksDone = s.tasks.filter((t) => t.completedAt && isSameDay(new Date(t.completedAt), d)).length
      return { label: format(d, 'EEE').slice(0, 2), hint: format(d, 'EEEE d MMM'), hours, tasks: tasksDone, today: isSameDay(d, now) }
    })
    const weekMs = sumMs(s.entries.filter((e) => e.memberId === me.id), weekStart)
    const lastWeekMs = sumMs(s.entries.filter((e) => e.memberId === me.id), subDays(weekStart, 7), weekStart)
    const laterThisWeek = openTasks
      .filter((t) => t.deadline && daysUntil(t.deadline) >= 1 && daysUntil(t.deadline) <= 6)
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
    const plannedHours = openTasks
      .filter((t) => t.assigneeId === me.id && t.deadline && daysUntil(t.deadline) <= 7)
      .reduce((a, t) => a + t.estimate, 0)

    const upcoming = [
      ...openProjects.map((p) => ({ id: p.id, date: p.deadline, title: p.name, sub: 'Project deadline', kind: 'project' as const, projectId: p.id })),
      ...openTasks.filter((t) => t.deadline).map((t) => ({ id: t.id, date: t.deadline!, title: t.title, sub: project.get(t.projectId)?.name ?? '', kind: 'task' as const, projectId: t.projectId })),
      ...s.events.map((e) => ({ id: e.id, date: e.date, title: e.title, sub: e.kind === 'review' ? 'Review' : e.kind === 'approval' ? 'Approval' : 'Milestone', kind: 'event' as const, projectId: e.projectId })),
    ]
      .filter((x) => daysUntil(x.date) >= 1 && daysUntil(x.date) <= 21)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7)

    return { openProjects, inProgress, dueToday, laterThisWeek, approvals, recent, completed30, week, weekMs, lastWeekMs, plannedHours, upcoming }
  }, [s.projects, s.tasks, s.statuses, s.entries, s.events, s.settings.weekStartsOn, me.id, project])

  const firstName = me.name.split(' ')[0]
  const reviewCount = data.approvals.length
  const summary =
    data.dueToday.length === 0
      ? 'Nothing is due today. A good day for deep work.'
      : `${pluralize(data.dueToday.length, 'task')} ${data.dueToday.length === 1 ? 'needs' : 'need'} you today${reviewCount ? ` and ${pluralize(reviewCount, 'item')} ${reviewCount === 1 ? 'is' : 'are'} waiting for approval` : ''}.`
  const capacity = me.weeklyCapacity || 40
  const load = data.plannedHours / capacity
  const loadLabel = load < 0.6 ? 'Room to breathe' : load <= 1 ? 'Nicely balanced' : 'Heavier than usual'
  const todayIdx = data.week.findIndex((d) => d.today)
  const trend = data.lastWeekMs ? Math.round(((data.weekMs - data.lastWeekMs) / data.lastWeekMs) * 100) : 0
  const nextUp = data.dueToday[0]

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 lg:gap-5">
      {/* Greeting + headline numbers */}
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Card className="relative overflow-hidden p-6 lg:col-span-2 lg:p-7">
          <div className="pointer-events-none absolute -top-40 -right-24 size-[420px] rounded-full bg-accent opacity-[0.10] blur-3xl" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] text-ink-3">{format(now, 'EEEE, d MMMM')}</p>
              <h1 className="mt-1 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[40px]">
                {greeting(now)}, {firstName}
              </h1>
              <p className="mt-2 max-w-xl text-[15px] text-ink-2">{summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Presentation size={16} />} onClick={() => setUI({ reportBuilder: previousMonth() })}>
                Generate month-end report
              </Button>
              <Button variant="accent" icon={<Plus size={18} strokeWidth={2.4} />} onClick={() => setUI({ projectForm: { open: true } })}>
                New project
              </Button>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="In progress" value={data.inProgress.length} sub={`${data.openProjects.length} open projects`} onClick={() => navigate({ name: 'projects' })} />
            <Stat label="Due today" value={data.dueToday.length} sub={data.dueToday.some((t) => daysUntil(t.deadline!) < 0) ? 'Includes overdue' : 'Tasks'} accent={data.dueToday.length > 0} onClick={() => navigate({ name: 'tasks' })} />
            <Stat label="Waiting approval" value={reviewCount} sub="Projects and tasks" onClick={() => navigate({ name: 'projects' })} />
            <Stat label="Completed" value={data.completed30} sub="Last 30 days" onClick={() => navigate({ name: 'insights' })} />
          </div>
        </Card>

        {/* Current workload — two rings, like the reference's energy card */}
        <Card className="flex flex-col">
          <CardHeader title="Current workload" sub={loadLabel} />
          <div className="grid flex-1 grid-cols-2 items-center gap-2">
            <div className="flex flex-col items-center gap-3">
              <Ring value={Math.min(1, data.weekMs / 3600000 / capacity)} size={124}>
                <span className="tnum block text-2xl font-semibold tracking-tight">{Math.round(data.weekMs / 360000) / 10}h</span>
                <span className="text-[11px] text-ink-3">of {capacity}h</span>
              </Ring>
              <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                <span className="size-2 rounded-full bg-accent" /> Logged, last 7 days
              </span>
            </div>
            <div className="flex flex-col items-center gap-3 border-l border-line">
              <Ring value={Math.min(1, load)} size={124} color={load > 1 ? 'var(--warn)' : 'var(--accent)'}>
                <span className="tnum block text-2xl font-semibold tracking-tight">{Math.round(data.plannedHours)}h</span>
                <span className="text-[11px] text-ink-3">next 7 days</span>
              </Ring>
              <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                <span className={cn('size-2 rounded-full', load > 1 ? 'bg-warn' : 'bg-accent')} /> Planned work
              </span>
            </div>
          </div>
          {nextUp && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-3">Up next</p>
                <p className="truncate text-sm font-medium">{nextUp.title}</p>
              </div>
              <TimerButton projectId={nextUp.projectId} taskId={nextUp.id} size={38} />
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        {/* Due today */}
        <Card className="lg:row-span-2">
          <CardHeader
            title="Due today"
            sub={data.dueToday.length ? `${pluralize(data.dueToday.length, 'task')} to wrap up` : 'All clear'}
            action={
              <Button size="sm" variant="ghost" onClick={() => navigate({ name: 'tasks' })}>
                All tasks <ArrowUpRight size={14} />
              </Button>
            }
          />
          {data.dueToday.length ? (
            <div className="-mx-2 flex flex-col">
              {data.dueToday.slice(0, 8).map((t) => (
                <TaskRow key={t.id} task={t} dense />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CheckCircle2 size={20} />} title="Nothing due today" body="Enjoy the space, or pull something forward from this week." />
          )}
          {data.laterThisWeek.length > 0 && (
            <>
              <h3 className="mt-6 mb-2 text-sm font-medium text-ink-2">Coming up this week</h3>
              <div className="-mx-2 flex flex-col">
                {data.laterThisWeek.slice(0, 7).map((t) => (
                  <TaskRow key={t.id} task={t} dense />
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Weekly productivity */}
        <Card>
          <CardHeader
            title="Weekly productivity"
            sub={
              metric === 'hours'
                ? `${fmtHours(data.weekMs, true)} in the last 7 days${trend ? ` · ${trend > 0 ? '+' : ''}${trend}% vs the 7 before` : ''}`
                : `${data.week.reduce((a, d) => a + d.tasks, 0)} tasks finished in the last 7 days`
            }
            action={
              <Segmented
                label="Chart metric"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'hours', label: 'Hours' },
                  { value: 'tasks', label: 'Tasks' },
                ]}
              />
            }
          />
          <PillBars
            data={data.week.map((d) => ({ label: d.label, hint: d.hint, value: metric === 'hours' ? d.hours : d.tasks }))}
            highlight={todayIdx}
            format={(v) => (metric === 'hours' ? `${v}h` : String(v))}
            height={150}
          />
        </Card>

        {/* Upcoming deadlines */}
        <Card>
          <CardHeader
            title="Upcoming deadlines"
            sub="Next three weeks"
            action={
              <Button size="sm" variant="ghost" onClick={() => navigate({ name: 'calendar' })}>
                Calendar <ArrowUpRight size={14} />
              </Button>
            }
          />
          <ol className="relative flex flex-col gap-1">
            {data.upcoming.map((u) => (
              <li key={u.kind + u.id}>
                <button
                  type="button"
                  onClick={() => (u.kind === 'task' ? setUI({ taskDetail: u.id }) : u.projectId && navigate({ name: 'project', id: u.projectId }))}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="grid w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 py-1 leading-none">
                    <span className="text-[10px] tracking-wide text-ink-3 uppercase">{format(parseDay(u.date), 'MMM')}</span>
                    <span className="tnum text-base font-semibold">{format(parseDay(u.date), 'd')}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{u.title}</span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-ink-3">
                      {u.kind === 'project' ? <Flag size={11} /> : u.kind === 'event' ? <CalendarClock size={11} /> : <Clock3 size={11} />}
                      {u.sub}
                    </span>
                  </span>
                  <span className="text-xs text-ink-3">{dueLabel(u.date)}</span>
                </button>
              </li>
            ))}
            {!data.upcoming.length && <EmptyState title="No deadlines ahead" body="Your next three weeks are open." />}
          </ol>
        </Card>

        {/* Pending approvals */}
        <Card>
          <CardHeader title="Pending approvals" sub={reviewCount ? 'Waiting on a yes' : 'Nothing waiting'} />
          <div className="flex flex-col gap-2">
            {data.approvals.slice(0, 4).map((a) => {
              const p = project.get(a.projectId)
              const c = p?.clientId ? client.get(p.clientId) : null
              return (
                <button
                  key={a.kind + a.id}
                  type="button"
                  onClick={() => (a.kind === 'task' ? setUI({ taskDetail: a.id }) : navigate({ name: 'project', id: a.id }))}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left transition-colors hover:border-line-strong"
                >
                  {c ? <ClientMark name={c.name} hue={c.hue} size={36} /> : <span className="size-9 rounded-xl bg-surface-3" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {a.kind === 'project' ? 'Whole project' : p?.name} · {c?.name ?? 'Personal'}
                    </span>
                  </span>
                  <DueBadge date={a.date} />
                </button>
              )
            })}
            {!reviewCount && <EmptyState title="No approvals pending" />}
          </div>
        </Card>

        {/* Recently completed */}
        <Card>
          <CardHeader
            title="Recently completed"
            sub="Creative wins"
            action={
              <Button size="sm" variant="ghost" onClick={() => navigate({ name: 'archive' })}>
                Archive <ArrowUpRight size={14} />
              </Button>
            }
          />
          <div className="grid grid-cols-2 gap-3">
            {data.recent.map((p) => (
              <button key={p.id} type="button" onClick={() => navigate({ name: 'project', id: p.id })} className="group text-left">
                <Cover hue={p.cover.hue} shape={p.cover.shape} className="h-20 rounded-2xl transition-transform group-hover:scale-[1.02]" />
                <span className="mt-2 block truncate text-[13px] font-medium">{p.name}</span>
                <span className="block text-xs text-ink-3">{fmtDate(p.completedAt?.slice(0, 10), 'd MMM')}</span>
              </button>
            ))}
          </div>
          {!data.recent.length && <EmptyState icon={<Trophy size={20} />} title="Your wins will show up here" />}
        </Card>
      </div>

      {/* Projects in progress */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-[17px] font-medium tracking-tight">Projects in progress</h2>
            <p className="text-[13px] text-ink-3">Sorted by deadline</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => navigate({ name: 'projects' })}>
            All projects <ArrowUpRight size={14} />
          </Button>
        </div>
        {data.inProgress.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-5">
            {[...data.inProgress]
              .sort((a, b) => a.deadline.localeCompare(b.deadline))
              .slice(0, 4)
              .map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
          </div>
        ) : (
          <EmptyState
            icon={<Sparkles size={20} />}
            title="No projects in progress"
            body="Start one, or use Quick add to turn a thought into a project."
            action={
              <Button variant="accent" onClick={() => setUI({ projectForm: { open: true } })}>
                New project
              </Button>
            }
          />
        )}
      </section>

      {/* Open project statuses at a glance */}
      <Card>
        <CardHeader title="Workflow at a glance" sub="Where all your open projects sit right now" />
        <div className="flex flex-wrap gap-2">
          {s.statuses
            .filter((st) => !isFinishedKind(st.kind))
            .map((st) => {
              const n = data.openProjects.filter((p) => p.statusId === st.id).length
              return (
                <button key={st.id} type="button" onClick={() => navigate({ name: 'projects' })} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1.5 pr-3 pl-1.5 transition-colors hover:border-line-strong">
                  <StatusPill status={st} className="border-0 bg-transparent" />
                  <span className="tnum text-sm font-semibold">{n}</span>
                </button>
              )
            })}
        </div>
      </Card>
    </div>
  )
}
