import type { Objective } from '../../../hooks/useObjectives'
import type { ObjectiveWeek } from '../../../hooks/useObjectiveWeeks'
import { quarterRatingKey, type QuarterRatings } from '../../../hooks/useQuarterRatings'
import { objectiveSkin } from '../../../lib/objectivePalette'
import { RATING_COLORS } from '../../../lib/reviewRating'
import type { IsoDate, WeekRef } from '../../../lib/appDate'

type CadenceStripProps = {
  objective: Objective
  week: ObjectiveWeek | undefined
  /** `objectifId|jour` → jour crédité. */
  activeDays: Set<string>
  /** Les 7 dates de la semaine en cours, lundi → dimanche. */
  weekDays: IsoDate[]
  /** Semaines du trimestre affiché, dans l'ordre. */
  quarterWeeks: WeekRef[]
  ratings: QuarterRatings
  quarter: number
}

/**
 * « Cette semaine » + évolution du trimestre.
 *
 * Deux lectures distinctes, jamais mélangées : à gauche les faits de la semaine
 * (jours crédités), à droite les notes que l'utilisateur s'est données en
 * review. L'app enregistre les premiers, l'utilisateur pose les secondes.
 */
export function CadenceStrip({
  objective,
  week,
  activeDays,
  weekDays,
  quarterWeeks,
  ratings,
  quarter,
}: CadenceStripProps) {
  const skin = objectiveSkin(objective.slot)
  const isDaily = objective.cadence === 7
  const target = week?.cadence_target ?? objective.cadence ?? 1
  const done = week?.active_days ?? 0

  // Cadence 7 : on montre les 7 jours réels. Sinon, autant de cases que la
  // cadence figée de la semaine — la cible fait foi, pas la cadence actuelle.
  const cells = isDaily
    ? weekDays.map((day) => activeDays.has(`${objective.id}|${day}`))
    : Array.from({ length: target }, (_, i) => i < done)

  return (
    <div className="flex flex-wrap items-center gap-6 border-b border-surface-subtle bg-field px-5.5 py-4">
      <div className="shrink-0">
        <div className="mb-2 text-[11px] text-ink-2">
          Cette semaine{' '}
          <span className="font-semibold text-ink">
            {isDaily ? `${done}/7 jours` : `${done}/${target} séances`}
          </span>
        </div>
        <div className="flex gap-1.5">
          {cells.map((filled, i) => (
            <span
              key={i}
              className="size-[18px] rounded-xs"
              style={
                filled
                  ? {
                      backgroundImage: `linear-gradient(145deg,${skin.ramp[2]},${skin.ramp[0]})`,
                      boxShadow: `0 0 8px ${skin.ramp[1]}59`,
                    }
                  : { backgroundColor: '#dcdbd4' }
              }
            />
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1 text-right">
        <div className="flex h-7 items-end justify-end gap-1">
          {quarterWeeks.map(({ isoYear, weekNo }) => {
            const rating = ratings.get(quarterRatingKey(objective.id, isoYear, weekNo))
            return (
              <span
                key={`${isoYear}-${weekNo}`}
                title={`Semaine ${weekNo}${rating ? ` — note ${rating}/3` : ' — non notée'}`}
                className="w-3 shrink-0 rounded-xs"
                style={{
                  height: rating ? rating * 7 + 3 : 3,
                  backgroundColor: rating ? RATING_COLORS[rating] : '#d8d7d0',
                }}
              />
            )
          })}
        </div>
        <span className="text-[8.5px] tracking-[1px] text-ink-muted">ÉVOLUTION Q{quarter}</span>
      </div>
    </div>
  )
}
