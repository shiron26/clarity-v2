import { objectiveSkin } from '../../../lib/objectivePalette'
import type { Objective } from '../../../hooks/useObjectives'
import type { ObjectiveWeek } from '../../../hooks/useObjectiveWeeks'
import type { IsoDate } from '../../../lib/appDate'

const DAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type ReviewFlowBandsProps = {
  title: string
  objectives: Objective[]
  /** `objectifId|semaineISO` → relevé hebdomadaire. */
  weekIndex: Map<string, ObjectiveWeek>
  weekNo: number
  /** `objectifId|jour` → jour crédité. */
  activeDays: Set<string>
  /** Les 7 dates de la semaine notée, lundi → dimanche. */
  weekDays: IsoDate[]
  onNext: () => void
}

/**
 * Les faits avant le jugement : ce que la semaine a réellement produit, objectif
 * par objectif.
 *
 * Tout vient de `objective_week` et des jours crédités — jamais d'un recalcul
 * depuis les tâches en cache (SPEC §4.1). L'écran ne conclut rien : il montre,
 * l'utilisateur tranchera à l'étape suivante.
 */
export function ReviewFlowBands({
  title,
  objectives,
  weekIndex,
  weekNo,
  activeDays,
  weekDays,
  onNext,
}: ReviewFlowBandsProps) {
  return (
    // 640 px centrés : au-delà, le titre et les cases s'éloignent aux deux bords
    // de l'écran et la bande cesse de se lire comme une ligne.
    <div className="mx-auto flex w-full max-w-160 flex-1 flex-col justify-center">
      <div className="animate-slide-up text-center">
        <p className="text-[10px] font-semibold tracking-[1.4px] text-ink-onnight lg:text-[11px] lg:tracking-[1.5px]">
          {title}
        </p>
        <h2 className="mt-2 mb-5.5 text-[17px] font-semibold text-white lg:text-h1">
          Votre régularité sur les objectifs
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        {objectives.map((objective, index) => {
          const skin = objectiveSkin(objective.slot)
          const week = weekIndex.get(`${objective.id}|${weekNo}`)
          const target = week?.cadence_target ?? objective.cadence ?? 1
          const done = week?.active_days ?? 0
          const daily = target === 7

          const cells = daily
            ? weekDays.map((day) => activeDays.has(`${objective.id}|${day}`))
            : Array.from({ length: target }, (_, i) => i < done)

          const met = daily ? done > 0 : done >= target

          return (
            <div
              key={objective.id}
              className="animate-slide-up flex flex-col gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3.5 lg:flex-row lg:items-center lg:gap-4 lg:rounded-[18px] lg:border-white/6 lg:bg-[linear-gradient(135deg,#17181f,#22242f)] lg:px-6 lg:py-4.5"
              style={{ animationDelay: `${0.1 + index * 0.22}s` }}
            >
              <div className="flex min-w-0 items-center gap-2.5 lg:contents">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundImage: skin.gradient,
                    boxShadow: `0 0 10px ${skin.ramp[1]}66`,
                  }}
                />
                <h3 className="truncate text-[12.5px] font-semibold text-white lg:text-ui">
                  {objective.title}
                </h3>
                <span
                  className="ml-auto shrink-0 text-[10px] font-semibold lg:text-caption"
                  style={{ color: met ? '#3ff5a2' : '#f5a524' }}
                >
                  {daily ? `${done}/7 jours` : `${done}/${target} séances`}
                </span>
              </div>

              <div className="flex gap-1.5">
                {cells.map((filled, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div
                      className="animate-cell-in size-6.5"
                      style={{
                        borderRadius: daily ? 8 : '50%',
                        animationDelay: `${0.45 + index * 0.28 + i * 0.13}s`,
                        ...(filled
                          ? {
                              backgroundImage: `linear-gradient(145deg,${skin.ramp[2]},${skin.ramp[0]})`,
                              boxShadow: `0 0 14px ${skin.ramp[1]}59, inset 0 1px 0 rgb(255 255 255 / 0.35)`,
                            }
                          : { backgroundColor: 'rgb(255 255 255 / 0.06)' }),
                      }}
                    />
                    {daily && (
                      <span className="text-[8px] text-[#565866]">{DAY_INITIALS[i]}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onNext}
          className="animate-slide-up mt-6.5 flex min-h-12 cursor-pointer items-center justify-center rounded-[14px] bg-primary px-6.5 text-ui font-medium text-white shadow-[0_8px_20px_rgb(0_68_224_/_0.35)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-px active:bg-primary-active focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none lg:mt-7.5 lg:min-h-0 lg:rounded-lg lg:py-3 lg:text-body"
          style={{ animationDelay: '1.9s' }}
        >
          Noter mes objectifs →
        </button>
      </div>
    </div>
  )
}
