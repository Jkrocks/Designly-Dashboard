import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { buildDemo, type DemoData } from './demo'
import type {
  AppNotification,
  CalendarEvent,
  Client,
  Comment,
  ID,
  Member,
  Project,
  ReportRecord,
  Settings,
  Status,
  Task,
  TimeEntry,
  ActiveTimer,
} from './types'
import { safeStorage, uid } from './utils'

interface State extends DemoData {
  timer: ActiveTimer | null
  readIds: ID[]
  dismissedIds: ID[]

  addProject: (p: Omit<Project, 'id' | 'createdAt'> & { id?: ID }) => Project
  updateProject: (id: ID, patch: Partial<Project>) => void
  removeProject: (id: ID) => void

  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'comments' | 'attachments'> & Partial<Pick<Task, 'attachments'>>) => Task
  updateTask: (id: ID, patch: Partial<Task>) => void
  moveTask: (id: ID, statusId: ID) => void
  removeTask: (id: ID) => void
  addComment: (taskId: ID, body: string) => void

  addClient: (c: Omit<Client, 'id' | 'createdAt' | 'files'>) => Client
  updateClient: (id: ID, patch: Partial<Client>) => void
  removeClient: (id: ID) => void

  addMember: (m: Omit<Member, 'id'> & { id?: ID }) => void
  updateMember: (id: ID, patch: Partial<Member>) => void
  removeMember: (id: ID) => void

  addStatus: (s: Omit<Status, 'id'>) => void
  updateStatus: (id: ID, patch: Partial<Status>) => void
  removeStatus: (id: ID) => void
  moveStatus: (id: ID, dir: -1 | 1) => void

  addEvent: (e: Omit<CalendarEvent, 'id'>) => void
  removeEvent: (id: ID) => void

  startTimer: (projectId: ID, taskId?: ID | null) => void
  stopTimer: () => void
  addEntry: (e: Omit<TimeEntry, 'id'>) => void
  removeEntry: (id: ID) => void

  pushNotification: (n: Omit<AppNotification, 'id' | 'at'>) => void
  markRead: (ids: ID[]) => void
  dismiss: (id: ID) => void

  updateSettings: (patch: Partial<Settings>) => void
  addReport: (r: ReportRecord) => void
  removeReport: (id: ID) => void
  resetDemo: () => void
  startFresh: () => void
}

const now = () => new Date().toISOString()

