import { useSortableItem } from '../../../components/dnd/useSortableItem'
import { TaskRowCompact, type TaskRowCompactProps } from './TaskRowCompact'

/** Jumeau mobile de `SortableTaskRow` : même raison d'être, même mécanique. */
export function SortableTaskRowCompact({
  disabled,
  ...props
}: TaskRowCompactProps & { disabled: boolean }) {
  const { setNodeRef, style, handleProps, isDragging } = useSortableItem({
    id: props.task.id,
    disabled,
    roleDescription: 'tâche déplaçable',
    reducedMotion: props.reducedMotion,
  })

  return (
    <TaskRowCompact
      {...props}
      sortableRef={setNodeRef}
      sortableStyle={style}
      handleProps={handleProps}
      dragging={isDragging}
    />
  )
}
