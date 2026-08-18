import { cn } from '../../lib/cn'
import { STEP_NEXT, STEP_PREV, stepperArrowClasses, type StepperSize } from './stepperClasses'

type YearStepperProps = {
  year: number
  /** Borne haute : on ne se projette pas dans une année qu'on n'a pas vécue. */
  currentYear: number
  onSelectYear: (year: number) => void
  /** `sm` = en ligne dans un en-tête dense, `lg` = repère principal de l'écran. */
  size?: StepperSize
  className?: string
}

/**
 * `◀ 2026 ▶` — un stepper, pas un segmented control : celui-ci tient à deux ans,
 * plus à dix (REFONTE §6). Reculer n'a pas de borne, avancer s'arrête à l'année
 * en cours.
 *
 * L'apparence des flèches vit dans `stepperClasses` : le pas de trimestre la
 * partage, et il est fait de liens.
 */
export function YearStepper({
  year,
  currentYear,
  onSelectYear,
  size = 'sm',
  className,
}: YearStepperProps) {
  const atMax = year >= currentYear

  return (
    <div
      className={cn(
        'flex items-center',
        size === 'lg' ? 'gap-2.5' : 'gap-1 lg:gap-1.5',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSelectYear(year - 1)}
        aria-label={`Année ${year - 1}`}
        className={stepperArrowClasses({ size })}
      >
        {STEP_PREV}
      </button>

      <span
        className={cn(
          'text-center font-semibold text-ink',
          size === 'lg' && 'min-w-[58px] text-h1 tracking-[0.3px]',
        )}
      >
        {year}
      </span>

      <button
        type="button"
        onClick={() => onSelectYear(year + 1)}
        disabled={atMax}
        aria-label={`Année ${year + 1}`}
        className={stepperArrowClasses({ size, disabled: atMax })}
      >
        {STEP_NEXT}
      </button>
    </div>
  )
}
