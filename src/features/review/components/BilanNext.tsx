import { useState } from 'react'
import { DeckCard } from '../../../components/ritual/DeckCard'
import { DeckHeading } from '../../../components/ritual/DeckHeading'
import { cn } from '../../../lib/cn'
import { MAX_MILESTONES } from '../../../lib/objectiveDraft'
import { objectiveSkinOf } from '../../../lib/objectivePalette'
import { PRINCIPAL_SLOTS } from '../../../lib/objectivePalette'
import { quarterRangeLabel } from '../../../lib/quarterLabels'
import { closureLabel } from '../../../lib/objectiveWording'
import type { Objective } from '../../../hooks/useObjectives'
import { DeckAction } from '../../../components/ritual/DeckAction'

/** Ce que l'on décide pour une place libre. Aucune n'est le défaut. */
export type NextChoice = 'create' | 'resume' | 'leave'

type BilanNextProps = {
  year: number
  /** Le trimestre **qui vient**, pas celui qu'on conclut. */
  quarter: number
  /** Les principaux qui poursuivent leur route au trimestre suivant. */
  carried: Objective[]
  /** Ceux dont la fenêtre se ferme ce soir — ils libèrent leur place. */
  closing: Objective[]
  /** Le candidat le plus récent à une reprise, s'il y en a un. */
  stopped: Objective | undefined
  choice: NextChoice | null
  onChoose: (choice: NextChoice) => void
  /** Les objectifs jalonnés qui continuent, et ce qu'ils portent déjà. */
  milestoneTargets: Array<{ objective: Objective; count: number }>
  onAddMilestone: (objective: Objective, title: string) => void
  onFinish: () => void
}

/**
 * Le trimestre qui vient — **l'acte qui justifie la cérémonie**.
 *
 * Clôturer un objectif trimestriel libère un slot : c'est le seul moment du
 * produit où la composition des trois objectifs change délibérément au lieu de
 * dériver. Trois issues de **poids égal** — même taille, même graisse — dont
 * « laisser la place vide », qui est une décision et non un manque. Hiérarchiser
 * les trois reviendrait à dire qu'il faut remplir, et un remplissage est le pire
 * résultat possible : il dilue la contrainte et n'avance jamais.
 *
 * **Reprendre, c'est créer la suite**, jamais rouvrir : la frise affichera deux
 * segments consécutifs, ce qui se lit comme de la continuité — là où prolonger
 * une fenêtre effacerait le fait qu'un trimestre s'est terminé.
 */
export function BilanNext({
  year,
  quarter,
  carried,
  closing,
  stopped,
  choice,
  onChoose,
  milestoneTargets,
  onAddMilestone,
  onFinish,
}: BilanNextProps) {
  const free = Math.max(0, PRINCIPAL_SLOTS.length - carried.length)

  const options: Array<{ key: NextChoice; title: string; hint: string }> = [
    { key: 'create', title: 'Un nouvel objectif', hint: 'cinq questions, une minute' },
    ...(stopped
      ? [
          {
            key: 'resume' as const,
            title: `Reprendre « ${stopped.title} »`,
            hint: stopped.closed_at ? closureLabel(stopped.closed_at) : 'arrêté',
          },
        ]
      : []),
    {
      key: 'leave',
      title: 'Laisser la place vide',
      hint: 'deux bien tenus valent mieux que trois',
    },
  ]

  return (
    <>
      <DeckHeading
        eyebrow={`Trimestre ${quarter} ${year} · ${quarterRangeLabel(quarter)}`}
        subtitle={
          closing.length > 0
            ? `${closing.map((o) => `« ${o.title} »`).join(', ')} se ferme${closing.length > 1 ? 'nt' : ''} ce soir.`
            : undefined
        }
      >
        {free > 0 ? (
          free > 1 ? (
            <>Deux places se libèrent</>
          ) : (
            <>Une place se libère</>
          )
        ) : (
          <>Vos trois places sont tenues</>
        )}
      </DeckHeading>

      {/* Les trois places, telles qu'elles seront. La libre est en pointillé :
          ici l'invitation est le sujet de l'écran, pas un manque à combler. */}
      <div className="mt-6 flex w-full gap-2.5">
        {carried.map((objective) => (
          <div
            key={objective.id}
            className="min-w-0 flex-1 rounded-xl px-3 py-3.5 text-left"
            style={{ backgroundImage: objectiveSkinOf(objective).gradient }}
          >
            <p className="truncate text-caption font-semibold text-white">{objective.label}</p>
            <p className="mt-0.5 text-micro text-white/75">continue</p>
          </div>
        ))}
        {Array.from({ length: free }, (_, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 rounded-xl border-[1.5px] border-dashed border-deck-idle px-3 py-3.5 text-left"
          >
            <p className="text-caption font-semibold text-ink-onnight">Libre</p>
            <p className="mt-0.5 text-micro text-ink-onnight-faint">à vous</p>
          </div>
        ))}
      </div>

      {free > 0 && (
        <div className="mt-6 flex w-full flex-col gap-2.5">
          {options.map((option, index) => (
            <DeckCard key={option.key} index={index} className="p-0">
              <button
                type="button"
                onClick={() => onChoose(option.key)}
                aria-pressed={choice === option.key}
                className={cn(
                  'w-full cursor-pointer rounded-xl px-4.5 py-4 text-left',
                  'transition-[background-color,box-shadow] duration-150',
                  'focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none',
                  choice === option.key
                    ? 'bg-primary/16 shadow-[inset_0_0_0_1.5px_var(--color-primary)]'
                    : 'hover:bg-white/4',
                )}
              >
                <span className="block text-body font-semibold text-white">{option.title}</span>
                <span className="mt-0.5 block text-caption text-ink-onnight-faint">
                  {option.hint}
                </span>
              </button>
            </DeckCard>
          ))}
        </div>
      )}

      {milestoneTargets.map(({ objective, count }) => (
        <MilestoneDraft
          key={objective.id}
          objective={objective}
          count={count}
          onAdd={(title) => onAddMilestone(objective, title)}
        />
      ))}

      <DeckAction onClick={onFinish} className="mt-7">
        Terminer le bilan →
      </DeckAction>
    </>
  )
}

/**
 * Les étapes du trimestre à venir, pour un objectif jalonné qui continue.
 *
 * Quatre au plus (`milestone_cap` en base) : le cap n'est pas un budget à
 * remplir, c'est ce qui empêche la liste de redevenir un backlog. Un jalon non
 * posé ici se pose n'importe quand sur la page de l'objectif — le bilan n'est
 * jamais une porte.
 */
function MilestoneDraft({
  objective,
  count,
  onAdd,
}: {
  objective: Objective
  count: number
  onAdd: (title: string) => void
}) {
  const [title, setTitle] = useState('')
  const full = count >= MAX_MILESTONES

  function submit() {
    const next = title.trim()
    if (next === '' || full) return
    onAdd(next)
    setTitle('')
  }

  return (
    <div className="mt-5 w-full text-left">
      <p className="text-caption text-ink-onnight">
        Étapes de « {objective.title} » · {count} sur {MAX_MILESTONES}
      </p>
      <input
        type="text"
        value={title}
        disabled={full}
        placeholder={full ? 'Quatre étapes, c’est complet' : 'Ajouter une étape…'}
        aria-label={`Nouvelle étape pour « ${objective.title} »`}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          submit()
        }}
        onBlur={submit}
        className="mt-1.5 w-full border-b border-deck-idle bg-transparent pb-2 text-body text-white placeholder:text-ink-onnight-faint focus:border-primary focus:outline-none disabled:text-ink-onnight-faint"
      />
    </div>
  )
}
