import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Info, Send } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { useCan, useCurrentUser } from '../lib/selectors'
import { PROJECT_TYPES } from '../lib/demo'
import { deleteStoredFile } from '../lib/files'
import { dimsText, emptyKld, emptyPack, FINISHES, isPackaging, PACK_MATERIALS, PACK_SIZE_HELP, PACK_SIZES, PACK_TYPES, packSizeText, PRINT_PROCESSES, readiness, type Step } from '../lib/handoff'
import type { DimUnit, PackDetails, Project, ProjectFile } from '../lib/types'
import { cn, uid } from '../lib/utils'
import { Avatar, Button, Field, inputCls, Modal, TagInput, textareaCls } from './ui'
import { blankProject, LinksEditor, MemberPicker, PriorityPicker } from './forms'
import { FilesBoard, KldPanel } from './ProjectFiles'
import { ReadyBar } from './ProjectReady'

type Draft = Omit<Project, 'createdAt'>

const STEP_LABEL: Record<Step, string> = { basics: 'Project', brief: 'Brief', pack: 'Pack details', kld: 'KLD', files: 'Files', assign: 'Assign' }

function Warn({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-warn">
      <AlertTriangle size={13} /> {children}
    </p>
  )
}

function Options({ id, list }: { id: string; list: string[] }) {
  return (
    <datalist id={id}>
      {list.map((x) => (
        <option key={x} value={x} />
      ))}
    </datalist>
  )
}

