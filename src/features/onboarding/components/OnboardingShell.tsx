import type { ReactNode } from 'react'
import { Logo } from '../../../components/brand/Logo'
import { WizardProgress } from '../../../components/objectives/draft/WizardProgress'
import { buttonClasses } from '../../../components/ui/buttonClasses'

/**
 * La coquille des huit écrans d'onboarding.
 *
 * Page claire, plein écran, sans coquille de navigation : le parcours n'est pas
 * une modale posée sur l'application, c'est le premier écran. Une colonne unique
 * de 480 px, alignée à gauche et collée en haut — le contenu est un formulaire,
 * pas une affiche.
 *
 * Quatre barres de progression, pas plus : ce sont les quatre questions. Les
 * deux derniers écrans (les places, puis le récapitulatif) les laissent pleines,
 * ils ne demandent rien.
 */

const TOTAL_STEPS = 4

type OnboardingShellProps = {
  /** Le rang de la question, de 1 à `TOTAL_STEPS`. */
  step: number
  title: string
  subtitle: string
  children: ReactNode
  /** Le bouton primaire, seul contrôle de navigation vers l'avant. */
  actionLabel: string
  onAction: () => void
  actionDisabled?: boolean
  /** Absent sur le premier écran : il n'y a rien derrière. */
  onBack?: () => void
  /** Bloc posé au-dessus du titre — la pastille de succès du dernier écran. */
  lead?: ReactNode
  /**
   * Illustration de l'écran : **à côté de la colonne en grand écran, au-dessus
   * du formulaire sinon.** Seule la question des mesures s'en sert (la carte
   * d'objectif), et c'est la coquille qui en décide la place parce qu'elle est
   * la seule à connaître la mise en page.
   *
   * Rendue deux fois plutôt que déplacée : les deux positions n'ont pas le même
   * parent, aucune propriété CSS ne fait passer un nœud de l'un à l'autre. Même
   * procédé que les cartes du dashboard (`ObjectivesBlock`).
   */
  aside?: ReactNode
}

export function OnboardingShell({
  step,
  title,
  subtitle,
  children,
  actionLabel,
  onAction,
  actionDisabled = false,
  onBack,
  lead,
  aside,
}: OnboardingShellProps) {
  return (
    <div className="w-full max-w-120">
      <Logo size="md" className="mb-7.5" />

      <WizardProgress total={TOTAL_STEPS} current={step} className="mb-6.5" />

      {/* La maquette n'offre aucun retour. Quatre questions d'affilée sans moyen
          de corriger une faute de frappe coûtent trop cher, donc il est là.
          Il a d'abord été un lien gris posé sur le fond : à cette taille et à
          cette couleur, il se lisait comme la légende de la barre de
          progression, pas comme un bouton. Il porte maintenant la coquille
          `secondary` du design system — visible sans concurrencer le bouton
          primaire, qui reste le seul bleu de l'écran. */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'mb-5' })}
        >
          <span aria-hidden="true">←</span>
          Retour
        </button>
      )}

      {lead}

      <h1 className="text-[26px] leading-[1.25] font-semibold text-ink">{title}</h1>
      <p className="mt-2 mb-6 text-body leading-relaxed text-ink-3">{subtitle}</p>

      {aside && <div className="mb-5 xl:hidden">{aside}</div>}

      {/* `xl` et non `lg` : la colonne reste centrée, et à 1024 px il ne lui
          reste que 240 px à droite — de quoi poser une carte illisible, ou
          décentrer tous les autres écrans du parcours. À partir de 1280 px la
          marge suffit, et rien ne bouge en dessous. */}
      <div className="xl:relative">
        {children}
        {aside && (
          <div className="absolute top-0 left-full ml-8 hidden w-80 xl:block">{aside}</div>
        )}
      </div>

      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        className={buttonClasses({ size: 'lg', fullWidth: true, className: 'mt-6.5' })}
      >
        {actionLabel}
      </button>
    </div>
  )
}

// `FieldLabel` et `FieldHint` vivent désormais dans `src/components/ui/FieldLabel.tsx` :
// le formulaire d'objectif de l'écran Objectifs les réutilise, et une feature
// n'importe jamais d'une autre (AGENTS.md).
