import { useMemo } from 'react'
import { findMemoList, useLists } from '../../../hooks/useLists'
import { useTasks, type Task } from '../../../hooks/useTasks'
import { useDeleteTask } from '../../../hooks/useTaskMutations'
import { TaskCheckbox } from '../../../components/tasks/TaskCheckbox'
import { MEMO_GLYPH, MEMO_TINT } from './glyphs'
import { cn } from '../../../lib/cn'
import type { MemoKind } from '../dashboardLayout'
import { useDashboardCtx } from '../dashboardContext'
import { WidgetCard, WidgetEmpty } from './WidgetCard'
import { TaskCapture } from './TaskCapture'

const CAPTURE: Record<MemoKind, string> = {
  courses: 'Ajouter un article',
  idees: 'Noter une idée',
  notes: 'Noter quelque chose',
}

/**
 * L'aide-mémoire : une liste sans échéance, qu'on remplit d'une ligne et qu'on
 * vide d'un geste.
 *
 * Son nom ne se change pas depuis ici : les trois listes sont posées par le
 * serveur, elles ne sont modifiables nulle part dans l'interface. Une seule
 * action reste donc au widget, « vider les cochés », et une action seule n'a pas
 * besoin d'un menu — elle vit dans l'en-tête, en clair.
 *
 * La liste est désignée par sa nature et non par son identifiant : le serveur la
 * sème à l'inscription et refuse sa suppression, il n'y a donc pas de cible qui
 * puisse disparaître entre deux sessions.
 *
 * La requête n'est volontairement PAS bornée par `completedSince` : la borne du
 * jour cacherait les lignes cochées hier sans les supprimer, et « Vider les
 * cochés » laisserait un tas invisible. Attention au piège de `useTasks` — la
 * clé présente avec une valeur vide désactive la query, il faut l'omettre.
 */
export function MemoWidget({ kind }: { kind: MemoKind }) {
  const { onToggleTask } = useDashboardCtx()
  const listsQuery = useLists()
  const list = findMemoList(listsQuery.data, kind)

  const tasksQuery = useTasks('list', { listId: list?.id })
  const deleteTask = useDeleteTask()

  const { open, done } = useMemo(() => {
    const rows = tasksQuery.data ?? []
    return {
      open: rows.filter((task) => task.completed_at === null),
      done: rows.filter((task) => task.completed_at !== null),
    }
  }, [tasksQuery.data])

  if (!list) {
    return (
      <WidgetCard
        title="Aide-mémoire"
        icon={MEMO_GLYPH[kind]}
        iconColor={MEMO_TINT[kind]}
        error={listsQuery.error}
      >
        <WidgetEmpty>
          {listsQuery.isPending ? 'Chargement…' : 'Cet aide-mémoire n’est pas encore là.'}
        </WidgetEmpty>
      </WidgetCard>
    )
  }

  // Sans confirmation, volontairement : ce sont des courses cochées, pas des
  // archives, et une boîte de dialogue pour trois lignes barrées coûte plus cher
  // que ce qu'elle protège. La suppression reste définitive — il n'y a pas de
  // corbeille dans le produit.
  function clearDone() {
    for (const task of done) deleteTask.mutate(task.id)
  }

  return (
    <WidgetCard
      title={list.name}
      icon={MEMO_GLYPH[kind]}
      // La couleur portée par la liste prime sur la teinte du glyphe : la colonne
      // existe, et le jour où on l'ouvrira au choix, la pastille suivra sans
      // qu'on y revienne. Aucun aide-mémoire n'en a aujourd'hui.
      iconColor={list.color ?? MEMO_TINT[kind]}
      meta={open.length > 0 ? <span>{open.length}</span> : undefined}
      action={
        done.length > 0 ? (
          <button
            type="button"
            onClick={clearDone}
            className="cursor-pointer text-label font-medium text-ink-muted transition-colors duration-150 hover:text-danger focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
          >
            Vider les cochés ({done.length})
          </button>
        ) : undefined
      }
      error={tasksQuery.error}
      onRetry={() => void tasksQuery.refetch()}
      retrying={tasksQuery.isFetching}
    >
      {open.length === 0 && done.length === 0 ? (
        <WidgetEmpty>Rien pour l’instant.</WidgetEmpty>
      ) : (
        <div className="flex flex-col">
          {[...open, ...done].map((task) => (
            <MemoRow
              key={task.id}
              task={task}
              onToggle={onToggleTask}
              onDelete={() => deleteTask.mutate(task.id)}
            />
          ))}
        </div>
      )}

      <TaskCapture placeholder={CAPTURE[kind]} listId={list.id} className="mt-auto pt-2" />
    </WidgetCard>
  )
}

/**
 * Une ligne d'aide-mémoire : la case, le texte, et de quoi la faire disparaître.
 * Pas de pastille de liste (elle serait la même sur toutes), pas de drapeau, pas
 * d'échéance — cocher veut dire « pris », pas « accompli ».
 *
 * La croix efface une ligne qu'on n'a pas prise et qu'on ne prendra pas : la
 * cocher pour s'en débarrasser dirait le contraire de ce qui s'est passé. Elle se
 * révèle au survol sur les écrans qui en ont un, et reste discrètement visible
 * ailleurs — sans quoi elle serait inatteignable au doigt.
 */
function MemoRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task
  onToggle: (task: Task) => void
  onDelete: () => void
}) {
  const done = task.completed_at !== null
  return (
    <div className="group flex items-center gap-2.5 py-[7px]">
      <TaskCheckbox done={done} title={task.title} compact onToggle={() => onToggle(task)} />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-body',
          done ? 'text-ink-muted line-through' : 'text-ink',
        )}
      >
        {task.title}
      </span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Supprimer « ${task.title} »`}
        className={cn(
          'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-ink-muted',
          'opacity-0 transition-[opacity,color,background-color] duration-150 max-lg:opacity-60',
          'group-hover:opacity-100 focus-visible:opacity-100',
          'hover:bg-danger-bg hover:text-danger',
          'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        )}
      >
        ✕
      </button>
    </div>
  )
}
