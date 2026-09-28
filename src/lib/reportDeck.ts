import { format, parseISO } from 'date-fns'
import logoMark from '../assets/logo-mark.png'
import { fileUrl } from './files'
import type { ProjectFile } from './types'
import { artworkFileName, isMonthTitle, reportCsv, reportFileBase, zipFileName, type ReportData, type ReportProject } from './report'

/* ---------- Layout model shared by the PowerPoint and PDF renderers (inches, 16:9) ---------- */

const W = 13.333
const H = 7.5
const M = 0.7

const C = {
  paper: '#F5F5F0',
  card: '#FFFFFF',
  ink: '#111111',
  muted: '#76766F',
  line: '#DEDED6',
  well: '#E9E9E2',
  dark: '#0B0B0B',
  darkMuted: '#8A8A84',
  accent: '#C8EC2C',
  accentInk: '#5A7000',
}

type Box = { x: number; y: number; w: number; h: number }
type TextEl = { t: 'text'; text: string; size: number; color: string; bold?: boolean; align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' | 'bottom'; spacing?: number; lineH?: number } & Box
type RectEl = { t: 'rect'; fill: string; radius?: number } & Box
type ImageEl = { t: 'image'; data: string } & Box
type El = TextEl | RectEl | ImageEl
interface Slide {
  bg: string
  els: El[]
}

export interface Artwork {
  file: ProjectFile
  /** JPEG data URL sized for slides. */
  data: string
  w: number
  h: number
  /** The original upload, for the ZIP. */
  blob: Blob
}

const text = (s: string, box: Box, size: number, color: string, o: Partial<TextEl> = {}): TextEl => ({ t: 'text', text: s, size, color, ...box, ...o })
const rect = (box: Box, fill: string, radius = 0): RectEl => ({ t: 'rect', fill, radius, ...box })
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const day = (iso: string, p = 'd MMM yyyy') => (iso ? format(parseISO(iso), p) : '—')

/** Fit an image inside a box without cropping or stretching. */
function contain(a: Artwork, b: Box): ImageEl {
  const s = Math.min(b.w / a.w, b.h / a.h)
  const w = a.w * s
  const h = a.h * s
  return { t: 'image', data: a.data, x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h }
}

function footer(d: ReportData, n: number): El[] {
  return [
    rect({ x: M, y: H - 0.55, w: W - 2 * M, h: 0.008 }, C.line),
    text(`Designly  ·  ${d.title} Design Report`, { x: M, y: H - 0.45, w: 7, h: 0.25 }, 8.5, C.muted),
    text(String(n).padStart(2, '0'), { x: W - M - 1, y: H - 0.45, w: 1, h: 0.25 }, 8.5, C.muted, { align: 'right' }),
  ]
}

function header(eyebrow: string, title: string): El[] {
  return [
    rect({ x: M, y: 0.62, w: 0.36, h: 0.05 }, C.accentInk),
    text(eyebrow.toUpperCase(), { x: M, y: 0.78, w: 8, h: 0.25 }, 9.5, C.muted, { bold: true, spacing: 2.5 }),
    text(title, { x: M, y: 1.05, w: W - 2 * M, h: 0.7 }, 30, C.ink, { bold: true }),
  ]
}

function coverSlide(d: ReportData, logo: Artwork | null): Slide {
  const month = isMonthTitle(d.title)
  const big = d.title.toUpperCase()
  return {
    bg: C.dark,
    els: [
      ...(logo ? [contain(logo, { x: M, y: 0.6, w: 0.5, h: 0.5 })] : []),
      text('Designly', { x: M + 0.65, y: 0.6, w: 4, h: 0.5 }, 16, '#FFFFFF', { bold: true, valign: 'middle' }),
      text(`${day(d.from, 'd MMM')} – ${day(d.to)}`, { x: W - M - 4, y: 0.6, w: 4, h: 0.5 }, 11, C.darkMuted, { align: 'right', valign: 'middle' }),
      rect({ x: M, y: 2.25, w: 0.6, h: 0.07 }, C.accent),
      text(month ? 'MONTH-END DESIGN REPORT' : 'DESIGN REPORT', { x: M, y: 2.5, w: 9, h: 0.35 }, 12, C.accent, { bold: true, spacing: 4 }),
      text(big, { x: M - 0.04, y: 2.95, w: W - 2 * M, h: 1.25 }, big.length > 16 ? 50 : 72, '#FFFFFF', { bold: true }),
      text('DESIGN REPORT', { x: M - 0.04, y: 4.15, w: W - 2 * M, h: 1.2 }, 72, '#3A3A37', { bold: true }),
      rect({ x: M, y: 6.05, w: W - 2 * M, h: 0.008 }, '#2A2A27'),
      text('PREPARED BY', { x: M, y: 6.25, w: 3, h: 0.25 }, 9, C.darkMuted, { bold: true, spacing: 2 }),
      text(clip(`${d.studio}  ·  ${d.preparedBy}`, 90), { x: M, y: 6.5, w: 9, h: 0.4 }, 14, '#FFFFFF'),
      text(`${d.projects.length} ${d.projects.length === 1 ? 'project' : 'projects'}`, { x: W - M - 3, y: 6.5, w: 3, h: 0.4 }, 14, '#FFFFFF', { align: 'right' }),
    ],
  }
}

function glanceSlide(d: ReportData, n: number): Slide {
  const stats: [string, string, string][] = [
    [String(d.projects.length), 'Projects completed', ''],
    [String(d.designers.length), d.designers.length === 1 ? 'Designer' : 'Designers', ''],
    [String(d.deliverables), 'Deliverables', ''],
    [`${d.onTime}/${d.projects.length}`, 'Completed on time', d.projects.length ? `${Math.round((d.onTime / d.projects.length) * 100)}%` : ''],
  ]
  const cw = (W - 2 * M - 3 * 0.25) / 4
  const els: El[] = [...header('Month at a glance', d.title)]
  stats.forEach(([v, l, extra], i) => {
    const x = M + i * (cw + 0.25)
    els.push(rect({ x, y: 2.0, w: cw, h: 1.95 }, i === 0 ? C.accent : C.card, 0.18))
    els.push(text(v, { x: x + 0.3, y: 2.2, w: cw - 0.6, h: 0.95 }, 50, C.ink, { bold: true }))
    els.push(text(l, { x: x + 0.3, y: 3.25, w: cw - 0.6, h: 0.3 }, 12, i === 0 ? C.ink : C.muted))
    if (extra) els.push(text(extra, { x: x + cw - 1.3, y: 2.25, w: 1, h: 0.3 }, 12, C.accentInk, { bold: true, align: 'right' }))
  })
  els.push(text('PROJECTS BY CATEGORY', { x: M, y: 4.35, w: 6, h: 0.25 }, 9.5, C.muted, { bold: true, spacing: 2.5 }))
  const cats = d.categories.length > 5 ? [...d.categories.slice(0, 4), { name: 'Other', count: d.categories.slice(4).reduce((a, c) => a + c.count, 0) }] : d.categories
  const max = Math.max(1, ...cats.map((c) => c.count))
  const barX = M + 2.4
  const barW = W - M - barX - 0.8
  cats.forEach((c, i) => {
    const y = 4.75 + i * 0.36
    els.push(text(c.name, { x: M, y, w: 2.3, h: 0.26 }, 12, C.ink, { valign: 'middle' }))
    els.push(rect({ x: barX, y: y + 0.04, w: barW, h: 0.18 }, C.well, 0.09))
    els.push(rect({ x: barX, y: y + 0.04, w: Math.max(0.18, (barW * c.count) / max), h: 0.18 }, i === 0 ? C.ink : C.accentInk, 0.09))
    els.push(text(String(c.count), { x: barX + barW + 0.1, y, w: 0.7, h: 0.26 }, 12, C.ink, { bold: true, align: 'right', valign: 'middle' }))
  })
  if (!cats.length) els.push(text('No completed projects in this period.', { x: M, y: 4.75, w: 8, h: 0.3 }, 12, C.muted))
  return { bg: C.paper, els: [...els, ...footer(d, n)] }
}

function indexSlides(d: ReportData, start: number): Slide[] {
  const cols: [string, number, (r: ReportProject) => string][] = [
    ['No.', 0.7, (r) => String(r.index).padStart(2, '0')],
    ['Project', 4.1, (r) => clip(r.name, 44)],
    ['Brand', 2.3, (r) => clip(r.brand, 24)],
    ['Designer', 1.9, (r) => clip(r.designer || '—', 20)],
    ['Type', 1.75, (r) => clip(r.type, 18)],
    ['Completed', 1.18, (r) => day(r.completed, 'd MMM')],
  ]
  const per = 11
  const pages: Slide[] = []
  for (let p = 0; p * per < Math.max(1, d.projects.length); p++) {
    const rows = d.projects.slice(p * per, (p + 1) * per)
    const els: El[] = [...header('Project index', p ? `${d.title} (continued)` : d.title)]
    let x = M
    const top = 2.0
    for (const [label, w] of cols) {
      els.push(text(label.toUpperCase(), { x, y: top, w, h: 0.3 }, 9, C.muted, { bold: true, spacing: 1.5 }))
      x += w
    }
    els.push(rect({ x: M, y: top + 0.36, w: W - 2 * M, h: 0.012 }, C.ink))
    rows.forEach((r, i) => {
      const y = top + 0.44 + i * 0.4
      let cx = M
      cols.forEach(([, w, get], ci) => {
        els.push(text(get(r), { x: cx, y, w: w - 0.1, h: 0.32 }, 12, ci === 0 ? C.muted : C.ink, { bold: ci === 1, valign: 'middle' }))
        cx += w
      })
      els.push(rect({ x: M, y: y + 0.37, w: W - 2 * M, h: 0.006 }, C.line))
    })
    if (!rows.length) els.push(text('No completed projects in this period.', { x: M, y: top + 0.5, w: 8, h: 0.3 }, 12, C.muted))
    pages.push({ bg: C.paper, els: [...els, ...footer(d, start + p)] })
  }
  return pages
}

/** Label / value pairs for the showcase side panel. */
function facts(r: ReportProject): [string, string][] {
  const f: [string, string][] = [
    ['Brand', r.brand],
    ['Project type', r.type],
    ['Designer', r.designer || '—'],
    ['Completed', day(r.completed)],
  ]
  if (r.product) f.push(['Product', r.product])
  if (r.packSize) f.push(['Pack size', r.packSize])
  if (r.packDims) f.push(['Pack dimensions', r.packDims])
  if (r.kld) f.push(['KLD', r.kld])
  return f.slice(0, 8)
}

function showcaseSlides(d: ReportData, r: ReportProject, art: Artwork[], start: number): Slide[] {
  const panelW = 3.95
  const well: Box = { x: M + panelW + 0.35, y: 0.6, w: W - M - (M + panelW + 0.35), h: H - 0.6 - 0.75 }
  const els: El[] = [
    rect({ x: M, y: 0.62, w: 0.36, h: 0.05 }, C.accentInk),
    text(`PROJECT ${String(r.index).padStart(2, '0')} / ${String(d.projects.length).padStart(2, '0')}`, { x: M, y: 0.78, w: panelW, h: 0.25 }, 9.5, C.muted, { bold: true, spacing: 2.5 }),
    text(clip(r.name, 60), { x: M, y: 1.08, w: panelW, h: 1.05 }, r.name.length > 30 ? 20 : 24, C.ink, { bold: true, lineH: 1.05 }),
  ]
  const f = facts(r)
  const colW = panelW / 2
  f.forEach(([label, value], i) => {
    const x = M + (i % 2) * colW
    const y = 2.3 + Math.floor(i / 2) * 0.66
    els.push(text(label.toUpperCase(), { x, y, w: colW - 0.1, h: 0.22 }, 8, C.muted, { bold: true, spacing: 1.5 }))
    els.push(text(clip(value, 30), { x, y: y + 0.22, w: colW - 0.1, h: 0.36 }, 11.5, C.ink))
  })
  let y = 2.3 + Math.ceil(f.length / 2) * 0.66 + 0.1
  if (r.description && y < 5.6) {
    els.push(text('BRIEF', { x: M, y, w: panelW, h: 0.22 }, 8, C.muted, { bold: true, spacing: 1.5 }))
    const room = Math.max(1, Math.floor((6.2 - y) / 0.2))
    els.push(text(clip(r.description, Math.min(320, room * 48)), { x: M, y: y + 0.24, w: panelW, h: Math.min(1.4, 6.3 - y - 0.3) }, 10.5, C.ink, { lineH: 1.2 }))
    y += 0.24 + Math.min(1.4, 6.3 - y - 0.3) + 0.1
  }
  if (r.deliverables.length && y < 6.1) {
    els.push(text('KEY DELIVERABLES', { x: M, y, w: panelW, h: 0.22 }, 8, C.muted, { bold: true, spacing: 1.5 }))
    els.push(text(clip(r.deliverables.slice(0, 5).join('  ·  '), 150), { x: M, y: y + 0.24, w: panelW, h: 6.75 - y - 0.3 }, 10, C.ink, { lineH: 1.2 }))
  }

  const slides: Slide[] = []
  const first = art.slice(0, 3)
  els.push(rect(well, C.well, 0.16))
  if (!first.length) {
    els.push(text('Final JPG missing', { ...well, y: well.y + well.h / 2 - 0.3, h: 0.35 }, 16, C.muted, { align: 'center', bold: true }))
    els.push(text('Upload a FINAL or FINAL APPROVED JPG to the project to show it here.', { ...well, y: well.y + well.h / 2 + 0.1, h: 0.3 }, 11, C.muted, { align: 'center' }))
  } else els.push(...gallery(first, well, art.length > 1))
  slides.push({ bg: C.paper, els: [...els, ...footer(d, start)] })

  // Anything beyond three pieces continues on extra slides, four at a time.
  for (let i = 3; i < art.length; i += 4) {
    const chunk = art.slice(i, i + 4)
    const box: Box = { x: M, y: 1.35, w: W - 2 * M, h: H - 1.35 - 0.75 }
    slides.push({
      bg: C.paper,
      els: [
        rect({ x: M, y: 0.62, w: 0.36, h: 0.05 }, C.accentInk),
        text(`PROJECT ${String(r.index).padStart(2, '0')}  ·  FINAL DESIGNS (CONTINUED)`, { x: M, y: 0.78, w: 9, h: 0.25 }, 9.5, C.muted, { bold: true, spacing: 2.5 }),
        text(clip(r.name, 70), { x: M, y: 0.98, w: W - 2 * M, h: 0.4 }, 18, C.ink, { bold: true }),
        ...gallery(chunk, box, true, i),
        ...footer(d, start + slides.length),
      ],
    })
  }
  return slides
}

/** One hero, two side by side, one large plus two stacked, or a 2×2 grid. Captions read FINAL 01, 02… */
function gallery(art: Artwork[], b: Box, captions: boolean, offset = 0): El[] {
  const g = 0.15
  let cells: Box[]
  if (art.length === 1) cells = [b]
  else if (art.length === 2) cells = [0, 1].map((i) => ({ x: b.x + i * ((b.w + g) / 2), y: b.y, w: (b.w - g) / 2, h: b.h }))
  else if (art.length === 3 && offset === 0)
    cells = [
      { x: b.x, y: b.y, w: b.w * 0.62 - g / 2, h: b.h },
      { x: b.x + b.w * 0.62 + g / 2, y: b.y, w: b.w * 0.38 - g / 2, h: (b.h - g) / 2 },
      { x: b.x + b.w * 0.62 + g / 2, y: b.y + (b.h + g) / 2, w: b.w * 0.38 - g / 2, h: (b.h - g) / 2 },
    ]
  else cells = [0, 1, 2, 3].slice(0, art.length).map((i) => ({ x: b.x + (i % 2) * ((b.w + g) / 2), y: b.y + Math.floor(i / 2) * ((b.h + g) / 2), w: (b.w - g) / 2, h: art.length > 2 ? (b.h - g) / 2 : b.h }))
  const els: El[] = []
  art.forEach((a, i) => {
    const c = cells[i]!
    if (art.length > 1) els.push(rect(c, C.well, 0.12))
    const pad = art.length > 1 ? 0.1 : 0
    els.push(contain(a, { x: c.x + pad, y: c.y + pad, w: c.w - 2 * pad, h: c.h - 2 * pad }))
    if (captions) {
      els.push(rect({ x: c.x + 0.14, y: c.y + 0.14, w: 0.95, h: 0.28 }, C.ink, 0.14))
      els.push(text(`FINAL ${String(offset + i + 1).padStart(2, '0')}`, { x: c.x + 0.14, y: c.y + 0.14, w: 0.95, h: 0.28 }, 8, '#FFFFFF', { bold: true, align: 'center', valign: 'middle', spacing: 1 }))
    }
  })
  return els
}

function designerSlide(d: ReportData, n: number): Slide {
  const els: El[] = [...header('Designer breakdown', d.title)]
  const list = d.designers.slice(0, 8)
  const cols = 4
  const cw = (W - 2 * M - (cols - 1) * 0.25) / cols
  list.forEach((m, i) => {
    const x = M + (i % cols) * (cw + 0.25)
    const y = 2.0 + Math.floor(i / cols) * 2.3
    els.push(rect({ x, y, w: cw, h: 2.05 }, i === 0 ? C.ink : C.card, 0.18))
    const fg = i === 0 ? '#FFFFFF' : C.ink
    const mu = i === 0 ? C.darkMuted : C.muted
    els.push(text(clip(m.name, 24), { x: x + 0.3, y: y + 0.25, w: cw - 0.6, h: 0.35 }, 15, fg, { bold: true }))
    els.push(text(String(m.projects), { x: x + 0.3, y: y + 0.75, w: 1.2, h: 0.7 }, 36, i === 0 ? C.accent : fg, { bold: true }))
    els.push(text(m.projects === 1 ? 'project' : 'projects', { x: x + 0.3, y: y + 1.45, w: 1.3, h: 0.3 }, 10.5, mu))
    els.push(text(String(m.deliverables), { x: x + cw / 2, y: y + 0.75, w: 1.2, h: 0.7 }, 36, fg, { bold: true }))
    els.push(text('deliverables', { x: x + cw / 2, y: y + 1.45, w: 1.4, h: 0.3 }, 10.5, mu))
  })
  return { bg: C.paper, els: [...els, ...footer(d, n)] }
}

function summarySlide(d: ReportData, n: number): Slide {
  const els: El[] = [...header('Month-end summary', d.title)]
  const colW = (W - 2 * M - 2 * 0.4) / 3
  const col = (i: number) => M + i * (colW + 0.4)
  // Column 1: counts
  els.push(rect({ x: col(0), y: 2.0, w: colW, h: 4.6 }, C.ink, 0.18))
  els.push(text('PROJECTS COMPLETED', { x: col(0) + 0.35, y: 2.3, w: colW - 0.7, h: 0.25 }, 9, C.darkMuted, { bold: true, spacing: 2 }))
  els.push(text(String(d.projects.length), { x: col(0) + 0.35, y: 2.55, w: colW - 0.7, h: 1.1 }, 64, C.accent, { bold: true }))
  const types = d.categories.slice(0, 6)
  types.forEach((c, i) => {
    const y = 3.95 + i * 0.4
    els.push(text(c.name, { x: col(0) + 0.35, y, w: colW - 1.3, h: 0.3 }, 12, '#FFFFFF', { valign: 'middle' }))
    els.push(text(String(c.count), { x: col(0) + colW - 1.0, y, w: 0.65, h: 0.3 }, 12, '#FFFFFF', { bold: true, align: 'right', valign: 'middle' }))
    els.push(rect({ x: col(0) + 0.35, y: y + 0.35, w: colW - 0.7, h: 0.006 }, '#2A2A27'))
  })
  const list = (x: number, y: number, title: string, rows: [string, string][], empty: string, max: number) => {
    els.push(text(title, { x, y, w: colW, h: 0.25 }, 9, C.muted, { bold: true, spacing: 2 }))
    if (!rows.length) els.push(text(empty, { x, y: y + 0.35, w: colW, h: 0.3 }, 11.5, C.muted))
    rows.slice(0, max).forEach(([a, b], i) => {
      const ry = y + 0.35 + i * 0.4
      els.push(text(clip(a, 34), { x, y: ry, w: colW - 1.1, h: 0.3 }, 12, C.ink, { valign: 'middle' }))
      els.push(text(b, { x: x + colW - 1.1, y: ry, w: 1.1, h: 0.3 }, 11, C.muted, { align: 'right', valign: 'middle' }))
      els.push(rect({ x, y: ry + 0.35, w: colW, h: 0.006 }, C.line))
    })
  }
  list(col(1), 2.0, 'MOST ACTIVE DESIGNERS', d.designers.map((m) => [m.name, `${m.projects} proj · ${m.deliverables} deliv`]), 'No designers assigned.', 4)
  list(col(1), 4.2, 'PENDING PROJECTS', d.pending.map((p) => [p.name, day(p.deadline, 'd MMM')]), 'Nothing overdue or due.', 4)
  list(col(2), 2.0, 'KEY DESIGN OUTPUTS', d.projects.map((r) => [r.name, r.type]), 'No completed projects.', 10)
  return { bg: C.paper, els: [...els, ...footer(d, n)] }
}

function buildSlides(d: ReportData, art: Map<string, Artwork[]>, logo: Artwork | null): Slide[] {
  const slides: Slide[] = [coverSlide(d, logo), glanceSlide(d, 2)]
  slides.push(...indexSlides(d, slides.length + 1))
  for (const r of d.projects) slides.push(...showcaseSlides(d, r, art.get(r.project.id) ?? [], slides.length + 1))
  if (d.designers.length > 1) slides.push(designerSlide(d, slides.length + 1))
  slides.push(summarySlide(d, slides.length + 1))
  return slides
}

/* ---------- Images ---------- */

const MAX_EDGE = 2400

function blobToDataUrl(b: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })
}

