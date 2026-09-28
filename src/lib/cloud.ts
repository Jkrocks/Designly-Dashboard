import { createClient, type RealtimeChannel, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { create } from 'zustand'
import { buildDemo, DEFAULT_STATUSES } from './demo'
import { useStore } from './store'
import type { Member, Role } from './types'

/**
 * Cloud mode turns on when the build has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * Without them DesignFlow keeps working exactly as before, saving in the browser.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const cloudEnabled = !!(url && key)
export const supabase: SupabaseClient | null = cloudEnabled ? createClient(url!, key!, { auth: { persistSession: true, detectSessionInUrl: true } }) : null

/** Shared collections. Timer, theme and read-state stay on each person's device. */
const COLLECTIONS = ['statuses', 'members', 'clients', 'projects', 'tasks', 'events', 'entries', 'notifications', 'reports'] as const
type Collection = (typeof COLLECTIONS)[number]
type Row = { collection: string; id: string; data: unknown; deleted: boolean }

export interface Workspace {
  id: string
  name: string
  role: Role
}

type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error'

interface CloudState {
  session: Session | null
  ready: boolean
  workspaces: Workspace[]
  workspace: Workspace | null
  loading: boolean
  sync: SyncState
  error: string | null
  set: (p: Partial<CloudState>) => void
}

export const useCloud = create<CloudState>()((set) => ({
  session: null,
  ready: !cloudEnabled,
  workspaces: [],
  workspace: null,
  loading: false,
  sync: 'idle',
  error: null,
  set: (p) => set(p),
}))

export const memberIdFor = (email: string) => `u:${email.trim().toLowerCase()}`

const LAST_WS = 'df:last-workspace'
const readLast = () => {
  try {
    return localStorage.getItem(LAST_WS)
  } catch {
    return null
  }
}
const writeLast = (id: string) => {
  try {
    localStorage.setItem(LAST_WS, id)
  } catch {
    /* only affects which workspace opens first */
  }
}

/* ---------- Auth ---------- */

export async function initCloud() {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  useCloud.getState().set({ session: data.session, ready: true })
  if (data.session) await afterSignIn()
  supabase.auth.onAuthStateChange((event, session) => {
    const prev = useCloud.getState().session
    useCloud.getState().set({ session })
    if (event === 'SIGNED_IN' && !prev) void afterSignIn()
    if (event === 'SIGNED_OUT') {
      stopSync()
      useCloud.getState().set({ workspace: null, workspaces: [] })
    }
  })
}

export async function sendMagicLink(email: string) {
  const redirect = `${location.origin}${location.pathname}`
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
  if (error) throw error
}

export async function signInWithPassword(email: string, password: string, mode: 'in' | 'up') {
  const redirect = `${location.origin}${location.pathname}`
  const { error, data } =
    mode === 'in'
      ? await supabase!.auth.signInWithPassword({ email, password })
      : await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
  if (error) throw error
  return { needsConfirm: mode === 'up' && !data.session }
}

export async function signOut() {
  stopSync()
  await supabase?.auth.signOut()
}

async function afterSignIn() {
  const c = useCloud.getState()
  c.set({ loading: true, error: null })
  try {
    await supabase!.rpc('claim_invites')
    const list = await listWorkspaces()
    c.set({ workspaces: list })
    const last = readLast()
    const pick = list.find((w) => w.id === last) ?? list[0]
    if (pick) await openWorkspace(pick)
  } catch (e) {
    c.set({ error: messageOf(e) })
  } finally {
    c.set({ loading: false })
  }
}

async function listWorkspaces(): Promise<Workspace[]> {
  const email = useCloud.getState().session?.user.email?.toLowerCase() ?? ''
  const uid = useCloud.getState().session?.user.id
  const { data, error } = await supabase!.from('workspace_members').select('role, email, user_id, workspaces(id, name)')
  if (error) throw error
  return (data ?? [])
    .filter((r) => r.user_id === uid || r.email?.toLowerCase() === email)
    .map((r) => {
      const ws = r.workspaces as unknown as { id: string; name: string }
      return { id: ws.id, name: ws.name, role: r.role as Role }
    })
}

/* ---------- Workspaces ---------- */

export async function createWorkspace(name: string, withDemo: boolean) {
  const c = useCloud.getState()
  const user = c.session!.user
  c.set({ loading: true, error: null })
  try {
    const { data, error } = await supabase!.from('workspaces').insert({ name }).select('id, name').single()
    if (error) throw error
    const ws: Workspace = { id: data.id, name: data.name, role: 'Owner' }
    const me = memberIdFor(user.email!)
    const seed = withDemo ? buildDemo() : null
    const swap = <T,>(v: T): T => JSON.parse(JSON.stringify(v).replaceAll('"m_me"', JSON.stringify(me)))
    const myProfile: Member = {
      ...(seed?.members.find((m) => m.id === 'm_me') ?? { title: 'Designer', location: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, skills: [], specializations: [], bio: '', hue: 262, weeklyCapacity: 40 }),
      id: me,
      email: user.email!,
      name: user.user_metadata?.name || user.email!.split('@')[0]!,
      role: 'Owner',
    }
    const collections: Record<Collection, { id: string }[]> = seed
      ? {
          statuses: seed.statuses,
          members: [myProfile, ...seed.members.filter((m) => m.id !== 'm_me')],
          clients: seed.clients,
          projects: swap(seed.projects),
          tasks: swap(seed.tasks),
          events: seed.events,
          entries: swap(seed.entries),
          notifications: seed.notifications,
          reports: [],
        }
      : { statuses: DEFAULT_STATUSES, members: [myProfile], clients: [], projects: [], tasks: [], events: [], entries: [], notifications: [], reports: [] }
    const rows: { workspace_id: string; collection: string; id: string; data: unknown; deleted: boolean }[] = COLLECTIONS.flatMap((col) =>
      collections[col].map((item, i) => ({ workspace_id: ws.id, collection: col, id: item.id, data: col === 'statuses' ? { ...item, order: i } : item, deleted: false })),
    )
    rows.push({ workspace_id: ws.id, collection: 'meta', id: 'settings', data: { workspaceName: name, weekStartsOn: 1, mode: withDemo ? 'team' : 'solo' }, deleted: false })
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e2 } = await supabase!.from('records').insert(rows.slice(i, i + 500))
      if (e2) throw e2
    }
    c.set({ workspaces: [...c.workspaces, ws] })
    await openWorkspace(ws)
  } catch (e) {
    c.set({ error: messageOf(e) })
  } finally {
    c.set({ loading: false })
  }
}

