import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isThisWeek,
  isToday,
  isTomorrow,
  parseISO,
} from 'date-fns'
import type { Priority } from './types'

export const cn = (...v: ClassValue[]) => twMerge(clsx(v))

let counter = 0
export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd')
export const todayISO = () => toISODate(new Date())
export const parseDay = (s: string) => parseISO(s)

export function daysUntil(date: string) {
  return differenceInCalendarDays(parseDay(date), new Date())
}

/** Friendly relative label for a due date: "Today", "Tomorrow", "Fri", "3d late". */
export function dueLabel(date: string | null | undefined) {
  if (!date) return 'No date'
  const d = parseDay(date)
  const diff = daysUntil(date)
  if (diff < 0) return diff === -1 ? 'Yesterday' : `${-diff}d overdue`
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (diff < 7 && isThisWeek(d, { weekStartsOn: 1 })) return format(d, 'EEEE')
  return format(d, 'd MMM')
}

export function dueTone(date: string | null | undefined): 'bad' | 'warn' | 'neutral' {
  if (!date) return 'neutral'
  const diff = daysUntil(date)
  if (diff < 0) return 'bad'
  if (diff <= 2) return 'warn'
  return 'neutral'
}

export const fmtDate = (s: string | null | undefined, pattern = 'd MMM yyyy') => (s ? format(parseDay(s), pattern) : '—')
export const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true })

export function fmtHours(ms: number, short = false) {
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (short) return h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export const hoursOf = (ms: number) => Math.round((ms / 3600000) * 10) / 10

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 5) return 'Working late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Working late'
}

export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']
export const priorityLabel: Record<Priority, string> = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }
export const priorityRank: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

/** Soft identity color from a hue; works on both themes. */
export const hueBg = (hue: number, dark = false) => (dark ? `oklch(0.32 0.06 ${hue})` : `oklch(0.93 0.045 ${hue})`)
export const hueFg = (hue: number, dark = false) => (dark ? `oklch(0.86 0.09 ${hue})` : `oklch(0.42 0.12 ${hue})`)
export const hueSolid = (hue: number) => `oklch(0.64 0.14 ${hue})`

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function safeStorage(): Storage | undefined {
  try {
    const s = window.localStorage
    const k = '__df_probe'
    s.setItem(k, '1')
    s.removeItem(k)
    return s
  } catch {
    return undefined
  }
}

/**
 * Links typed by teammates open only as web or email links. Anything else (javascript:, data:, …)
 * is dropped, and a bare "figma.com/…" becomes https.
 */
export function safeHref(url: string | null | undefined) {
  const v = (url ?? '').trim()
  if (!v) return undefined
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return undefined
  return `https://${v.replace(/^\/+/, '')}`
}
