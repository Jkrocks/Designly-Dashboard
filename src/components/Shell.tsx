import { useEffect, useState, type ReactNode } from 'react'
import {
  Presentation,
  Archive,
  Bell,
  CalendarDays,
  ChartNoAxesColumn,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Square,
  Sun,
  Timer,
  Users,
  X,
} from 'lucide-react'
import { useStore, useUI, type Route } from '../lib/store'
import { useCurrentUser, useLookups } from '../lib/selectors'
import { useNotifications } from '../lib/notifications'
import { useTheme } from '../lib/theme'
import { cn, fmtClock } from '../lib/utils'
import { Logo } from './art'
import { Avatar, IconButton, Kbd } from './ui'
import { SyncBadge } from './CloudGate'

export const NAV: { name: Route['name']; label: string; icon: typeof LayoutDashboard; key: string }[] = [
  { name: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'd' },
  { name: 'projects', label: 'Projects', icon: FolderKanban, key: 'p' },
  { name: 'tasks', label: 'Tasks', icon: ListChecks, key: 't' },
  { name: 'calendar', label: 'Calendar', icon: CalendarDays, key: 'c' },
  { name: 'clients', label: 'Clients', icon: Users, key: 'l' },
  { name: 'time', label: 'Time', icon: Timer, key: 'm' },
  { name: 'insights', label: 'Insights', icon: ChartNoAxesColumn, key: 'i' },
  { name: 'reports', label: 'Reports', icon: Presentation, key: 'r' },
  { name: 'archive', label: 'Archive', icon: Archive, key: 'a' },
]

const sectionOf = (r: Route): Route['name'] =>
  r.name === 'project' ? 'projects' : r.name === 'client' ? 'clients' : r.name === 'profile' ? 'settings' : r.name

export function useTick(ms = 1000, on = true) {
  const [, set] = useState(0)
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => set((x) => x + 1), ms)
    return () => clearInterval(t)
  }, [ms, on])
}

function RailLink({ active, label, onClick, children, hint }: { active: boolean; label: string; onClick: () => void; children: ReactNode; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative grid size-12 place-items-center rounded-2xl transition-all duration-150',
        active ? 'bg-surface-3 text-accent-text shadow-[inset_0_0_0_1px_var(--line-strong)]' : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
      <span className="pointer-events-none absolute left-[calc(100%+12px)] z-50 flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-[13px] whitespace-nowrap text-ink opacity-0 shadow-pop transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
        {hint && <span className="text-ink-3">{hint}</span>}
      </span>
    </button>
  )
}

