import { cn } from '../../lib/cn'
import { maskTitle } from '../../lib/objectivePalette'
import { HEAT_STEPS } from '../../lib/objectiveState'
import type { YearTrack } from '../../lib/yearTimeline'

// Les douze colonnes de mois, en fond de piste.
const MONTHS = Array.from({ length: 12 }, (_, i) => i)

/**
 * L'opacité d'une cellule à l'intérieur de la barre. Blanc translucide et non
 * une couleur : la cellule vit SUR le dégradé du slot, qui change d'un objectif
 * à l'autre — seule une valeur relative reste lisible sur les trois.
 *
 * Cran 0 = période sans activité : un creux sombre, jamais du transparent, qui
 * laisserait voir le dégradé et se lirait comme une semaine pleine.
 */
function cellStyle(level: number): string {
  if (level <= 0) return 'rgb(0 0 0 / 0.4)'
  return `rgb(255 255 255 / ${(0.16 + (level / (HEAT_STEPS - 1)) * 0.81).toFixed(3)})`
}

type YearTimelineTrackProps = {
  track: YearTrack
  /** Position d'aujourd'hui dans l'année, `null` si l'année est révolue. */
  now: number | null
  /** Mobile : segments pleins, sans le détail période par période. */
  overview: boolean
  labelWidth: number
  privacy: boolean
}

export function YearTimelineTrack({
  track,
  now,
  overview,
  labelWidth,
  privacy,
}: YearTimelineTrackProps) {
  const { objective, skin, secondary, from, to, stopAt, lived, state, cells, tag } = track

  const left = from * 100
  const width = (to - from) * 100
  // Part de la fenêtre effectivement remplie. Un objectif arrêté ne remplit que
  // la portion vécue, un objectif à venir n'en remplit aucune — dans les deux cas
  // le reste passe en pointillé, pour montrer ce qui était prévu sans le compter
  // comme un échec.
  const solid = state === 'future' ? 0 : stopAt === null ? width : (stopAt - from) * 100

  const density =
    overview || cells.length === 0
      ? null
      : cells.map((level, i) => (
          <i
            key={i}
            className="min-w-px flex-1 rounded-[2px]"
            style={{ backgroundColor: cellStyle(level) }}
          />
        ))

  return (
    <div
      className={cn('flex items-center', overview ? 'gap-2.5' : 'gap-3.5', secondary && 'opacity-72')}
    >
      <div
        className={cn(
          'flex shrink-0 items-center overflow-hidden font-medium text-ink-onnight-strong',
          overview ? 'gap-1.5 text-[10.5px]' : 'gap-2 text-label',
        )}
        style={{ width: labelWidth }}
      >
        <span
          className={cn('shrink-0 rounded-full', secondary ? 'size-[5px]' : 'size-[7px]')}
          style={{ backgroundColor: skin.hue }}
        />
        <span className={cn('truncate', state === 'stopped' && 'text-ink-onnight')}>
          {privacy ? maskTitle(objective.title) : objective.title}
        </span>
        {tag && !overview && (
          <span className="shrink-0 text-[10px] text-ink-onnight">{tag}</span>
        )}
      </div>

      <div
        className={cn(
          'relative flex-1 rounded-[7px] bg-timeline-track',
          secondary ? 'h-3.5' : overview ? 'h-5' : 'h-[26px]',
        )}
      >
        <div aria-hidden className="absolute inset-0 flex">
          {MONTHS.map((month) => (
            <i
              key={month}
              className={cn(
                'flex-1 border-r last:border-r-0',
                // Le séparateur de trimestre est plus clair : c'est le repère qui
                // relie la frise aux onglets juste en dessous.
                month % 3 === 2 ? 'border-timeline-grid-strong' : 'border-timeline-grid',
              )}
            />
          ))}
        </div>

        {/* Ce qui était prévu et n'a pas été vécu : un contour, jamais un bloc. */}
        {solid < width && (
          <div
            className="absolute inset-y-0 rounded-[7px] border border-dashed border-timeline-ghost"
            style={{ left: `${left + solid}%`, width: `${width - solid}%` }}
          />
        )}

        {solid > 0 && (
          <div
            className={cn(
              'absolute inset-y-0 flex items-stretch gap-[1.5px] overflow-hidden rounded-[7px] p-[3px]',
              stopAt !== null && 'border-r-2 border-dashed border-white/35 opacity-55',
            )}
            style={{ left: `${left}%`, width: `${solid}%`, backgroundImage: skin.gradient }}
          >
            {density}
            {/* Le voile assombrit le « pas encore » pour qu'il ne se confonde pas
                avec une période passée sans activité. */}
            {lived < 1 && (
              <div
                className="absolute inset-y-0 right-0 bg-[rgb(20_21_28/0.66)]"
                style={{ left: `${lived * 100}%` }}
              />
            )}
          </div>
        )}

        {now !== null && (
          <div
            aria-hidden
            className="absolute -top-1.5 -bottom-1.5 w-[1.5px] rounded-[1px] bg-today"
            style={{ left: `${now * 100}%` }}
          />
        )}
      </div>
    </div>
  )
}
