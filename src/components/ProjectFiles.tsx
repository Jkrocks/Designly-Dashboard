import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle2, ChevronDown, Clock3, Download, Eye, FileArchive, FileImage, FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react'
import { useUI } from '../lib/store'
import { useCurrentUser, useLookups } from '../lib/selectors'
import type { FileCategory, KldInfo, ProjectFile } from '../lib/types'
import { categoryLabel, fileExt, fileGroups, FILE_CATEGORIES, fmtBytes, KLD_ACCEPT, nextVersion, VERSION_LABELS } from '../lib/handoff'
import { canPreview, deleteStoredFile, downloadFile, fileUrl, isPdf, uploadProjectFile } from '../lib/files'
import { cn } from '../lib/utils'
import { Button, Field, inputCls, Modal, textareaCls } from './ui'

export type FilesUpdater = (fn: (files: ProjectFile[]) => ProjectFile[]) => void

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.')

function useFileActions(projectId: string, update: FilesUpdater) {
  const me = useCurrentUser()
  const notify = useUI((u) => u.notify)
  const [busy, setBusy] = useState<string | null>(null)
  const upload = async (list: FileList | File[] | null, category: FileCategory, group?: ProjectFile[]) => {
    const files = Array.from(list ?? [])
    if (!files.length) return
    setBusy(group?.[0]?.groupId ?? category)
    try {
      for (const [i, file] of files.entries()) {
        // A file dropped onto an existing one becomes its next version; anything else starts at V1.
        const version = group && i === 0 ? nextVersion(group) : 'V1'
        const f = await uploadProjectFile({ projectId, file, category, groupId: group && i === 0 ? group[0]!.groupId : undefined, version, uploadedBy: me.id })
        update((cur) => [...cur, f])
      }
      notify(files.length === 1 ? `${files[0]!.name} uploaded` : `${files.length} files uploaded`)
    } catch (e) {
      notify(message(e))
    } finally {
      setBusy(null)
    }
  }
  const remove = async (f: ProjectFile) => {
    try {
      await deleteStoredFile(f)
      update((cur) => cur.filter((x) => x.id !== f.id))
      notify(`${f.name} (${f.version}) deleted`)
    } catch (e) {
      notify(message(e))
    }
  }
  const setVersion = (f: ProjectFile, version: string) => update((cur) => cur.map((x) => (x.id === f.id ? { ...x, version } : x)))
  const download = (f: ProjectFile) => downloadFile(f).catch((e) => notify(message(e)))
  return { upload, remove, setVersion, download, busy }
}

export function DropZone({ onFiles, accept, label, hint, busy, compact, id, multiple = true }: { onFiles: (f: FileList | null) => void; accept?: string; label: string; hint?: string; busy?: boolean; compact?: boolean; id: string; multiple?: boolean }) {
  const [drag, setDrag] = useState(false)
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        onFiles(e.dataTransfer.files)
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed text-center text-[13px] text-ink-3 transition-colors',
        compact ? 'px-3 py-3' : 'px-4 py-7',
        drag ? 'border-accent-text bg-accent-soft text-accent-text' : 'border-line-strong hover:border-ink-3',
        busy && 'pointer-events-none opacity-70',
      )}
    >
      <span className="flex items-center gap-2">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        <span>
          {busy ? 'Uploading…' : <>
            Drop {label} or <span className="font-medium text-ink">browse</span>
          </>}
        </span>
      </span>
      {hint && !compact && <span className="text-xs">{hint}</span>}
      <input id={id} type="file" multiple={multiple} accept={accept} className="sr-only" onChange={(e) => {
        onFiles(e.target.files)
        e.target.value = ''
      }} />
    </label>
  )
}

function FileIcon({ f, size = 36 }: { f: ProjectFile; size?: number }) {
  const Icon = /^image\//.test(f.mime) ? FileImage : /zip|archive/i.test(f.mime) || /\.zip$/i.test(f.name) ? FileArchive : FileText
  return (
    <span className="relative grid shrink-0 place-items-center rounded-xl bg-surface-3 text-ink-2" style={{ width: size, height: size }}>
      <Icon size={size * 0.44} />
      <span className="absolute -bottom-1 rounded bg-ink px-1 text-[8px] leading-3 font-semibold text-bg">{fileExt(f.name)}</span>
    </span>
  )
}

