import { useMemo } from 'react'
import {
  endOfWeek,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useStore } from './store'
import type { ID, Project, Role, Status, StatusKind, Task, TimeEntry } from './types'
import { daysUntil, parseDay } from './utils'

export function useLookups() {
  const statuses = useStore((s) => s.statuses)
  const clients = useStore((s) => s.clients)
  const members = useStore((s) => s.members)
  const projects = useStore((s) => s.projects)
  return useMemo(
    () => ({
      status: new Map(statuses.map((x) => [x.id, x])),
      client: new Map(clients.map((x) => [x.id, x])),
      member: new Map(members.map((x) => [x.id, x])),
      project: new Map(projects.map((x) => [x.id, x])),
    }),
    [statuses, clients, members, projects],
  )
}

export const kindOf = (statuses: Status[], id: ID): StatusKind => statuses.find((s) => s.id === id)?.kind ?? 'active'
export const isClosedKind = (k: StatusKind) => k === 'done' || k === 'archived' || k === 'approved'
export const isFinishedKind = (k: StatusKind) => k === 'done' || k === 'archived'

export function useCurrentUser() {
  const id = useStore((s) => s.settings.currentUserId)
  const members = useStore((s) => s.members)
  return members.find((m) => m.id === id) ?? members[0]!
}

type Action = 'edit' | 'delete' | 'comment' | 'approve' | 'manageTeam' | 'settings'
const permissions: Record<Role, Action[]> = {
  Owner: ['edit', 'delete', 'comment', 'approve', 'manageTeam', 'settings'],
  Admin: ['edit', 'delete', 'comment', 'approve', 'manageTeam', 'settings'],
  Designer: ['edit', 'comment'],
  Reviewer: ['comment', 'approve'],
  Viewer: [],
}
export const roleCan = (role: Role, a: Action) => permissions[role].includes(a)
export function useCan() {
  const me = useCurrentUser()
  return (a: Action) => roleCan(me.role, a)
}

export const ROLE_INFO: Record<Role, string> = {
  Owner: 'Full control, including billing and deleting the workspace.',
  Admin: 'Manage people, clients, statuses and every project.',
  Designer: 'Create and edit projects and tasks, track time, comment.',
  Reviewer: 'Comment on work and approve or request revisions.',
  Viewer: 'See everything, change nothing. Good for clients and producers.',
}

export const entryMs = (e: TimeEntry) => e.end - e.start

export function projectProgress(tasks: Task[], statuses: Status[]) {
  if (!tasks.length) return 0
  const done = tasks.filter((t) => isClosedKind(kindOf(statuses, t.statusId))).length
  return done / tasks.length
}

/* ---------- Smart filters ---------- */

export interface ProjectFilter {
  id: string
  label: string
  test: (p: Project, ctx: { statuses: Status[]; me: ID }) => boolean
}

const inThisWeek = (d: string) => {
  const now = new Date()
  return isWithinInterval(parseDay(d), { start: startOfDay(now), end: endOfWeek(now, { weekStartsOn: 1 }) })
}

export const PROJECT_FILTERS: ProjectFilter[] = [
  { id: 'all', label: 'All open', test: (p, c) => !isFinishedKind(kindOf(c.statuses, p.statusId)) },
  { id: 'mine', label: 'My active projects', test: (p, c) => p.memberIds.includes(c.me) && !isClosedKind(kindOf(c.statuses, p.statusId)) },
  { id: 'week', label: 'Due this week', test: (p, c) => !isFinishedKind(kindOf(c.statuses, p.statusId)) && (inThisWeek(p.deadline) || daysUntil(p.deadline) < 0) },
  { id: 'approval', label: 'Waiting for approval', test: (p, c) => kindOf(c.statuses, p.statusId) === 'review' },
  { id: 'month', label: 'Completed this month', test: (p) => !!p.completedAt && isSameMonth(new Date(p.completedAt), new Date()) },
  { id: 'high', label: 'High priority', test: (p, c) => (p.priority === 'high' || p.priority === 'urgent') && !isFinishedKind(kindOf(c.statuses, p.statusId)) },
  { id: 'everything', label: 'Everything', test: () => true },
]

export interface TaskFilter {
  id: string
  label: string
  test: (t: Task, ctx: { statuses: Status[]; me: ID }) => boolean
}

export const TASK_FILTERS: TaskFilter[] = [
  { id: 'open', label: 'All open', test: (t, c) => !isClosedKind(kindOf(c.statuses, t.statusId)) },
  { id: 'mine', label: 'Assigned to me', test: (t, c) => t.assigneeId === c.me && !isClosedKind(kindOf(c.statuses, t.statusId)) },
  { id: 'today', label: 'Due today', test: (t, c) => !!t.deadline && daysUntil(t.deadline) === 0 && !isClosedKind(kindOf(c.statuses, t.statusId)) },
  { id: 'week', label: 'Due this week', test: (t, c) => !!t.deadline && inThisWeek(t.deadline) && !isClosedKind(kindOf(c.statuses, t.statusId)) },
  { id: 'overdue', label: 'Overdue', test: (t, c) => !!t.deadline && daysUntil(t.deadline) < 0 && !isClosedKind(kindOf(c.statuses, t.statusId)) },
  { id: 'review', label: 'In review', test: (t, c) => kindOf(c.statuses, t.statusId) === 'review' },
  { id: 'high', label: 'High priority', test: (t, c) => (t.priority === 'high' || t.priority === 'urgent') && !isClosedKind(kindOf(c.statuses, t.statusId)) },
  { id: 'all', label: 'Everything', test: () => true },
]

/* ---------- Time ---------- */

export function sumMs(entries: TimeEntry[], from?: Date, to?: Date) {
  return entries.reduce((acc, e) => {
    if (from && e.end < from.getTime()) return acc
    if (to && e.start > to.getTime()) return acc
    const s = from ? Math.max(e.start, from.getTime()) : e.start
    const en = to ? Math.min(e.end, to.getTime()) : e.end
    return acc + Math.max(0, en - s)
  }, 0)
}

export function timeWindows(weekStartsOn: 0 | 1 = 1) {
  const now = new Date()
  return {
    today: startOfDay(now),
    week: startOfWeek(now, { weekStartsOn }),
    month: startOfMonth(now),
  }
}
