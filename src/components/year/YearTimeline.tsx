import { YearTimelineTrack } from './YearTimelineTrack'
import { cn } from '../../lib/cn'
import type { YearTrack } from '../../lib/yearTimeline'

const QUARTERS = ['T1', 'T2', 'T3', 'T4']
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

type YearTimelineProps = {
  tracks: YearTrack[]
  /** Position d'aujourd'hui dans l'année, `null` si l'année est révolue. */
  now: number | null
  /**
   * Mobile : segments pleins, sans détail période par période. 52 semaines à
   * 390 px ne se lisent pas — le détail se consulte trimestre par trimestre.
   */
  overview: boolean
  privacy?: boolean
  className?: string
}

/**
 * Le récit de l'année : un segment par objectif, à sa place et à sa longueur.
 *
 * Un objectif de trois mois n'y est pas un trou, c'est une séquence terminée
 * (REFONTE §6). Les secondaires ferment la frise — `useObjectives` les trie déjà
 * ainsi, le composant ne réordonne rien.
 */
export function YearTimeline({
  tracks,
  now,
  overview,
  privacy = false,
  className,
}: YearTimelineProps) {
  const labelWidth = overview ? 112 : 226
  const gap = overview ? 'gap-2.5' : 'gap-3.5'

  const scale = (items: string[], className: string) => (
    <div aria-hidden className={cn('flex items-center', gap)}>
      <span className="shrink-0" style={{ width: labelWidth }} />
      <div className={cn('flex flex-1', className)}>
        {items.map((item, i) => (
          <span key={i} className="flex-1 text-center">
            {item}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div className={cn('flex flex-col', overview ? 'gap-2.5' : 'gap-3', className)}>
      {scale(QUARTERS, 'text-[9px] font-semibold tracking-[1px] text-ink-onnight')}

      <div className={cn('flex flex-col', overview ? 'gap-[7px]' : 'gap-[9px]')}>
        {tracks.map((track) => (
          <YearTimelineTrack
            key={track.objective.id}
            track={track}
            now={now}
            overview={overview}
            labelWidth={labelWidth}
            privacy={privacy}
          />
        ))}
      </div>

      {scale(MONTH_INITIALS, 'text-[9px] tracking-[0.6px] text-ink-onnight-faint')}
    </div>
  )
}
