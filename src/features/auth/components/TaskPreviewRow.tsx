import { cn } from '../../../lib/cn'
import { CheckIcon } from '../../../components/icons/CheckIcon'

type TaskPreviewRowProps = {
  title: string
  done: boolean
  /** Couleur de la liste liée (checkbox + pastille). */
  hue?: string
  tag?: string
  /** Panneau sombre (login) ou panneau bleu (signup) : les traits changent. */
  surface: 'night' | 'primary'
  last?: boolean
}

// Aperçu décoratif d'une ligne de tâche — aucune donnée réelle derrière.
export function TaskPreviewRow({
  title,
  done,
  hue,
  tag,
  surface,
  last = false,
}: TaskPreviewRowProps) {
  const onNight = surface === 'night'

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 py-2',
        !last && (onNight ? 'border-b border-night-line' : 'border-b border-white/14'),
      )}
    >
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px]"
        style={
          onNight
            ? {
                backgroundColor: done ? hue : 'transparent',
                borderColor: done ? hue : '#3a3b45',
                color: '#17181f',
              }
            : {
                backgroundColor: done ? '#fff' : 'transparent',
                borderColor: done ? '#fff' : 'rgba(255,255,255,.45)',
                color: '#1a66ff',
              }
        }
      >
        {done && <CheckIcon className="size-2.5" />}
      </span>

      <span
        className={cn(
          'min-w-0 truncate text-[11.5px]',
          done && 'line-through',
          onNight
            ? done
              ? 'text-[#565866]'
              : 'text-[#d5d6e0]'
            : done
              ? 'text-white/55'
              : 'text-white',
        )}
      >
        {title}
      </span>

      {tag && (
        <span
          className="ml-auto shrink-0 rounded-2xl bg-white/8 px-2 py-0.5 text-[9.5px] font-semibold whitespace-nowrap"
          style={{ color: hue }}
        >
          {tag}
        </span>
      )}
    </div>
  )
}