/** Completion timestamps follow the status's meaning, so renaming statuses never breaks insights. */
function completionFor(statuses: Status[], statusId: ID, prev?: string) {
  const kind = statuses.find((s) => s.id === statusId)?.kind
  if (kind === 'done' || kind === 'archived' || kind === 'approved') return prev ?? now()
  return undefined
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...buildDemo(),
      timer: null,
      readIds: [],
      dismissedIds: [],

      addProject: (p) => {
        const project: Project = { ...p, id: p.id ?? uid('p'), createdAt: now() }
        project.completedAt = completionFor(get().statuses, project.statusId)
        set((s) => ({ projects: [project, ...s.projects] }))
        return project
      },
      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== id) return p
            const next = { ...p, ...patch }
            if (patch.statusId) {
              const kind = s.statuses.find((x) => x.id === patch.statusId)?.kind
              next.completedAt = kind === 'done' || kind === 'archived' ? (p.completedAt ?? now()) : undefined
            }
            return next
          }),
        })),
      removeProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          tasks: s.tasks.filter((t) => t.projectId !== id),
          entries: s.entries.filter((e) => e.projectId !== id),
          events: s.events.filter((e) => e.projectId !== id),
          timer: s.timer?.projectId === id ? null : s.timer,
        })),

      addTask: (t) => {
        const task: Task = { attachments: [], ...t, id: uid('t'), createdAt: now(), comments: [] }
        task.completedAt = completionFor(get().statuses, task.statusId)
        set((s) => ({ tasks: [...s.tasks, task] }))
        return task
      },
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t
            const next = { ...t, ...patch }
            if (patch.statusId) next.completedAt = completionFor(s.statuses, patch.statusId, t.completedAt)
            return next
          }),
        })),
      moveTask: (id, statusId) => get().updateTask(id, { statusId }),
      removeTask: (id) =>
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          timer: s.timer?.taskId === id ? null : s.timer,
        })),
      addComment: (taskId, body) => {
        const c: Comment = { id: uid('cm'), authorId: get().settings.currentUserId, body, at: now() }
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, comments: [...t.comments, c] } : t)) }))
      },

      addClient: (c) => {
        const client: Client = { ...c, id: uid('c'), createdAt: now(), files: [] }
        set((s) => ({ clients: [...s.clients, client] }))
        return client
      },
      updateClient: (id, patch) => set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeClient: (id) =>
        set((s) => ({
          clients: s.clients.filter((c) => c.id !== id),
          projects: s.projects.map((p) => (p.clientId === id ? { ...p, clientId: null } : p)),
        })),

      addMember: (m) => set((s) => ({ members: [...s.members.filter((x) => x.id !== m.id), { ...m, id: m.id ?? uid('m') }] })),
      updateMember: (id, patch) => set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      removeMember: (id) =>
        set((s) => ({
          members: s.members.filter((m) => m.id !== id),
          projects: s.projects.map((p) => ({ ...p, memberIds: p.memberIds.filter((x) => x !== id) })),
          tasks: s.tasks.map((t) => (t.assigneeId === id ? { ...t, assigneeId: null } : t)),
        })),

      addStatus: (st) => set((s) => {
        // New statuses go just before the "done" group so the flow stays left-to-right.
        const idx = s.statuses.findIndex((x) => x.kind === 'done')
        const next = [...s.statuses]
        next.splice(idx === -1 ? next.length : idx, 0, { ...st, id: uid('st') })
        return { statuses: next }
      }),
      updateStatus: (id, patch) => set((s) => ({ statuses: s.statuses.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      removeStatus: (id) =>
        set((s) => {
          if (s.statuses.length <= 2) return s
          const idx = s.statuses.findIndex((x) => x.id === id)
          const fallback = s.statuses[idx === 0 ? 1 : idx - 1]!.id
          return {
            statuses: s.statuses.filter((x) => x.id !== id),
            projects: s.projects.map((p) => (p.statusId === id ? { ...p, statusId: fallback } : p)),
            tasks: s.tasks.map((t) => (t.statusId === id ? { ...t, statusId: fallback } : t)),
          }
        }),
      moveStatus: (id, dir) =>
        set((s) => {
          const i = s.statuses.findIndex((x) => x.id === id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= s.statuses.length) return s
          const next = [...s.statuses]
          ;[next[i], next[j]] = [next[j]!, next[i]!]
          return { statuses: next }
        }),

      addEvent: (e) => set((s) => ({ events: [...s.events, { ...e, id: uid('ev') }] })),
      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      startTimer: (projectId, taskId = null) => {
        if (get().timer) get().stopTimer()
        set({ timer: { projectId, taskId, start: Date.now() } })
      },
      stopTimer: () => {
        const t = get().timer
        if (!t) return
        const end = Date.now()
        set((s) => ({
          timer: null,
          entries:
            end - t.start > 30_000
              ? [...s.entries, { id: uid('te'), projectId: t.projectId, taskId: t.taskId, memberId: s.settings.currentUserId, start: t.start, end, note: '' }]
              : s.entries,
        }))
      },
      addEntry: (e) => set((s) => ({ entries: [...s.entries, { ...e, id: uid('te') }] })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      pushNotification: (n) => set((s) => ({ notifications: [{ ...n, id: uid('n'), at: now() }, ...s.notifications] })),
      markRead: (ids) => set((s) => ({ readIds: Array.from(new Set([...s.readIds, ...ids])) })),
      dismiss: (id) => set((s) => ({ dismissedIds: [...s.dismissedIds, id] })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      addReport: (r) => set((s) => ({ reports: [r, ...s.reports.filter((x) => x.id !== r.id)] })),
      removeReport: (id) => set((s) => ({ reports: s.reports.filter((x) => x.id !== id) })),
      resetDemo: () => set({ ...buildDemo(), timer: null, readIds: [], dismissedIds: [] }),
      startFresh: () =>
        set((s) => {
          const me = s.members.find((m) => m.id === s.settings.currentUserId) ?? s.members[0]!
          return {
            projects: [],
            tasks: [],
            clients: [],
            events: [],
            entries: [],
            notifications: [],
            reports: [],
            members: [me],
            timer: null,
            readIds: [],
            dismissedIds: [],
            settings: { ...s.settings, mode: 'solo' },
          }
        }),
    }),
    {
      name: 'designflow:v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage() ?? memoryStorage()),
    },
  ),
)

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}

