import { cn } from '../../lib/cn'

type LogoTone = 'gradient' | 'solid' | 'onPrimary'
type LogoSize = 'sm' | 'md' | 'lg'

type LogoProps = {
  tone?: LogoTone
  size?: LogoSize
  /** Masque le mot-symbole (sidebar réduite, favicon inline…). */
  markOnly?: boolean
  className?: string
}

const MARK_TONES: Record<LogoTone, string> = {
  gradient: 'bg-brand-gradient text-white',
  solid: 'bg-primary text-white',
  onPrimary: 'bg-white/20 text-white',
}

const WORD_TONES: Record<LogoTone, string> = {
  gradient: 'text-ink',
  solid: 'text-ink',
  onPrimary: 'text-white',
}

const SIZES: Record<LogoSize, { mark: string; word: string; gap: string }> = {
  sm: { mark: 'size-7 rounded-sm text-[12px]', word: 'text-[16px]', gap: 'gap-2.5' },
  md: { mark: 'size-[30px] rounded-md text-[13px]', word: 'text-[15px]', gap: 'gap-[9px]' },
  lg: { mark: 'size-[34px] rounded-[11px] text-[15px]', word: 'text-title', gap: 'gap-2.5' },
}

export function Logo({ tone = 'gradient', size = 'md', markOnly = false, className }: LogoProps) {
  const s = SIZES[size]

  return (
    <span className={cn('inline-flex items-center', s.gap, className)}>
      <span
        aria-hidden="true"
        className={cn('flex items-center justify-center leading-none', MARK_TONES[tone], s.mark)}
      >
        ▲
      </span>
      {markOnly ? (
        <span className="sr-only">Clarity</span>
      ) : (
        <span className={cn('font-semibold', WORD_TONES[tone], s.word)}>Clarity</span>
      )}
    </span>
  )
}