function Rail() {
  const route = useUI((s) => s.route)
  const navigate = useUI((s) => s.navigate)
  const setUI = useUI((s) => s.set)
  const unread = useNotifications().unread.length
  const current = sectionOf(route)
  return (
    <nav aria-label="Primary" className="sticky top-0 hidden h-dvh w-[84px] shrink-0 flex-col items-center gap-2 border-r border-line py-5 md:flex">
      <button type="button" onClick={() => navigate({ name: 'dashboard' })} className="mb-4 rounded-xl" aria-label="Designly home">
        <Logo size={40} />
      </button>
      <div className="flex flex-1 flex-col items-center gap-1.5">
        {NAV.map((n) => (
          <RailLink key={n.name} active={current === n.name} label={n.label} hint={`G ${n.key.toUpperCase()}`} onClick={() => navigate({ name: n.name } as Route)}>
            <n.icon size={20} strokeWidth={1.8} />
          </RailLink>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1.5 border-t border-line pt-3">
        <RailLink active={false} label="Notifications" onClick={() => setUI({ notifications: true })}>
          <Bell size={20} strokeWidth={1.8} />
          {unread > 0 && <span className="absolute top-2.5 right-2.5 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-ink">{unread > 9 ? '9+' : unread}</span>}
        </RailLink>
        <RailLink active={current === 'settings'} label="Settings" onClick={() => navigate({ name: 'settings' })}>
          <Settings size={20} strokeWidth={1.8} />
        </RailLink>
      </div>
    </nav>
  )
}

export function TimerPill({ compact }: { compact?: boolean }) {
  const timer = useStore((s) => s.timer)
  const stop = useStore((s) => s.stopTimer)
  const notify = useUI((s) => s.notify)
  const { project } = useLookups()
  const tasks = useStore((s) => s.tasks)
  useTick(1000, !!timer)
  if (!timer) return null
  const p = project.get(timer.projectId)
  const t = timer.taskId ? tasks.find((x) => x.id === timer.taskId) : null
  return (
    <div className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface-2 pr-1 pl-3">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-accent" />
      </span>
      {!compact && <span className="max-w-[160px] truncate text-[13px] text-ink-2">{t?.title ?? p?.name}</span>}
      <span className="tnum font-mono text-[13px] font-medium">{fmtClock(Date.now() - timer.start)}</span>
      <button
        type="button"
        aria-label="Stop timer"
        onClick={() => {
          stop()
          notify('Time saved to your timesheet')
        }}
        className="grid size-8 place-items-center rounded-full bg-ink text-bg transition-transform active:scale-90"
      >
        <Square size={12} fill="currentColor" />
      </button>
    </div>
  )
}

function ThemeToggle() {
  const { dark } = useTheme()
  const update = useStore((s) => s.updateSettings)
  return (
    <IconButton label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => update({ theme: dark ? 'light' : 'dark' })} className="border border-line bg-surface">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </IconButton>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const setUI = useUI((s) => s.set)
  const navigate = useUI((s) => s.navigate)
  const me = useCurrentUser()
  const unread = useNotifications().unread.length
  const workspace = useStore((s) => s.settings.workspaceName)
  return (
    <header
      className="sticky z-30 flex items-center gap-2 bg-bg/80 px-4 py-3 backdrop-blur-xl sm:px-6 md:px-8 md:py-5"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center gap-2 md:hidden">
        <IconButton label="Open menu" onClick={onMenu}>
          <Menu size={20} />
        </IconButton>
        <Logo size={30} />
      </div>
      <button
        type="button"
        onClick={() => setUI({ search: true })}
        className="ml-auto flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-ink-3 transition-colors hover:border-line-strong md:mr-auto md:ml-0 md:w-[min(420px,40vw)]"
        aria-label="Search everything"
      >
        <Search size={17} />
        <span className="hidden md:inline">Search projects, tasks, clients, files…</span>
        <span className="ml-auto hidden items-center gap-1 md:flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <SyncBadge />
      <div className="hidden lg:block">
        <TimerPill />
      </div>
      <div className="lg:hidden">
        <TimerPill compact />
      </div>
      <button
        type="button"
        onClick={() => setUI({ quickCapture: true })}
        className="hidden h-10 items-center gap-2 rounded-full bg-accent pr-4 pl-3 text-sm font-medium text-accent-ink shadow-[0_8px_24px_-8px_var(--accent-glow)] transition-all hover:brightness-105 active:scale-95 sm:flex"
      >
        <Plus size={18} strokeWidth={2.4} /> Quick add
        <span className="ml-1 hidden rounded-md bg-black/10 px-1.5 font-mono text-[11px] lg:inline">N</span>
      </button>
      <div className="hidden sm:block">
        <ThemeToggle />
      </div>
      <IconButton label="Notifications" onClick={() => setUI({ notifications: true })} className="relative border border-line bg-surface md:hidden">
        <Bell size={18} />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-accent ring-2 ring-surface" />}
      </IconButton>
      <button type="button" onClick={() => navigate({ name: 'profile', id: me.id })} className="hidden items-center gap-3 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-surface-2 md:flex" aria-label="Your profile">
        <Avatar member={me} size={38} />
        <span className="hidden text-left leading-tight xl:block">
          <span className="block text-sm font-medium">{me.name}</span>
          <span className="block text-xs text-ink-3">
            {me.role} · {workspace}
          </span>
        </span>
      </button>
    </header>
  )
}

function MobileTabs() {
  const route = useUI((s) => s.route)
  const navigate = useUI((s) => s.navigate)
  const setUI = useUI((s) => s.set)
  const current = sectionOf(route)
  const Tab = ({ name, label, icon: Icon }: { name: Route['name']; label: string; icon: typeof Timer }) => (
    <button
      type="button"
      onClick={() => navigate({ name } as Route)}
      aria-current={current === name ? 'page' : undefined}
      className={cn('flex flex-1 flex-col items-center gap-1 py-1.5 text-[11px] font-medium', current === name ? 'text-ink' : 'text-ink-3')}
    >
      <span className={cn('grid h-8 w-12 place-items-center rounded-full transition-colors', current === name && 'bg-surface-3 text-accent-text')}>
        <Icon size={20} strokeWidth={1.8} />
      </span>
      {label}
    </button>
  )
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-30 flex items-end border-t border-line bg-surface/90 px-2 pt-1.5 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)' }}
    >
      <Tab name="dashboard" label="Today" icon={LayoutDashboard} />
      <Tab name="tasks" label="Tasks" icon={ListChecks} />
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          aria-label="Quick add"
          onClick={() => setUI({ quickCapture: true })}
          className="-mt-6 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_10px_30px_-6px_var(--accent-glow)] ring-4 ring-bg transition-transform active:scale-90"
        >
          <Plus size={26} strokeWidth={2.4} />
        </button>
      </div>
      <Tab name="time" label="Timer" icon={Timer} />
      <Tab name="calendar" label="Deadlines" icon={CalendarDays} />
    </nav>
  )
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useUI((s) => s.navigate)
  const route = useUI((s) => s.route)
  const me = useCurrentUser()
  if (!open) return null
  const go = (r: Route) => {
    navigate(r)
    onClose()
  }
  return (
    <div className="anim-fade fixed inset-0 z-50 bg-black/50 md:hidden" onClick={onClose}>
      <div
        className="anim-pop absolute inset-x-3 top-3 rounded-[28px] border border-line bg-surface p-4 shadow-pop"
        style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className="flex items-center gap-3" onClick={() => go({ name: 'profile', id: me.id })}>
            <Avatar member={me} size={40} />
            <span className="text-left leading-tight">
              <span className="block font-medium">{me.name}</span>
              <span className="text-xs text-ink-3">View profile</span>
            </span>
          </button>
          <IconButton label="Close menu" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[...NAV, { name: 'settings' as const, label: 'Settings', icon: Settings, key: 's' }].map((n) => (
            <button
              key={n.name}
              type="button"
              onClick={() => go({ name: n.name } as Route)}
              className={cn('flex flex-col items-center gap-2 rounded-2xl border border-line px-2 py-4 text-[13px]', sectionOf(route) === n.name ? 'bg-surface-3 text-ink' : 'bg-surface-2 text-ink-2')}
            >
              <n.icon size={20} strokeWidth={1.8} />
              {n.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false)
  return (
    <div className="flex min-h-dvh">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMenu(true)} />
        <main id="main" className="flex-1 px-4 pb-28 sm:px-6 md:px-8 md:pb-12">
          {children}
        </main>
      </div>
      <MobileTabs />
      <MobileMenu open={menu} onClose={() => setMenu(false)} />
    </div>
  )
}
