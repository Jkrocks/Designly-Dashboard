import { format } from 'date-fns'
import type { FileCategory, KldInfo, Member, PackDetails, Project, ProjectFile, Task } from './types'
import { parseDay, priorityLabel } from './utils'

export const FILE_CATEGORIES: { id: FileCategory; label: string; hint: string }[] = [
  { id: 'brief', label: 'Creative brief', hint: 'The client’s brief or your written one' },
  { id: 'kld', label: 'KLD / Keyline', hint: 'Die line from the printer' },
  { id: 'brand', label: 'Brand guidelines', hint: 'Logos, colours, type rules' },
  { id: 'reference', label: 'Reference images', hint: 'Moodboards and inspiration' },
  { id: 'previous', label: 'Previous artwork', hint: 'The pack or design being replaced' },
  { id: 'copy', label: 'Copy document', hint: 'Text, claims, nutrition, legal' },
  { id: 'product', label: 'Product images', hint: 'Photos and renders' },
  { id: 'final', label: 'Final artwork', hint: 'Print-ready files' },
  { id: 'other', label: 'Other attachments', hint: 'Anything else' },
]
export const categoryLabel = (c: FileCategory) => FILE_CATEGORIES.find((x) => x.id === c)?.label ?? 'Other'

/** Categories whose files move through V1, V2 … FINAL APPROVED. */
export const VERSIONED: FileCategory[] = ['kld', 'final', 'previous', 'copy']
export const VERSION_LABELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'FINAL', 'FINAL APPROVED']

export const KLD_ACCEPT = '.pdf,.ai,.eps,.psd,.svg,.zip'

export const PACK_SIZES = ['200 g', '500 g', '1 kg', '250 ml', '500 ml', '1 L', '6-pack', '12-pack']
export const PACK_TYPES = ['Stand-up pouch', 'Flat pouch', 'Carton box', 'Bottle', 'Jar', 'Can', 'Tub', 'Sachet', 'Tray with sleeve', 'Label', 'Shipper box', 'Gift box']
export const PACK_MATERIALS = ['Laminated film (PET/PE)', 'Metallised film', 'Paperboard', 'Corrugated board', 'Kraft paper', 'Glass', 'PET plastic', 'HDPE plastic', 'Aluminium', 'Tin']
export const PRINT_PROCESSES = ['Rotogravure', 'Flexography', 'Offset', 'Digital', 'Screen']
export const FINISHES = ['Matte', 'Gloss', 'Soft-touch', 'Spot UV', 'Foil', 'Emboss / deboss', 'Window cut-out']
export const PACK_SIZE_HELP = 'Pack Size is the quantity of product inside the pack, for example 500 g, 1 kg, 250 ml or 6 pieces.'

export const emptyPack = (): PackDetails => ({
  productName: '', category: '', packType: '', packSize: '', customSize: '', width: '', height: '', depth: '', unit: 'mm',
  material: '', variants: '', sku: '', barcode: '', printing: '', finishing: '', languages: '',
})

export const emptyKld = (): KldInfo => ({ later: false, version: '', date: '', dimensions: '', vendor: '', specs: '', colors: '', bleed: '', safety: '', instructions: '' })

/** Packaging-style work gets the pack and KLD steps. */
export const isPackaging = (type: string) => /pack|label|box|pouch/i.test(type)

export function packSizeText(pack?: PackDetails) {
  if (!pack) return ''
  return [pack.packSize, pack.customSize].filter(Boolean).join(' · ')
}

export function dimsText(pack?: PackDetails) {
  if (!pack) return ''
  const parts = [pack.width, pack.height, pack.depth].map((x) => x.trim()).filter(Boolean)
  return parts.length ? `${parts.join(' × ')} ${pack.unit}` : ''
}

