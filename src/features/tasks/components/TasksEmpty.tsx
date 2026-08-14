import { Link } from 'react-router'
import { cn } from '../../../lib/cn'

type TasksEmptyProps = {
  /** Aucune tâche du tout dans la portée, ou juste aucun résultat de recherche. */
  searching: boolean
  /**
   * L'utilisateur a-t-il déjà au moins un objectif ? Si oui, l'amorce n'est
   * plus « créer un objectif » mais « ajouter une tâche ».
   */
  hasObjectives?: boolean
  onCreate: () => void
}

const CTA_CLASS = cn(
  'mt-1.5 flex min-h-11 cursor-pointer items-center justify-center rounded-[11px] bg-primary px-5 text-[12px] font-medium text-white shadow-primary',
  'transition-[background-color,box-shadow,transform] duration-150',
  'hover:-translate-y-px hover:bg-primary-hover hover:shadow-primary-hover',
  'active:translate-y-px active:bg-primary-active active:shadow-primary-active',
  'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
)

/**
 * État vide **dans** la carte, pas en dehors : la maquette garde la carte
 * blanche et remplit son intérieur.
 */
export function TasksEmpty({ searching, hasObjectives = false, onCreate }: TasksEmptyProps) {
  if (searching) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center lg:py-13">
        <p className="text-card font-semibold text-ink">Aucune tâche ne correspond</p>
        <p className="max-w-[340px] text-[12px] leading-relaxed text-ink-faint">
          La recherche ne porte que sur les tâches encore à faire.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 px-4 py-9.5 text-center lg:gap-2.5 lg:px-5 lg:py-13">
      <div className="flex size-9.5 items-center justify-center rounded-lg bg-surface-subtle text-[16px] text-ink-muted lg:size-11 lg:rounded-panel lg:text-[18px]">
        <span aria-hidden>✓</span>
      </div>
      <p className="text-[13px] font-semibold text-ink lg:text-card">Aucune tâche pour le moment</p>
      <p className="max-w-[260px] text-[11px] leading-relaxed text-ink-faint lg:max-w-[340px] lg:text-[12px]">
        {hasObjectives
          ? 'Ajoutez une tâche et reliez-la à un objectif : chaque coche fera avancer votre année.'
          : 'Commencez par définir un objectif : vos tâches y seront reliées et chaque coche fera avancer votre année.'}
      </p>
      {hasObjectives ? (
        <>
          <button type="button" onClick={onCreate} className={CTA_CLASS}>
            Ajouter une tâche
          </button>
          <Link
            to="/objectifs"
            className="cursor-pointer rounded-xs p-1 text-label font-medium text-ink-muted transition-colors duration-150 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
          >
            ou revoir mes objectifs
          </Link>
        </>
      ) : (
        <>
          <Link to="/objectifs" className={CTA_CLASS}>
            Créer un objectif
          </Link>
          <button
            type="button"
            onClick={onCreate}
            className="cursor-pointer rounded-xs p-1 text-label font-medium text-ink-muted transition-colors duration-150 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
          >
            ou ajouter une tâche libre
          </button>
        </>
      )}
    </div>
  )
}
