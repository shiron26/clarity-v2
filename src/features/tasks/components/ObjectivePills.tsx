import type { Objective } from '../../../hooks/useObjectives'
import { cn } from '../../../lib/cn'
import { objectiveSkin } from '../../../lib/objectivePalette'

type ObjectivePillsProps = {
  objectives: Objective[]
  /** `null` = « Aucun » — c'est le défaut d'une nouvelle tâche. */
  value: string | null
  onChange: (objectiveId: string | null) => void
}

const BASE =
  'flex shrink-0 cursor-pointer items-center gap-[7px] rounded-lg px-3.5 py-2.5 text-label transition-all duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none'

/**
 * Choix de l'objectif rattaché. Seuls les **principaux personnels** sont
 * proposés : le serveur refuse tout le reste (`task_objective_invalid_target`).
 */
export function ObjectivePills({ objectives, value, onChange }: ObjectivePillsProps) {
  return (
    <div role="radiogroup" aria-label="Objectif rattaché" className="flex flex-wrap gap-2">
      {objectives.map((objective) => {
        const skin = objectiveSkin(objective.slot)
        const selected = value === objective.id
        return (
          <button
            key={objective.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(objective.id)}
            className={cn(
              BASE,
              selected
                ? 'font-semibold text-white'
                : 'border border-border bg-canvas text-ink-2 hover:border-[#a9beff]',
            )}
            style={
              selected
                ? {
                    backgroundImage: skin.gradient,
                    boxShadow: `0 0 0 2.5px #fff, 0 0 0 4.5px ${skin.core}`,
                  }
                : undefined
            }
          >
            {!selected && (
              <span
                aria-hidden
                className="size-[7px] shrink-0 rounded-full"
                style={{ backgroundColor: skin.core }}
              />
            )}
            {objective.label}
          </button>
        )
      })}

      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        onClick={() => onChange(null)}
        className={cn(
          BASE,
          value === null
            ? 'bg-ink-2 font-semibold text-white'
            : 'border border-border bg-canvas text-ink-muted hover:border-[#a9beff]',
        )}
      >
        Aucun
      </button>
    </div>
  )
}
