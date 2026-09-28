import { useMemo, useState } from 'react'
import { addDays, format, isSameDay, startOfDay, subDays } from 'date-fns'
import { Play, Plus, Square, Trash2 } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { entryMs, isClosedKind, kindOf, sumMs, timeWindows, useCurrentUser, useLookups } from '../lib/selectors'
import { cn, fmtClock, fmtHours, hoursOf } from '../lib/utils'
import { Button, Card, CardHeader, Field, IconButton, inputCls, Modal, PageHeader, Segmented } from '../components/ui'
import { PillBars, RankBars } from '../components/charts'
import { useTick } from '../components/Shell'

export default function Time() {
  const s = useStore()
  const { project } = useLookups()
  const me = useCurrentUser()
  const notify = useUI((u) => u.notify)
  const open = s.projects.filter((p) => !isClosedKind(kindOf(s.statuses, p.statusId)))
  const [pid, setPid] = useState(() => s.timer?.projectId ?? open[0]?.id ?? '')
  const [tid, setTid] = useState('')
  const [range, setRange] = useState<'week' | 'month' | 'all'>('month')
  const [manual, setManual] = useState(false)
  const [draft, setDraft] = useState({ projectId: open[0]?.id ?? '', date: format(new Date(), 'yyyy-MM-dd'), hours: 1, note: '' })
  useTick(1000, !!s.timer)

  const mine = s.entries.filter((e) => e.memberId === me.id)
  const w = timeWindows(s.settings.weekStartsOn)
  const totals = {
    today: sumMs(mine, w.today),
    week: sumMs(mine, w.week),
    month: sumMs(mine, w.month),
    total: sumMs(mine),
  }
  const running = s.timer
  const runningMs = running ? Date.now() - running.start : 0

  const byProject = useMemo(() => {
    const from = range === 'week' ? w.week : range === 'month' ? w.month : undefined
    const map = new Map<string, number>()
    for (const e of mine) {
      const ms = sumMs([e], from)
      if (ms) map.set(e.projectId, (map.get(e.projectId) ?? 0) + ms)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, ms]) => ({ label: project.get(id)?.name ?? 'Deleted project', value: hoursOf(ms) }))
  }, [mine, range, project])

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(startOfDay(new Date()), 13 - i)
    return { label: format(d, 'd'), hint: format(d, 'EEE d MMM'), value: hoursOf(sumMs(mine, d, addDays(d, 1))) }
  })

  const recent = [...mine].sort((a, b) => b.start - a.start).slice(0, 30)
  const days = Array.from(new Set(recent.map((e) => startOfDay(e.start).getTime())))
  const taskOptions = s.tasks.filter((t) => t.projectId === pid && !isClosedKind(kindOf(s.statuses, t.statusId)))

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Time" sub="Track focus time for yourself. Only you see your own timesheet." actions={<Button icon={<Plus size={16} />} onClick={() => setManual(true)}>Add time manually</Button>} />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:gap-5">
        <Card className="relative overflow-hidden p-6">
          <div className={cn('pointer-events-none absolute -right-20 -bottom-40 size-[380px] rounded-full bg-accent blur-3xl transition-opacity duration-700', running ? 'opacity-[0.18]' : 'opacity-[0.05]')} aria-hidden />
          <div className="relative">
            <p className="text-[13px] text-ink-3">{running ? 'Tracking now' : 'Ready when you are'}</p>
            <p className="tnum mt-2 font-mono text-[56px] leading-none font-medium tracking-tight sm:text-[76px]" aria-live="off">
              {fmtClock(runningMs)}
            </p>
            {running ? (
              <p className="mt-3 text-sm text-ink-2">
                {running.taskId ? `${s.tasks.find((t) => t.id === running.taskId)?.title} · ` : ''}
                {project.get(running.projectId)?.name}
              </p>
            ) : (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <select id="timer-project" aria-label="Project" className={inputCls} value={pid} onChange={(e) => { setPid(e.target.value); setTid('') }}>
                  {open.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select id="timer-task" aria-label="Task" className={inputCls} value={tid} onChange={(e) => setTid(e.target.value)}>
                  <option value="">Whole project</option>
                  {taskOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-5">
              {running ? (
                <Button size="lg" variant="primary" icon={<Square size={14} fill="currentColor" />} onClick={() => { s.stopTimer(); notify(`Saved ${fmtHours(runningMs, true)}`) }}>
                  Stop and save
                </Button>
              ) : (
                <Button size="lg" variant="accent" icon={<Play size={16} fill="currentColor" />} disabled={!pid} onClick={() => s.startTimer(pid, tid || null)} className="w-full sm:w-auto">
                  Start timer
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          {[
            ['Today', totals.today],
            ['This week', totals.week],
            ['This month', totals.month],
            ['Total hours', totals.total],
          ].map(([l, v], i) => (
            <div key={l as string} className={cn('card flex flex-col justify-between p-5', i === 0 && 'border-transparent bg-accent bg-none text-accent-ink')}>
              <p className={cn('text-[13px]', i === 0 ? 'text-accent-ink/70' : 'text-ink-3')}>{l}</p>
              <p className="tnum mt-3 text-[32px] leading-none font-semibold tracking-tight">{fmtHours(v as number, true)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Card>
          <CardHeader title="Last 14 days" sub="Hours per day" />
          <PillBars data={last14} highlight={13} format={(v) => `${v}h`} height={140} />
        </Card>
        <Card>
          <CardHeader
            title="Time by project"
            action={
              <Segmented
                label="Range"
                value={range}
                onChange={setRange}
                options={[
                  { value: 'week', label: 'Week' },
                  { value: 'month', label: 'Month' },
                  { value: 'all', label: 'All' },
                ]}
              />
            }
          />
          {byProject.length ? <RankBars data={byProject} format={(v) => `${v}h`} /> : <p className="text-sm text-ink-3">No time tracked in this range.</p>}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Timesheet" sub="Your most recent sessions" />
        <div className="flex flex-col gap-5">
          {days.map((d) => {
            const list = recent.filter((e) => isSameDay(e.start, d))
            return (
              <div key={d}>
                <div className="mb-1 flex items-center justify-between px-2 text-[13px]">
                  <span className="font-medium">{format(d, 'EEEE d MMM')}</span>
                  <span className="tnum text-ink-3">{fmtHours(list.reduce((a, e) => a + entryMs(e), 0), true)}</span>
                </div>
                <ul>
                  {list.map((e) => (
                    <li key={e.id} className="group flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2">
                      <span className="tnum w-24 shrink-0 font-mono text-xs text-ink-3">
                        {format(e.start, 'HH:mm')}–{format(e.end, 'HH:mm')}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {project.get(e.projectId)?.name ?? 'Deleted project'}
                        {e.taskId && <span className="text-ink-3"> · {s.tasks.find((t) => t.id === e.taskId)?.title}</span>}
                      </span>
                      <span className="tnum text-sm font-medium">{fmtHours(entryMs(e), true)}</span>
                      <IconButton label="Delete entry" onClick={() => s.removeEntry(e.id)} className="size-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
                        <Trash2 size={14} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {!days.length && <p className="text-sm text-ink-3">No sessions yet. Start the timer above.</p>}
        </div>
      </Card>

      <Modal
        open={manual}
        onClose={() => setManual(false)}
        title="Add time"
        footer={
          <>
            <Button variant="ghost" onClick={() => setManual(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={!draft.projectId || draft.hours <= 0}
              onClick={() => {
                const start = new Date(`${draft.date}T09:00:00`).getTime()
                s.addEntry({ projectId: draft.projectId, taskId: null, memberId: me.id, start, end: start + draft.hours * 3600000, note: draft.note })
                setManual(false)
                notify('Time added')
              }}
            >
              Add time
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project" className="sm:col-span-2">
            <select id="mt-project" className={inputCls} value={draft.projectId} onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}>
              {s.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input id="mt-date" type="date" className={inputCls} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </Field>
          <Field label="Hours">
            <input id="mt-hours" type="number" min={0.25} step={0.25} className={inputCls} value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: Number(e.target.value) })} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
