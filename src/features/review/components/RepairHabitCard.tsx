import { DeckCard } from '../../../components/ritual/DeckCard'
import { cn } from '../../../lib/cn'
import { objectiveSkinOf } from '../../../lib/objectivePalette'
import { formatLongDate, type IsoDate } from '../../../lib/appDate'
import { sessionKey } from '../../../lib/objectiveState'
import type { Objective } from '../../../hooks/useObjectives'
import type { ObjectivePeriod } from '../../../hooks/useObjectivePeriods'
import { DeckCardHeader } from '../../../components/ritual/DeckCardHeader'

const DAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type RepairHabitCardProps = {
  objective: Objective
  period: ObjectivePeriod | undefined
  /** Les 7 dates de la semaine passée en revue, lundi → dimanche. */
  weekDays: IsoDate[]
  /** Tous les jours crédités : `objectifId|jour`. Tâches ET séances. */
  activeDays: Set<string>
  /** Les seules séances : `objectifId|jour` → id de la ligne. */
  sessions: Map<string, string>
  /** Jour applicatif — au-delà, on ne crédite rien. */
  today: IsoDate
  index: number
  onAdd: (day: IsoDate) => void
  onRemove: (sessionId: string) => void
}

/**
 * Une habitude et sa semaine, jour par jour — le geste central du rituel.
 *
 * Trois états de case, et la distinction n'est pas cosmétique :
 *
 * - **allumée par une séance** → on peut la retirer, c'est nous qui l'avons posée ;
 * - **allumée par une tâche cochée** → inerte ici. Dé-cocher une tâche depuis le
 *   rituel effacerait un travail réel derrière un geste qui ressemble à une
 *   correction d'oubli ; cela se fait sur l'écran Tâches, en connaissance de cause ;
 * - **éteinte** → un toucher la crédite.
 *
 * Les jours à venir sont désactivés : le serveur les refuserait
 * (`objective_session_future`), autant ne pas les proposer.
 */
export function RepairHabitCard({
  objective,
  period,
  weekDays,
  activeDays,
  sessions,
  today,
  index,
  onAdd,
  onRemove,
}: RepairHabitCardProps) {
  const skin = objectiveSkinOf(objective)
  const target = period?.target ?? objective.cadence ?? 1
  const done = period?.done ?? 0
  const met = done >= target

  return (
    <DeckCard index={index}>
      <DeckCardHeader
        color={skin.hue}
        title={objective.title}
        className="mb-3.5"
        trailing={
          <span
            className={cn('shrink-0 text-body font-semibold', met ? 'text-success' : 'text-warn')}
          >
            {done}/{target}
          </span>
        }
      />

      {/* gap serré : « les jours se touchent » — la semaine se lit comme une
          bande continue, pas comme sept boutons indépendants. */}
      <div className="flex gap-1.5">
        {weekDays.map((day, i) => {
          const credited = activeDays.has(`${objective.id}|${day}`)
          const sessionId = sessions.get(sessionKey(objective.id, day))
          const future = day > today
          // Créditée par une tâche : allumée, mais pas à nous de la défaire.
          const locked = credited && sessionId === undefined

          return (
            <button
              key={day}
              type="button"
              disabled={future || locked}
              onClick={() => (sessionId ? onRemove(sessionId) : onAdd(day))}
              title={
                locked
                  ? 'Ce jour vient d’une tâche cochée — décochez-la depuis vos tâches.'
                  : undefined
              }
              aria-pressed={credited}
              aria-label={`${formatLongDate(day)}${credited ? ' — fait' : ''}`}
              className={cn(
                'h-9.5 flex-1 rounded-[11px] border-[1.5px] text-label font-semibold',
                'transition-[background-color,border-color,color] duration-150',
                'focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none',
                credited ? 'text-white' : 'border-deck-idle text-ink-onnight',
                !credited && !future && 'cursor-pointer hover:border-link hover:text-link',
                credited && !locked && 'cursor-pointer',
                future && 'opacity-40',
              )}
              style={
                credited
                  ? { backgroundColor: skin.core, borderColor: skin.core }
                  : undefined
              }
            >
              {DAY_INITIALS[i]}
            </button>
          )
        })}
      </div>
    </DeckCard>
  )
}
