import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Member, Priority, Status } from '../lib/types'
import { cn, hueBg, hueFg, initials, priorityLabel } from '../lib/utils'
import { useTheme } from '../lib/theme'

/* ---------- Buttons ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        variant === 'primary' && 'bg-ink text-bg hover:opacity-90',
        variant === 'accent' && 'bg-accent text-accent-ink shadow-[0_8px_24px_-8px_var(--accent-glow)] hover:brightness-105',
        variant === 'secondary' && 'border border-line bg-surface-2 text-ink hover:bg-surface-3',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'danger' && 'bg-bad-soft text-bad hover:brightness-95',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({ label, className, children, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        'inline-grid size-10 shrink-0 place-items-center rounded-full text-ink-2 transition-all hover:bg-surface-2 hover:text-ink active:scale-95',
        active && 'bg-surface-2 text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ---------- Surfaces ---------- */

export function Card({ className, children, as: As = 'section', ...rest }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As {...rest} className={cn('card p-5', className)}>
      {children}
    </As>
  )
}

export function CardHeader({ title, action, sub }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-medium tracking-tight text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      {icon && <div className="mb-1 grid size-11 place-items-center rounded-full bg-surface-2 text-ink-3">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="max-w-sm text-[13px] text-ink-3">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/* ---------- Identity ---------- */

export function Avatar({ member, size = 32, ring }: { member?: Pick<Member, 'name' | 'hue'> | null; size?: number; ring?: boolean }) {
  const dark = useTheme().dark
  if (!member) return <span className="inline-grid shrink-0 place-items-center rounded-full bg-surface-3 text-ink-3" style={{ width: size, height: size, fontSize: size * 0.38 }}>?</span>
  return (
    <span
      title={member.name}
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold', ring && 'ring-2 ring-surface')}
      style={{ width: size, height: size, fontSize: size * 0.36, background: hueBg(member.hue, dark), color: hueFg(member.hue, dark) }}
    >
      {initials(member.name)}
    </span>
  )
}

export function AvatarStack({ members, max = 4, size = 26 }: { members: Member[]; max?: number; size?: number }) {
  const shown = members.slice(0, max)
  const extra = members.length - shown.length
  return (
    <div className="flex -space-x-2">
      {shown.map((m) => (
        <Avatar key={m.id} member={m} size={size} ring />
      ))}
      {extra > 0 && (
        <span className="inline-grid place-items-center rounded-full bg-surface-3 font-medium text-ink-2 ring-2 ring-surface" style={{ width: size, height: size, fontSize: size * 0.38 }}>
          +{extra}
        </span>
      )}
    </div>
  )
}

export function ClientMark({ name, hue, size = 32 }: { name: string; hue: number; size?: number }) {
  const dark = useTheme().dark
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-[30%] font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.4, background: hueBg(hue, dark), color: hueFg(hue, dark) }}
    >
      {name.replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase()}
    </span>
  )
}

/* ---------- Status & priority ---------- */

export function StatusPill({ status, className }: { status?: Status; className?: string }) {
  if (!status) return null
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-surface-2 pr-2.5 pl-2 text-xs font-medium text-ink-2', className)}>
      <span className="size-2 rounded-full" style={{ background: status.color }} />
      {status.name}
    </span>
  )
}

const prioStyle: Record<Priority, string> = {
  urgent: 'bg-bad-soft text-bad',
  high: 'bg-warn-soft text-warn',
  medium: 'bg-surface-2 text-ink-2',
  low: 'bg-surface-2 text-ink-3',
}
export function PriorityTag({ priority, compact }: { priority: Priority; compact?: boolean }) {
  const bars = { urgent: 3, high: 3, medium: 2, low: 1 }[priority]
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium', prioStyle[priority])} title={`${priorityLabel[priority]} priority`}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn('w-[3px] rounded-full bg-current', i > bars && 'opacity-25')} style={{ height: 3 + i * 2 }} />
        ))}
      </span>
      {!compact && priorityLabel[priority]}
    </span>
  )
}

export function Chip({ active, onClick, children, count }: { active?: boolean; onClick?: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
        active ? 'border-transparent bg-ink text-bg' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
      {count !== undefined && <span className={cn('tnum text-xs', active ? 'opacity-70' : 'text-ink-3')}>{count}</span>}
    </button>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-6 items-center rounded-full bg-surface-2 px-2.5 text-xs text-ink-2">#{children}</span>
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-grid h-5 min-w-5 place-items-center rounded-md border border-line bg-surface-2 px-1 font-mono text-[11px] text-ink-3">{children}</kbd>
}

/* ---------- Data marks ---------- */

/** Ring gauge in the spirit of the reference: thick track, lime arc, round cap with a dot. */
export function Ring({ value, size = 120, stroke = 12, children, color = 'var(--accent)' }: { value: number; size?: number; stroke?: number; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  const angle = v * 2 * Math.PI - Math.PI / 2
  const cx = size / 2 + r * Math.cos(angle)
  const cy = size / 2 + r * Math.sin(angle)
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)', filter: 'drop-shadow(0 0 10px var(--accent-glow))' }}
        />
        {v > 0.02 && <circle cx={cx} cy={cy} r={stroke / 5} fill="var(--accent-ink)" opacity={0.7} />}
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  )
}

export function Bar({ value, className, tone = 'accent' }: { value: number; className?: string; tone?: 'accent' | 'ink' | 'warn' | 'bad' }) {
  const bg = { accent: 'bg-accent', ink: 'bg-ink', warn: 'bg-warn', bad: 'bg-bad' }[tone]
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', bg)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

/* ---------- Overlays ---------- */

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('input, textarea, select, button[data-autofocus]')?.focus())
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'anim-pop flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface shadow-pop sm:rounded-[28px]',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
          <h2 id={titleId} className="text-lg font-medium tracking-tight">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={18} />
          </IconButton>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-6 pb-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="anim-fade fixed inset-0 z-40 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label={label} className="anim-slide flex h-full w-full max-w-xl flex-col border-l border-line bg-surface shadow-pop" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {children}
      </aside>
    </div>
  )
}

/* ---------- Forms ---------- */

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-accent-text/60 focus:bg-surface'
export const textareaCls = cn(inputCls, 'h-auto min-h-[84px] resize-y py-2.5 leading-relaxed')

export function TagInput({ value, onChange, placeholder, id }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const parts = draft.split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean)
    if (parts.length) onChange(Array.from(new Set([...value, ...parts])))
    setDraft('')
  }
  return (
    <div className={cn(inputCls, 'flex h-auto min-h-10 flex-wrap items-center gap-1.5 py-1.5')}>
      {value.map((t) => (
        <span key={t} className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-3 pr-1 pl-2.5 text-xs">
          {t}
          <button type="button" aria-label={`Remove ${t}`} className="grid size-4 place-items-center rounded-full hover:bg-line-strong" onClick={() => onChange(value.filter((x) => x !== t))}>
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
      />
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-all',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
