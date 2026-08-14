import { cn } from '../../../lib/cn'
import { PASSWORD_SCORE_LABELS, passwordScore } from '../passwordScore'

type PasswordStrengthProps = {
  password: string
}

const BAR_TONES = ['bg-border', 'bg-danger', 'bg-warn', 'bg-success']
const TEXT_TONES = ['text-border-strong', 'text-danger', 'text-warn', 'text-success']

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const score = passwordScore(password)

  return (
    <div className="mt-0.5 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-[3px] transition-colors duration-200',
              i < score ? BAR_TONES[score] : 'bg-border',
            )}
          />
        ))}
      </div>
      <span
        aria-live="polite"
        className={cn('min-w-[42px] text-right text-caption font-semibold', TEXT_TONES[score])}
      >
        {PASSWORD_SCORE_LABELS[score]}
      </span>
    </div>
  )
}
