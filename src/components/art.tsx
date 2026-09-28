import { useTheme } from '../lib/theme'
import { cn } from '../lib/utils'

/** Generated project cover: a quiet abstract composition, unique per project. */
export function Cover({ hue, shape, className, label }: { hue: number; shape: number; className?: string; label?: string }) {
  const { dark } = useTheme()
  const bg = dark ? `oklch(0.24 0.04 ${hue})` : `oklch(0.9 0.05 ${hue})`
  const a = dark ? `oklch(0.55 0.13 ${hue})` : `oklch(0.7 0.13 ${hue})`
  const b = dark ? `oklch(0.36 0.08 ${hue + 40})` : `oklch(0.8 0.09 ${hue + 40})`
  const lime = 'var(--accent)'
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ background: bg }} role={label ? 'img' : undefined} aria-label={label}>
      <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        {shape === 0 && (
          <>
            <circle cx="140" cy="60" r="46" fill={a} />
            <circle cx="70" cy="95" r="30" fill={b} />
            <circle cx="160" cy="28" r="6" fill={lime} />
          </>
        )}
        {shape === 1 && (
          <>
            <path d="M40 120 V70 a40 40 0 0 1 80 0 V120 Z" fill={a} />
            <path d="M110 120 V85 a30 30 0 0 1 60 0 V120 Z" fill={b} />
            <rect x="24" y="22" width="30" height="6" rx="3" fill={lime} />
          </>
        )}
        {shape === 2 && (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={i} x={30 + i * 30} y={30 + (i % 2) * 18} width="18" height={80 - (i % 3) * 14} rx="9" fill={i === 3 ? lime : i % 2 ? b : a} />
            ))}
          </>
        )}
        {shape === 3 && (
          <>
            <rect x="30" y="24" width="90" height="90" rx="22" fill={a} transform="rotate(-12 75 69)" />
            <rect x="105" y="40" width="64" height="64" rx="32" fill={b} />
            <circle cx="136" cy="72" r="8" fill={lime} />
          </>
        )}
      </svg>
    </div>
  )
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-label="DesignFlow" role="img">
      <rect width="36" height="36" rx="11" fill="var(--accent)" />
      <path d="M10 11.5h11.5a5 5 0 0 1 0 10H15" stroke="var(--accent-ink)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <path d="M10 18h6M10 24.5h9" stroke="var(--accent-ink)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}
