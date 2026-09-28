import { useMemo } from 'react'
import { useStore } from './store'
import type { AppNotification } from './types'
import { isClosedKind, kindOf } from './selectors'
import { daysUntil, dueLabel } from './utils'

/** Stored events (comments, reviews, assignments) plus live ones derived from deadlines. */
export function useNotifications() {
  const s = useStore()
  return useMemo(() => {
    const me = s.settings.currentUserId
    const derived: AppNotification[] = []
    const todayStamp = new Date()
    todayStamp.setHours(7, 0, 0, 0)
    for (const t of s.tasks) {
      if (!t.deadline || isClosedKind(kindOf(s.statuses, t.statusId))) continue
      const mine = t.assigneeId === me || s.projects.find((p) => p.id === t.projectId)?.memberIds.includes(me)
      if (!mine) continue
      const d = daysUntil(t.deadline)
      const project = s.projects.find((p) => p.id === t.projectId)
      if (d < 0) derived.push({ id: `od_${t.id}_${t.deadline}`, kind: 'overdue', title: 'Overdue task', body: `“${t.title}” in ${project?.name ?? 'a project'} is ${dueLabel(t.deadline).toLowerCase()}.`, at: todayStamp.toISOString(), taskId: t.id, projectId: t.projectId })
      else if (d <= 1) derived.push({ id: `dl_${t.id}_${t.deadline}`, kind: 'deadline', title: d === 0 ? 'Due today' : 'Due tomorrow', body: `“${t.title}” for ${project?.name ?? 'a project'}.`, at: todayStamp.toISOString(), taskId: t.id, projectId: t.projectId })
    }
    for (const p of s.projects) {
      if (isClosedKind(kindOf(s.statuses, p.statusId)) || !p.memberIds.includes(me)) continue
      const d = daysUntil(p.deadline)
      if (d >= 0 && d <= 3) derived.push({ id: `pd_${p.id}_${p.deadline}`, kind: 'deadline', title: 'Project deadline coming up', body: `${p.name} is due ${dueLabel(p.deadline).toLowerCase()}.`, at: todayStamp.toISOString(), projectId: p.id })
    }
    const all = [...s.notifications, ...derived]
      .filter((n) => !s.dismissedIds.includes(n.id))
      .sort((a, b) => b.at.localeCompare(a.at))
    const unread = all.filter((n) => !s.readIds.includes(n.id))
    return { all, unread, isRead: (id: string) => s.readIds.includes(id) }
  }, [s.tasks, s.projects, s.statuses, s.notifications, s.readIds, s.dismissedIds, s.settings.currentUserId])
}
