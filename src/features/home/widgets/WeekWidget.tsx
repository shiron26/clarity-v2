import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAppDayStart } from '../../../hooks/useAppToday'
import { useTasks, type Task } from '../../../hooks/useTasks'
import { selectTaskLists, useLists } from '../../../hooks/useLists'
import { useObjectives } from '../../../hooks/useObjectives'
import { TaskRowList } from '../../../components/tasks/TaskRowList'
import { objectiveSkin } from '../../../lib/objectivePalette'
import {
  formatDayHeader,
  formatDayNumber,
  isoWeekday,
  rollingWeek,
  WEEK_HEADERS,
  type IsoDate,
} from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import type { WidgetSpan } from '../dashboardLayout'
import { useDashboardCtx } from '../dashboardContext'
import { useDashboardObjectives } from '../useDashboardObjectives'
import { EmptyToday } from '../components/EmptyToday'
import { OverdueCard } from '../components/OverdueCard'
import { WIDGET_GLYPH } from './glyphs'
import { WidgetCard, WidgetEmpty } from './WidgetCard'

const DOTS = 3
// Trois colonnes quand la place manque : sept à 390 px tombent à un chiffre
// illisible. La fenêtre suit le jour CHOISI, pas le jour courant : c'est ce qui
// rend les sept jours atteignables sans ajouter deux flèches à une carte déjà
// dense — choisir la colonne de droite découvre la suivante, de proche en proche.
const NARROW_COLUMNS = 3

/**
 * « Votre semaine » — aujourd'hui et les six jours suivants, ce qui est dû
 * chacun, et le retard à côté.
 *
 * Le seul endroit du produit qui regarde devant : l'accueil s'arrête sinon à
 * aujourd'hui, et le jeudi chargé n'existe pas tant qu'on n'est pas jeudi.
 *
 * La fenêtre GLISSE (`rollingWeek`), elle n'est pas la semaine calendaire. Une
 * bande lundi → dimanche rétrécit au fil de la semaine : le vendredi elle ne
 * montre plus que trois jours d'avenir contre quatre colonnes de passé grisé, et
 * le dimanche plus qu'un seul. C'est l'exact contraire de ce que ce widget est
 * là pour faire. Le passé n'y figure plus du tout : il est déjà couvert par la
 * carte « En retard » posée juste à côté.
 *
 * Il a absorbé « Aujourd'hui », qui affichait exactement les mêmes lignes que la
 * colonne du jour — un doublon à deux endroits de l'écran. Le retard le suit :
 * ce qui est dû et ce qui aurait dû l'être se lisent d'un même regard.
 *
 * Ce sont des ÉCHÉANCES, pas un planning. Rien ne se reporte d'une colonne à
 * l'autre, et un samedi vide reste vide sans invitation à le remplir.
 *
 * Le repli à trois jours suit la largeur RÉELLE du widget, pas le seul point de
 * rupture : posé sur un tiers de grille, il est aussi à l'étroit qu'un téléphone,
 * même sur un grand écran.
 */
