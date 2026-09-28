import { useState } from 'react'
import { ArrowLeft, Clock3, MapPin, Pencil } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { entryMs, isClosedKind, isFinishedKind, kindOf, sumMs, timeWindows, useCan, useCurrentUser } from '../lib/selectors'
import { cn, daysUntil } from '../lib/utils'
import { Avatar, Button, Card, CardHeader, EmptyState, Field, inputCls, Ring, TagInput, textareaCls } from '../components/ui'
import { Cover } from '../components/art'
import { TaskRow } from '../components/items'

export default function Profile({ id }: { id: string }) {
  const s = useStore()
  const me = useCurrentUser()
  const can = useCan()
  const navigate = useUI((u) => u.navigate)
  const [editing, setEditing] = useState(false)
  const m = s.members.find((x) => x.id === id)
  if (!m) return <EmptyState title="This person isn’t on the team anymore" action={<Button onClick={() => navigate({ name: 'settings', tab: 'team' })}>Back to team</Button>} />

  const mine = s.projects.filter((p) => p.memberIds.includes(m.id))
  const completed = mine.filter((p) => p.completedAt && isFinishedKind(kindOf(s.statuses, p.statusId)))
  const openTasks = s.tasks.filter((t) => t.assigneeId === m.id && !isClosedKind(kindOf(s.statuses, t.statusId)))
  const weekLoad = openTasks.filter((t) => t.deadline && daysUntil(t.deadline) <= 7).reduce((a, t) => a + t.estimate, 0)
  const weekMs = sumMs(s.entries.filter((e) => e.memberId === m.id), timeWindows(s.settings.weekStartsOn).week)
  const totalMs = s.entries.filter((e) => e.memberId === m.id).reduce((a, e) => a + entryMs(e), 0)
  const canEdit = m.id === me.id || can('manageTeam')
  const localTime = (() => {
    try {
      return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: m.timezone }).format(new Date())
    } catch {
      return null
    }
  })()

  return (
    <div className="mx-auto max-w-[1200px]">
      <button type="button" onClick={() => navigate({ name: 'settings', tab: 'team' })} className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft size={15} /> Team
      </button>

      <div className="card relative mb-5 overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-32 -right-10 size-[360px] rounded-full bg-accent opacity-[0.08] blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start gap-5">
          <Avatar member={m} size={88} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink-3">
              {m.role} · {s.settings.workspaceName}
            </p>
            <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.03em]">{m.name}</h1>
            <p className="text-[15px] text-ink-2">{m.title}</p>
            <p className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-ink-3">
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {m.location || 'Somewhere on Earth'}
              </span>
              {localTime && (
                <span className="flex items-center gap-1">
                  <Clock3 size={13} /> {localTime} local time
                </span>
              )}
            </p>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">{m.bio || 'No creative bio yet.'}</p>
          </div>
          {canEdit && (
            <Button icon={<Pencil size={15} />} onClick={() => setEditing((e) => !e)}>
              {editing ? 'Done' : 'Edit profile'}
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <Card className="anim-pop mb-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input id="pr-name" className={inputCls} value={m.name} onChange={(e) => s.updateMember(m.id, { name: e.target.value })} />
            </Field>
            <Field label="Title">
              <input id="pr-title" className={inputCls} value={m.title} onChange={(e) => s.updateMember(m.id, { title: e.target.value })} />
            </Field>
            <Field label="Location">
              <input id="pr-loc" className={inputCls} value={m.location} onChange={(e) => s.updateMember(m.id, { location: e.target.value })} />
            </Field>
            <Field label="Weekly capacity (hours)">
              <input id="pr-cap" type="number" min={1} className={inputCls} value={m.weeklyCapacity} onChange={(e) => s.updateMember(m.id, { weeklyCapacity: Number(e.target.value) })} />
            </Field>
            <Field label="Skills">
              <TagInput id="pr-skills" value={m.skills} onChange={(skills) => s.updateMember(m.id, { skills })} />
            </Field>
            <Field label="Specialisations">
              <TagInput id="pr-spec" value={m.specializations} onChange={(specializations) => s.updateMember(m.id, { specializations })} />
            </Field>
            <Field label="Creative bio" className="sm:col-span-2">
              <textarea id="pr-bio" className={textareaCls} value={m.bio} onChange={(e) => s.updateMember(m.id, { bio: e.target.value })} />
            </Field>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <Card>
          <CardHeader title="Current workload" sub={`${openTasks.length} open tasks`} />
          <div className="flex items-center gap-5">
            <Ring value={Math.min(1, weekLoad / (m.weeklyCapacity || 40))} size={110} color={weekLoad > m.weeklyCapacity ? 'var(--warn)' : 'var(--accent)'}>
              <span className="tnum text-xl font-semibold">{Math.round(weekLoad)}h</span>
            </Ring>
            <div className="text-[13px] text-ink-2">
              <p>Planned in the next 7 days</p>
              <p className="text-ink-3">Capacity {m.weeklyCapacity}h a week</p>
              <p className="tnum mt-3 text-ink-3">{Math.round(weekMs / 360000) / 10}h tracked this week</p>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Skills" />
          <div className="flex flex-wrap gap-1.5">
            {m.skills.map((x) => (
              <span key={x} className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px]">
                {x}
              </span>
            ))}
            {!m.skills.length && <p className="text-sm text-ink-3">No skills added yet.</p>}
          </div>
          <p className="eyebrow mt-5 mb-2">Specialisations</p>
          <div className="flex flex-wrap gap-1.5">
            {m.specializations.map((x) => (
              <span key={x} className="rounded-full border border-accent-text/40 px-3 py-1.5 text-[13px] text-accent-text">
                {x}
              </span>
            ))}
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Projects completed', completed.length],
            ['Active projects', mine.length - completed.length],
            ['Open tasks', openTasks.length],
            ['Hours logged', `${Math.round(totalMs / 3600000)}h`],
          ].map(([l, v], i) => (
            <div key={l as string} className={cn('card flex flex-col justify-between p-4', i === 0 && 'border-transparent bg-accent bg-none text-accent-ink')}>
              <p className={cn('text-[13px]', i === 0 ? 'text-accent-ink/70' : 'text-ink-3')}>{l}</p>
              <p className="tnum mt-2 text-[28px] leading-none font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {openTasks.length > 0 && (
        <Card className="mt-5">
          <CardHeader title="On their plate" />
          <div className="-mx-2">
            {openTasks.slice(0, 6).map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        </Card>
      )}

      <section className="mt-6">
        <h2 className="mb-3 px-1 text-[17px] font-medium tracking-tight">Portfolio</h2>
        {completed.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {completed.map((p) => (
              <button key={p.id} type="button" onClick={() => navigate({ name: 'project', id: p.id })} className="group text-left">
                <Cover hue={p.cover.hue} shape={p.cover.shape} className="aspect-[4/3] max-w-full rounded-[20px] transition-transform group-hover:scale-[1.02]" />
                <p className="mt-2 truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-ink-3">{p.type}</p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No finished projects yet" body="Completed work shows up here automatically." />
        )}
      </section>
    </div>
  )
}
