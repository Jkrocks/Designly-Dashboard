import { useState } from 'react'
import { ArrowDown, ArrowUp, Monitor, Moon, Plus, RotateCcw, Sun, Trash2, UserPlus } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { ROLE_INFO, useCan, useCurrentUser } from '../lib/selectors'
import type { Role, StatusKind } from '../lib/types'
import { cn } from '../lib/utils'
import { cloudEnabled, inviteMember, memberIdFor, messageOf, openWorkspace, removeMemberAccess, setMemberRole, signOut, useCloud } from '../lib/cloud'
import { Avatar, Button, Card, CardHeader, Field, IconButton, inputCls, Modal, PageHeader, Segmented } from '../components/ui'

const KIND_LABEL: Record<StatusKind, string> = {
  backlog: 'Not started',
  active: 'In progress',
  review: 'Needs review',
  approved: 'Approved',
  done: 'Done',
  archived: 'Archived',
}
const ROLES: Role[] = ['Owner', 'Admin', 'Designer', 'Reviewer', 'Viewer']
const SWATCHES = ['#a78bfa', '#60a5fa', '#b5d92a', '#f59e0b', '#f97316', '#14b8a6', '#16a34a', '#9ca3af', '#ec4899', '#ef4444']

function General() {
  const s = useStore()
  const can = useCan()
  const notify = useUI((u) => u.notify)
  const [confirm, setConfirm] = useState<'reset' | 'fresh' | null>(null)
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      <Card>
        <CardHeader title="Workspace" />
        <div className="flex flex-col gap-4">
          <Field label="Studio or workspace name">
            <input id="set-ws" className={inputCls} value={s.settings.workspaceName} disabled={!can('settings')} onChange={(e) => s.updateSettings({ workspaceName: e.target.value })} />
          </Field>
          <Field label="How you work" hint="Just me hides assignees and team avatars so the app feels personal. Switch any time.">
            <Segmented label="Mode" value={s.settings.mode} onChange={(mode) => s.updateSettings({ mode })} options={[{ value: 'solo', label: 'Just me' }, { value: 'team', label: 'With a team' }]} />
          </Field>
          <Field label="Week starts on">
            <Segmented label="Week start" value={String(s.settings.weekStartsOn) as '0' | '1'} onChange={(v) => s.updateSettings({ weekStartsOn: Number(v) as 0 | 1 })} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Appearance" />
        <Segmented
          label="Theme"
          value={s.settings.theme}
          onChange={(theme) => s.updateSettings({ theme })}
          options={[
            { value: 'light', label: <><Sun size={14} /> Light</> },
            { value: 'dark', label: <><Moon size={14} /> Dark</> },
            { value: 'system', label: <><Monitor size={14} /> System</> },
          ]}
        />
        {!cloudEnabled && <>
        <p className="mt-6 mb-2 text-[13px] font-medium text-ink-2">Try another role</p>
        <p className="mb-3 text-xs text-ink-3">See the app the way a teammate would. Viewers can’t edit, reviewers can comment and approve.</p>
        <select id="set-viewas" className={inputCls} value={s.settings.currentUserId} onChange={(e) => s.updateSettings({ currentUserId: e.target.value })}>
          {s.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.role}
            </option>
          ))}
        </select>
        </>}
      </Card>
      {cloudEnabled ? <Account /> : (
      <Card className="lg:col-span-2">
        <CardHeader title="Data" sub="Everything is saved in this browser only." />
        {confirm ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-warn-soft p-4 text-[13px] text-warn">
            <span className="mr-auto">{confirm === 'reset' ? 'Replace everything with fresh demo data?' : 'Remove all demo projects, tasks, clients and time so you can start with your own work?'}</span>
            <Button size="sm" variant="danger" onClick={() => { confirm === 'reset' ? s.resetDemo() : s.startFresh(); setConfirm(null); notify(confirm === 'reset' ? 'Demo data restored' : 'Clean slate. Add your first project.') }}>
              {confirm === 'reset' ? 'Restore demo' : 'Start fresh'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button icon={<RotateCcw size={15} />} onClick={() => setConfirm('reset')}>
              Restore demo data
            </Button>
            <Button variant="ghost" onClick={() => setConfirm('fresh')}>
              Start with an empty workspace
            </Button>
          </div>
        )}
      </Card>
      )}
    </div>
  )
}

