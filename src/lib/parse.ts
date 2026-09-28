import { addDays, addMonths, endOfMonth, endOfWeek, setDate, setMonth } from 'date-fns'
import type { Client, Priority, Project } from './types'
import { toISODate } from './utils'

export interface Capture {
  title: string
  quantity: number | null
  deadline: string | null
  deadlineText: string | null
  priority: Priority
  tags: string[]
  clientName: string | null
  clientId: string | null
  projectId: string | null
  type: string
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const WD_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const TYPE_HINTS: [RegExp, string][] = [
  [/instagram|social|tiktok|reel|story|stories|linkedin|post/i, 'Social Media'],
  [/pack(aging|shot)?|label|dieline|box|pouch|bottle/i, 'Packaging'],
  [/logo|brand|identity|wordmark|guidelines/i, 'Branding'],
  [/landing|website|web ?page|homepage|site/i, 'Web Design'],
  [/app|ui|ux|wireframe|prototype|flow|dashboard/i, 'UI/UX'],
  [/illustrat|drawing|sketch|mascot|icon set/i, 'Illustration'],
  [/motion|animat|video|lottie|reel|film/i, 'Motion'],
  [/deck|presentation|pitch|slides/i, 'Presentation'],
  [/poster|flyer|brochure|print|catalog|magazine|signage/i, 'Print'],
  [/campaign|key ?visual|banner|ad(s|vert)?\b/i, 'Campaign'],
]

const DATE_WORD =
  '(?:today|tonight|tomorrow|tmrw|eod|end of (?:the )?week|end of (?:the )?month|next week|next month|this weekend|' +
  `(?:next |this )?(?:${WEEKDAYS.join('|')}|${WD_SHORT.join('|')})|in \\d+ (?:days?|weeks?)|` +
  `\\d{1,2}(?:st|nd|rd|th)? (?:${MONTHS.join('|')})[a-z]*|(?:${MONTHS.join('|')})[a-z]* \\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}[/.]\\d{1,2})`

function resolveDate(raw: string, now: Date): Date | null {
  const s = raw.toLowerCase().trim()
  if (s === 'today' || s === 'tonight' || s === 'eod') return now
  if (s === 'tomorrow' || s === 'tmrw') return addDays(now, 1)
  if (/end of (the )?week|this weekend/.test(s)) return endOfWeek(now, { weekStartsOn: 1 })
  if (/end of (the )?month/.test(s)) return endOfMonth(now)
  if (s === 'next week') return addDays(now, 7)
  if (s === 'next month') return addMonths(now, 1)
  let m = s.match(/^in (\d+) (days?|weeks?)$/)
  if (m) return addDays(now, Number(m[1]) * (m[2]!.startsWith('week') ? 7 : 1))
  m = s.match(/^(next |this )?([a-z]+)$/)
  if (m) {
    let idx = WEEKDAYS.indexOf(m[2]!)
    if (idx === -1) idx = WD_SHORT.indexOf(m[2]!)
    if (idx !== -1) {
      let diff = (idx - now.getDay() + 7) % 7
      if (m[1] === 'next ' && diff === 0) diff = 7
      return addDays(now, diff)
    }
  }
  const monthIndex = (w: string) => MONTHS.indexOf(w.slice(0, 3))
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)$/) ?? null
  let day: number | null = null
  let month: number | null = null
  if (m) {
    day = Number(m[1])
    month = monthIndex(m[2]!)
  } else if ((m = s.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?$/))) {
    day = Number(m[2])
    month = monthIndex(m[1]!)
  } else if ((m = s.match(/^(\d{1,2})[/.](\d{1,2})$/))) {
    // Day-first, the way most of the world writes dates.
    day = Number(m[1])
    month = Number(m[2]) - 1
  }
  if (day !== null && month !== null && month >= 0 && month < 12) {
    let d = setDate(setMonth(new Date(now), month), day)
    if (d < addDays(now, -1)) d = addMonths(d, 12)
    return d
  }
  return null
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function parseCapture(input: string, clients: Client[], projects: Project[], now = new Date()): Capture {
  let text = ` ${input.trim().replace(/[.。]+$/, '')} `

  const tags = Array.from(text.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map((m) => m[1]!.toLowerCase())
  text = text.replace(/#[\p{L}\p{N}_-]+/gu, ' ')

  let priority: Priority = 'medium'
  const bang = text.match(/!(urgent|high|medium|low)\b|!{1,3}/i)
  if (bang) {
    priority = bang[1] ? (bang[1].toLowerCase() as Priority) : bang[0].length >= 2 ? 'urgent' : 'high'
    text = text.replace(bang[0], ' ')
  }
  if (/\b(asap|urgent(ly)?|right away)\b/i.test(text)) {
    priority = 'urgent'
    text = text.replace(/\b(asap|urgent(ly)?|right away)\b/gi, ' ')
  } else if (/\b(important|high priority)\b/i.test(text)) {
    priority = 'high'
    text = text.replace(/\b(important|high priority)\b/gi, ' ')
  } else if (/\blow priority\b/i.test(text)) {
    priority = 'low'
    text = text.replace(/\blow priority\b/gi, ' ')
  }

  let deadline: Date | null = null
  let deadlineText: string | null = null
  const dateRe = new RegExp(`\\b(?:(?:by|due|on|before|until|for)\\s+)?(${DATE_WORD})\\b`, 'i')
  const dm = text.match(dateRe)
  if (dm) {
    const d = resolveDate(dm[1]!, now)
    if (d) {
      deadline = d
      deadlineText = dm[1]!
      text = text.replace(dm[0], ' ')
    }
  }

  // Client or project: "for <name>" / "with <name>" / "@name", or any known name mentioned anywhere.
  let clientId: string | null = null
  let clientName: string | null = null
  let projectId: string | null = null
  const lower = text.toLowerCase()
  const knownClient = [...clients].sort((a, b) => b.name.length - a.name.length).find((c) => lower.includes(c.name.toLowerCase()))
  const knownProject = [...projects].sort((a, b) => b.name.length - a.name.length).find((p) => lower.includes(p.name.toLowerCase()))
  if (knownProject) {
    projectId = knownProject.id
    clientId = knownProject.clientId
    text = text.replace(new RegExp(`\\b(?:for|in|on)?\\s*${escapeRe(knownProject.name)}`, 'i'), ' ')
  }
  if (knownClient) {
    clientId = knownClient.id
    clientName = knownClient.name
    text = text.replace(new RegExp(`\\b(?:for|with|from|@)?\\s*${escapeRe(knownClient.name)}`, 'i'), ' ')
  } else if (!clientId) {
    const fm = text.match(/\b(?:for|client:?)\s+([A-Z@][\p{L}\p{N}&'. -]*?)(?=\s*(?:,|$|\s(?:by|due|on|before|to|and|with)\b))/u) ?? text.match(/@([\p{L}\p{N}_-]+)/u)
    if (fm) {
      clientName = fm[1]!.replace(/^@/, '').trim()
      text = text.replace(fm[0], ' ')
    }
  }
  if (clientName && !clientId) {
    const c = clients.find((x) => x.name.toLowerCase() === clientName!.toLowerCase())
    if (c) clientId = c.id
  }
  if (clientId && !clientName) clientName = clients.find((c) => c.id === clientId)?.name ?? null

  text = text
    .replace(/^\s*(?:i\s+)?(?:need to|have to|must|should|gotta|remember to|todo:?|to do:?|please)\s+/i, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/[,;:\s]+$/, '')
    .trim()

  const qm = text.match(/\b(\d{1,3})\s+(?=[\p{L}])/u)
  const quantity = qm ? Number(qm[1]) : null
  const type = TYPE_HINTS.find(([re]) => re.test(input))?.[1] ?? 'Campaign'

  return {
    title: titleCase(text || 'Untitled task'),
    quantity,
    deadline: deadline ? toISODate(deadline) : null,
    deadlineText,
    priority,
    tags,
    clientName,
    clientId,
    projectId,
    type,
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const CAPTURE_EXAMPLES = [
  'Need to create 3 Instagram posts for iD Fresh by Friday',
  'Logo refinement for Nordlys Coffee tomorrow !urgent',
  'Packaging dieline for Sahara Botanics on 14 Oct #print',
  'Pitch deck for Aurora Hotels next week',
]
