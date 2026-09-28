import { useId, useState } from 'react'
import { cn } from '../lib/utils'

export interface Datum {
  label: string
  value: number
  hint?: string
}

/**
 * Pill bars from the reference: hatched track shows the scale ceiling,
 * the solid pill shows the value, and the highlighted pill glows lime.
 */
export function PillBars({ data, highlight, format = (v) => String(v), height = 170 }: { data: Datum[]; highlight?: number; format?: (v: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const active = hover ?? highlight ?? -1
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height: height + 28 }} role="list">
      {data.map((d, i) => {
        const h = Math.max(10, (d.value / max) * height)
        const on = i === active
        return (
          <div
            key={d.label + i}
            role="listitem"
            aria-label={`${d.hint ?? d.label}: ${format(d.value)}`}
            tabIndex={0}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="group relative flex flex-1 flex-col items-center gap-2 outline-none"
          >
            <div className="relative flex w-full max-w-12 flex-col justify-end" style={{ height }}>
              <div className="hatch absolute inset-x-0 bottom-0 rounded-full opacity-60" style={{ height: Math.min(height, h + 22) }} />
              <div
                className={cn('relative w-full rounded-full transition-all duration-300', on ? 'bg-accent shadow-[0_0_28px_-4px_var(--accent-glow)]' : 'bg-line-strong group-hover:bg-ink-3/50')}
                style={{ height: h }}
              >
                {on && (
                  <span className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-accent-ink tnum">
                    {format(d.value)}
                  </span>
                )}
                {on && <span className="absolute top-1.5 left-1/2 size-2 -translate-x-1/2 rounded-full bg-accent-ink/60" />}
              </div>
            </div>
            <span className={cn('text-xs', on ? 'text-ink' : 'text-ink-3')}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Area line with lime glow and a crosshair tooltip. One series, one axis. */
export function AreaChart({ data, format = (v) => String(v), height = 180 }: { data: Datum[]; format?: (v: number) => string; height?: number }) {
  const id = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
  const W = 600
  const H = height
  const pad = { t: 16, b: 26, l: 8, r: 8 }
  const max = Math.max(1, ...data.map((d) => d.value)) * 1.15
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const pts = data.map((d, i) => [x(i), y(d.value)] as const)
  const line = pts.map(([px, py], i) => {
    if (i === 0) return `M${px},${py}`
    const [qx, qy] = pts[i - 1]!
    const cx = (qx + px) / 2
    return `C${cx},${qy} ${cx},${py} ${px},${py}`
  }).join(' ')
  const area = `${line} L${x(data.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`
  const last = pts.length - 1
  const hi = hover ?? last
  const labelEvery = Math.ceil(data.length / 6)
  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`Trend: ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const rel = ((e.clientX - r.left) / r.width) * W
          const i = Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (data.length - 1))
          setHover(Math.max(0, Math.min(data.length - 1, i)))
        }}
      >
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <filter id={`f${id}`} x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + f * (H - pad.t - pad.b)} y2={pad.t + f * (H - pad.t - pad.b)} stroke="var(--line)" strokeDasharray="2 6" />
        ))}
        <path d={area} fill={`url(#g${id})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="6" opacity="0.35" filter={`url(#f${id})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        {data.map((d, i) =>
          i % labelEvery === 0 || i === last ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} fontSize="12" fill="var(--ink-3)">
              {d.label}
            </text>
          ) : null,
        )}
        <line x1={pts[hi]![0]} x2={pts[hi]![0]} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" />
        <circle cx={pts[hi]![0]} cy={pts[hi]![1]} r="6" fill="var(--accent)" stroke="var(--surface)" strokeWidth="3" />
      </svg>
      <div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs shadow-pop"
        style={{ left: `${(pts[hi]![0] / W) * 100}%`, top: `${(pts[hi]![1] / H) * 100}%`, marginTop: -12 }}
      >
        <span className="text-ink-3">{data[hi]!.hint ?? data[hi]!.label}</span> <span className="tnum font-semibold text-ink">{format(data[hi]!.value)}</span>
      </div>
    </div>
  )
}

/** Ranked horizontal bars. Labels in ink, value at the end, the top row in accent. */
export function RankBars({ data, format = (v) => String(v) }: { data: Datum[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d, i) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5" title={`${d.label}: ${format(d.value)}`}>
          <span className="truncate text-[13px] text-ink-2">{d.label}</span>
          <span className="tnum text-[13px] font-medium text-ink">{format(d.value)}</span>
          <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-surface-3">
            <div className={cn('h-full rounded-full', i === 0 ? 'bg-accent' : 'bg-ink-3/60')} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
