import { RepeatIcon } from '../icons/RepeatIcon'
import { StepsIcon } from '../icons/StepsIcon'
import { SwapIcon } from '../icons/SwapIcon'
import { cn } from '../../lib/cn'
import type { ObjectiveMeasure } from '../../hooks/useObjectives'

/**
 * Le glyphe d'une mesure — **un par façon de suivre**, et toujours le même.
 *
 * Les trois natures d'objectif ne se distinguaient que par le mot de leur chiffre
 * (« 3 séances », « + 60 kg », « 0 étape ») : il fallait lire pour comprendre
 * qu'on comparait trois choses différentes. Un glyphe le dit avant la lecture.
 *
 * Les métaphores sont celles que le produit emploie déjà ailleurs : la flèche de
 * répétition pour un rythme qui revient, les deux flèches opposées pour une
 * valeur qui monte comme elle baisse (le même glyphe que la carte « Je note un
 * total » du formulaire), l'escalier pour des marches à franchir.
 */
const GLYPHS: Record<ObjectiveMeasure, { Icon: typeof RepeatIcon; label: string }> = {
  habitude: { Icon: RepeatIcon, label: 'Habitude' },
  quantite: { Icon: SwapIcon, label: 'Relevé' },
  jalons: { Icon: StepsIcon, label: 'Étapes' },
}

export function MeasureIcon({
  measure,
  className,
}: {
  measure: ObjectiveMeasure
  className?: string
}) {
  const { Icon, label } = GLYPHS[measure]

  return (
    // `title` pour la souris, texte masqué pour le lecteur d'écran : un glyphe
    // seul ne dit rien à qui ne le voit pas.
    <span title={label} className={cn('flex shrink-0 items-center text-ink-muted', className)}>
      <Icon className="size-3.5" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
