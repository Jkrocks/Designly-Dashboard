import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Download, Eye, FileArchive, FileSpreadsheet, FileText, ImageOff, Loader2, Presentation, Upload } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { useCan, useCurrentUser } from '../lib/selectors'
import { fileUrl, uploadProjectFile } from '../lib/files'
import { buildReportData, completedIn, defaultSelection, designerOf, finalArtwork, recordFor, reportCsv, type ReportData } from '../lib/report'
import { loadArtwork, names, renderPdf, renderPptx, renderZip, saveBlob, type Artwork } from '../lib/reportDeck'
import type { ID, Project, ProjectFile } from '../lib/types'
import { cn, uid } from '../lib/utils'
import { Button, Modal } from './ui'

function Thumb({ file, className }: { file: ProjectFile; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    fileUrl(file).then((u) => live && setUrl(u), () => {})
    return () => {
      live = false
    }
  }, [file.id])
  return url ? <img src={url} alt={file.name} className={cn('object-cover', className)} loading="lazy" /> : <span className={cn('grid place-items-center bg-surface-3 text-ink-3', className)}><Loader2 size={14} className="animate-spin" /></span>
}

type Built = { data: ReportData; art: Map<string, Artwork[]>; logo: Artwork | null; pptx: Blob; failed: string[] }

