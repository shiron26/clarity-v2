import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { DeckAction } from './DeckAction'
import { DeckEyebrow } from './DeckEyebrow'

const COUNT_MS = 1900
// Le comptage démarre après l'entrée du chiffre : le nombre se pose, puis grimpe.
const COUNT_DELAY_MS = 350

type DeckRecapProps = {
  /** Sur-titre : la période dont on parle. */
  eyebrow: string
  count: number
  /** Ce que le chiffre compte — « choses faites cette semaine ». */
  headline: string
  detail: string
  nextLabel: string
  onNext: () => void
}

/**
 * L'ouverture d'une cérémonie : ce que la période a produit, avant tout jugement.
 *
 * **On mène toujours avec ce qui a été fait**, jamais avec ce qui manque — c'est
 * la règle qui vaut au rituel hebdomadaire (§7), au bilan trimestriel (§8) et au
 * retour après absence (§9). Un seul écran pour les trois : seul change ce que le
 * chiffre compte.
 *
 * Le chiffre est écrit directement dans le DOM à chaque frame plutôt que par un
 * `setState` : soixante rendus React par seconde pour animer un compteur seraient
 * du gâchis, et le reste de l'écran n'a aucune raison de se réconcilier.
 */
export function DeckRecap({
  eyebrow,
  count,
  headline,
  detail,
  nextLabel,
  onNext,
}: DeckRecapProps) {
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
    <>
      <DeckEyebrow className="animate-slide-up">{eyebrow}</DeckEyebrow>

      <div
        ref={numberRef}
        aria-hidden
        className="animate-num-in mt-3.5 bg-deck-number bg-clip-text text-[82px] leading-[1.05] font-bold text-transparent lg:mt-4.5 lg:text-[104px] lg:leading-[0.95]"
        style={{ animationDelay: reducedMotion ? undefined : '0.15s' }}
      >
        {settled ? count : 0}
      </div>

      <h2
        className="animate-slide-up mt-1 text-[15px] font-semibold text-white lg:text-h1"
        style={{ animationDelay: reducedMotion ? undefined : '0.35s' }}
      >
        {/* Le chiffre au-dessus est décoratif pour un lecteur d'écran : la phrase
            complète est ici, jamais amputée par l'animation en cours. */}
        <span className="sr-only">{count} </span>
        {headline}
      </h2>

      <p
        className="animate-slide-up mt-2 text-[11px] leading-relaxed text-ink-onnight lg:text-body"
        style={{ animationDelay: reducedMotion ? undefined : '0.55s' }}
      >
        {detail}
      </p>

      <DeckAction
        onClick={onNext}
        className="mt-7.5 lg:mt-8.5"
        delay={reducedMotion ? undefined : '1.5s'}
      >
        {nextLabel}
      </DeckAction>
    </>
  )
}
