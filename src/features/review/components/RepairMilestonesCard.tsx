import { DeckCard } from '../../../components/ritual/DeckCard'
import { CheckIcon } from '../../../components/icons/CheckIcon'
import { cn } from '../../../lib/cn'
import { objectiveSkinOf } from '../../../lib/objectivePalette'
import type { Objective } from '../../../hooks/useObjectives'
import type { Milestone } from '../../../hooks/useMilestones'
import { DeckCardHeader } from '../../../components/ritual/DeckCardHeader'

type RepairMilestonesCardProps = {
  objective: Objective
  milestones: Milestone[]
  index: number
  onToggle: (milestone: Milestone) => void
}

/**
 * Les étapes d'un objectif jalonné, cochables depuis le rituel.
 *
 * Cases **carrées**, là où une habitude a des jours arrondis : un jalon n'est
 * pas un jour, et la forme le dit avant la lecture. Cocher un jalon ne produit
 * aucun signal ailleurs — ils informent, ils n'alimentent aucun compteur.
 */
export function RepairMilestonesCard({
  objective,
  milestones,
  index,
  onToggle,
}: RepairMilestonesCardProps) {
  const skin = objectiveSkinOf(objective)
  const done = milestones.filter((m) => m.completed_at !== null).length

  return (
    <DeckCard index={index}>
      <DeckCardHeader
        color={skin.hue}
        title={objective.title}
        className="mb-3"
        trailing={
          <span className="shrink-0 text-body text-ink-onnight">
            {done}/{milestones.length}
          </span>
        }
      />

      <ul className="flex flex-col">
        {milestones.map((milestone) => {
          const checked = milestone.completed_at !== null
          return (
            <li key={milestone.id}>
              <button
                type="button"
                onClick={() => onToggle(milestone)}
                aria-pressed={checked}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xs py-1.5 text-left focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-4.5 shrink-0 items-center justify-center rounded-xs border-[1.5px] text-white',
                    'transition-colors duration-150',
                    !checked && 'border-deck-idle',
                  )}
                  style={
                    checked ? { backgroundColor: skin.core, borderColor: skin.core } : undefined
                  }
                >
                  {checked && <CheckIcon width={9} height={9} />}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-body',
                    checked ? 'text-ink-onnight-faint line-through' : 'text-ink-onnight-strong',
                  )}
                >
                  {milestone.title}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </DeckCard>
  )
}