export function fmtBytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1e3))} KB`
}

export function fileExt(name: string) {
  const m = name.match(/\.([a-z0-9]+)$/i)
  return m ? m[1]!.toUpperCase() : 'FILE'
}

/** Newest version first, grouped by logical file. */
export function fileGroups(files: ProjectFile[], category?: FileCategory) {
  const map = new Map<string, ProjectFile[]>()
  for (const f of files) {
    if (category && f.category !== category) continue
    map.set(f.groupId, [...(map.get(f.groupId) ?? []), f])
  }
  return [...map.values()].map((v) => v.sort((a, b) => b.at.localeCompare(a.at))).sort((a, b) => b[0]!.at.localeCompare(a[0]!.at))
}

export function nextVersion(versions: ProjectFile[]) {
  const nums = versions.map((v) => /^V(\d+)$/.exec(v.version)?.[1]).filter(Boolean).map(Number)
  return `V${(nums.length ? Math.max(...nums) : versions.length) + 1}`
}

export const latestKld = (p: Pick<Project, 'files'>) => fileGroups(p.files ?? [], 'kld')[0]?.[0]

export type Step = 'basics' | 'brief' | 'pack' | 'kld' | 'files' | 'assign'

export interface ReadyItem {
  label: string
  done: boolean
  step: Step
  /** Shown as a warning when missing. */
  important?: boolean
  /** Missing, but the owner chose to continue without it. */
  deferred?: boolean
}

export function readiness(p: Partial<Project>): { pct: number; items: ReadyItem[]; missing: ReadyItem[] } {
  const files = p.files ?? []
  const has = (c: FileCategory) => files.some((f) => f.category === c)
  const pack = p.pack
  const items: ReadyItem[] = [
    { label: 'Add project name', done: !!p.name?.trim(), step: 'basics' },
    { label: 'Choose the client or brand', done: !!p.clientId, step: 'basics' },
    { label: 'Set the deadline', done: !!p.deadline, step: 'basics' },
    { label: 'Add a description', done: !!p.description?.trim(), step: 'brief' },
    { label: 'Write the creative brief', done: !!p.brief?.trim() || has('brief'), step: 'brief', important: true },
    { label: 'Assign a designer', done: !!p.leadId, step: 'assign', important: true },
  ]
  if (isPackaging(p.type ?? '')) {
    items.push(
      { label: 'Add product name', done: !!pack?.productName.trim(), step: 'pack' },
      { label: 'Choose pack type', done: !!pack?.packType.trim(), step: 'pack' },
      { label: 'Add pack size', done: !!packSizeText(pack), step: 'pack', important: true },
      { label: 'Add pack dimensions', done: !!dimsText(pack), step: 'pack' },
      { label: 'Choose pack material', done: !!pack?.material.trim(), step: 'pack' },
      { label: 'Upload KLD', done: has('kld'), step: 'kld', important: true, deferred: !has('kld') && !!p.kld?.later },
      { label: 'Add brand guidelines', done: has('brand'), step: 'files' },
    )
  }
  const done = items.filter((i) => i.done).length
  return { pct: Math.round((done / items.length) * 100), items, missing: items.filter((i) => !i.done) }
}

export interface EmailContext {
  project: Project
  clientName?: string
  designer?: Member | null
  tasks: Task[]
  kldUrl?: string | null
  projectUrl: string
}

export function projectEmail({ project: p, clientName, designer, tasks, kldUrl, projectUrl }: EmailContext) {
  const pack = p.pack
  const kld = latestKld(p)
  const lines: string[] = []
  const add = (label: string, value?: string | null) => value && lines.push(`${label}:\n${value}\n`)
  if (designer) lines.push(`Hi ${designer.name.split(' ')[0]},\n\nYou’ve been assigned a new project. Everything you need is below.\n`)
  add('PROJECT', p.name)
  add('CLIENT', clientName)
  if (pack?.productName) add('PRODUCT', pack.productName)
  if (pack?.packType) add('PACK', pack.packType)
  add('PACK SIZE', packSizeText(pack))
  add('PACK DIMENSIONS', dimsText(pack))
  if (pack?.material) add('MATERIAL', pack.material)
  if (isPackaging(p.type)) add('KLD', kld ? `${kld.name} (${kld.version})${kldUrl ? `\n${kldUrl}` : ' · open the project to view'}` : p.kld?.later ? 'Coming later' : 'Not uploaded yet')
  add('DEADLINE', p.deadline ? format(parseDay(p.deadline), 'd MMM yyyy') : '')
  add('PRIORITY', priorityLabel[p.priority])
  const brief = (p.brief || p.description).trim()
  add('BRIEF', brief.length > 600 ? `${brief.slice(0, 600)}…` : brief)
  const open = tasks.filter((t) => !t.completedAt)
  if (open.length) add('TASKS', open.map((t) => `• ${t.title}`).join('\n'))
  lines.push(`OPEN PROJECT:\n${projectUrl}`)
  return {
    subject: `New project: ${p.name}${pack?.productName ? ` · ${pack.productName}` : ''}`,
    body: lines.join('\n'),
  }
}
