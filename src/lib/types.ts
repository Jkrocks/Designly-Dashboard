export type ID = string

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

/** What a status means to the app, whatever the user names it. */
export type StatusKind = 'backlog' | 'active' | 'review' | 'approved' | 'done' | 'archived'

export interface Status {
  id: ID
  name: string
  color: string
  kind: StatusKind
}

export type Role = 'Owner' | 'Admin' | 'Designer' | 'Reviewer' | 'Viewer'

export interface Member {
  id: ID
  name: string
  role: Role
  email?: string
  title: string
  location: string
  timezone: string
  skills: string[]
  specializations: string[]
  bio: string
  hue: number
  weeklyCapacity: number
}

export interface Attachment {
  id: ID
  name: string
  kind: 'image' | 'pdf' | 'figma' | 'video' | 'doc' | 'archive' | 'other'
  size: string
  addedAt: string
  final?: boolean
}

export interface LinkRef {
  id: ID
  label: string
  url: string
}

export interface Comment {
  id: ID
  authorId: ID
  body: string
  at: string
}

export interface Client {
  id: ID
  name: string
  contact: string
  email: string
  phone: string
  website: string
  location: string
  industry: string
  notes: string
  hue: number
  files: Attachment[]
  createdAt: string
}

export interface Project {
  id: ID
  name: string
  clientId: ID | null
  type: string
  description: string
  brief: string
  startDate: string
  deadline: string
  priority: Priority
  statusId: ID
  tags: string[]
  memberIds: ID[]
  software: string[]
  attachments: Attachment[]
  links: LinkRef[]
  notes: string
  cover: { hue: number; shape: number }
  createdAt: string
  completedAt?: string
}

export interface Task {
  id: ID
  projectId: ID
  title: string
  statusId: ID
  deadline: string | null
  priority: Priority
  estimate: number
  assigneeId: ID | null
  notes: string
  attachments: Attachment[]
  comments: Comment[]
  createdAt: string
  completedAt?: string
}

export type EventKind = 'review' | 'approval' | 'milestone'

export interface CalendarEvent {
  id: ID
  title: string
  date: string
  kind: EventKind
  projectId: ID | null
}

export interface TimeEntry {
  id: ID
  projectId: ID
  taskId: ID | null
  memberId: ID
  start: number
  end: number
  note: string
}

export interface ActiveTimer {
  projectId: ID
  taskId: ID | null
  start: number
}

export type NotificationKind = 'deadline' | 'overdue' | 'review' | 'approval' | 'comment' | 'assignment'

export interface AppNotification {
  id: ID
  kind: NotificationKind
  title: string
  body: string
  at: string
  projectId?: ID
  taskId?: ID
}

export type ThemePref = 'system' | 'light' | 'dark'

export interface Settings {
  theme: ThemePref
  currentUserId: ID
  workspaceName: string
  weekStartsOn: 0 | 1
  mode: 'solo' | 'team'
}
