import { cn } from '../../lib/cn'
import type { Objective } from '../../hooks/useObjectives'
import type { ObjectiveWeek } from '../../hooks/useObjectiveWeeks'
import { addDays, isoWeek, type IsoDate } from '../../lib/appDate'
import { maskTitle, objectiveSkin } from '../../lib/objectivePalette'

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type ObjectiveHeatmapProps = {
  objective: Objective
  /** Lundis des semaines à afficher — trimestre sur le dashboard, 13 dernières
   *  semaines sur l'écran Objectifs. */
  weeks: IsoDate[]
  /** `objectifId|semaineISO` → relevé hebdomadaire. */
  weekIndex: Map<string, ObjectiveWeek>
  /** `objectifId|jour` → ce jour a été crédité. */
  activeDays: Set<string>
  today: IsoDate
  privacy?: boolean
  /** Colonne de libellés L→D à gauche de la grille. */
  showDayLabels?: boolean
  /** Pastille de couleur + titre au-dessus de la grille. */
  showHeader?: boolean
}

export function ObjectiveHeatmap({
  objective,
  weeks,
  weekIndex,
  activeDays,
  today,
  privacy = false,
  showDayLabels = false,
  showHeader = true,
}: ObjectiveHeatmapProps) {
  const skin = objectiveSkin(objective.slot)

  // La série chauffe : plus les semaines tenues s'enchaînent, plus la rampe
  // monte. `run` se remet à zéro dès qu'une semaine passée n'atteint pas la
  // cadence ; la semaine en cours ne casse pas la série, elle n'est pas finie.
  let run = 0

  const columns = weeks.map((monday) => {
    const { isoWeek: weekNo } = isoWeek(monday)
    const record = weekIndex.get(`${objective.id}|${weekNo}`)
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
    const isCurrent = monday <= today && today <= days[6]!
    const isFuture = monday > today

    // « Semaine tenue » se lit dans objective_week (source de vérité), jamais
    // d'un comptage des cases : les deux peuvent différer sur une période
    // clôturée, et c'est le relevé qui fait foi.
    const held = !!record && record.active_days >= record.cadence_target
    if (isFuture) {
      // rien
    } else if (isCurrent) {
      // la semaine en cours est en sursis : elle ne rompt pas la série
    } else if (held) {
      run += 1
    } else {
      run = 0
    }

    const heat = skin.ramp[Math.min(Math.max(run - 1, 0), 5)]!

    return { monday, days, isCurrent, isFuture, held, heat }
  })

  return (
    <div>
      {showHeader && (
        <div className="mb-3 flex items-center gap-2">
          <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: skin.hue }} />
          <span className="truncate text-body font-semibold text-[#d5d6e0]">
            {privacy ? maskTitle(objective.title) : objective.title}
          </span>
        </div>
      )}

      <div className="flex gap-[3px] overflow-x-auto">
        {showDayLabels && (
          <div className="flex shrink-0 flex-col py-[4.5px] pr-[2px]">
            {DAY_LABELS.map((label, i) => (
              <span
                key={i}
                aria-hidden
                className="mb-[3.5px] h-[15px] text-center text-[8.5px] leading-[15px] text-[#565866]"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {columns.map((col) => (
          <div
            key={col.monday}
            title={`Semaine du ${col.monday}`}
            // rayons hors échelle du design system : à 15px, `rounded-sm` (9px)
            // transformerait les cases en pastilles.
            className="flex shrink-0 flex-col gap-[3.5px] rounded-[8px] border border-transparent p-[3.5px]"
            style={
              col.held
                ? { backgroundColor: `${col.heat}30`, borderColor: `${col.heat}cc` }
                : undefined
            }
          >
            {col.days.map((day) => {
              const active = activeDays.has(`${objective.id}|${day}`)
              const isToday = day === today
              return (
                <span
                  key={day}
                  className={cn(
                    'size-[15px] rounded-[4px]',
                    active && isToday && 'animate-cell-pulse',
                    !active && (col.isFuture || day > today) && 'border border-[#262734]',
                  )}
                  style={{
                    backgroundColor: active
                      ? col.heat
                      : day > today
                        ? '#20212c'
                        : col.isCurrent
                          ? '#34364a'
                          : 'transparent',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
