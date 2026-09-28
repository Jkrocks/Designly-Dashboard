import { useEffect, useState, type ReactNode } from 'react'
import { Cloud, CloudOff, Loader2, Mail } from 'lucide-react'
import { cloudEnabled, createWorkspace, initCloud, openWorkspace, sendMagicLink, signInWithPassword, signOut, useCloud } from '../lib/cloud'
import { cn } from '../lib/utils'
import { Logo } from './art'
import { Button, Field, inputCls, Segmented } from './ui'

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="pointer-events-none fixed -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-accent opacity-[0.08] blur-3xl" aria-hidden />
      <div className="card anim-pop relative w-full max-w-md p-7 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={40} />
          <span className="text-lg font-semibold tracking-tight">DesignFlow</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function Loading({ text }: { text: string }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4 text-ink-3">
        <Logo size={44} />
        <span className="flex items-center gap-2 text-sm">
          <Loader2 size={15} className="animate-spin" /> {text}
        </span>
      </div>
    </div>
  )
}

const invited = new URLSearchParams(location.search).get('invite') ?? ''

function SignIn() {
  const [mode, setMode] = useState<'in' | 'up' | 'link'>(invited ? 'up' : 'in')
  const [email, setEmail] = useState(invited)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const submit = async () => {
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'link') {
        await sendMagicLink(email)
        setMsg({ tone: 'good', text: `Check ${email} for a sign-in link.` })
      } else {
        const r = await signInWithPassword(email, password, mode)
        if (r.needsConfirm) setMsg({ tone: 'good', text: `Almost there. Confirm your email from the message we sent to ${email}.` })
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : ''
      setMsg({
        tone: 'bad',
        text: /fetch|network/i.test(text)
          ? 'Can’t reach the server. Check your internet connection and try again.'
          : /rate limit/i.test(text)
            ? 'Too many emails were sent in the last hour. Ask the studio owner to turn off email confirmation in Supabase, or try again later.'
            : text || 'Sign-in failed. Check your details and try again.',
      })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Screen>
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight">Every project, every deadline, in one place.</h1>
      <p className="mt-2 mb-6 text-sm text-ink-3">
        {invited ? 'You’ve been invited to a studio. Create your account with this email and you’ll land straight in it.' : 'Sign in to reach your studio from any device and work with your team.'}
      </p>
      <Segmented
        label="Sign-in method"
        value={mode}
        onChange={(m) => { setMode(m); setMsg(null) }}
        options={[
          { value: 'in', label: 'Sign in' },
          { value: 'up', label: 'Create account' },
          { value: 'link', label: <><Mail size={14} /> Email link</> },
        ]}
      />
      <form
        className="mt-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Field label="Email">
          <input id="auth-email" type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" />
        </Field>
        {mode !== 'link' && (
          <Field label="Password" hint={mode === 'up' ? 'At least 6 characters.' : undefined}>
            <input id="auth-password" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={6} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        {msg && <p className={cn('rounded-2xl px-4 py-3 text-[13px]', msg.tone === 'good' ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad')}>{msg.text}</p>}
        <Button type="submit" variant="accent" size="lg" disabled={busy || !email || (mode !== 'link' && password.length < 6)}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          {mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send me a link'}
        </Button>
      </form>
    </Screen>
  )
}

function PickWorkspace() {
  const { workspaces, session, loading, error } = useCloud()
  const [name, setName] = useState('')
  const [demo, setDemo] = useState(true)
  return (
    <Screen>
      {workspaces.length > 0 && (
        <>
          <h1 className="text-[22px] font-semibold tracking-tight">Open a studio</h1>
          <ul className="mt-4 mb-6 flex flex-col gap-2">
            {workspaces.map((w) => (
              <li key={w.id}>
                <button type="button" onClick={() => openWorkspace(w)} className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left hover:border-line-strong">
                  <span className="font-medium">{w.name}</span>
                  <span className="text-xs text-ink-3">{w.role}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="eyebrow mb-3">Or start a new one</p>
        </>
      )}
      {!workspaces.length && (
        <>
          <h1 className="text-[22px] font-semibold tracking-tight">Name your studio</h1>
          <p className="mt-1 mb-5 text-sm text-ink-3">It can be just you, or your whole team. If a teammate invited you, ask them to add {session?.user.email} and then reload.</p>
        </>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) void createWorkspace(name.trim(), demo)
        }}
      >
        <Field label="Studio name">
          <input id="ws-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Studio North" required />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input id="ws-demo" type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Start with example projects so I can look around
        </label>
        {error && <p className="rounded-2xl bg-bad-soft px-4 py-3 text-[13px] text-bad">{error}</p>}
        <Button type="submit" variant="accent" size="lg" disabled={loading || !name.trim()}>
          {loading && <Loader2 size={16} className="animate-spin" />}
          Create studio
        </Button>
      </form>
      <button type="button" onClick={() => void signOut()} className="mt-5 text-[13px] text-ink-3 hover:text-ink">
        Sign out of {session?.user.email}
      </button>
    </Screen>
  )
}

/** Wraps the app: sign-in and studio picker when cloud storage is configured, a pass-through otherwise. */
export function CloudGate({ children }: { children: ReactNode }) {
  const { ready, session, workspace, loading } = useCloud()
  useEffect(() => {
    if (cloudEnabled) void initCloud()
  }, [])
  if (!cloudEnabled) return <>{children}</>
  if (!ready) return <Loading text="Starting up…" />
  if (!session) return <SignIn />
  if (!workspace) return loading ? <Loading text="Opening your studio…" /> : <PickWorkspace />
  return <>{children}</>
}

export function SyncBadge() {
  const sync = useCloud((s) => s.sync)
  if (!cloudEnabled) return null
  const off = sync === 'offline' || sync === 'error'
  return (
    <span
      className={cn('hidden h-10 items-center gap-1.5 rounded-full border border-line px-3 text-xs sm:flex', off ? 'text-warn' : 'text-ink-3')}
      title={off ? 'Changes are kept on this device and will upload when the connection is back.' : 'Everything is saved to the cloud.'}
    >
      {off ? <CloudOff size={14} /> : sync === 'saving' ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
      {off ? 'Offline, saving later' : sync === 'saving' ? 'Saving…' : 'Saved'}
    </span>
  )
}