export function FilePreview({ file, onClose }: { file: ProjectFile | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    setUrl(null)
    setErr(null)
    if (!file || !canPreview(file)) return
    fileUrl(file).then(setUrl, (e) => setErr(message(e)))
  }, [file])
  return (
    <Modal open={!!file} onClose={onClose} title={file ? `${file.name} · ${file.version}` : ''} wide footer={file && <Button icon={<Download size={15} />} onClick={() => downloadFile(file).catch((e) => setErr(message(e)))}>Download</Button>}>
      {file && !canPreview(file) && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <FileIcon f={file} size={56} />
          <p className="text-sm text-ink-2">{fileExt(file.name)} files can’t be shown in the browser. Download it to open in Illustrator, Photoshop or your usual app.</p>
        </div>
      )}
      {err && <p className="rounded-2xl bg-bad-soft px-4 py-3 text-[13px] text-bad">{err}</p>}
      {file && canPreview(file) && !url && !err && (
        <div className="grid h-60 place-items-center text-ink-3">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {file && url && (isPdf(file) ? <iframe src={url} title={file.name} className="h-[70dvh] w-full rounded-2xl border border-line bg-white" /> : <img src={url} alt={file.name} className="mx-auto max-h-[70dvh] rounded-2xl" />)}
    </Modal>
  )
}

