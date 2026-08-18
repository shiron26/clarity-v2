import { cn } from '../../lib/cn'
import type { Objective } from '../../hooks/useObjectives'
import type { ObjectivePeriod, PeriodUnit } from '../../hooks/useObjectivePeriods'
import { addDays, formatMonthShort, type IsoDate } from '../../lib/appDate'
import { comparePeriods, periodRef } from '../../lib/objectivePeriod'
import { heatLevel } from '../../lib/objectiveState'
import { maskTitle, objectiveSkinOf } from '../../lib/objectivePalette'

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Géométrie : une SEULE source. `--heat-cell` est la seule mesure qui varie ;
// marges, écarts et rayons s'en déduisent en `calc()` dans les classes. C'est ce
// qui met fin au doublon d'avant, où des constantes JS (`CELL`, `COL_STEP`)
// répétaient des classes Tailwind arbitraires et pouvaient diverger en silence.
//
// Poser une custom property en style inline est l'exception minimale prévue par
// AGENTS.md — une déclaration par composant, et non une par cellule. Le dépôt en
// use déjà pour les particules de `ObjectiveCard` (`--tx` / `--ty`).
const CELL_SIZES = {
  sm: '11px',
  md: '15px',
  lg: '25px',
} as const

export type HeatmapSize = keyof typeof CELL_SIZES | 'auto'

// Pas d'une colonne à la suivante : la case, ses deux marges internes (3.5px),
// ses deux bordures (1px) et l'écart entre colonnes (3px) — soit `cell + 12`.
// Sert uniquement à poser les libellés de mois au-dessus des bonnes colonnes.
const COLUMN_STEP = 'calc(var(--heat-cell) + 12px)'

// Un mois trop étroit n'est pas étiqueté : son libellé mordrait sur le suivant
// (un trimestre commence souvent par une semaine à cheval sur le mois d'avant)
// et trois colonnes sont le minimum pour que le repère se lise.
const MONTH_MIN_COLUMNS = 3

/**
 * Un libellé par mois, à la colonne où ce mois commence — le mois d'une semaine
 * est celui de son lundi. La position est un décalage horizontal et non une
 * cellule de grille : le bandeau se pose ainsi au-dessus des colonnes sans peser
 * sur leur largeur.
 */
function monthMarks(mondays: IsoDate[]): Array<{ key: string; label: string; index: number }> {
  const starts: Array<{ key: string; monday: IsoDate; index: number }> = []
  mondays.forEach((monday, index) => {
    const key = monday.slice(0, 7)
    if (starts[starts.length - 1]?.key === key) return
    starts.push({ key, monday, index })
  })

  return starts
    .filter((start, i) => (starts[i + 1]?.index ?? mondays.length) - start.index >= MONTH_MIN_COLUMNS)
    .map((start) => ({
      key: start.key,
      label: formatMonthShort(start.monday).toUpperCase(),
      index: start.index,
    }))
}

type ObjectiveHeatmapProps = {
  objective: Objective
  /** Lundis des semaines à afficher, dans l'ordre. */
  weeks: IsoDate[]
  /** Relevés de CET objectif. La colonne résout sa période elle-même. */
  periods: ObjectivePeriod[]
  /** L'unité des relevés : une colonne reste une semaine, la période non. */
  unit: PeriodUnit
  /** `objectifId|jour` → ce jour a été crédité. */
  activeDays: Set<string>
  today: IsoDate
  privacy?: boolean
  /** Colonne de libellés L→D à gauche de la grille. */
  showDayLabels?: boolean
  /** Bandeau des mois au-dessus de la grille, aligné sur les colonnes. */
  showMonthLabels?: boolean
  /** Pastille de couleur + titre au-dessus de la grille. */
  showHeader?: boolean
  /** `auto` = 11 px au doigt, 25 px au curseur (les valeurs de la maquette). */
  size?: HeatmapSize
  className?: string
}