/* ---------- UI state (not persisted) ---------- */

export type Route =
  | { name: 'dashboard' }
  | { name: 'projects' }
  | { name: 'project'; id: ID }
  | { name: 'tasks' }
  | { name: 'calendar' }
  | { name: 'clients' }
  | { name: 'client'; id: ID }
  | { name: 'time' }
  | { name: 'insights' }
  | { name: 'archive' }
  | { name: 'reports'; tab?: string }
  | { name: 'settings'; tab?: string }
  | { name: 'profile'; id: ID }

export interface ReportRequest {
  title: string
  from: string
  to: string
  designerId?: ID
  projectIds?: ID[]
  /** Reopening a saved report keeps its artwork choices. */
  record?: ReportRecord
}

interface UIState {
  route: Route
  navigate: (r: Route) => void
  quickCapture: boolean
  search: boolean
  notifications: boolean
  shortcuts: boolean
  projectForm: { open: boolean; id?: ID; preset?: Partial<Project>; step?: string }
  taskForm: { open: boolean; id?: ID; preset?: Partial<Task> }
  taskDetail: ID | null
  /** Project whose handoff email sheet is open. */
  projectEmail: ID | null
  /** The month-end report builder, open for a period and optional filter. */
  reportBuilder: ReportRequest | null
  clientForm: { open: boolean; id?: ID }
  projectsTag: string | null
  toast: { id: number; text: string; action?: { label: string; run: () => void } } | null
  set: (patch: Partial<Omit<UIState, 'set' | 'navigate' | 'notify'>>) => void
  notify: (text: string, action?: { label: string; run: () => void }) => void
}

export function routeToHash(r: Route) {
  if (r.name === 'project' || r.name === 'client' || r.name === 'profile') return `#${r.name}-${r.id}`
  if ((r.name === 'settings' || r.name === 'reports') && r.tab) return `#${r.name}-${r.tab}`
  return `#${r.name}`
}

export function hashToRoute(hash: string): Route {
  const h = hash.replace(/^#/, '')
  const m = h.match(/^(project|client|profile|settings|reports)-(.+)$/)
  if (m) {
    if (m[1] === 'settings' || m[1] === 'reports') return { name: m[1], tab: m[2] }
    return { name: m[1] as 'project' | 'client' | 'profile', id: m[2]! }
  }
  const simple = ['dashboard', 'projects', 'tasks', 'calendar', 'clients', 'time', 'insights', 'archive', 'reports', 'settings'] as const
  return (simple as readonly string[]).includes(h) ? ({ name: h } as Route) : { name: 'dashboard' }
}

export const useUI = create<UIState>()((set) => ({
  route: hashToRoute(typeof location !== 'undefined' ? location.hash : ''),
  navigate: (route) => {
    set({ route, search: false, notifications: false })
    try {
      history.pushState(null, '', routeToHash(route))
    } catch {
      /* sandboxed frames may refuse history writes */
    }
    document.getElementById('main')?.scrollTo({ top: 0 })
  },
  quickCapture: false,
  search: false,
  notifications: false,
  shortcuts: false,
  projectForm: { open: false },
  projectEmail: null,
  reportBuilder: null,
  taskForm: { open: false },
  taskDetail: null,
  clientForm: { open: false },
  projectsTag: null,
  toast: null,
  set: (patch) => set(patch),
  notify: (text, action) => set({ toast: { id: Date.now(), text, action } }),
}))
