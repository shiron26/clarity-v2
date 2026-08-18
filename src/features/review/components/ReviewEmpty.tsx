import { Link } from 'react-router'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ReviewIcon } from '../../../components/icons/ReviewIcon'
import { buttonClasses } from '../../../components/ui/buttonClasses'

/**
 * Rien à passer en revue tant qu'il n'y a pas d'objectif : le rituel constate ce
 * qui a avancé, et sans objectif il n'y a rien à constater. L'issue de secours
 * pointe donc vers l'écran Objectifs.
 *
 * Un `<Link>` ne peut pas *être* un `Button` (react-router rend une ancre), d'où
 * `buttonClasses` — la raison même de son extraction.
 */
export function ReviewEmpty() {
  return (
    <EmptyState
      icon={<ReviewIcon className="size-6" />}
      title="Votre premier rituel vous attend"
      description="Dès que vous aurez un objectif, le rendez-vous du dimanche vous montrera ce qui a avancé, et ce qu'il reste à rattraper."
      action={
        <Link to="/objectifs" className={buttonClasses({ size: 'lg', className: 'mt-2' })}>
          Commencer par un objectif
        </Link>
      }
      className="flex-1"
    />
  )
}
