import { cn } from '../../lib/cn'
import type { Objective } from '../../hooks/useObjectives'
import type { ObjectiveWeek } from '../../hooks/useObjectiveWeeks'
import { useElementWidth } from '../../hooks/useElementWidth'
import { addDays, isoWeek, type IsoDate } from '../../lib/appDate'
import { maskTitle, objectiveSkin } from '../../lib/objectivePalette'

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Géométrie d'une colonne, en pixels — les mêmes nombres que les classes
// arbitraires du JSX plus bas. Elles vivent ici pour que le calcul de « combien
// de semaines tiennent » et le rendu ne puissent pas diverger.
const CELL = 15 // size-[15px]
const COL_PADDING = 3.5 // p-[3.5px]
const COL_BORDER = 1 // border
const COL_GAP = 3 // gap-[3px] entre colonnes
const COL_WIDTH = CELL + COL_PADDING * 2 + COL_BORDER * 2 // 24px

const COL_STEP = COL_WIDTH + COL_GAP // pas d'une colonne à la suivante

/** Combien de colonnes tiennent dans `width` : n colonnes occupent
 *  `n * COL_WIDTH + (n - 1) * COL_GAP`. Au moins une, jamais plus que `max`. */
function fitColumns(width: number, max: number): number {
  return Math.max(1, Math.min(Math.floor((width + COL_GAP) / COL_STEP), max))
}

// Bandeau de mois : hauteur du texte + son écart à la grille. La colonne des
// jours porte le même décalage en tête, sinon ses lettres ne tombent plus en
// face des cases.
const MONTH_ROW = 'mb-1 h-[11px]'

const MONTH_FORMAT = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })

// Un mois trop étroit n'est pas étiqueté : son libellé mordrait sur le suivant
// (un trimestre commence souvent par une semaine à cheval sur le mois d'avant)
// et trois colonnes sont le minimum pour que le repère se lise.
const MONTH_MIN_COLUMNS = 3

/**
 * Un libellé par mois, à la colonne où ce mois commence — le mois d'une semaine
 * est celui de son lundi, comme sur l'écran Objectifs. La position est un décalage
 * en pixels et non une cellule de grille : le bandeau se pose ainsi au-dessus des
 * colonnes sans peser sur leur largeur.
 */
function monthMarks(mondays: IsoDate[]): Array<{ key: string; label: string; left: number }> {
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
      label: MONTH_FORMAT.format(new Date(`${start.monday}T12:00:00Z`))
        .replace('.', '')
        .toUpperCase(),
      left: start.index * COL_STEP,
    }))
}

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
  /** Bandeau des mois au-dessus de la grille, aligné sur les colonnes. */
  showMonthLabels?: boolean
  /** Pastille de couleur + titre au-dessus de la grille. */
  showHeader?: boolean
  /** Ne jamais déborder : si la place manque, les semaines les plus anciennes
   *  sont retirées plutôt que de faire défiler la grille. Suppose un parent qui
   *  contraint la largeur (`min-w-0` dans une grille ou un flex). */
  fit?: boolean
}

export function ObjectiveHeatmap({
  objective,
  weeks,
  weekIndex,
  activeDays,
  today,
  privacy = false,
  showDayLabels = false,
  showMonthLabels = false,
  showHeader = true,
  fit = false,
}: ObjectiveHeatmapProps) {
  const skin = objectiveSkin(objective.slot)
  const [gridRef, gridWidth] = useElementWidth<HTMLDivElement>()

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

  // La troncature est purement visuelle : `run` a déjà couru sur tout le
  // trimestre ci-dessus, donc les couleurs des colonnes restantes sont celles
  // qu'elles auraient eues avec la grille complète. Couper `weeks` en amont
  // aurait redémarré la série et menti sur la rampe.
  const visible =
    fit && gridWidth !== null
      ? columns.slice(-fitColumns(gridWidth, columns.length))
      : columns

  return (
    <div className={cn(fit && 'min-w-0')}>
      {showHeader && (
        <div className="mb-3 flex items-center gap-2">
          <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: skin.hue }} />
          <span className="truncate text-body font-semibold text-[#d5d6e0]">
            {privacy ? maskTitle(objective.title) : objective.title}
          </span>
        </div>
      )}

      <div className={cn('flex gap-[3px]', fit ? 'overflow-hidden' : 'overflow-x-auto')}>
        {showDayLabels && (
          <div className="flex shrink-0 flex-col py-[4.5px] pr-[2px]">
            {showMonthLabels && <span aria-hidden className={MONTH_ROW} />}
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

        {/* La mesure porte sur les colonnes seules : la colonne de libellés est
            hors du compte, sinon elle ferait disparaître une semaine de plus
            que nécessaire. */}
        <div
          ref={gridRef}
          className={cn('flex flex-col', fit ? 'min-w-0 flex-1' : 'shrink-0')}
        >
          {showMonthLabels && (
            <div className={cn('relative overflow-hidden', MONTH_ROW)}>
              {monthMarks(visible.map((col) => col.monday)).map((mark) => (
                <span
                  key={mark.key}
                  className="absolute top-0 text-[8.5px] leading-[11px] whitespace-nowrap text-[#565866]"
                  style={{ left: mark.left }}
                >
                  {mark.label}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-[3px]">
            {visible.map((col) => (
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
                      // Trois creux distincts, jamais `transparent` : une case
                      // invisible fait lire la grille comme décalée à droite, un
                      // trimestre encore vide n'affichant alors que son futur.
                      style={{
                        backgroundColor: active
                          ? col.heat
                          : day > today
                            ? '#1b1c24' // à venir — c'est son liseré qui le dit
                            : col.isCurrent
                              ? '#34364a' // cette semaine, encore jouable
                              : '#20212c', // passé sans séance
                      }}
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
