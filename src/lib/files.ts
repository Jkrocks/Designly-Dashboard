import { cloudEnabled, supabase, useCloud } from './cloud'
import type { FileCategory, ProjectFile } from './types'
import { uid } from './utils'

const BUCKET = 'project-files'
/** Without cloud storage files live in this browser, so keep them small. */
const LOCAL_LIMIT = 3e6

const safeName = (name: string) => name.replace(/[^\w.\-]+/g, '_').slice(-120)

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export async function uploadProjectFile(opts: { projectId: string; file: File; category: FileCategory; groupId?: string; version: string; uploadedBy: string }): Promise<ProjectFile> {
  const { projectId, file, category, version, uploadedBy } = opts
  const id = uid('pf')
  const base: ProjectFile = {
    id,
    groupId: opts.groupId ?? id,
    category,
    name: file.name,
    mime: file.type,
    bytes: file.size,
    uploadedBy,
    at: new Date().toISOString(),
    version,
  }
  if (cloudEnabled) {
    const ws = useCloud.getState().workspace
    if (!ws) throw new Error('Open a studio before uploading files.')
    const path = `${ws.id}/${projectId}/${id}-${safeName(file.name)}`
    const { error } = await supabase!.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
    if (error) {
      if (/bucket not found/i.test(error.message)) throw new Error('File storage isn’t set up yet. Run the latest supabase/schema.sql in Supabase → SQL Editor, then try again.')
      if (/row-level security|unauthorized|403/i.test(error.message)) throw new Error('Your role can’t upload files to this studio.')
      if (/exceeded|too large|413/i.test(error.message)) throw new Error(`${file.name} is larger than your storage plan allows (50 MB per file on the free plan).`)
      throw error
    }
    return { ...base, path }
  }
  if (file.size > LOCAL_LIMIT) throw new Error(`${file.name} is too big to keep in this browser. Files up to 3 MB work here; sign in to cloud storage for larger ones.`)
  return { ...base, dataUrl: await readAsDataUrl(file) }
}

/** A short-lived link to view or download a file. */
export async function fileUrl(f: ProjectFile, opts: { download?: boolean; expiresIn?: number } = {}) {
  // Only real file data, never a script or web page someone slipped into a shared record.
  if (f.dataUrl) return /^data:(?!text\/html)[\w.+-]+\/[\w.+-]+[;,]/i.test(f.dataUrl) ? f.dataUrl : null
  if (!f.path || !supabase) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, opts.expiresIn ?? 3600, opts.download ? { download: f.name } : undefined)
  if (error) throw error
  return data.signedUrl
}

export async function downloadFile(f: ProjectFile) {
  const url = await fileUrl(f, { download: true })
  if (!url) throw new Error('This file has no stored copy to download.')
  const a = document.createElement('a')
  a.href = url
  a.download = f.name
  a.rel = 'noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function deleteStoredFile(f: ProjectFile) {
  if (f.path && supabase) {
    const { error } = await supabase.storage.from(BUCKET).remove([f.path])
    if (error) throw error
  }
}

export const canPreview = (f: ProjectFile) => /^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(f.mime) || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name) || f.mime === 'application/pdf' || /\.pdf$/i.test(f.name)
export const isPdf = (f: ProjectFile) => f.mime === 'application/pdf' || /\.pdf$/i.test(f.name)
