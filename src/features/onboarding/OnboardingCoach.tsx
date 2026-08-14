import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { useProfile } from '../../hooks/useProfile'
import { ONBOARDING_STEPS } from './onboardingSteps'
import { useCompleteOnboarding } from './useCompleteOnboarding'

// Présentation de première connexion : panneau ancré en bas à droite en desktop,
// feuille remontante en mobile. Les quatre étapes restent sur le dashboard — la
// maquette les faisait naviguer vers Objectifs / Tâches / Review, écrans qui
// n'existent pas encore.
export function OnboardingCoach() {
  const profile = useProfile()
  // `mutate` est stable (TanStack Query v5) : utilisable en dépendance d'effet.
  const { mutate: finish, isPending, isSuccess } = useCompleteOnboarding()
  const [step, setStep] = useState(0)

  const pending = profile.isSuccess && profile.data.onboarded_at === null
  const total = ONBOARDING_STEPS.length
  const current = ONBOARDING_STEPS[step]!
  const isLast = step === total - 1

  useEffect(() => {
    if (!pending) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') finish()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [pending, finish])

  // On sort dès que la mutation part : pas d'attente du round-trip pour un
  // panneau purement informatif.
  if (!pending || isPending || isSuccess) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenue sur Clarity"
      className="animate-fade-in fixed inset-0 z-70 flex items-end justify-center bg-[rgb(16_17_22/0.55)] p-0 sm:justify-end sm:p-11"
    >
      <div
        key={step}
        // pb : feuille collée au bas en mobile, il faut dégager l'indicateur
        // d'accueil en app installée. `sm:py-6` reprend la main dès que le panneau
        // passe en carte flottante.
        className="animate-slide-up w-full rounded-t-3xl bg-surface px-6 pt-7 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-modal sm:w-[400px] sm:rounded-2xl sm:px-6.5 sm:py-6"
      >
        <div className="mx-auto mb-5 h-1 w-9 rounded-sm bg-border sm:hidden" />

        <div className="mb-4 flex items-start justify-between">
          <span
            aria-hidden="true"
            className="flex size-13 items-center justify-center rounded-xl text-[22px] text-white"
            style={{ backgroundImage: current.gradient }}
          >
            {current.icon}
          </span>
          <span className="text-caption text-ink-muted">
            {step + 1} / {total}
          </span>
        </div>

        <h2 className="text-title leading-tight font-semibold">{current.title}</h2>
        <p className="mt-2 text-body leading-relaxed whitespace-pre-line text-ink-3">
          {current.body}
        </p>

        <div className="mt-5 flex items-center gap-1.5">
          {ONBOARDING_STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-sm transition-all duration-300',
                i === step ? 'w-5' : 'w-1.5',
                i <= step ? 'bg-primary' : 'bg-border-strong',
              )}
            />
          ))}

          <button
            type="button"
            onClick={() => finish()}
            className="ml-auto cursor-pointer px-2 py-1.5 text-[11px] text-ink-muted transition-colors hover:text-ink-2 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
          >
            Passer
          </button>

          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              aria-label="Étape précédente"
              className="cursor-pointer px-2.5 py-2 text-label font-medium text-ink-3 transition-colors hover:text-ink focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
            >
              ←
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isLast) finish()
              else setStep((s) => s + 1)
            }}
            className="cursor-pointer rounded-md bg-primary px-4.5 py-2.5 text-body font-medium text-white shadow-primary transition-[background-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:bg-primary-hover hover:shadow-primary-hover active:translate-y-px active:bg-primary-active focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
          >
            {isLast ? 'C’est parti ✓' : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  )
}
