import { endOfMonth, endOfYear, format, parseISO, startOfMonth, startOfYear, subMonths } from 'date-fns'
import type { Client, ID, Member, Project, ProjectFile, ReportRecord, Status, Task } from './types'
import { dimsText, fileGroups, isPackaging, latestKld, packSizeText } from './handoff'
import { toISODate } from './utils'

export interface Period {
  title: string
  from: string
  to: string
}

export const monthPeriod = (d: Date): Period => ({ title: format(d, 'MMMM yyyy'), from: toISODate(startOfMonth(d)), to: toISODate(endOfMonth(d)) })
export const previousMonth = (now = new Date()) => monthPeriod(subMonths(now, 1))
export const currentMonth = (now = new Date()) => monthPeriod(now)
export const yearPeriod = (year: number): Period => {
  const d = new Date(year, 0, 1)
  return { title: String(year), from: toISODate(startOfYear(d)), to: toISODate(endOfYear(d)) }
}
export function customPeriod(from: string, to: string): Period {
  const a = parseISO(from)
  const b = parseISO(to)
  const title = format(a, 'yyyy') === format(b, 'yyyy') ? `${format(a, 'd MMM')} – ${format(b, 'd MMM yyyy')}` : `${format(a, 'd MMM yyyy')} – ${format(b, 'd MMM yyyy')}`
  return { title, from, to }
}

/** Month periods read as “September 2026”; anything else keeps its date range. */
export const isMonthTitle = (t: string) => /^[A-Z][a-z]+ \d{4}$/.test(t)

/** Completed or approved projects whose completion date falls inside the period. Archived work was completed too, so it counts. */
export function completedIn(projects: Project[], statuses: Status[], from: string, to: string) {
  const kind = (id: ID) => statuses.find((s) => s.id === id)?.kind
  return projects
    .filter((p) => {
      const k = kind(p.statusId)
      if (k !== 'done' && k !== 'approved' && k !== 'archived') return false
      const day = p.completedAt?.slice(0, 10)
      return !!day && day >= from && day <= to
    })
    .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))
}

export const isArtworkImage = (f: ProjectFile) => /^image\/(jpe?g|png)$/.test(f.mime) || /\.(jpe?g|png)$/i.test(f.name)
export const isFinalVersion = (v: string) => /^FINAL( APPROVED)?$/.test(v)

/**
 * The newest FINAL / FINAL APPROVED image of each file, FINAL APPROVED first.
 * Older versions of the same file are left out so the report shows only the latest artwork.
 */
export function finalArtwork(p: Project) {
  const out: ProjectFile[] = []
  for (const versions of fileGroups(p.files ?? [])) {
    const f = versions.find((v) => isFinalVersion(v.version) && isArtworkImage(v))
    if (f) out.push(f)
  }
  return out.sort((a, b) => Number(b.version === 'FINAL APPROVED') - Number(a.version === 'FINAL APPROVED') || b.at.localeCompare(a.at))
}

/** What goes in by default: every FINAL APPROVED image, or the FINAL ones when nothing is approved yet. */
export function defaultSelection(p: Project) {
  const all = finalArtwork(p)
  const approved = all.filter((f) => f.version === 'FINAL APPROVED')
  return (approved.length ? approved : all).map((f) => f.id)
}

export const designerOf = (p: Project) => p.leadId ?? p.memberIds[0] ?? null

export interface ReportProject {
  index: number
  project: Project
  name: string
  brand: string
  client: string
  product: string
  type: string
  designer: string
  designerId: ID | null
  completed: string
  deadline: string
  onTime: boolean
  packSize: string
  packDims: string
  kld: string
  status: string
  description: string
  deliverables: string[]
  notes: string
  images: ProjectFile[]
}

export interface ReportData extends Period {
  studio: string
  preparedBy: string
  projects: ReportProject[]
  designers: { id: ID; name: string; projects: number; deliverables: number }[]
  categories: { name: string; count: number }[]
  deliverables: number
  onTime: number
  finals: number
  pending: { name: string; deadline: string; status: string }[]
}