/** Keeps small JPGs as they are; larger or PNG artwork is re-encoded as a high-quality JPEG. */
async function prepare(blob: Blob, file: ProjectFile | null): Promise<Omit<Artwork, 'file'>> {
  const bmp = await createImageBitmap(blob)
  const { width, height } = bmp
  const jpeg = /jpe?g/.test(blob.type) || /\.jpe?g$/i.test(file?.name ?? '')
  if (jpeg && Math.max(width, height) <= MAX_EDGE && blob.size < 4e6) {
    bmp.close()
    return { data: await blobToDataUrl(blob), w: width, h: height, blob }
  }
  const s = Math.min(1, MAX_EDGE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * s)
  canvas.height = Math.round(height * s)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return { data: canvas.toDataURL('image/jpeg', 0.9), w: canvas.width, h: canvas.height, blob }
}

async function fetchBlob(f: ProjectFile) {
  const url = await fileUrl(f)
  if (!url) throw new Error(`${f.name} has no stored copy.`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Couldn’t load ${f.name}.`)
  return res.blob()
}

export async function loadArtwork(d: ReportData, onProgress?: (done: number, total: number) => void) {
  const all = d.projects.flatMap((r) => r.images.map((f) => ({ r, f })))
  const out = new Map<string, Artwork[]>()
  const failed: string[] = []
  let done = 0
  onProgress?.(0, all.length)
  await Promise.all(
    all.map(async ({ r, f }, i) => {
      try {
        const a = { file: f, ...(await prepare(await fetchBlob(f), f)) }
        const list = out.get(r.project.id) ?? []
        list[r.images.indexOf(f)] = a
        out.set(r.project.id, list)
      } catch {
        failed.push(`${r.name}: ${f.name}`)
      } finally {
        onProgress?.(++done, all.length)
      }
      return i
    }),
  )
  for (const [k, v] of out) out.set(k, v.filter(Boolean))
  let logo: Artwork | null = null
  try {
    const b = await (await fetch(logoMark)).blob()
    logo = { file: null as never, ...(await prepare(b, null)) }
    // The logo keeps its transparency as PNG.
    logo.data = await blobToDataUrl(b)
  } catch {
    logo = null
  }
  return { art: out, logo, failed }
}

/* ---------- Renderers ---------- */

const hex = (c: string) => c.replace('#', '')

export async function renderPptx(d: ReportData, art: Map<string, Artwork[]>, logo: Artwork | null): Promise<Blob> {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = `${d.title} Design Report`
  pptx.company = d.studio
  pptx.author = 'Designly'
  for (const s of buildSlides(d, art, logo)) {
    const slide = pptx.addSlide()
    slide.background = { color: hex(s.bg) }
    for (const e of s.els) {
      if (e.t === 'rect')
        slide.addShape(e.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, { x: e.x, y: e.y, w: e.w, h: e.h, fill: { color: hex(e.fill) }, line: { type: 'none' }, ...(e.radius ? { rectRadius: Math.min(e.radius, Math.min(e.w, e.h) / 2) } : {}) })
      else if (e.t === 'image') slide.addImage({ data: e.data.replace(/^data:/, ''), x: e.x, y: e.y, w: e.w, h: e.h })
      else
        slide.addText(e.text, {
          x: e.x,
          y: e.y,
          w: e.w,
          h: e.h,
          fontFace: 'Arial',
          fontSize: e.size,
          color: hex(e.color),
          bold: e.bold,
          align: e.align ?? 'left',
          valign: e.valign ?? 'top',
          charSpacing: e.spacing,
          lineSpacingMultiple: e.lineH ?? 1.1,
          margin: 0,
          fit: 'none',
        })
    }
  }
  return (await pptx.write({ outputType: 'blob' })) as Blob
}

export async function renderPdf(d: ReportData, art: Map<string, Artwork[]>, logo: Artwork | null): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: [W, H], compress: true })
  buildSlides(d, art, logo).forEach((s, i) => {
    if (i) doc.addPage([W, H], 'landscape')
    doc.setFillColor(s.bg)
    doc.rect(0, 0, W, H, 'F')
    for (const e of s.els) {
      if (e.t === 'rect') {
        doc.setFillColor(e.fill)
        if (e.radius) doc.roundedRect(e.x, e.y, e.w, e.h, Math.min(e.radius, e.h / 2), Math.min(e.radius, e.h / 2), 'F')
        else doc.rect(e.x, e.y, e.w, e.h, 'F')
      } else if (e.t === 'image') {
        const png = e.data.startsWith('data:image/png')
        doc.addImage(e.data, png ? 'PNG' : 'JPEG', e.x, e.y, e.w, e.h, undefined, 'FAST')
      } else {
        doc.setFont('helvetica', e.bold ? 'bold' : 'normal')
        doc.setFontSize(e.size)
        doc.setTextColor(e.color)
        doc.setCharSpace((e.spacing ?? 0) / 72)
        const lh = (e.size / 72) * (e.lineH ?? 1.15)
        const lines: string[] = doc.splitTextToSize(e.text, e.w)
        const fit = Math.max(1, Math.floor((e.h + 0.02) / lh))
        const shown = lines.slice(0, fit)
        const blockH = shown.length * lh
        const y = e.valign === 'middle' ? e.y + (e.h - blockH) / 2 : e.valign === 'bottom' ? e.y + e.h - blockH : e.y
        const x = e.align === 'center' ? e.x + e.w / 2 : e.align === 'right' ? e.x + e.w : e.x
        doc.text(shown, x, y, { baseline: 'top', align: e.align ?? 'left', lineHeightFactor: e.lineH ?? 1.15 })
      }
    }
    doc.setCharSpace(0)
  })
  return doc.output('blob')
}

export async function renderZip(d: ReportData, art: Map<string, Artwork[]>, pptx: Blob): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const finals = zip.folder('Final Designs')!
  for (const r of d.projects) {
    const list = art.get(r.project.id) ?? []
    list.forEach((a, i) => {
      const ext = /png/.test(a.blob.type) || /\.png$/i.test(a.file.name) ? 'png' : 'jpg'
      finals.file(artworkFileName(r, i + 1, list.length, ext), a.blob)
    })
  }
  zip.folder('Report')!.file(`${reportFileBase(d.title)}.pptx`, pptx)
  zip.folder('Report')!.file(`${reportFileBase(d.title)}_Data.csv`, reportCsv(d))
  return zip.generateAsync({ type: 'blob' })
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export const names = (title: string) => ({
  pptx: `${reportFileBase(title)}.pptx`,
  pdf: `${reportFileBase(title)}.pdf`,
  csv: `${reportFileBase(title)}_Data.csv`,
  zip: zipFileName(title),
})
