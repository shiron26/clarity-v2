import { useSortableItem } from '../../../components/dnd/useSortableItem'
import { TaskListRow, type TaskListRowProps } from './TaskListRow'

/**
 * L'enveloppe qui branche une ligne de tâche sur le glissement.
 *
 * Elle existe pour une raison précise : `TaskListRow` est aussi rendue par la
 * section « en retard », **hors de tout `DndContext`**. Si elle appelait
 * `useSortable` elle-même, ce hook tournerait sans contexte. Isoler l'appel ici
 * laisse la ligne utilisable des deux côtés.
 */
export function SortableTaskRow({
  disabled,
  ...props
}: TaskListRowProps & { disabled: boolean }) {
  const { setNodeRef, style, handleProps, isDragging } = useSortableItem({
    id: props.task.id,
    disabled,
    roleDescription: 'tâche déplaçable',
    reducedMotion: props.reducedMotion,
  })

  return (
    <TaskListRow
      {...props}
      sortableRef={setNodeRef}
      sortableStyle={style}
      handleProps={handleProps}
      dragging={isDragging}
    />
  )
}