export function WeekWidget({ span }: { span: WidgetSpan }) {
  const { today, onToggleTask, onToggleImportant, donePhaseFor, reducedMotion, isVisible } =
    useDashboardCtx()
  const [selected, setSelected] = useState<IsoDate | null>(null)

  const dayStartQuery = useAppDayStart()
  const tasksQuery = useTasks('all', { completedSince: dayStartQuery.data })
  const overdueQuery = useTasks('overdue', { today })
  const listsQuery = useLists()
  const objectivesQuery = useObjectives(Number(today.slice(0, 4)))
  // Pour la phrase du jour vide : « vos trois séances de la semaine sont faites »
  // ne s'écrit que si c'est vrai.
  const { principals, weekComplete, sessionsThisWeek } = useDashboardObjectives(today)

  const week = useMemo(() => rollingWeek(today), [today])
  const day = selected && week.includes(selected) ? selected : today

  const objectiveById = useMemo(
    () => new Map((objectivesQuery.data ?? []).map((o) => [o.id, o])),
    [objectivesQuery.data],
  )
  const listById = useMemo(
    () => new Map(selectTaskLists(listsQuery.data).map((l) => [l.id, l])),
    [listsQuery.data],
  )

  // Les tâches de la semaine, rangées par échéance. Les aide-mémoire n'ont pas
  // de date : ils ne peuvent pas entrer ici.
  const byDay = useMemo(() => {
    const map = new Map<IsoDate, Task[]>()
    for (const task of tasksQuery.data ?? []) {
      if (!task.due_date || !week.includes(task.due_date)) continue
      const bucket = map.get(task.due_date)
      if (bucket) bucket.push(task)
      else map.set(task.due_date, [task])
    }
    return map
  }, [tasksQuery.data, week])

  const pendingOf = (date: IsoDate) =>
    (byDay.get(date) ?? []).filter((task) => task.completed_at === null).length
  const total = week.reduce((sum, date) => sum + pendingOf(date), 0)

  const overdue = useMemo(
    () => (overdueQuery.data ?? []).filter(isVisible),
    [overdueQuery.data, isVisible],
  )

  // La fenêtre étroite se centre sur le jour choisi, sans sortir de la bande.
  const narrow = span === 1
  const dayIndex = week.indexOf(day)
  const narrowStart = Math.min(Math.max(dayIndex - 1, 0), week.length - NARROW_COLUMNS)

  const shown = (byDay.get(day) ?? []).filter(isVisible)

  return (
    <div
      className={cn(
        'grid h-full min-w-0 gap-4.5',
        span === 3 && overdue.length > 0 && 'lg:grid-cols-2',
      )}
    >
      <WidgetCard
        title="Votre semaine"
        icon={WIDGET_GLYPH['week']}
        meta={<span>{total === 0 ? 'rien de dû' : `${total} à faire`}</span>}
        action={
          <Link
            to="/taches"
            className="text-label font-medium text-primary transition-colors hover:text-primary-hover"
          >
            Tout voir →
          </Link>
        }
        error={tasksQuery.error ?? dayStartQuery.error}
        onRetry={() => void tasksQuery.refetch()}
        retrying={tasksQuery.isFetching}
      >
        <div className={cn('grid grid-cols-3 gap-1.5', !narrow && 'lg:grid-cols-7')}>
          {week.map((date, index) => {
            const inWindow = index >= narrowStart && index < narrowStart + NARROW_COLUMNS
            const pending = pendingOf(date)
            const isToday = date === today
            const active = date === day
            // Le libellé vient du VRAI jour de la semaine, jamais de la position
            // dans la bande : celle-ci ne commence plus au lundi.
            const header = WEEK_HEADERS[isoWeekday(date) - 1]
            // Les pastilles ne parlent que des OBJECTIFS : une couleur de liste
            // ici disait « il y a quelque chose », ce que le quantième ne dit
            // déjà que trop. Le jour qui porte une séance se repère d'un coup.
            const dots = (byDay.get(date) ?? [])
              .filter((t) => t.completed_at === null && t.objective_id !== null)
              .slice(0, DOTS)

            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                aria-pressed={active}
                aria-label={`${formatDayHeader(date)}, ${pending} tâche${pending > 1 ? 's' : ''}`}
                className={cn(
                  'cursor-pointer rounded-md px-1 pt-1.5 pb-2 text-center transition-colors duration-150',
                  'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                  inWindow ? 'block' : narrow ? 'hidden' : 'hidden lg:block',
                  isToday ? 'bg-primary text-white' : 'bg-surface-subtle hover:bg-field',
                  active && !isToday && 'ring-2 ring-border-strong',
                )}
              >
                <span
                  className={cn(
                    'block text-micro font-semibold tracking-[0.8px] uppercase',
                    isToday ? 'text-white/75' : 'text-ink-3',
                  )}
                >
                  {header.short}
                </span>
                {/* Le QUANTIÈME, pas le nombre de tâches : sur une colonne de
                    calendrier, un gros chiffre se lit comme une date, et « le 20
                    août » s'affichait « 2 ». Le compte reste dans l'en-tête du
                    widget et dans le libellé accessible du bouton. */}
                <span
                  className={cn(
                    'block text-title font-semibold tabular-nums',
                    isToday ? 'text-white' : 'text-ink',
                  )}
                >
                  {formatDayNumber(date)}
                </span>
                <span aria-hidden className="flex h-1.5 items-center justify-center gap-0.5">
                  {dots.map((task) => (
                    <DayDot
                      key={task.id}
                      color={dotColor(task, objectiveById)}
                      onPrimary={isToday}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 min-w-0">
          <p className="mb-0.5 text-micro font-semibold tracking-[1.2px] text-ink-3 uppercase">
            {formatDayHeader(day)}
          </p>
          {shown.length > 0 ? (
            <TaskRowList
              tasks={shown}
              today={today}
              objectives={objectiveById}
              lists={listById}
              onToggle={onToggleTask}
              onToggleImportant={onToggleImportant}
              donePhaseFor={donePhaseFor}
              reducedMotion={reducedMotion}
            />
          ) : day === today ? (
            // Le jour en cours mérite mieux qu'un constat : c'est le seul qu'on ne
            // peut plus préparer.
            <EmptyToday
              hasObjectives={principals.length > 0}
              weekComplete={weekComplete}
              sessionsThisWeek={sessionsThisWeek}
            />
          ) : (
            <WidgetEmpty>Rien de dû ce jour-là.</WidgetEmpty>
          )}
        </div>
      </WidgetCard>

      {/* `OverdueCard` sait déjà se taire quand il n'y a rien ; la garde explicite
          évite en plus de réserver une cellule vide dans la sous-grille. */}
      {overdue.length > 0 && (
        <OverdueCard
          tasks={overdue}
          objectives={objectiveById}
          lists={listById}
          onToggle={onToggleTask}
          onToggleImportant={onToggleImportant}
          donePhaseFor={donePhaseFor}
          reducedMotion={reducedMotion}
        />
      )}
    </div>
  )
}

function DayDot({ color, onPrimary }: { color: string | null; onPrimary: boolean }) {
  return (
    <span
      className={cn('size-1 rounded-2xl', !color && (onPrimary ? 'bg-white/70' : 'bg-ink-muted'))}
      style={color ? { backgroundColor: onPrimary ? '#ffffff' : color } : undefined}
    />
  )
}

/** La couleur de l'objectif porté par la tâche. Seules celles-là ont une pastille. */
function dotColor(task: Task, objectives: Map<string, { slot: number | null }>): string | null {
  if (!task.objective_id) return null
  const objective = objectives.get(task.objective_id)
  return objective ? objectiveSkin(objective.slot).core : null
}