export async function openWorkspace(ws: Workspace) {
  const c = useCloud.getState()
  stopSync()
  c.set({ loading: true, error: null })
  try {
    const rows: Row[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase!.from('records').select('collection, id, data, deleted').eq('workspace_id', ws.id).order('collection').order('id').range(from, from + 999)
      if (error) throw error
      rows.push(...(data as Row[]))
      if (!data || data.length < 1000) break
    }
    const { data: team } = await supabase!.from('workspace_members').select('email, role').eq('workspace_id', ws.id)
    const roles = new Map((team ?? []).map((t) => [memberIdFor(t.email), t.role as Role]))

    const next: Record<string, unknown[]> = Object.fromEntries(COLLECTIONS.map((col) => [col, []]))
    let meta: Record<string, unknown> = {}
    for (const r of rows) {
      if (r.deleted) continue
      if (r.collection === 'meta' && r.id === 'settings') meta = r.data as Record<string, unknown>
      else if (next[r.collection]) next[r.collection]!.push(r.data)
    }
    // Keep status order stable: they are stored with an index.
    ;(next.statuses as { order?: number }[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    const user = c.session!.user
    const me = memberIdFor(user.email!)
    let members = next.members as Member[]
    members = members.map((m) => (roles.has(m.id) ? { ...m, role: roles.get(m.id)! } : m))
    const newProfile = !members.some((m) => m.id === me)
    if (newProfile) {
      members.push({ id: me, email: user.email!, name: user.email!.split('@')[0]!, role: ws.role, title: 'Designer', location: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, skills: [], specializations: [], bio: '', hue: Math.floor(Math.random() * 360), weeklyCapacity: 40 })
    }

    applying = true
    const local = useStore.getState()
    useStore.setState({
      ...(next as object),
      members,
      settings: { ...local.settings, ...meta, currentUserId: me },
      timer: local.timer && (next.projects as { id: string }[]).some((p) => p.id === local.timer!.projectId) ? local.timer : null,
    })
    applying = false
    snapshot()
    writeLast(ws.id)
    c.set({ workspace: { ...ws, role: roles.get(me) ?? ws.role }, sync: 'saved' })
    startSync(ws.id)
    if (newProfile) {
      // First visit to this studio: save the new profile so teammates see who joined.
      synced.get('members')?.delete(me)
      collectChanges()
      void flush()
    }
  } catch (e) {
    applying = false
    c.set({ error: messageOf(e) })
  } finally {
    c.set({ loading: false })
  }
}

/* ---------- Team membership (the access list) ---------- */

export async function inviteMember(email: string, role: Role) {
  const ws = useCloud.getState().workspace
  if (!ws) return
  const { error } = await supabase!.from('workspace_members').upsert({ workspace_id: ws.id, email: email.toLowerCase(), role })
  if (error) throw error
}
/**
 * Emails the person a one-click sign-in link. Supabase creates their account if needed, and
 * claim_invites() drops them straight into the studio. Works without a server or secret key.
 */
export async function sendInviteEmail(email: string) {
  const { error } = await supabase!.auth.signInWithOtp({
    email: email.toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}${location.pathname}` },
  })
  if (error) {
    if (/rate limit/i.test(error.message)) throw new Error('Supabase’s built-in email only sends a few messages an hour. Wait a bit and resend, or connect your own email service in Supabase.')
    throw error
  }
}

export async function setMemberRole(email: string, role: Role) {
  const ws = useCloud.getState().workspace
  if (!ws) return
  const { error } = await supabase!.from('workspace_members').update({ role }).eq('workspace_id', ws.id).eq('email', email.toLowerCase())
  if (error) throw error
}
export async function removeMemberAccess(email: string) {
  const ws = useCloud.getState().workspace
  if (!ws) return
  const { error } = await supabase!.from('workspace_members').delete().eq('workspace_id', ws.id).eq('email', email.toLowerCase())
  if (error) throw error
}

/* ---------- Sync engine ---------- */

let applying = false
let channel: RealtimeChannel | null = null
let unsub: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let retry: ReturnType<typeof setInterval> | null = null
const synced = new Map<string, Map<string, unknown>>()
const statusOrder = new Map<string, number>()
let syncedMeta = ''
let pending = new Map<string, Row>()

const metaOf = () => {
  const s = useStore.getState().settings
  return { workspaceName: s.workspaceName, weekStartsOn: s.weekStartsOn, mode: s.mode }
}

function snapshot() {
  const s = useStore.getState() as unknown as Record<string, { id: string }[]>
  for (const col of COLLECTIONS) synced.set(col, new Map(s[col]!.map((x) => [x.id, x])))
  resetOrder()
  syncedMeta = JSON.stringify(metaOf())
}

function resetOrder() {
  statusOrder.clear()
  useStore.getState().statuses.forEach((x, i) => statusOrder.set(x.id, i))
}

function collectChanges() {
  const s = useStore.getState() as unknown as Record<string, { id: string }[]>
  for (const col of COLLECTIONS) {
    const prev = synced.get(col) ?? new Map()
    const list = s[col]!
    const seen = new Set<string>()
    list.forEach((item, i) => {
      seen.add(item.id)
      // Statuses carry their position so every teammate sees the same order.
      const data = col === 'statuses' ? { ...item, order: i } : item
      if (prev.get(item.id) !== item || (col === 'statuses' && statusOrder.get(item.id) !== i)) {
        pending.set(`${col}/${item.id}`, { collection: col, id: item.id, data, deleted: false })
      }
    })
    for (const [id, item] of prev) if (!seen.has(id)) pending.set(`${col}/${id}`, { collection: col, id, data: item, deleted: true })
    synced.set(col, new Map(list.map((x) => [x.id, x])))
  }
  resetOrder()
  const meta = JSON.stringify(metaOf())
  if (meta !== syncedMeta) {
    pending.set('meta/settings', { collection: 'meta', id: 'settings', data: metaOf(), deleted: false })
    syncedMeta = meta
  }
}

async function flush() {
  const ws = useCloud.getState().workspace
  if (!ws || !pending.size) return
  const batch = [...pending.values()]
  pending = new Map()
  useCloud.getState().set({ sync: 'saving' })
  const { error } = await supabase!.from('records').upsert(batch.map((r) => ({ ...r, workspace_id: ws.id, updated_at: new Date().toISOString() })))
  if (error) {
    for (const r of batch) if (!pending.has(`${r.collection}/${r.id}`)) pending.set(`${r.collection}/${r.id}`, r)
    useCloud.getState().set({ sync: navigator.onLine === false ? 'offline' : 'error', error: messageOf(error) })
  } else {
    useCloud.getState().set({ sync: pending.size ? 'saving' : 'saved', error: null })
  }
}

function startSync(workspaceId: string) {
  unsub = useStore.subscribe((state, prev) => {
    if (applying) return
    const touched = COLLECTIONS.some((c) => (state as never)[c] !== (prev as never)[c]) || state.settings !== prev.settings
    if (!touched) return
    collectChanges()
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, 500)
  })
  retry = setInterval(() => pending.size && void flush(), 10000)
  channel = supabase!
    .channel(`records:${workspaceId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
      const r = payload.new as Row & { updated_by?: string }
      if (!r?.collection) return
      applyRemote(r)
    })
    .subscribe()
  window.addEventListener('online', onOnline)
}

function onOnline() {
  void flush()
}

function applyRemote(r: Row) {
  if (pending.has(`${r.collection}/${r.id}`)) return // our unsaved edit wins locally until it is written
  const s = useStore.getState() as unknown as Record<string, { id: string }[]>
  applying = true
  if (r.collection === 'meta') {
    const d = r.data as Record<string, unknown>
    useStore.setState((st) => ({ settings: { ...st.settings, ...d } }))
    syncedMeta = JSON.stringify(metaOf())
  } else if ((COLLECTIONS as readonly string[]).includes(r.collection)) {
    const col = r.collection as Collection
    const list = s[col]!
    const exists = list.findIndex((x) => x.id === r.id)
    const incoming = r.data as { id: string }
    if (JSON.stringify(list[exists]) !== JSON.stringify(incoming) || r.deleted) {
      let next = r.deleted ? list.filter((x) => x.id !== r.id) : exists >= 0 ? list.map((x) => (x.id === r.id ? incoming : x)) : [...list, incoming]
      if (col === 'statuses') next = [...next].sort((a, b) => ((a as { order?: number }).order ?? 0) - ((b as { order?: number }).order ?? 0))
      useStore.setState({ [col]: next } as never)
    }
    synced.set(col, new Map((useStore.getState() as unknown as Record<string, { id: string }[]>)[col]!.map((x) => [x.id, x])))
    if (col === 'statuses') resetOrder()
  }
  applying = false
}

export function stopSync() {
  unsub?.()
  unsub = null
  if (timer) clearTimeout(timer)
  if (retry) clearInterval(retry)
  if (channel) void supabase?.removeChannel(channel)
  channel = null
  window.removeEventListener('online', onOnline)
}

export function messageOf(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message)
  return 'Something went wrong. Check your connection and try again.'
}

/** A link to this site that opens the sign-up screen with the invitee's email filled in. */
export function inviteLink(email: string) {
  return `${location.origin}${location.pathname}?invite=${encodeURIComponent(email.toLowerCase())}`
}

export function inviteMessage(name: string, email: string) {
  const studio = useCloud.getState().workspace?.name ?? 'our studio'
  return `Hi ${name.split(' ')[0]}, you're invited to join ${studio} on Designly. Open this link and create your account with ${email.toLowerCase()}:\n${inviteLink(email)}`
}