/** Checklist, artwork picker and exports for one report period. */
export function ReportBuilder() {
  const req = useUI((u) => u.reportBuilder)
  const setUI = useUI((u) => u.set)
  const notify = useUI((u) => u.notify)
  const s = useStore()
  const me = useCurrentUser()
  const can = useCan()
  const [selection, setSelection] = useState<Record<ID, ID[]>>({})
  const [excluded, setExcluded] = useState<ID[]>([])
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [phase, setPhase] = useState<'review' | 'building' | 'done'>('review')
  const [progress, setProgress] = useState<[number, number]>([0, 0])
  const [built, setBuilt] = useState<Built | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const recordId = useRef<ID | null>(null)

  const candidates = useMemo(() => {
    if (!req) return []
    if (req.record) return req.record.projectIds.map((id) => s.projects.find((p) => p.id === id)).filter(Boolean) as Project[]
    let list = completedIn(s.projects, s.statuses, req.from, req.to)
    if (req.designerId) list = list.filter((p) => designerOf(p) === req.designerId)
    if (req.projectIds) list = list.filter((p) => req.projectIds!.includes(p.id))
    return list
  }, [req, s.projects, s.statuses])

  useEffect(() => {
    if (!req) return
    const initial: Record<ID, ID[]> = {}
    for (const p of candidates) initial[p.id] = req.record?.images[p.id]?.filter((id) => p.files?.some((f) => f.id === id)) ?? defaultSelection(p)
    setSelection(initial)
    setExcluded([])
    setOnlyMissing(false)
    setPhase('review')
    setBuilt(null)
    recordId.current = req.record?.id ?? null
  }, [req])

  if (!req) return null
  const included = candidates.filter((p) => !excluded.includes(p.id))
  const missing = included.filter((p) => !(selection[p.id]?.length))
  const finals = included.reduce((a, p) => a + (selection[p.id]?.length ?? 0), 0)
  const designers = new Set(included.map(designerOf).filter(Boolean)).size
  const incomplete = included.filter((p) => !designerOf(p) || !(p.description || p.brief).trim())
  const close = () => setUI({ reportBuilder: null })

  const toggle = (pid: ID, fid: ID) =>
    setSelection((cur) => {
      const list = cur[pid] ?? []
      return { ...cur, [pid]: list.includes(fid) ? list.filter((x) => x !== fid) : [...list, fid] }
    })

  const uploadFinal = async (p: Project, list: FileList | null) => {
    const file = list?.[0]
    if (!file) return
    if (!/^image\/(jpe?g|png)$/.test(file.type)) {
      notify('Please choose a JPG or PNG image.')
      return
    }
    setBusy(p.id)
    try {
      const f = await uploadProjectFile({ projectId: p.id, file, category: 'final', version: 'FINAL APPROVED', uploadedBy: me.id })
      const cur = useStore.getState().projects.find((x) => x.id === p.id)?.files ?? []
      s.updateProject(p.id, { files: [...cur, f] })
      setSelection((sel) => ({ ...sel, [p.id]: [...(sel[p.id] ?? []), f.id] }))
      notify(`Final JPG added to ${p.name}`)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Upload failed. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const generate = async () => {
    setPhase('building')
    try {
      const data = buildReportData({
        period: { title: req.title, from: req.from, to: req.to },
        projects: included,
        allProjects: s.projects,
        tasks: s.tasks,
        clients: s.clients,
        members: s.members,
        statuses: s.statuses,
        studio: s.settings.workspaceName,
        selection,
      })
      const { art, logo, failed } = await loadArtwork(data, (d, t) => setProgress([d, t]))
      const pptx = await renderPptx(data, art, logo)
      setBuilt({ data, art, logo, pptx, failed })
      const rec = recordFor(data, selection, me.id, recordId.current ?? undefined)
      const id = rec.id ?? uid('rp')
      recordId.current = id
      s.addReport({ ...rec, id })
      setPhase('done')
    } catch (e) {
      notify(e instanceof Error ? `Couldn’t build the report: ${e.message}` : 'Couldn’t build the report. Try again.')
      setPhase('review')
    }
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(null)
    }
  }
  const n = names(req.title)
  const viewPdf = () =>
    run('view', async () => {
      const win = window.open('', '_blank')
      const blob = await renderPdf(built!.data, built!.art, built!.logo)
      const url = URL.createObjectURL(blob)
      if (win) win.location.href = url
      else saveBlob(blob, n.pdf)
    })

  const shown = onlyMissing ? missing : candidates
  return (
    <Modal
      open
      onClose={close}
      wide
      title={`${req.title} report`}
      footer={
        phase === 'done' ? (
          <Button variant="ghost" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="accent" icon={phase === 'building' ? <Loader2 size={16} className="animate-spin" /> : <Presentation size={16} />} disabled={phase === 'building' || !included.length} onClick={generate}>
              {phase === 'building' ? (progress[1] ? `Loading artwork ${progress[0]}/${progress[1]}…` : 'Building PPT…') : 'Generate PPT'}
            </Button>
          </>
        )
      }
    >
      {phase === 'done' && built ? (
        <div className="flex flex-col items-center gap-5 py-4 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-accent text-accent-ink">
            <Check size={30} strokeWidth={2.5} />
          </span>
          <div>
            <h3 className="text-xl font-semibold">Report generated successfully</h3>
            <p className="mt-1 text-sm text-ink-3">
              {built.data.projects.length} projects · {built.data.finals} final designs · {n.pptx}
            </p>
            {built.failed.length > 0 && <p className="mt-2 text-[13px] text-warn">{built.failed.length} image{built.failed.length > 1 ? 's' : ''} couldn’t be loaded and {built.failed.length > 1 ? 'were' : 'was'} left out: {built.failed.join(', ')}</p>}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="accent" icon={<Download size={16} />} onClick={() => saveBlob(built.pptx, n.pptx)}>
              Download PPT
            </Button>
            <Button icon={busy === 'view' ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} onClick={viewPdf}>
              View
            </Button>
            <Button icon={busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} onClick={() => run('pdf', async () => saveBlob(await renderPdf(built.data, built.art, built.logo), n.pdf))}>
              PDF
            </Button>
            <Button icon={busy === 'zip' ? <Loader2 size={15} className="animate-spin" /> : <FileArchive size={15} />} onClick={() => run('zip', async () => saveBlob(await renderZip(built.data, built.art, built.pptx), n.zip))}>
              ZIP with final JPGs
            </Button>
            <Button icon={<FileSpreadsheet size={15} />} onClick={() => saveBlob(new Blob([reportCsv(built.data)], { type: 'text/csv;charset=utf-8' }), n.csv)}>
              Report data
            </Button>
          </div>
          <p className="text-xs text-ink-3">Saved to report history. Downloading it again later rebuilds it from the latest project data.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <section className="rounded-[22px] border border-line p-4 sm:p-5" aria-label="Report checklist">
            <p className="eyebrow mb-3">{missing.length || incomplete.length ? 'Month-end report almost ready' : 'Month-end report ready'}</p>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className={included.length ? 'text-good' : 'text-ink-3'} /> {included.length} completed {included.length === 1 ? 'project' : 'projects'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className={finals ? 'text-good' : 'text-ink-3'} /> {finals} final {finals === 1 ? 'JPG' : 'JPGs'} selected
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className={designers ? 'text-good' : 'text-ink-3'} /> {designers} {designers === 1 ? 'designer' : 'designers'}
              </li>
              <li className={cn('flex items-center gap-2', incomplete.length && 'text-warn')}>
                {incomplete.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} className="text-good" />}
                {incomplete.length ? `${incomplete.length} missing a designer or description` : 'Project information complete'}
              </li>
              {missing.length > 0 && (
                <li className="flex flex-wrap items-center gap-2 text-warn sm:col-span-2">
                  <AlertTriangle size={16} /> {missing.length} {missing.length === 1 ? 'project' : 'projects'} missing a final JPG
                  <button type="button" onClick={() => setOnlyMissing(!onlyMissing)} className="ml-1 rounded-full border border-warn/40 bg-warn-soft px-3 py-1 text-xs font-medium">
                    {onlyMissing ? 'Show all projects' : 'Review missing files'}
                  </button>
                </li>
              )}
            </ul>
            {!candidates.length && <p className="mt-3 text-sm text-ink-3">No projects were completed or approved in this period. Projects count once their status is Completed or Approved.</p>}
          </section>

          <ul className="flex flex-col gap-2">
            {shown.map((p) => {
              const art = finalArtwork(p)
              const chosen = selection[p.id] ?? []
              const out = excluded.includes(p.id)
              const client = s.clients.find((c) => c.id === p.clientId)
              return (
                <li key={p.id} className={cn('rounded-[20px] border border-line p-3', out && 'opacity-50')}>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input type="checkbox" checked={!out} onChange={() => setExcluded(out ? excluded.filter((x) => x !== p.id) : [...excluded, p.id])} className="size-4 shrink-0 accent-[var(--accent)]" aria-label={`Include ${p.name}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {client?.name ?? 'Personal'} · {p.type} · completed {p.completedAt?.slice(0, 10)}
                        </span>
                      </span>
                    </label>
                    {!art.length && (
                      <span className="flex items-center gap-1.5 rounded-full bg-warn-soft px-3 py-1 text-xs font-medium text-warn">
                        <ImageOff size={13} /> Final JPG missing
                      </span>
                    )}
                    {can('edit') && (
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:border-line-strong">
                        {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        {art.length ? 'Add final JPG' : 'Upload final JPG'}
                        <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => {
                          void uploadFinal(p, e.target.files)
                          e.target.value = ''
                        }} />
                      </label>
                    )}
                  </div>
                  {art.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {art.map((f) => {
                        const on = chosen.includes(f.id)
                        return (
                          <button
                            key={f.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle(p.id, f.id)}
                            className={cn('relative shrink-0 overflow-hidden rounded-xl border-2 transition-colors', on ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100')}
                            title={`${f.name} · ${f.version}`}
                          >
                            <Thumb file={f} className="h-20 w-28" />
                            <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 text-[9px] font-semibold text-white">{f.version}</span>
                            {on && (
                              <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-accent text-accent-ink">
                                <Check size={12} strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {missing.length > 0 && <p className="text-xs text-ink-3">You can still generate now. Projects without a final JPG get a “Final JPG missing” panel on their slide.</p>}
        </div>
      )}
    </Modal>
  )
}
