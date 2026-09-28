import { useEffect, useRef } from 'react'
import { hashToRoute, useStore, useUI, type Route } from './lib/store'
import { ThemeSync, useTheme } from './lib/theme'
import { isTypingTarget } from './lib/utils'
import { Shell } from './components/Shell'
import { CloudGate } from './components/CloudGate'
import QuickCapture from './components/QuickCapture'
import Search from './components/Search'
import TaskDetail from './components/TaskDetail'
import { ClientForm, TaskForm } from './components/forms'
import { ProjectForm } from './components/ProjectForm'
import { ProjectEmailSheet } from './components/ProjectReady'
import { NotificationsPanel, ShortcutsDialog, Toast } from './components/overlays'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import { ClientDetail, Clients } from './pages/Clients'
import Time from './pages/Time'
import Insights from './pages/Insights'
import Archive from './pages/Archive'
import Reports from './pages/Reports'
import { ReportBuilder } from './components/ReportBuilder'
import Settings from './pages/Settings'
import Profile from './pages/Profile'

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'dashboard': return <Dashboard />
    case 'projects': return <Projects />
    case 'project': return <ProjectDetail id={route.id} />
    case 'tasks': return <Tasks />
    case 'calendar': return <Calendar />
    case 'clients': return <Clients />
    case 'client': return <ClientDetail id={route.id} />
    case 'time': return <Time />
    case 'insights': return <Insights />
    case 'archive': return <Archive />
    case 'reports': return <Reports tab={route.tab} />
    case 'settings': return <Settings tab={route.tab} />
    case 'profile': return <Profile id={route.id} />
  }
}

const GOTO: Record<string, Route> = {
  d: { name: 'dashboard' }, p: { name: 'projects' }, t: { name: 'tasks' }, c: { name: 'calendar' },
  l: { name: 'clients' }, m: { name: 'time' }, i: { name: 'insights' }, a: { name: 'archive' }, r: { name: 'reports' }, s: { name: 'settings' },
}

function useShortcuts() {
  const pendingG = useRef(0)
  const { dark } = useTheme()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUI.getState()
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ui.set({ search: !ui.search })
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      const overlayOpen = ui.search || ui.quickCapture || ui.projectForm.open || ui.taskForm.open || ui.clientForm.open || ui.shortcuts || !!ui.taskDetail || ui.notifications
      if (overlayOpen) return
      const k = e.key.toLowerCase()
      if (Date.now() - pendingG.current < 900 && GOTO[k]) {
        e.preventDefault()
        pendingG.current = 0
        ui.navigate(GOTO[k]!)
        return
      }
      if (k === 'g') { pendingG.current = Date.now(); return }
      if (k === 'n') { e.preventDefault(); ui.set({ quickCapture: true }) }
      else if (k === 'p') { e.preventDefault(); ui.set({ projectForm: { open: true } }) }
      else if (k === '/') { e.preventDefault(); ui.set({ search: true }) }
      else if (e.key === '?') ui.set({ shortcuts: true })
      else if (k === '.') useStore.getState().updateSettings({ theme: dark ? 'light' : 'dark' })
      else if (k === 't') {
        const st = useStore.getState()
        if (st.timer) { st.stopTimer(); ui.notify('Timer stopped and saved') }
        else {
          const last = [...st.entries].sort((a, b) => b.end - a.end)[0]
          if (last && st.projects.some((p) => p.id === last.projectId)) {
            st.startTimer(last.projectId, last.taskId)
            ui.notify(`Timer started on ${st.projects.find((p) => p.id === last.projectId)!.name}`)
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dark])
}

export default function App() {
  const route = useUI((s) => s.route)
  useShortcuts()
  useEffect(() => {
    const on = () => useUI.setState({ route: hashToRoute(location.hash) })
    window.addEventListener('popstate', on)
    window.addEventListener('hashchange', on)
    return () => {
      window.removeEventListener('popstate', on)
      window.removeEventListener('hashchange', on)
    }
  }, [])
  const key = route.name + ('id' in route ? route.id : '') + ('tab' in route ? route.tab ?? '' : '')
  return (
    <>
      <ThemeSync />
      <CloudGate>
      <Shell>
        <div key={key} className="anim-fade">
          <Page route={route} />
        </div>
      </Shell>
      <QuickCapture />
      <Search />
      <TaskDetail />
      <ProjectForm />
      <ProjectEmailSheet />
      <ReportBuilder />
      <TaskForm />
      <ClientForm />
      <NotificationsPanel />
      <ShortcutsDialog />
      <Toast />
      </CloudGate>
    </>
  )
}
