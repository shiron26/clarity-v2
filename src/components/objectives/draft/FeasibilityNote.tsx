import type { ReactNode } from 'react'
import { CheckIcon } from '../../icons/CheckIcon'
import { cn } from '../../../lib/cn'

/**
 * Le contrôle de faisabilité de l'étape 4 — le seul moment où une cible
 * irréaliste peut encore être corrigée.
 *
 * Fond blanc, coche bleue, aucune couleur d'alerte : l'encart projette, il
 * n'avertit pas. Deux niveaux de gris dans le même paragraphe — le fait en
 * `ink-2`, sa conséquence en `ink-muted` — pour qu'on lise le chiffre d'abord.
 */
export function FeasibilityNote({ children }: { children: ReactNode }) {
  return (
    <Note
      className="bg-surface px-[15px] py-3.5"
      icon={<CheckIcon width="16" height="16" />}
      iconClassName="text-primary"
    >
      {children}
    </Note>
  )
}

/**
 * La variante éteinte : une information, pas une projection. Même fond blanc que
 * `FeasibilityNote` — un encart de formulaire est blanc, comme un champ ; seule
 * l'icône grise (au lieu de la coche bleue) dit qu'il n'y a rien à célébrer.
 * Sert à dire qu'un objectif jalonné n'a pas de cadence, ou qu'une même question
 * admet plusieurs réponses.
 */
export function QuietNote({ children }: { children: ReactNode }) {
  return (
    <Note className="bg-surface px-3.5 py-3" icon={<ObjectiveGlyph />} iconClassName="text-ink-muted">
      {children}
    </Note>
  )
}

/**
 * La coquille des deux : encadré arrondi, icône alignée sur la première ligne,
 * paragraphe fin. Seuls le fond, l'icône et sa couleur changent — le reste était
 * recopié à l'identique.
 */
function Note({
  children,
  className,
  icon,
  iconClassName,
}: {
  children: ReactNode
  className: string
  icon: ReactNode
  iconClassName: string
}) {
  return (
    <div
      className={cn(
        'mt-5 flex items-start gap-2.5 rounded-panel border-[1.5px] border-border',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('mt-px shrink-0', iconClassName)}>
        {icon}
      </span>
      <p className="text-[11px] leading-relaxed text-ink-2">{children}</p>
    </div>
  )
}

function ObjectiveGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** Le conteneur de secondaire : gras pour le fait, gris clair pour le reste. */
export function NoteAside({ children }: { children: ReactNode }) {
  return <span className="text-ink-muted">{children}</span>
}
