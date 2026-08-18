import { DeckCard } from '../../../components/ritual/DeckCard'
import { cn } from '../../../lib/cn'
import { objectiveSkinOf } from '../../../lib/objectivePalette'
import { objectiveSubtitle } from '../../../lib/objectiveWording'
import type { ComebackLine } from '../comebackContent'

type ComebackCardProps = {
  line: ComebackLine
  /** Rang dans la liste : décale l'entrée pour que les cartes se posent l'une après l'autre. */
  index: number
}

/**
 * L'état d'un objectif au retour, en une carte.
 *
 * **La cadence est sous le titre**, et ce n'est pas décoratif : sans elle,
 * « 71 % » et « 4 400 € » flottent côte à côte sans qu'on comprenne pourquoi les
 * deux cartes n'affichent pas la même chose. C'est le même formateur que la carte
 * du dashboard (`objectiveSubtitle`) — deux formulations du même fait feraient
 * douter des deux.
 *
 * **Barre pour les mesurables, pastilles pour les jalons** : une barre sous-entend
 * une pression du temps qui n'existe pas pour des étapes.
 */
export function ComebackCard({ line, index }: ComebackCardProps) {
  const { objective, value, percent, steps, behind } = line
  const skin = objectiveSkinOf(objective)

  return (
    <DeckCard index={index}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden
            className="mt-[5px] size-[9px] shrink-0 rounded-full"
            style={{ backgroundColor: skin.hue }}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-ui font-semibold text-white">{objective.title}</span>
            <span className="truncate text-caption text-ink-onnight-faint">
              {objectiveSubtitle(objective)}
            </span>
          </span>
        </span>

        {/* L'accent, jamais le rouge : un rythme qui n'a pas tenu n'est pas une
            erreur. Le rouge est réservé à ce qui a échoué, et rien n'a échoué. */}
        <span
          className={cn(
            'shrink-0 text-caption font-semibold',
            behind ? 'text-accent' : 'text-ink-onnight',
          )}
        >
          {value}
        </span>
      </div>

      {steps ? (
        <div className="flex gap-[7px]">
          {Array.from({ length: steps.total }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className={cn('size-5.5 rounded-full', i >= steps.done && 'bg-deck-idle')}
              style={i < steps.done ? { backgroundColor: skin.core } : undefined}
            />
          ))}
        </div>
      ) : (
        percent !== null && (
          <div className="h-1.5 overflow-hidden rounded-full bg-deck-idle">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${percent}%`,
                backgroundColor: behind ? 'var(--color-accent)' : skin.core,
              }}
            />
          </div>
        )
      )}
    </DeckCard>
  )
}