/**
 * La grille de densité d'un objectif : une colonne par semaine, une case par
 * jour.
 *
 * **L'intensité dit ce qui a été fait dans la période, pas depuis combien de
 * temps ça dure** (`heatLevel`, REFONTE §0.1). Le cadre autour d'une colonne dit
 * autre chose et le dit seul : la période a atteint sa cible.
 */
export function ObjectiveHeatmap({
  objective,
  weeks,
  periods,
  unit,
  activeDays,
  today,
  privacy = false,
  showDayLabels = false,
  showMonthLabels = false,
  showHeader = true,
  size = 'auto',
  className,
}: ObjectiveHeatmapProps) {
  const skin = objectiveSkinOf(objective)

  const columns = weeks.map((monday) => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
    const isCurrent = monday <= today && today <= days[6]!
    const isFuture = monday > today

    // La période d'une colonne n'est pas forcément sa semaine : une habitude
    // mensuelle fait partager la même teinte à toutes les colonnes d'un mois.
    // C'est voulu — « ce mois-là a été dense » — et non un défaut d'alignement.
    const ref = periodRef(unit, monday)
    const record = periods.find(
      (p) =>
        p.period_unit === unit &&
        comparePeriods({ periodYear: p.period_year, periodIndex: p.period_index }, ref) === 0,
    )

    // « Période tenue » se lit dans objective_period (source de vérité), jamais
    // d'un comptage des cases : les deux peuvent différer sur une période
    // clôturée, et c'est le relevé qui fait foi.
    const held = !!record && record.done >= record.target
    const heat = skin.ramp[heatLevel(record?.done ?? 0, record?.target ?? 0)]!

    return { monday, days, isCurrent, isFuture, held, heat }
  })

  const cell = size === 'auto' ? undefined : CELL_SIZES[size]

  return (
    <div
      className={cn(size === 'auto' && '[--heat-cell:11px] lg:[--heat-cell:25px]', className)}
      style={cell ? ({ '--heat-cell': cell } as React.CSSProperties) : undefined}
    >
      {showHeader && (
        <div className="mb-3 flex items-center gap-2">
          <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: skin.hue }} />
          <span className="truncate text-body font-semibold text-ink-onnight-strong">
            {privacy ? maskTitle(objective.title) : objective.title}
          </span>
        </div>
      )}

      <div className="flex gap-[3px] overflow-x-auto">
        {showDayLabels && (
          <div className="flex shrink-0 flex-col py-[4.5px] pr-[2px]">
            {showMonthLabels && <span aria-hidden className="mb-1 h-[11px]" />}
            {DAY_LABELS.map((label, i) => (
              <span
                key={i}
                aria-hidden
                className="mb-[3.5px] flex h-(--heat-cell) items-center justify-center text-[8.5px] text-ink-onnight-faint"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="flex shrink-0 flex-col">
          {showMonthLabels && (
            <div className="relative mb-1 h-[11px] overflow-hidden">
              {monthMarks(columns.map((col) => col.monday)).map((mark) => (
                <span
                  key={mark.key}
                  className="absolute top-0 text-[8.5px] leading-[11px] whitespace-nowrap text-ink-onnight-faint"
                  style={{ left: `calc(${COLUMN_STEP} * ${mark.index})` }}
                >
                  {mark.label}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-[3px]">
            {columns.map((col) => (
              <div
                key={col.monday}
                title={`Semaine du ${col.monday}`}
                className="flex shrink-0 flex-col gap-[3.5px] rounded-[calc(var(--heat-cell)/2.5)] border border-transparent p-[3.5px]"
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
                        'size-(--heat-cell) rounded-[calc(var(--heat-cell)/3.75)]',
                        active && isToday && 'animate-cell-pulse',
                        !active && (col.isFuture || day > today) && 'border border-heat-future-line',
                        // Trois creux distincts, jamais `transparent` : une case
                        // invisible fait lire la grille comme décalée à droite,
                        // un trimestre encore vide n'affichant alors que son futur.
                        !active &&
                          (day > today
                            ? 'bg-heat-future'
                            : col.isCurrent
                              ? 'bg-heat-live'
                              : 'bg-heat-empty'),
                      )}
                      style={active ? { backgroundColor: col.heat } : undefined}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
