import { useEffect, useMemo, useState } from 'react'
import { cn } from '../../../lib/cn'
import { ObjectiveCard } from '../../../components/objectives/ObjectiveCard'
import type { Milestone } from '../../../hooks/useMilestones'
import type { Objective } from '../../../hooks/useObjectives'
import type { ObjectiveWeek } from '../../../hooks/useObjectiveWeeks'
import { objectiveSkin } from '../../../lib/objectivePalette'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'
import type { IsoDate } from '../../../lib/appDate'

// Séquence de la maquette : la carte arrive désaturée, puis « s'allume » avec
// les confettis, puis le texte et le lien apparaissent en décalé.
const STEP_ARRIVE_MS = 550
const STEP_LIGHT_MS = 1750
// 1250 ms de pop, la durée exacte de `colorReveal` dans `animate-card-lit` : en
// deçà, la montée en couleur serait coupée avant sa fin.
const POP_END_MS = STEP_LIGHT_MS + 1250
const CLOSE_MS = 430

const CONFETTI_COUNT = 36
const EXTRA_COLORS = ['#ffd43b', '#ffffff']

type Confetti = {
  left: number
  delay: number
  duration: number
  size: number
  rotation: number
  color: string
  round: boolean
}

type ObjectiveCelebrationProps = {
  objective: Objective
  week: ObjectiveWeek | undefined
  activeDays: Set<string>
  milestones: Milestone[]
  weekDays: IsoDate[]
  today: IsoDate
  onClose: () => void
}

/**
 * Plein écran joué quand un objectif est marqué comme atteint. Purement
 * décoratif : la clôture est déjà enregistrée quand cet overlay s'affiche, le
 * fermer ne défait rien.
 */
export function ObjectiveCelebration({
  objective,
  week,
  activeDays,
  milestones,
  weekDays,
  today,
  onClose,
}: ObjectiveCelebrationProps) {
  // Une prise en main de trois secondes en plein écran est exactement ce que la
  // préférence de mouvement réduit vise : on saute la séquence.
  const reducedMotion = usePrefersReducedMotion()

  const [step, setStep] = useState(reducedMotion ? 2 : 0)
  const [popping, setPopping] = useState(false)
  const [closing, setClosing] = useState(false)

  const skin = objectiveSkin(objective.slot)

  useEffect(() => {
    if (reducedMotion) return
    const timers = [
      setTimeout(() => setStep(1), STEP_ARRIVE_MS),
      setTimeout(() => {
        setStep(2)
        setPopping(true)
      }, STEP_LIGHT_MS),
      setTimeout(() => setPopping(false), POP_END_MS),
    ]
    return () => timers.forEach(clearTimeout)
  }, [reducedMotion])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const confetti = useMemo<Confetti[]>(() => {
    if (reducedMotion) return []
    const colors = [skin.ramp[0], skin.ramp[2], skin.ramp[4], ...EXTRA_COLORS]
    return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.6 + Math.random() * 1.1,
      size: 6 + Math.random() * 8,
      rotation: Math.round(Math.random() * 360),
      color: colors[i % colors.length]!,
      round: i % 2 === 0,
    }))
  }, [skin, reducedMotion])

  function handleClose() {
    if (closing) {
      return
    }
    if (reducedMotion) {
      onClose()
      return
    }
    setClosing(true)
    setTimeout(onClose, CLOSE_MS)
  }

  const revealed = step === 2

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Objectif atteint : ${objective.title}`}
      onClick={handleClose}
      className={cn(
        'fixed inset-0 z-80 flex flex-col items-center justify-center overflow-hidden px-5',
        'bg-[radial-gradient(1100px_600px_at_50%_-10%,#1d2030,#101116_60%)]',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
    >
      {revealed &&
        confetti.map((c, i) => (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute -top-5"
            style={{
              left: `${c.left}%`,
              width: c.size,
              height: c.size,
              background: c.color,
              borderRadius: c.round ? '50%' : 3,
              transform: `rotate(${c.rotation}deg)`,
              animation: `confettiFall ${c.duration}s ease-in ${c.delay}s forwards`,
            }}
          />
        ))}

      {/* La désaturation et l'allumage sont l'affaire de la carte, pas du
          conteneur : `lit` + `popping` rejouent ici exactement ce qui se passe
          quand on coche une tâche reliée à un objectif — tressaillement, montée
          en couleur (`colorReveal`) et gerbe. Un filtre posé sur ce wrapper
          basculerait d'un coup, sans transition. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full max-w-[560px]',
          step === 0 && 'opacity-0',
          step > 0 && !reducedMotion && 'animate-card-arrive',
        )}
      >
        <ObjectiveCard
          objective={objective}
          week={week}
          activeDays={activeDays}
          milestones={milestones}
          daysOfWeek={weekDays}
          today={today}
          showMilestones
          lit={revealed}
          popping={popping}
        />
      </div>

      {/* Apparition en cascade pilotée en style inline : l'opacité et le décalage
          sont des valeurs d'animation, pas des états de design — et cela évite de
          dépendre d'utilitaires Tailwind qui ne sont pas tous générés. */}
      <div className="flex flex-col items-center">
        <p
          className="mt-6.5 text-title font-semibold text-white"
          style={{
            transition: 'opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1)',
            transitionDelay: reducedMotion ? '0ms' : '400ms',
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'none' : 'translateY(16px)',
          }}
        >
          Objectif atteint 🎉
        </p>

        <button
          type="button"
          onClick={handleClose}
          className={cn(
            'mt-5 cursor-pointer text-[11px] text-ink-onnight hover:text-white',
            'focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none',
            !revealed && 'pointer-events-none',
          )}
          style={{
            transition: 'opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1)',
            transitionDelay: reducedMotion ? '0ms' : '650ms',
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'none' : 'translateY(12px)',
          }}
        >
          ← Fermer
        </button>
      </div>
    </div>
  )
}