export function buildReportData(opts: {
  period: Period
  projects: Project[]
  allProjects: Project[]
  tasks: Task[]
  clients: Client[]
  members: Member[]
  statuses: Status[]
  studio: string
  selection: Record<ID, ID[]>
}): ReportData {
  const { period, projects, tasks, clients, members, statuses, selection } = opts
  const client = (id: ID | null) => clients.find((c) => c.id === id)
  const member = (id: ID | null) => members.find((m) => m.id === id)
  const status = (id: ID) => statuses.find((s) => s.id === id)
  const rows: ReportProject[] = projects.map((p, i) => {
    const designerId = designerOf(p)
    const ptasks = tasks.filter((t) => t.projectId === p.id)
    const kld = latestKld(p)
    const chosen = selection[p.id] ?? []
    const images = (p.files ?? []).filter((f) => chosen.includes(f.id)).sort((a, b) => chosen.indexOf(a.id) - chosen.indexOf(b.id))
    const completed = p.completedAt?.slice(0, 10) ?? ''
    return {
      index: i + 1,
      project: p,
      name: p.name,
      brand: client(p.clientId)?.name ?? 'Personal project',
      client: client(p.clientId)?.name ?? '',
      product: [packSizeText(p.pack), p.pack?.productName].filter(Boolean).join(' '),
      type: p.type,
      designer: member(designerId)?.name ?? '',
      designerId,
      completed,
      deadline: p.deadline,
      onTime: !!completed && completed <= p.deadline,
      packSize: packSizeText(p.pack),
      packDims: dimsText(p.pack),
      kld: kld ? `${kld.name} (${kld.version})` : isPackaging(p.type) ? (p.kld?.later ? 'Coming later' : 'Not uploaded') : '',
      status: status(p.statusId)?.name ?? '',
      description: (p.description || p.brief).trim(),
      deliverables: (ptasks.some((t) => t.completedAt) ? ptasks.filter((t) => t.completedAt) : ptasks).map((t) => t.title),
      notes: p.notes.trim(),
      images,
    }
  })
  const byDesigner = new Map<ID, { id: ID; name: string; projects: number; deliverables: number }>()
  for (const r of rows) {
    if (!r.designerId) continue
    const d = byDesigner.get(r.designerId) ?? { id: r.designerId, name: r.designer || 'Unknown', projects: 0, deliverables: 0 }
    d.projects++
    d.deliverables += Math.max(1, r.deliverables.length)
    byDesigner.set(r.designerId, d)
  }
  const cats = new Map<string, number>()
  for (const r of rows) cats.set(r.type, (cats.get(r.type) ?? 0) + 1)
  const closed = new Set(['done', 'approved', 'archived'])
  const pending = opts.allProjects
    .filter((p) => !closed.has(status(p.statusId)?.kind ?? '') && p.deadline <= period.to)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map((p) => ({ name: p.name, deadline: p.deadline, status: status(p.statusId)?.name ?? '' }))
  const designers = [...byDesigner.values()].sort((a, b) => b.projects - a.projects || b.deliverables - a.deliverables)
  return {
    ...period,
    studio: opts.studio,
    preparedBy: designers.length ? designers.map((d) => d.name.split(' ')[0]).join(', ') : opts.studio,
    projects: rows,
    designers,
    categories: [...cats.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    deliverables: rows.reduce((a, r) => a + Math.max(1, r.deliverables.length), 0),
    onTime: rows.filter((r) => r.onTime).length,
    finals: rows.reduce((a, r) => a + r.images.length, 0),
    pending,
  }
}

const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '')

export function reportFileBase(title: string) {
  return isMonthTitle(title) ? `Designly_Month_End_Report_${slug(title)}` : `Designly_Report_${slug(title)}`
}
export const zipFileName = (title: string) => `Designly_Report_${slug(title)}.zip`
export const artworkFileName = (r: ReportProject, n: number, of: number, ext: string) =>
  `Project_${String(r.index).padStart(2, '0')}_${slug(r.name).slice(0, 40)}_Final${of > 1 ? `_${String(n).padStart(2, '0')}` : ''}.${ext}`

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function reportCsv(d: ReportData) {
  const head = ['No.', 'Project', 'Brand', 'Client', 'Product', 'Project type', 'Designer', 'Completed', 'Deadline', 'On time', 'Pack size', 'Pack dimensions', 'KLD', 'Status', 'Final JPGs', 'Description', 'Key deliverables', 'Notes']
  const lines = d.projects.map((r) =>
    [r.index, r.name, r.brand, r.client, r.product, r.type, r.designer, r.completed, r.deadline, r.onTime ? 'Yes' : 'No', r.packSize, r.packDims, r.kld, r.status, r.images.map((f) => f.name).join('; '), r.description, r.deliverables.join('; '), r.notes].map(csvCell).join(','),
  )
  return '﻿' + [head.join(','), ...lines].join('\r\n')
}

export function recordFor(d: ReportData, selection: Record<ID, ID[]>, by: ID, id?: ID): Omit<ReportRecord, 'id'> & { id?: ID } {
  return {
    id,
    title: d.title,
    from: d.from,
    to: d.to,
    generatedAt: new Date().toISOString(),
    generatedBy: by,
    projectIds: d.projects.map((r) => r.project.id),
    images: Object.fromEntries(d.projects.map((r) => [r.project.id, selection[r.project.id] ?? []])),
    stats: { projects: d.projects.length, finals: d.finals, designers: d.designers.length, deliverables: d.deliverables },
  }
}
