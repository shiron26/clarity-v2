import { cn } from '../../../lib/cn'

type WizardProgressProps = {
  /** Nombre de questions du parcours — 4 en onboarding, 5 dans l'assistant. */
  total: number
  /** Rang de la question courante, **1-indexé**. */
  current: number
  className?: string
}

/**
 * Les barres de progression d'un parcours de création.
 *
 * Des barres et non des points : elles disent la longueur du parcours avant de
 * l'avoir traversé, ce qui est toute leur utilité — savoir qu'il reste deux
 * questions change la disposition à en commencer une.
 *
 * Le total est une prop : l'onboarding pose quatre questions, l'assistant de
 * l'écran Objectifs cinq (il demande en plus la nature de l'objectif, que
 * l'onboarding n'a pas à demander — son premier objectif est un principal par
 * définition).
 */
export function WizardProgress({ total, current, className }: WizardProgressProps) {
  return (
    <div className={cn('flex gap-[5px]', className)} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-[3px] flex-1 rounded-[2px] transition-colors duration-300',
            i + 1 === current ? 'bg-primary' : i + 1 < current ? 'bg-primary-soft' : 'bg-field',
          )}
        />
      ))}
    </div>
  )
}
