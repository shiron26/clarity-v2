import { Link } from 'react-router'
import { CheckIcon } from '../../../components/icons/CheckIcon'
import { QuarterIcon } from '../../../components/icons/QuarterIcon'
import { ReviewIcon } from '../../../components/icons/ReviewIcon'
import { cn } from '../../../lib/cn'
import { maskTitle, objectiveSkinOf, SECONDARY_SKIN } from '../../../lib/objectivePalette'
import {
  bilanPath,
  quarterFullLabel,
  quarterPath,
  quarterRangeLabel,
} from '../../../lib/quarterLabels'
import { reviewStatus } from '../../../lib/reviewPeriod'
import type { Objective } from '../../../hooks/useObjectives'
import type { QuarterSummary } from './QuarterList'

type QuarterCardProps = {
  year: number
  summary: QuarterSummary
  privacy?: boolean
}

/**
 * Un trimestre, en carte.
 *
 * Celui **en cours** porte un sur-titre et une bordure orange. L'orange est déjà la
 * couleur du « maintenant » dans le produit — le trait d'aujourd'hui sur la frise
 * annuelle, la semaine courante d'une grille. Le bleu, lui, reste entier pour
 * les actions : c'est le seul signal d'action de l'UI (DESIGN.md).
 *
 * **La pastille ne vit jamais seule.** Isolée, la couleur d'un slot ne se retient pas
 * d'un écran à l'autre ; collée à son titre, elle relie instantanément la ligne à sa
 * barre sur la frise juste au-dessus. C'est la même couleur, au même endroit, pour le
 * même objectif.
 *
 * La carte entière est cliquable **sans HTML invalide** : le titre est un lien étiré
 * (`after:absolute after:inset-0`) et le bouton de bilan passe au-dessus en
 * `relative z-10`. Imbriquer un bouton dans un lien ne serait ni valide ni cliquable.
 */
export function QuarterCard({ year, summary, privacy = false }: QuarterCardProps) {
  const { quarter, carried, ahead, current, opening, review } = summary
  const status = reviewStatus({
    openAt: opening?.openAt,
    isOpen: opening?.isOpen ?? false,
    validatedAt: review?.validated_at ?? null,
  })

  const principals = carried.filter((o) => o.kind !== 'secondaire')
  const secondaries = carried.length - principals.length
  const done = status.reason === 'done'

  return (
    <div
      className={cn(
        // La bordure est toujours là, seule sa couleur change : sinon les cartes
        // n'auraient pas la même taille selon le trimestre.
        'relative flex flex-col rounded-2xl border-[1.5px] bg-surface p-5 shadow-card transition-colors duration-150',
        current ? 'border-today' : 'border-transparent hover:border-border-strong',
        // Un trimestre à venir n'a rien à dire : le laisser s'étirer à la hauteur
        // de son voisin creuserait un grand vide blanc qui se lirait comme du
        // contenu manquant.
        ahead && 'self-start',
      )}
    >
      {current && (
        <p className="mb-1.5 text-micro font-semibold tracking-[1.3px] text-today uppercase">
          En cours
        </p>
      )}

      {/* Le quart rempli du cercle situe le trimestre dans l'année : quatre
          cartes identiques au trait près se distinguaient jusqu'ici par leur
          seul numéro. La pastille prend l'orange du « maintenant » sur le
          trimestre en cours, comme la bordure de la carte. */}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            current ? 'bg-today/12 text-today' : 'bg-field text-ink-3',
          )}
        >
          <QuarterIcon quarter={quarter} className="size-4.5" />
        </span>

        <div className="min-w-0">
          <h3 className="text-card font-semibold">
            <Link
              to={quarterPath(year, quarter)}
              className="rounded-xs after:absolute after:inset-0 after:content-[''] focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
            >
              {quarterFullLabel(quarter)}
            </Link>
          </h3>
          <p className="mt-0.5 text-label text-ink-muted">{quarterRangeLabel(quarter)}</p>
        </div>
      </div>

      {ahead ? (
        <p className="mt-4 text-body text-ink-3">Pas encore commencé</p>
      ) : carried.length === 0 ? (
        <p className="mt-4 text-body text-ink-3">Aucun objectif porté</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1.5">
          {principals.map((objective) => (
            <ObjectiveLine key={objective.id} objective={objective} privacy={privacy} />
          ))}
          {secondaries > 0 && (
            // Les secondaires sont agrégés, jamais listés : leur donner une ligne
            // chacun leur donnerait le poids d'un principal, alors qu'on n'est
            // justement pas censé les surveiller.
            <li className="flex items-center gap-2.5">
              {/* Le gris partagé des secondaires, celui de la frise : ils n'ont pas
                  d'identité propre, et c'est le signal « discret » le plus fort. */}
              <span
                className="size-[5px] shrink-0 rounded-full"
                style={{ backgroundColor: SECONDARY_SKIN.hue }}
              />
              <span className="text-label text-ink-muted">
                {secondaries} objectif{secondaries > 1 ? 's' : ''} secondaire
                {secondaries > 1 ? 's' : ''}
              </span>
            </li>
          )}
        </ul>
      )}

      {/* Rien de porté, rien à conclure : le pied disparaît au lieu de proposer
          un bilan sans sujet. « Aucun objectif porté » est déjà écrit juste
          au-dessus, le répéter en inerte n'apprendrait rien. */}
      {!ahead && carried.length > 0 && (
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-5">
          {status.actionable ? (
            // Au-dessus du lien étiré du titre (`relative z-10`) : imbriquer deux
            // ancres serait invalide, les superposer ne l'est pas.
            <Link
              to={bilanPath(year, { type: 'quarter', quarter })}
              className={cn(
                'relative z-10 flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-body font-medium',
                'transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                done
                  ? 'border-[1.5px] border-border bg-surface text-ink-3 hover:border-border-strong'
                  : 'bg-primary-soft text-primary hover:bg-primary-soft-hover',
              )}
            >
              {done ? <CheckIcon className="size-3" /> : <ReviewIcon className="size-3.5" />}
              {done ? 'Revoir le bilan' : 'Faire le bilan'}
            </Link>
          ) : (
            <p className="text-label text-ink-muted">{status.meta}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** Une pastille, un titre. La couleur vient du slot — donc d'un style inline. */
function ObjectiveLine({ objective, privacy }: { objective: Objective; privacy: boolean }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className="size-[7px] shrink-0 rounded-full"
        style={{ backgroundColor: objectiveSkinOf(objective).hue }}
      />
      <span className="truncate text-body text-ink-2" title={objective.title}>
        {privacy ? maskTitle(objective.title) : objective.title}
      </span>
    </li>
  )
}
