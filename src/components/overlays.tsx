import { useEffect } from 'react'
import { AlarmClock, AtSign, BellOff, CheckCheck, Eye, MessageSquare, ShieldCheck, TriangleAlert, UserPlus, X } from 'lucide-react'
import { useStore, useUI } from '../lib/store'
import { useNotifications } from '../lib/notifications'
import type { NotificationKind } from '../lib/types'
import { ago, cn } from '../lib/utils'
import { Button, Drawer, IconButton, Kbd, Modal } from './ui'

const icons: Record<NotificationKind, { icon: typeof Eye; tone: string }> = {
  deadline: { icon: AlarmClock, tone: 'bg-warn-soft text-warn' },
  overdue: { icon: TriangleAlert, tone: 'bg-bad-soft text-bad' },
  review: { icon: Eye, tone: 'bg-accent-soft text-accent-text' },
  approval: { icon: ShieldCheck, tone: 'bg-accent-soft text-accent-text' },
  comment: { icon: MessageSquare, tone: 'bg-surface-3 text-ink-2' },
  assignment: { icon: UserPlus, tone: 'bg-surface-3 text-ink-2' },
}

export function NotificationsPanel() {
  const open = useUI((s) => s.notifications)
  const setUI = useUI((s) => s.set)
  const navigate = useUI((s) => s.navigate)
  const { all, unread, isRead } = useNotifications()
  const markRead = useStore((s) => s.markRead)
  const dismiss = useStore((s) => s.dismiss)
  const close = () => setUI({ notifications: false })
  return (
    <Drawer open={open} onClose={close} label="Notifications">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-lg font-medium tracking-tight">Notifications</h2>
          <p className="text-[13px] text-ink-3">{unread.length ? `${unread.length} new` : 'You’re all caught up'}</p>
        </div>
        <div className="flex items-center gap-1">
          {unread.length > 0 && (
            <Button size="sm" variant="ghost" icon={<CheckCheck size={15} />} onClick={() => markRead(unread.map((n) => n.id))}>
              Mark all read
            </Button>
          )}
          <IconButton label="Close notifications" onClick={close}>
            <X size={18} />
          </IconButton>
        </div>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-3">
        {all.map((n) => {
          const meta = icons[n.kind]
          const read = isRead(n.id)
          return (
            <div key={n.id} className={cn('group relative flex gap-3 rounded-2xl p-3 transition-colors hover:bg-surface-2', !read && 'bg-surface-2/60')}>
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', meta.tone)}>
                <meta.icon size={17} />
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  markRead([n.id])
                  if (n.taskId) setUI({ notifications: false, taskDetail: n.taskId })
                  else if (n.projectId) navigate({ name: 'project', id: n.projectId })
                }}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {n.title}
                  {!read && <span className="size-2 rounded-full bg-accent" aria-label="Unread" />}
                </span>
                <span className="mt-0.5 block text-[13px] text-ink-2">{n.body}</span>
                <span className="mt-1 block text-xs text-ink-3">{ago(n.at)}</span>
              </button>
              <IconButton label="Dismiss" onClick={() => dismiss(n.id)} className="size-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
                <X size={14} />
              </IconButton>
            </div>
          )
        })}
        {!all.length && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-ink-3">
            <BellOff size={22} />
            <p className="text-sm">No notifications. Deadlines, reviews and comments will show up here.</p>
          </div>
        )}
      </div>
      <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-ink-3">
        <AtSign size={12} /> You get notified about deadlines, overdue work, reviews, approvals, comments and assignments.
      </p>
    </Drawer>
  )
}

export function Toast() {
  const toast = useUI((s) => s.toast)
  const setUI = useUI((s) => s.set)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setUI({ toast: null }), 4200)
    return () => clearTimeout(t)
  }, [toast, setUI])
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-8" role="status" aria-live="polite">
      <div key={toast.id} className="anim-pop pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-5 text-sm text-bg shadow-pop">
        <span>{toast.text}</span>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.run()
              setUI({ toast: null })
            }}
            className="rounded-full bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink"
          >
            {toast.action.label}
          </button>
        )}
        {!toast.action && <span className="w-2" />}
      </div>
    </div>
  )
}

const SHORTCUTS: [string[], string][] = [
  [['⌘', 'K'], 'Search everything'],
  [['N'], 'Quick add'],
  [['P'], 'New project'],
  [['T'], 'Start or stop the timer'],
  [['G', 'D'], 'Go to Dashboard'],
  [['G', 'P'], 'Go to Projects'],
  [['G', 'T'], 'Go to Tasks'],
  [['G', 'C'], 'Go to Calendar'],
  [['G', 'L'], 'Go to Clients'],
  [['G', 'M'], 'Go to Time'],
  [['G', 'I'], 'Go to Insights'],
  [['G', 'A'], 'Go to Archive'],
  [['G', 'S'], 'Go to Settings'],
  [['.'], 'Toggle light / dark'],
  [['?'], 'Show shortcuts'],
]

export function ShortcutsDialog() {
  const open = useUI((s) => s.shortcuts)
  const setUI = useUI((s) => s.set)
  return (
    <Modal open={open} onClose={() => setUI({ shortcuts: false })} title="Keyboard shortcuts">
      <ul className="grid gap-1">
        {SHORTCUTS.map(([keys, label]) => (
          <li key={label} className="flex items-center justify-between rounded-xl px-2 py-2 text-sm odd:bg-surface-2">
            <span className="text-ink-2">{label}</span>
            <span className="flex gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
