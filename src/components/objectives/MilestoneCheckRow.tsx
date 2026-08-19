import { cn } from '../../lib/cn'
import { CheckIcon } from '../icons/CheckIcon'
import { maskTitle } from '../../lib/objectivePalette'
import type { Milestone } from '../../hooks/useMilestones'

/**
 * Une étape, cochable, et rien d'autre.
 *
 * `MilestoneList` (écran Objectif) est un éditeur : un seul objectif, un
 * formulaire d'ajout, la suppression, le plafond de quatre par trimestre. Le
 * dashboard veut l'inverse — plusieurs objectifs mêlés, lecture et coche. D'où
 * cette ligne à part, dans `components/` puisque deux écrans la consomment.
 *
 * Cocher une étape ne produit aucun signal ailleurs : ni jour actif, ni
 * compteur. Les deux tempos ne se croisent pas.
 */
type MilestoneCheckRowProps = {
  milestone: Milestone
  /** Couleur de l'objectif porteur, pour la case cochée. */
  accent: string
  privacy?: boolean
  onToggle: (milestone: Milestone) => void
}

export function MilestoneCheckRow({
  milestone,
  accent,
  privacy = false,
  onToggle,
}: MilestoneCheckRowProps) {
  const done = milestone.completed_at !== null
  const title = privacy ? maskTitle(milestone.title) : milestone.title

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <button
        type="button"
        onClick={() => onToggle(milestone)}
        aria-pressed={done}
        aria-label={`${done ? 'Décocher' : 'Cocher'} « ${title} »`}
        className={cn(
          'flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-xs border-2 transition-all duration-150',
          'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
          !done && 'border-border-idle',
        )}
        style={done ? { borderColor: accent, backgroundColor: accent } : undefined}
      >
        {done && <CheckIcon className="size-2.5 text-white" />}
      </button>

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-body',
          done ? 'text-ink-muted line-through' : 'text-ink',
        )}
      >
        {title}
      </span>
    </div>
  )
}