/** One logical file with its version history; older versions are kept, never overwritten. */
function FileGroup({ versions, canEdit, actions, onPreview, replaceAccept }: { versions: ProjectFile[]; canEdit: boolean; actions: ReturnType<typeof useFileActions>; onPreview: (f: ProjectFile) => void; replaceAccept?: string }) {
  const { member } = useLookups()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const latest = versions[0]!
  const row = (f: ProjectFile, main: boolean) => (
    <div key={f.id} className={cn('flex flex-wrap items-center gap-3', main ? 'p-3' : 'border-t border-line px-3 py-2.5')}>
      {main ? <FileIcon f={f} /> : <span className="w-9 text-center text-xs text-ink-3">{f.version}</span>}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate', main ? 'text-sm font-medium' : 'text-[13px] text-ink-2')}>{f.name}</p>
        <p className="text-xs text-ink-3">
          {fileExt(f.name)} · {fmtBytes(f.bytes)} · {member.get(f.uploadedBy)?.name.split(' ')[0] ?? 'Someone'} · {format(new Date(f.at), 'd MMM yyyy, HH:mm')}
        </p>
      </div>
      {canEdit ? (
        <select aria-label={`Version of ${f.name}`} value={f.version} onChange={(e) => actions.setVersion(f, e.target.value)} className={cn(inputCls, 'h-8 w-[7.5rem] shrink-0 rounded-full px-2.5 text-xs font-medium', /FINAL/.test(f.version) && 'border-accent-text/50 bg-accent-soft')}>
          {[...new Set([f.version, ...VERSION_LABELS])].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      ) : (
        <span className={cn('rounded-full border border-line px-2.5 py-1 text-xs font-medium', /FINAL/.test(f.version) && 'bg-accent-soft')}>{f.version}</span>
      )}
      <div className="flex items-center gap-1">
        {canPreview(f) && (
          <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => onPreview(f)} aria-label={`Preview ${f.name}`}>
            <span className="hidden sm:inline">Preview</span>
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={() => actions.download(f)} aria-label={`Download ${f.name}`}>
          <span className="hidden sm:inline">Download</span>
        </Button>
        {canEdit &&
          (confirm === f.id ? (
            <Button size="sm" variant="danger" onClick={() => actions.remove(f)}>
              Delete {f.version}?
            </Button>
          ) : (
            <button type="button" aria-label={`Delete ${f.name} ${f.version}`} onClick={() => setConfirm(f.id)} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-bad">
              <Trash2 size={14} />
            </button>
          ))}
      </div>
    </div>
  )
  return (
    <div className="rounded-2xl border border-line bg-surface-2">
      {row(latest, true)}
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
        {versions.length > 1 ? (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
            <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} /> {versions.length - 1} earlier {versions.length === 2 ? 'version' : 'versions'}
          </button>
        ) : (
          <span className="text-xs text-ink-3">Only version</span>
        )}
        {canEdit && (
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-surface-3 hover:text-ink">
            {actions.busy === latest.groupId ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Upload new version ({nextVersion(versions)})
            <input type="file" accept={replaceAccept} className="sr-only" onChange={(e) => {
              void actions.upload(e.target.files, latest.category, versions)
              e.target.value = ''
            }} />
          </label>
        )}
      </div>
      {open && versions.slice(1).map((f) => row(f, false))}
    </div>
  )
}

export function KldPanel({ projectId, files, update, kld, onKld, canEdit, showInfo = true }: { projectId: string; files: ProjectFile[]; update: FilesUpdater; kld: KldInfo; onKld: (k: KldInfo) => void; canEdit: boolean; showInfo?: boolean }) {
  const actions = useFileActions(projectId, update)
  const [preview, setPreview] = useState<ProjectFile | null>(null)
  const groups = fileGroups(files, 'kld')
  const set = <K extends keyof KldInfo>(k: K, v: KldInfo[K]) => onKld({ ...kld, [k]: v })
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow mr-auto">KLD / Keyline</p>
        {groups.length > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-good-soft px-3 py-1 text-xs font-medium text-good">
            <CheckCircle2 size={14} /> KLD uploaded
          </span>
        ) : kld.later ? (
          <span className="flex items-center gap-1.5 rounded-full bg-warn-soft px-3 py-1 text-xs font-medium text-warn">
            <Clock3 size={14} /> KLD coming later
          </span>
        ) : (
          <span className="rounded-full border border-line px-3 py-1 text-xs text-ink-3">No KLD uploaded yet</span>
        )}
      </div>
      {groups.map((g) => (
        <FileGroup key={g[0]!.groupId} versions={g} canEdit={canEdit} actions={actions} onPreview={setPreview} replaceAccept={KLD_ACCEPT} />
      ))}
      {canEdit && (
        <DropZone id={`kld-${projectId}`} accept={KLD_ACCEPT} label={groups.length ? 'another KLD' : 'the KLD'} hint="PDF, AI, EPS, PSD, SVG or ZIP" busy={actions.busy === 'kld'} onFiles={(f) => actions.upload(f, 'kld')} multiple={false} />
      )}
      {canEdit && !groups.length && (
        <label className="flex items-center gap-2.5 text-sm text-ink-2">
          <input type="checkbox" checked={kld.later} onChange={(e) => set('later', e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Create KLD later. The project can go ahead without it for now.
        </label>
      )}
      {showInfo && (
        <details className="group rounded-2xl border border-line" open={Object.entries(kld).some(([k, v]) => k !== 'later' && v)}>
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            KLD information <ChevronDown size={16} className="text-ink-3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
            <Field label="KLD version">
              <input id="kld-version" className={inputCls} readOnly={!canEdit} value={kld.version} onChange={(e) => set('version', e.target.value)} placeholder="R3 from printer" />
            </Field>
            <Field label="KLD date">
              <input id="kld-date" type="date" className={inputCls} readOnly={!canEdit} value={kld.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="Dimensions">
              <input id="kld-dims" className={inputCls} readOnly={!canEdit} value={kld.dimensions} onChange={(e) => set('dimensions', e.target.value)} placeholder="Open size 250 × 360 mm" />
            </Field>
            <Field label="Printer / vendor">
              <input id="kld-vendor" className={inputCls} readOnly={!canEdit} value={kld.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="Printer name" />
            </Field>
            <Field label="Number of colours">
              <input id="kld-colors" className={inputCls} readOnly={!canEdit} value={kld.colors} onChange={(e) => set('colors', e.target.value)} placeholder="CMYK + 2 spot" />
            </Field>
            <Field label="Bleed">
              <input id="kld-bleed" className={inputCls} readOnly={!canEdit} value={kld.bleed} onChange={(e) => set('bleed', e.target.value)} placeholder="3 mm" />
            </Field>
            <Field label="Safety area">
              <input id="kld-safety" className={inputCls} readOnly={!canEdit} value={kld.safety} onChange={(e) => set('safety', e.target.value)} placeholder="5 mm from trim and seals" />
            </Field>
            <Field label="Printing specifications">
              <input id="kld-specs" className={inputCls} readOnly={!canEdit} value={kld.specs} onChange={(e) => set('specs', e.target.value)} placeholder="Reverse print, white underlay" />
            </Field>
            <Field label="Special instructions" className="sm:col-span-2">
              <textarea id="kld-notes" className={textareaCls} readOnly={!canEdit} value={kld.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="Barcode zone, eye mark position, seal areas to keep clear…" />
            </Field>
          </div>
        </details>
      )}
      <FilePreview file={preview} onClose={() => setPreview(null)} />
    </div>
  )
}

/** Every project file by category, with drag-and-drop upload and version history. */
export function FilesBoard({ projectId, files, update, canEdit, skip = [] }: { projectId: string; files: ProjectFile[]; update: FilesUpdater; canEdit: boolean; skip?: FileCategory[] }) {
  const actions = useFileActions(projectId, update)
  const [preview, setPreview] = useState<ProjectFile | null>(null)
  const cats = FILE_CATEGORIES.filter((c) => !skip.includes(c.id))
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {cats.map((c) => {
        const groups = fileGroups(files, c.id)
        if (!canEdit && !groups.length) return null
        return (
          <section key={c.id} className="flex flex-col gap-2 rounded-[22px] border border-line p-3" aria-label={c.label}>
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h3 className="text-sm font-medium">{c.label}</h3>
              <span className="text-xs text-ink-3">{groups.length ? `${groups.length} ${groups.length === 1 ? 'file' : 'files'}` : c.hint}</span>
            </div>
            {groups.map((g) => (
              <FileGroup key={g[0]!.groupId} versions={g} canEdit={canEdit} actions={actions} onPreview={setPreview} replaceAccept={c.id === 'kld' ? KLD_ACCEPT : undefined} />
            ))}
            {canEdit && <DropZone compact id={`fb-${projectId}-${c.id}`} accept={c.id === 'kld' ? KLD_ACCEPT : undefined} label={categoryLabel(c.id).toLowerCase()} busy={actions.busy === c.id} onFiles={(f) => actions.upload(f, c.id)} />}
          </section>
        )
      })}
      <FilePreview file={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