export function PackFields({ pack, onChange, readOnly }: { pack: PackDetails; onChange: (p: PackDetails) => void; readOnly?: boolean }) {
  const set = <K extends keyof PackDetails>(k: K, v: PackDetails[K]) => onChange({ ...pack, [k]: v })
  const text = (k: keyof PackDetails, label: string, placeholder: string, list?: string[]) => (
    <Field label={label}>
      <input id={`pk-${k}`} className={inputCls} readOnly={readOnly} value={pack[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} list={list ? `pk-${k}-list` : undefined} />
      {list && <Options id={`pk-${k}-list`} list={list} />}
    </Field>
  )
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {text('productName', 'Product name', 'Idli & Dosa Batter')}
        {text('category', 'Product category', 'Ready-to-cook batter', ['Food', 'Beverage', 'Dairy', 'Snacks', 'Personal care', 'Home care', 'Health & wellness'])}
        {text('packType', 'Pack type', 'Stand-up pouch', PACK_TYPES)}
        {text('material', 'Pack material', 'Laminated film (PET/PE)', PACK_MATERIALS)}
      </div>

      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
          Pack size
          <span className="group relative inline-flex">
            <button type="button" aria-label="What is pack size?" className="grid size-5 place-items-center rounded-full text-ink-3 hover:text-ink">
              <Info size={14} />
            </button>
            <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-xs font-normal text-bg opacity-0 shadow-pop transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              {PACK_SIZE_HELP}
            </span>
          </span>
        </span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Common pack sizes">
          {PACK_SIZES.map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={pack.packSize === x}
              disabled={readOnly}
              onClick={() => set('packSize', pack.packSize === x ? '' : x)}
              className={cn('h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors', pack.packSize === x ? 'border-transparent bg-ink text-bg' : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong')}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input id="pk-packSize" aria-label="Pack size" className={inputCls} readOnly={readOnly} value={pack.packSize} onChange={(e) => set('packSize', e.target.value)} placeholder="Or type it, e.g. 750 g" />
          <input id="pk-customSize" aria-label="Custom pack size" className={inputCls} readOnly={readOnly} value={pack.customSize} onChange={(e) => set('customSize', e.target.value)} placeholder="Custom pack size, e.g. 4 × 250 g multipack" />
        </div>
        {!packSizeText(pack) && <Warn>Missing pack size</Warn>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-ink-2">Pack dimensions</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          {(['width', 'height', 'depth'] as const).map((k) => (
            <label key={k} className="relative">
              <span className="sr-only">{k}</span>
              <input id={`pk-${k}`} inputMode="decimal" className={cn(inputCls, 'pr-8')} readOnly={readOnly} value={pack[k]} onChange={(e) => set(k, e.target.value)} placeholder={k[0]!.toUpperCase() + k.slice(1)} />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-3">{pack.unit}</span>
            </label>
          ))}
          <div className="col-span-3 flex gap-1 rounded-xl border border-line bg-surface-2 p-1 sm:col-span-1" role="radiogroup" aria-label="Unit">
            {(['mm', 'cm', 'inch'] as DimUnit[]).map((u) => (
              <button key={u} type="button" role="radio" aria-checked={pack.unit === u} disabled={readOnly} onClick={() => set('unit', u)} className={cn('h-8 flex-1 rounded-lg px-3 text-[13px]', pack.unit === u ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink')}>
                {u}
              </button>
            ))}
          </div>
        </div>
        {dimsText(pack) && <p className="text-xs text-ink-3">{dimsText(pack)} (width × height × depth)</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {text('variants', 'Quantity / variants', '3 regional variants')}
        {text('sku', 'SKU', 'IDF-DB-1KG')}
        {text('barcode', 'Barcode', 'EAN-13 8906082910014')}
        {text('printing', 'Printing process', 'Rotogravure', PRINT_PROCESSES)}
        {text('finishing', 'Finishing', 'Matte with spot gloss', FINISHES)}
        {text('languages', 'Language requirements', 'English, Hindi, Arabic')}
      </div>
    </div>
  )
}

export function ProjectForm() {
  const form = useUI((s) => s.projectForm)
  const setUI = useUI((s) => s.set)
  const notify = useUI((s) => s.notify)
  const navigate = useUI((s) => s.navigate)
  const { projects, clients, statuses, members, addProject, updateProject, addClient } = useStore()
  const me = useCurrentUser()
  const can = useCan()
  const existing = form.id ? projects.find((p) => p.id === form.id) : undefined
  const fresh = (): Draft => ({ ...blankProject((statuses.find((s) => s.kind === 'backlog') ?? statuses[0]!).id, me.id), id: uid('p'), leadId: null, pack: emptyPack(), kld: emptyKld(), files: [], ...form.preset })
  const [v, setV] = useState<Draft>(fresh)
  const [newClient, setNewClient] = useState('')
  const [step, setStep] = useState<Step>('basics')
  const [sendEmail, setSendEmail] = useState(true)

  useEffect(() => {
    if (!form.open) return
    setV(existing ? { pack: emptyPack(), kld: emptyKld(), files: [], leadId: existing.memberIds[0] ?? null, ...existing } : fresh())
    setNewClient('')
    setStep((form.step as Step) ?? 'basics')
    setSendEmail(!existing)
  }, [form.open, form.id])

  const set = <K extends keyof Draft>(k: K, val: Draft[K]) => setV((x) => ({ ...x, [k]: val }))
  const updateFiles = (fn: (f: ProjectFile[]) => ProjectFile[]) => setV((x) => ({ ...x, files: fn(x.files ?? []) }))
  const readOnly = !can('edit')
  const packaging = isPackaging(v.type)
  const steps: Step[] = packaging ? ['basics', 'brief', 'pack', 'kld', 'files', 'assign'] : ['basics', 'brief', 'files', 'assign']
  const idx = Math.max(0, steps.indexOf(step))
  const ready = useMemo(() => readiness({ ...v, clientId: v.clientId === '__new' ? (newClient.trim() ? 'new' : null) : v.clientId }), [v, newClient])
  const lead = v.leadId ? members.find((m) => m.id === v.leadId) : null

  const close = () => {
    // Files uploaded for a project that was never saved would be orphaned.
    if (!existing) for (const f of v.files ?? []) void deleteStoredFile(f).catch(() => {})
    setUI({ projectForm: { open: false } })
  }

  const save = () => {
    if (!v.name.trim()) {
      setStep('basics')
      return
    }
    let clientId = v.clientId
    if (clientId === '__new' && newClient.trim()) {
      clientId = addClient({ name: newClient.trim(), contact: '', email: '', phone: '', website: '', location: '', industry: '', notes: '', hue: Math.floor(Math.random() * 360) }).id
    } else if (clientId === '__new') clientId = null
    const memberIds = v.leadId && !v.memberIds.includes(v.leadId) ? [v.leadId, ...v.memberIds] : v.memberIds
    const data = { ...v, clientId, memberIds, name: v.name.trim(), links: v.links.filter((l) => l.url.trim()) }
    let id: string
    if (existing) {
      updateProject(existing.id, data)
      id = existing.id
      notify('Project updated')
    } else {
      id = addProject(data).id
      notify(`“${data.name}” created`)
    }
    setUI({ projectForm: { open: false } })
    navigate({ name: 'project', id })
    if (sendEmail && v.leadId) setUI({ projectEmail: id })
  }

  const stepDone = (s: Step) => ready.items.filter((i) => i.step === s).every((i) => i.done || i.deferred)
  const stepWarn = (s: Step) => ready.missing.some((i) => i.step === s && i.important && !i.deferred)

  return (
    <Modal
      open={form.open}
      onClose={close}
      title={existing ? 'Edit project' : 'New project'}
      wide
      footer={
        <>
          <div className="mr-auto hidden min-w-40 sm:block">
            <ReadyBar pct={ready.pct} compact />
          </div>
          {idx > 0 ? (
            <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => setStep(steps[idx - 1]!)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
          )}
          {idx < steps.length - 1 && (
            <Button onClick={() => setStep(steps[idx + 1]!)} disabled={!v.name.trim()}>
              Next: {STEP_LABEL[steps[idx + 1]!]} <ArrowRight size={15} />
            </Button>
          )}
          <Button variant="accent" onClick={save} disabled={!v.name.trim() || readOnly} icon={sendEmail && v.leadId && step === 'assign' ? <Send size={15} /> : undefined}>
            {existing ? 'Save changes' : step === 'assign' && sendEmail && v.leadId ? 'Create & email designer' : 'Create project'}
          </Button>
        </>
      }
    >
      {readOnly && <p className="mb-4 rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-warn">Your role can view projects but not change them.</p>}

      <nav aria-label="Steps" className="scroll-thin -mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            aria-current={s === step ? 'step' : undefined}
            onClick={() => v.name.trim() && setStep(s)}
            className={cn(
              'flex h-9 shrink-0 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-[13px] font-medium transition-colors',
              s === step ? 'border-transparent bg-ink text-bg' : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong',
            )}
          >
            <span className={cn('grid size-6 place-items-center rounded-full text-[11px]', s === step ? 'bg-bg/15' : stepDone(s) ? 'bg-accent text-accent-ink' : 'bg-surface-3')}>
              {stepDone(s) && s !== step ? <Check size={13} /> : i + 1}
            </span>
            {STEP_LABEL[s]}
            {stepWarn(s) && s !== step && <span className="size-1.5 rounded-full bg-warn" aria-label="needs attention" />}
          </button>
        ))}
      </nav>

      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (idx < steps.length - 1) setStep(steps[idx + 1]!)
          else save()
        }}
      >
        {step === 'basics' && (
          <>
            <Field label="Project name">
              <input id="pf-name" className={cn(inputCls, 'h-12 text-base')} value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Protein Packs for Children" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client / brand">
                <select id="pf-client" className={inputCls} value={v.clientId ?? ''} onChange={(e) => set('clientId', e.target.value || null)}>
                  <option value="">Personal project</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__new">+ New client…</option>
                </select>
              </Field>
              {v.clientId === '__new' && (
                <Field label="New client name">
                  <input id="pf-newclient" className={inputCls} value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="Company name" />
                </Field>
              )}
              <Field label="Project type" hint={packaging ? 'Packaging projects get pack details and a KLD step.' : undefined}>
                <select id="pf-type" className={inputCls} value={v.type} onChange={(e) => set('type', e.target.value)}>
                  {PROJECT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Start date">
                <input id="pf-start" type="date" className={inputCls} value={v.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </Field>
              <Field label="Deadline">
                <input id="pf-deadline" type="date" className={inputCls} value={v.deadline} onChange={(e) => set('deadline', e.target.value)} />
              </Field>
              <Field label="Status">
                <select id="pf-status" className={inputCls} value={v.statusId} onChange={(e) => set('statusId', e.target.value)}>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Priority">
              <PriorityPicker value={v.priority} onChange={(p) => set('priority', p)} />
            </Field>
          </>
        )}

        {step === 'brief' && (
          <>
            <Field label="Project description">
              <textarea id="pf-desc" className={textareaCls} value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="One or two lines on what this is." rows={2} />
            </Field>
            <Field label="Creative brief" hint="Goals, deliverables, tone, must-haves. You can also upload the brief as a file in the Files step.">
              <textarea id="pf-brief" className={cn(textareaCls, 'min-h-[160px]')} value={v.brief} onChange={(e) => set('brief', e.target.value)} placeholder="What does the client need, and what does success look like?" />
            </Field>
            {!v.brief.trim() && !(v.files ?? []).some((f) => f.category === 'brief') && <Warn>Missing creative brief</Warn>}
            <Field label="Notes">
              <textarea id="pf-notes" className={textareaCls} value={v.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything else the designer should know." />
            </Field>
            <Field label="Reference links">
              <LinksEditor value={v.links} onChange={(l) => set('links', l)} />
            </Field>
          </>
        )}

        {step === 'pack' && <PackFields pack={v.pack ?? emptyPack()} onChange={(p) => set('pack', p)} readOnly={readOnly} />}

        {step === 'kld' && <KldPanel projectId={v.id} files={v.files ?? []} update={updateFiles} kld={v.kld ?? emptyKld()} onKld={(k) => set('kld', k)} canEdit={!readOnly} />}

        {step === 'files' && (
          <>
            <p className="text-sm text-ink-3">Drop files into the right box. Uploading again to the same file adds a new version and keeps the old one.</p>
            <FilesBoard projectId={v.id} files={v.files ?? []} update={updateFiles} canEdit={!readOnly} skip={packaging ? ['kld'] : []} />
          </>
        )}

        {step === 'assign' && (
          <>
            <Field label="Assigned designer">
              <select id="pf-lead" className={inputCls} value={v.leadId ?? ''} onChange={(e) => set('leadId', e.target.value || null)}>
                <option value="">Choose a designer…</option>
                {members
                  .filter((m) => m.role !== 'Viewer')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.title || m.role}
                    </option>
                  ))}
              </select>
            </Field>
            {!v.leadId && <Warn>No designer assigned yet</Warn>}
            <Field label="Also working on it">
              <MemberPicker value={v.memberIds} onChange={(ids) => set('memberIds', ids)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tags">
                <TagInput id="pf-tags" value={v.tags} onChange={(t) => set('tags', t)} placeholder="packaging, launch…" />
              </Field>
              <Field label="Software">
                <TagInput id="pf-software" value={v.software} onChange={(t) => set('software', t)} placeholder="illustrator, photoshop…" />
              </Field>
            </div>
            <div className="rounded-[22px] border border-line p-4">
              <ReadyBar pct={ready.pct} />
              {ready.missing.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {ready.missing.map((m) => (
                    <li key={m.label}>
                      <button type="button" onClick={() => setStep(m.step)} className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium', m.important && !m.deferred ? 'border-warn/40 bg-warn-soft text-warn' : 'border-line text-ink-2 hover:border-line-strong')}>
                        {m.important && !m.deferred && <AlertTriangle size={12} />}
                        {m.label}
                        {m.deferred && ' (later)'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {lead && (
              <label className="flex items-center gap-3 rounded-[22px] border border-line p-4 text-sm">
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                <Avatar member={lead} size={32} />
                <span className="min-w-0 flex-1">
                  Email the project to {lead.name.split(' ')[0]} after saving
                  <span className="block text-xs text-ink-3">{lead.email ? `Pack details, KLD link, brief, tasks and a link to open the project, ready to send to ${lead.email}.` : 'Pack details, KLD link, brief and tasks, ready to send.'}</span>
                </span>
              </label>
            )}
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
