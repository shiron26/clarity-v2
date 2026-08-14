import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'

const COUNT_MS = 1900
// Le comptage démarre après l'entrée du chiffre : le nombre se pose, puis grimpe.
const COUNT_DELAY_MS = 350

type ReviewFlowRecapProps = {
  /** Sur-titre : la période dont on parle. */
  eyebrow: string
  count: number
  /** Ce que le chiffre compte — « tâches accomplies cette semaine ». */
  headline: string
  detail: string
  nextLabel: string
  onNext: () => void
}

/**
 * L'ouverture du rituel : ce que la période a produit, avant tout jugement.
 *
 * Un seul écran pour les deux niveaux (SPEC §3 : « le même écran paramétré ») —
 * seul change ce que le chiffre compte : des tâches en hebdo, des jalons au
 * bilan trimestriel.
 *
 * Le chiffre est écrit directement dans le DOM à chaque frame plutôt que par un
 * `setState` : soixante rendus React par seconde pour animer un compteur seraient
 * du gâchis, et le reste de l'écran n'a aucune raison de se réconcilier.
 */
export function ReviewFlowRecap({
  eyebrow,
  count,
  headline,
  detail,
  nextLabel,
  onNext,
}: ReviewFlowRecapProps) {
  const reducedMotion = usePrefersReducedMotion()
  const numberRef = useRef<HTMLDivElement>(null)
  const [settled, setSettled] = useState(reducedMotion)

  useEffect(() => {
    if (reducedMotion) {
      setSettled(true)
      return
    }

    let frame = 0
    const start = performance.now() + COUNT_DELAY_MS

    function tick(now: number) {
      const progress = Math.min(1, Math.max(0, (now - start) / COUNT_MS))
      // Ease-out quart : rapide, puis freinage long — la fin se savoure.
      const eased = 1 - Math.pow(1 - progress, 4)
      if (numberRef.current) numberRef.current.textContent = String(Math.round(eased * count))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else setSettled(true)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [count, reducedMotion])

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="animate-slide-up text-[10px] font-semibold tracking-[1.4px] text-ink-onnight lg:text-[11px] lg:tracking-[1.5px]">
        {eyebrow}
      </p>

      <div
        ref={numberRef}
        aria-hidden
        className="animate-num-in mt-3.5 bg-[linear-gradient(90deg,#2f7bff,#22dcff)] bg-clip-text text-[82px] leading-[1.05] font-bold text-transparent lg:mt-4.5 lg:text-[120px] lg:leading-[1.1]"
        style={{ animationDelay: reducedMotion ? undefined : '0.15s' }}
      >
        {settled ? count : 0}
      </div>

      <p
        className="animate-slide-up mt-1 text-[15px] font-semibold text-white lg:text-title"
        style={{ animationDelay: reducedMotion ? undefined : '0.35s' }}
      >
        {/* Le chiffre au-dessus est décoratif pour un lecteur d'écran : la phrase
            complète est ici, jamais amputée par l'animation en cours. */}
        <span className="sr-only">{count} </span>
        {headline}
      </p>

      <p
        className="animate-slide-up mt-2 text-[11px] leading-relaxed text-ink-onnight lg:text-body"
        style={{ animationDelay: reducedMotion ? undefined : '0.55s' }}
      >
        {detail}
      </p>

      <button
        type="button"
        onClick={onNext}
        className="animate-slide-up mt-7.5 flex min-h-12 cursor-pointer items-center justify-center rounded-[14px] bg-primary px-7.5 text-ui font-medium text-white shadow-[0_8px_20px_rgb(0_68_224_/_0.35)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-px active:bg-primary-active focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none lg:mt-8.5 lg:min-h-0 lg:rounded-lg lg:px-6.5 lg:py-3 lg:text-body"
        style={{ animationDelay: reducedMotion ? undefined : '1.5s' }}
      >
        {nextLabel}
      </button>
    </div>
  )
}