function Account() {
  const { session, workspace, workspaces } = useCloud()
  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Account" sub="Your work is saved to the cloud and syncs live with your team." />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">
          Signed in as <span className="font-medium">{session?.user.email}</span>
        </span>
        {workspaces.length > 1 && (
          <select id="set-studio" aria-label="Studio" className={cn(inputCls, 'w-auto')} value={workspace?.id} onChange={(e) => { const w = workspaces.find((x) => x.id === e.target.value); if (w) void openWorkspace(w) }}>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        <Button variant="ghost" className="ml-auto" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </Card>
  )
}

function Workflow() {
  const s = useStore()
  const can = useCan()
  const [name, setName] = useState('')
  const disabled = !can('settings')
  return (
    <Card>
      <CardHeader title="Workflow statuses" sub="Rename, recolour, reorder or add your own steps. The type tells DesignFlow what a status means, so insights keep working." />
      <ul className="flex flex-col gap-2">
        {s.statuses.map((st, i) => {
          const used = s.projects.filter((p) => p.statusId === st.id).length + s.tasks.filter((t) => t.statusId === st.id).length
          return (
            <li key={st.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface-2 p-2 sm:flex-nowrap">
              <div className="flex gap-0.5">
                <IconButton label="Move up" disabled={i === 0 || disabled} onClick={() => s.moveStatus(st.id, -1)} className="size-8 disabled:opacity-30">
                  <ArrowUp size={14} />
                </IconButton>
                <IconButton label="Move down" disabled={i === s.statuses.length - 1 || disabled} onClick={() => s.moveStatus(st.id, 1)} className="size-8 disabled:opacity-30">
                  <ArrowDown size={14} />
                </IconButton>
              </div>
              <div className="flex gap-1" role="radiogroup" aria-label={`Colour for ${st.name}`}>
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={st.color === c}
                    aria-label={c}
                    disabled={disabled}
                    onClick={() => s.updateStatus(st.id, { color: c })}
                    className={cn('size-5 rounded-full transition-transform hover:scale-110', st.color === c && 'ring-2 ring-ink ring-offset-2 ring-offset-surface-2')}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <input id={`st-name-${st.id}`} aria-label="Status name" className={cn(inputCls, 'h-9 min-w-32 flex-1 bg-surface')} value={st.name} disabled={disabled} onChange={(e) => s.updateStatus(st.id, { name: e.target.value })} />
              <select id={`st-kind-${st.id}`} aria-label="Status type" className={cn(inputCls, 'h-9 w-auto bg-surface')} value={st.kind} disabled={disabled} onChange={(e) => s.updateStatus(st.id, { kind: e.target.value as StatusKind })}>
                {Object.entries(KIND_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <span className="tnum w-16 text-right text-xs text-ink-3">{used} items</span>
              <IconButton label={`Delete ${st.name}`} disabled={disabled || s.statuses.length <= 2} onClick={() => s.removeStatus(st.id)} className="size-8 disabled:opacity-30">
                <Trash2 size={14} />
              </IconButton>
            </li>
          )
        })}
      </ul>
      {!disabled && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            s.addStatus({ name: name.trim(), color: SWATCHES[s.statuses.length % SWATCHES.length]!, kind: 'active' })
            setName('')
          }}
        >
          <input id="st-new" className={inputCls} placeholder="New status, e.g. Client feedback" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="accent" icon={<Plus size={16} />} disabled={!name.trim()}>
            Add
          </Button>
        </form>
      )}
      <p className="mt-3 text-xs text-ink-3">Deleting a status moves its projects and tasks to the step before it.</p>
    </Card>
  )
}

function Team() {
  const s = useStore()
  const can = useCan()
  const me = useCurrentUser()
  const navigate = useUI((u) => u.navigate)
  const notify = useUI((u) => u.notify)
  const [invite, setInvite] = useState(false)
  const [draft, setDraft] = useState({ name: '', email: '', title: '', role: 'Designer' as Role, location: '' })
  const manage = can('manageTeam')
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:gap-5">
      <Card>
        <CardHeader
          title={`Team · ${s.members.length}`}
          sub="Works the same for one designer or a hundred."
          action={manage && <Button variant="accent" size="sm" icon={<UserPlus size={15} />} onClick={() => setInvite(true)}>Add designer</Button>}
        />
        <ul className="flex flex-col divide-y divide-line">
          {s.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <button type="button" onClick={() => navigate({ name: 'profile', id: m.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar member={m} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {m.name} {m.id === me.id && <span className="text-ink-3">(you)</span>}
                  </span>
                  <span className="block truncate text-xs text-ink-3">
                    {m.title} · {m.location}
                  </span>
                </span>
              </button>
              <select id={`role-${m.id}`} aria-label={`Role for ${m.name}`} className={cn(inputCls, 'h-9 w-auto')} value={m.role} disabled={!manage || m.role === 'Owner'} onChange={(e) => {
                const role = e.target.value as Role
                s.updateMember(m.id, { role })
                if (cloudEnabled && m.email) setMemberRole(m.email, role).catch((err) => notify(messageOf(err)))
              }}>
                {ROLES.map((r) => (
                  <option key={r} disabled={r === 'Owner'}>
                    {r}
                  </option>
                ))}
              </select>
              {manage && m.role !== 'Owner' && m.id !== me.id && (
                <IconButton label={`Remove ${m.name}`} onClick={() => {
                  s.removeMember(m.id)
                  if (cloudEnabled && m.email) removeMemberAccess(m.email).catch((err) => notify(messageOf(err)))
                  notify(`${m.name} removed`)
                }} className="size-9">
                  <Trash2 size={14} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Roles" />
        <dl className="flex flex-col gap-3">
          {ROLES.map((r) => (
            <div key={r}>
              <dt className="text-sm font-medium">{r}</dt>
              <dd className="text-[13px] text-ink-3">{ROLE_INFO[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Modal
        open={invite}
        onClose={() => setInvite(false)}
        title="Add a designer"
        footer={
          <>
            <Button variant="ghost" onClick={() => setInvite(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={!draft.name.trim() || (cloudEnabled && !/.+@.+\..+/.test(draft.email))}
              onClick={async () => {
                const email = draft.email.trim().toLowerCase()
                if (cloudEnabled) {
                  try {
                    await inviteMember(email, draft.role)
                  } catch (err) {
                    notify(messageOf(err))
                    return
                  }
                }
                s.addMember({ ...draft, id: email ? memberIdFor(email) : undefined, email: email || undefined, name: draft.name.trim(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, skills: [], specializations: [], bio: '', hue: Math.floor(Math.random() * 360), weeklyCapacity: 40 })
                setInvite(false)
                setDraft({ name: '', email: '', title: '', role: 'Designer', location: '' })
                notify(cloudEnabled ? `${draft.name.trim()} can now sign in with ${email}` : `${draft.name.trim()} added to the team`)
              }}
            >
              Add to team
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">
            <input id="inv-name" className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Email" hint={cloudEnabled ? 'They sign in with this address to join your studio.' : undefined} className="sm:col-span-2">
            <input id="inv-email" type="email" className={inputCls} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="name@studio.com" />
          </Field>
          <Field label="Title">
            <input id="inv-title" className={inputCls} value={draft.title} placeholder="Motion Designer" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field label="Role">
            <select id="inv-role" className={inputCls} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
              {ROLES.filter((r) => r !== 'Owner').map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="City, country" className="sm:col-span-2">
            <input id="inv-loc" className={inputCls} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

export default function Settings({ tab = 'general' }: { tab?: string }) {
  const navigate = useUI((u) => u.navigate)
  const t = ['general', 'workflow', 'team'].includes(tab) ? tab : 'general'
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Settings" />
      <div className="mb-5">
        <Segmented
          label="Settings section"
          value={t as 'general' | 'workflow' | 'team'}
          onChange={(v) => navigate({ name: 'settings', tab: v })}
          options={[
            { value: 'general', label: 'General' },
            { value: 'workflow', label: 'Workflow' },
            { value: 'team', label: 'Team & roles' },
          ]}
        />
      </div>
      {t === 'general' && <General />}
      {t === 'workflow' && <Workflow />}
      {t === 'team' && <Team />}
    </div>
  )
}
