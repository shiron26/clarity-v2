import { useState } from 'react'
import { DeckCard } from '../../../components/ritual/DeckCard'
import { cn } from '../../../lib/cn'
import { objectiveSkinOf } from '../../../lib/objectivePalette'
import { parseAmount } from '../../../lib/objectiveDraft'
import { formatQuantity } from '../../../lib/objectiveWording'
import type { Objective } from '../../../hooks/useObjectives'
import { DeckCardHeader } from '../../../components/ritual/DeckCardHeader'

type RepairQuantityCardProps = {
  objective: Objective
  /** Valeur courante (`objective_progress`) — le point de départ affiché. */
  current: number | undefined
  /** `true` quand la période en cours n'a pas encore de relevé. */
  awaited: boolean
  index: number
  onSubmit: (value: number) => void
  saving: boolean
}

/**
 * Le relevé d'une quantité, saisi depuis le rituel.
 *
 * L'unité est un **suffixe fixe**, jamais retapée : elle a été choisie à la
 * création et se répète partout où la valeur se saisit. La valeur reste un
 * nombre nu — jamais « 3 850 € » en base.
 *
 * La saisie remplace ou s'ajoute selon `entry_mode`, et c'est le serveur qui
 * tranche : ici on envoie ce que la personne a tapé. Le libellé le dit, parce
 * que taper « 4 400 » sur un cumul et sur un relevé ne veut pas dire la même
 * chose.
 */
export function RepairQuantityCard({
  objective,
  current,
  awaited,
  index,
  onSubmit,
  saving,
}: RepairQuantityCardProps) {
  const skin = objectiveSkinOf(objective)
  const [draft, setDraft] = useState('')
  const value = parseAmount(draft)
  const unit = objective.unit ?? ''

  const cumul = objective.entry_mode === 'cumul'
  const monthly = objective.period_unit === 'month'

  return (
    <DeckCard index={index}>
      <DeckCardHeader
        color={skin.hue}
        title={objective.title}
        className="mb-2"
        trailing={
          <span
            className={cn(
              'shrink-0 text-body font-semibold',
              awaited ? 'text-warn' : 'text-success',
            )}
          >
            {awaited ? 'relevé attendu' : 'relevé fait'}
          </span>
        }
      />

      <p className="mb-1 text-caption text-ink-onnight-faint">
        {cumul ? 'Ce que vous ajoutez' : 'Où vous en êtes'}
        {current !== undefined && !cumul && ` · actuellement ${formatQuantity(current, unit)}`}
        {monthly && ' · ce mois-ci'}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value !== null) onSubmit(value)
          setDraft('')
        }}
        className="flex items-center gap-2"
      >
        <span className="relative flex-1">
          <label className="sr-only" htmlFor={`entry-${objective.id}`}>
            Relevé pour {objective.title}
          </label>
          <input
            id={`entry-${objective.id}`}
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="0"
            className={cn(
              'w-full border-0 border-b border-deck-idle bg-transparent py-2 text-title text-white',
              'outline-none placeholder:text-ink-onnight-faint focus:border-b-link',
              unit !== '' && 'pr-10',
            )}
          />
          {unit !== '' && (
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-ui text-ink-onnight"
            >
              {unit}
            </span>
          )}
        </span>

        <button
          type="submit"
          disabled={value === null || saving}
          className={cn(
            'shrink-0 rounded-md px-3.5 py-2 text-body font-medium transition-colors duration-150',
            'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
            value === null || saving
              ? 'cursor-default bg-deck-idle text-ink-onnight'
              : 'cursor-pointer bg-primary text-white hover:bg-primary-hover',
          )}
        >
          Noter
        </button>
      </form>
    </DeckCard>
  )
}
