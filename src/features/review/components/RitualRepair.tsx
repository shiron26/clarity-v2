import { DeckHeading } from '../../../components/ritual/DeckHeading'
import { RepairHabitCard } from './RepairHabitCard'
import { RepairMilestonesCard } from './RepairMilestonesCard'
import { RepairQuantityCard } from './RepairQuantityCard'
import { periodOf } from '../ritualContent'
import type { IsoDate } from '../../../lib/appDate'
import type { Objective } from '../../../hooks/useObjectives'
import type { Milestone } from '../../../hooks/useMilestones'
import type { ObjectivePeriod } from '../../../hooks/useObjectivePeriods'
import type { ObjectiveProgress } from '../../../hooks/useObjectiveProgress'
import { DeckAction } from '../../../components/ritual/DeckAction'

type RitualRepairProps = {
  eyebrow: string
  objectives: Objective[]
  /** `periodKey(...)` → relevé, toutes unités confondues. */
  periods: Map<string, ObjectivePeriod>
  milestonesByObjective: Map<string, Milestone[]>
  progress: Map<string, ObjectiveProgress>
  weekDays: IsoDate[]
  weekStart: IsoDate
  activeDays: Set<string>
  sessions: Map<string, string>
  today: IsoDate
  savingEntry: boolean
  onAddSession: (objectiveId: string, day: IsoDate) => void
  onRemoveSession: (sessionId: string) => void
  onAddEntry: (objectiveId: string, value: number) => void
  onToggleMilestone: (milestone: Milestone) => void
  onNext: () => void
}

/**
 * L'écran 2 — le cœur du rituel.
 *
 * Le comportement bloc-notes observé chez les testeurs (« je coche après coup,
 * deux ou trois jours plus tard ») a enfin un endroit où exister, au lieu d'être
 * subi. Une carte par objectif, dans sa forme propre : une habitude se répare
 * jour par jour, une quantité se relève, des jalons se cochent.
 *
 * **Une seule ligne d'instruction, en bas.** Le reste de la mécanique n'est pas
 * expliqué : les cases se touchent, ça suffit (§10, contrôle n°3).
 */
export function RitualRepair({
  eyebrow,
  objectives,
  periods,
  milestonesByObjective,
  progress,
  weekDays,
  weekStart,
  activeDays,
  sessions,
  today,
  savingEntry,
  onAddSession,
  onRemoveSession,
  onAddEntry,
  onToggleMilestone,
  onNext,
}: RitualRepairProps) {
  // Un objectif arrêté n'a plus de passé à réparer — le serveur refuse d'ailleurs
  // toute écriture dessus (`objective_session_closed`). Le laisser ici afficherait
  // « 0/2 » sur quelque chose qu'on a délibérément arrêté : un reproche pour une
  // décision. Il reste compté à l'écran 1 et présent à la projection.
  const repairable = objectives.filter((o) => o.closed_at === null)

  return (
    <>
      <DeckHeading eyebrow={eyebrow}>Rien oublié&nbsp;?</DeckHeading>

      <div className="mt-5.5 flex w-full flex-col gap-2.5">
        {repairable.map((objective, index) => {
          if (objective.measure === 'habitude') {
            return (
              <RepairHabitCard
                key={objective.id}
                objective={objective}
                period={periodOf(objective, periods, weekStart)}
                weekDays={weekDays}
                activeDays={activeDays}
                sessions={sessions}
                today={today}
                index={index}
                onAdd={(day) => onAddSession(objective.id, day)}
                onRemove={onRemoveSession}
              />
            )
          }

          if (objective.measure === 'quantite') {
            return (
              <RepairQuantityCard
                key={objective.id}
                objective={objective}
                current={progress.get(objective.id)?.value}
                // La période COURANTE de l'objectif, dans son unité : un relevé
                // mensuel ne se réclame pas chaque semaine.
                awaited={(periodOf(objective, periods, today)?.done ?? 0) === 0}
                index={index}
                onSubmit={(value) => onAddEntry(objective.id, value)}
                saving={savingEntry}
              />
            )
          }

          const milestones = milestonesByObjective.get(objective.id) ?? []
          // Un objectif jalonné sans jalon n'a rien à réparer : sa carte serait
          // une invitation vide, et l'écran en compte déjà assez.
          if (milestones.length === 0) return null
          return (
            <RepairMilestonesCard
              key={objective.id}
              objective={objective}
              milestones={milestones}
              index={index}
              onToggle={onToggleMilestone}
            />
          )
        })}
      </div>

      <p className="animate-slide-up mt-4.5 text-caption text-ink-onnight-faint">
        {repairable.length > 0
          ? 'Touchez un jour pour le cocher après coup.'
          : 'Rien à corriger cette semaine.'}
      </p>

      <DeckAction
        onClick={onNext}
        className="mt-6"
      >
        Continuer →
      </DeckAction>
    </>
  )
}
