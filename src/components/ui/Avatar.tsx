import { cn } from '../../lib/cn'

type AvatarProps = {
  name: string | null | undefined
  size?: 'sm' | 'md'
  className?: string
}

function initial(name: string | null | undefined) {
  const trimmed = name?.trim()
  return trimmed ? trimmed[0]!.toUpperCase() : '?'
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-brand-gradient flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        size === 'sm' ? 'size-8 text-body' : 'size-[34px] text-body',
        className,
      )}
    >
      {initial(name)}
    </span>
  )
}
