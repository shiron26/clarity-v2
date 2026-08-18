import { Badge } from '../../../components/ui/Badge'
import { OnboardingShell } from '../components/OnboardingShell'
import { objectiveSkin, PRINCIPAL_SLOTS } from '../../../lib/objectivePalette'
import type { Objective } from '../../../hooks/useObjectives'

/**
 * s5 — « Vos trois slots »
 *
 * **Trois est un plafond, pas un quota.** Demander trois objectifs annuels dans
 * les deux premières minutes produit un vrai objectif et deux remplissages — et
 * les remplissages sont le pire résultat possible : ils diluent la contrainte,
 * n'avancent jamais, et leurs lignes vides redeviennent la culpabilité que la
 * refonte enlève.
 *
 * D'où cet écran : on montre les trois places, on en propose deux, on n'en exige
 * aucune. Les places libres portent **déjà leur couleur de slot** — c'est ce qui
 * les fait lire comme un système complet, pas comme deux manques.
 *
 * L'écran portait sous les cartes un encart « deux objectifs bien tenus valent
 * mieux que trois à moitié, un objectif trimestriel libère sa place au trimestre
 * suivant ». Il ne collait à aucun des deux états : les trois places prises, la
 * première phrase reproche à l'utilisateur ce qu'il vient de faire, et la
 * seconde parle d'un cas qui n'existe pas si tout est annuel. Le plafond est
 * déjà annoncé au premier écran du parcours, et le sous-titre dit ce qui reste
 * à faire — l'encart ne servait plus qu'à remplir.
 */
type StepSlotsProps = {
  principals: Objective[]
  onAdd: () => void
  onNext: () => void
}

export function StepSlots({ principals, onAdd, onNext }: StepSlotsProps) {
  const taken = new Map(principals.map((o) => [o.slot ?? 0, o]))
  const free = PRINCIPAL_SLOTS.length - taken.size

  return (
    <OnboardingShell
      step={4}
      title={taken.size === 1 ? 'Votre première place est prise' : 'Vos objectifs sont posés'}
      subtitle={
        free === 0
          ? 'C’est tout ce que Clarity vous demandera de suivre.'
          : `Il en reste ${free === 1 ? 'une' : 'deux'}. Vous pouvez ${free === 1 ? 'la' : 'les'} poser maintenant, ou plus tard.`
      }
      actionLabel={`Continuer avec ${taken.size} objectif${taken.size > 1 ? 's' : ''}`}
      onAction={onNext}
    >
      <div className="flex flex-col gap-2.5">
        {PRINCIPAL_SLOTS.map((slot) => {
          const objective = taken.get(slot)
          const skin = objectiveSkin(slot)

          if (objective) {
            return (
              <div
                key={slot}
                className="rounded-panel px-4 py-[15px] text-white"
                style={{ backgroundImage: skin.gradient, boxShadow: skin.shadow }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-ui font-semibold">{objective.title}</span>
                  <Badge tone="onDark">
                    {objective.quarter === null ? 'Année' : `T${objective.quarter}`}
                  </Badge>
                </div>
                <div className="mt-1 text-caption text-white/75">{metaOf(objective)}</div>
              </div>
            )
          }

          return (
            <button
              key={slot}
              type="button"
              onClick={onAdd}
              className="flex w-full cursor-pointer items-center gap-3 rounded-panel border-[1.5px] border-dashed border-border-strong bg-surface-sidebar px-4 py-[15px] text-left transition-[border-color,background-color] duration-150 hover:border-border-primary-soft hover:bg-primary-tint focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
            >
              <span
                aria-hidden="true"
                className="flex size-6.5 shrink-0 items-center justify-center rounded-sm text-[15px] text-white opacity-90"
                style={{ backgroundColor: skin.core }}
              >
                +
              </span>
              <span className="min-w-0">
                <span className="block text-ui font-semibold text-ink-2">Ajouter un objectif</span>
                <span className="block text-[11px] text-ink-muted">
                  quatre questions, une minute
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* La seule question que pose cet écran quand tout est plein : « et si
          j'en veux un autre ? ». Une ligne, et seulement dans ce cas — les
          places libres, elle parlerait d'un problème que personne n'a. */}
      {free === 0 && (
        <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
          Pour en poser un autre, il faudra qu’une place se libère : à la fin de la période
          d’un objectif, ou si vous le supprimez.
        </p>
      )}
    </OnboardingShell>
  )
}

/**
 * La ligne de méta d'une place prise : ce que l'objectif demande, pas son état.
 * Formulation en toutes lettres — « 3 fois par semaine » et non « 3×/semaine » :
 * on vient de la saisir, elle doit se relire comme on l'a dite.
 */
function metaOf(objective: Objective): string {
  const period = objective.period_unit === 'month' ? 'mois' : 'semaine'

  if (objective.measure === 'habitude') {
    const n = objective.cadence ?? 1
    const rhythm = `${n} fois par ${period}`
    return objective.target_value === null
      ? rhythm
      : `${rhythm} · cible ${objective.target_value}`
  }

  if (objective.measure === 'quantite') {
    const unit = objective.unit ? ` ${objective.unit}` : ''
    return `Relevé ${objective.period_unit === 'month' ? 'mensuel' : 'hebdomadaire'} · cible ${objective.target_value}${unit}`
  }

  return 'Étapes à franchir'
}
