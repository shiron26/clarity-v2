import type { CSSProperties } from 'react'
import type { ObjectiveWeek } from '../../../hooks/useObjectiveWeeks'
import { computeTrend } from '../objectiveDisplay'

export function TrendBadge({ weeks }: { weeks: ObjectiveWeek[] }) {
  const trend = computeTrend(weeks)

  return (
    <div
      className="animate-trend-pulse box-border w-full rounded-2xl border-[1.5px] px-4.5 py-6 text-center"
      style={{
        backgroundImage: `linear-gradient(165deg,${trend.bg} 0%,rgb(23 24 31 / 0.55) 100%)`,
        borderColor: trend.color,
        color: trend.color,
      }}
    >
      <div
        className="mx-auto flex size-[58px] items-center justify-center rounded-full"
        style={{ backgroundImage: `radial-gradient(circle,${trend.bg} 0%,transparent 72%)` }}
      >
        <RocketIcon
          className="size-[30px]"
          style={{
            color: trend.color,
            transform: trend.rotation,
            filter: `drop-shadow(0 0 12px ${trend.glow})`,
          }}
        />
      </div>
      <div
        className="mt-3.5 text-[14.5px] font-bold tracking-[0.2px]"
        style={{ color: trend.color }}
      >
        {trend.label}
      </div>
      <div className="mt-2 text-[10.5px] leading-relaxed text-ink-onnight">{trend.sub}</div>
    </div>
  )
}

/** La fusée est la métaphore de marque du produit (reviews, transitions). */
function RocketIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden>
      <path d="M12 1.5c3 2.6 4.6 6.2 4.6 9.8 0 1.5-.3 3-.8 4.4H8.2c-.5-1.4-.8-2.9-.8-4.4 0-3.6 1.6-7.2 4.6-9.8z" />
      <circle cx="12" cy="9.2" r="1.9" fill="#17181f" />
      <path d="M8.6 16.6l-2.1 4.2 3.6-1.6 1.9 2.6 1.9-2.6 3.6 1.6-2.1-4.2z" />
    </svg>
  )
}
