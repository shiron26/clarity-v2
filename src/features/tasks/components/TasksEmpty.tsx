import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '../../../lib/cn'
import type { TaskScope } from '../taskScope'
import { scopeSearch } from '../taskViewParams'

type TasksEmptyProps = {
  scope: TaskScope
  /** La liste ouverte : la porte vers le pool doit y rester. */
  listId: string | null
  /** Aucune tâche du tout dans la portée, ou juste aucun résultat de recherche. */
  searching: boolean
  /** Y a-t-il du retard affiché juste au-dessus ? Conditionne la sous-phrase :
   *  on n'écrit « rien à rattraper » que si c'est vrai. */
  hasOverdue: boolean
  /** Y a-t-il quelque chose dans le pool ? Sans lui, la porte « Voir les tâches
   *  sans date » mène à un autre vide. */
  hasUndated: boolean
  onCreate: () => void
}

// Deux portes de faible emphase, du même poids : aucune n'est ce qu'il
// « faudrait » faire. Le bleu resterait réservé à une action attendue — ici,
// ne rien faire est une réponse valable.
const DOOR = cn(
  'inline-flex min-h-9 cursor-pointer items-center rounded-sm px-3 py-1.5 text-body font-medium',
  'transition-colors duration-150',
  'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
)
const DOOR_OUTLINE = cn(DOOR, 'border-[1.5px] border-border bg-surface text-ink-2 hover:border-border-strong')
const DOOR_GHOST = cn(DOOR, 'text-ink-3 hover:bg-surface-subtle hover:text-ink')

/**
 * Un vide **sans reproche** (REFONTE §5) : pas de bordure pointillée, pas de
 * grande icône bleue, pas de « vous n'avez rien planifié » — ces signaux se
 * lisent comme un manque à combler. Juste un constat, et des portes
 * facultatives.
 *
 * L'état vide reste **dans** la carte : la maquette garde la carte blanche et
 * en remplit l'intérieur.
 */
export function TasksEmpty({
  scope,
  listId,
  searching,
  hasOverdue,
  hasUndated,
  onCreate,
}: TasksEmptyProps) {
  if (searching) {
    return (
      <Calm
        title="Aucune tâche ne correspond"
        note="La recherche ne porte que sur les tâches encore à faire."
      />
    )
  }

  if (scope === 'undated') {
    return (
      <Calm title="Rien en réserve." note="Ce que vous noterez sans échéance atterrira ici.">
        <button type="button" onClick={onCreate} className={DOOR_GHOST}>
          Noter quelque chose
        </button>
      </Calm>
    )
  }

  const dated = scope === 'today' || scope === 'week'

  return (
    <Calm
      title={scope === 'today' ? 'Rien pour aujourd’hui.' : 'Rien à faire ici.'}
      // « Il n'y a rien à rattraper » serait faux si du retard s'affichait
      // juste au-dessus.
      note={dated && !hasOverdue ? 'Il n’y a rien à rattraper.' : undefined}
    >
      {/* La porte vers le pool : c'est là qu'on pioche quand la journée est
          vide, plutôt que d'inventer une tâche pour remplir. */}
      {hasUndated && (
        <Link
          to={{ pathname: '/taches', search: scopeSearch('undated', listId) }}
          className={DOOR_OUTLINE}
        >
          Voir les tâches sans date
        </Link>
      )}
      <button type="button" onClick={onCreate} className={DOOR_GHOST}>
        Noter quelque chose
      </button>
    </Calm>
  )
}

function Calm({ title, note, children }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center lg:py-11">
      <p className="text-body font-medium text-ink-2">{title}</p>
      {note && (
        <p className="mx-auto mt-2 max-w-75 text-[11px] leading-relaxed text-ink-muted">{note}</p>
      )}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{children}</div>}
    </div>
  )
}
