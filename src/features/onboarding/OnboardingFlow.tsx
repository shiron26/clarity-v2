import { useEffect, useMemo, useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { useAuth } from '../auth/useAuth'
import { useAppToday } from '../../hooks/useAppToday'
import { useProfile } from '../../hooks/useProfile'
import { selectPrincipals, useObjectives } from '../../hooks/useObjectives'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { dataErrorMessage } from '../../lib/errorMessage'
import { emptyDraft, isDraftReady, type ObjectiveDraft } from '../../lib/objectiveDraft'
import { PRINCIPAL_SLOTS } from '../../lib/objectivePalette'
import { year as yearOf } from '../../lib/appDate'
import { useCompleteOnboarding } from './useCompleteOnboarding'
import { useCreateObjectiveFully } from '../../hooks/useCreateObjectiveFully'
import { StepGoal } from './steps/StepGoal'
import { StepHorizon } from './steps/StepHorizon'
import { StepMeasure } from './steps/StepMeasure'
import { StepHabit } from './steps/StepHabit'
import { StepQuantity } from './steps/StepQuantity'
import { StepMilestones } from './steps/StepMilestones'
import { StepSlots } from './steps/StepSlots'
import { StepReady } from './steps/StepReady'

/**
 * Le parcours de première connexion (REFONTE §2).
 *
 * Ce n'est pas une présentation : l'application ne se configure pas, elle fait
 * **créer un premier objectif correctement typé**. Quatre questions sur la vie
 * de la personne, jamais sur le modèle de données, puis les trois places et ce
 * que l'app rendra.
 *
 * Overlay plein écran plutôt que route : c'est le pattern du dépôt (les flows de
 * cérémonie en `z-60`), et cela évite un gate de redirection dans `ProtectedRoute`. Le
 * fond est opaque — la coquille de navigation disparaît, comme dans la maquette.
 */
type Step = 'goal' | 'horizon' | 'measure' | 'setup' | 'slots' | 'ready'

const QUESTIONS: Step[] = ['goal', 'horizon', 'measure', 'setup']

export function OnboardingFlow() {
  const { session } = useAuth()
  const userId = session?.user.id
  const profile = useProfile()
  const todayQuery = useAppToday()
  const today = todayQuery.data
  const year = today ? yearOf(today) : undefined
  const objectivesQuery = useObjectives(year)

  const reducedMotion = usePrefersReducedMotion()
  const complete = useCompleteOnboarding()
  const createObjective = useCreateObjectiveFully()

  const [step, setStep] = useState<Step>('goal')
  const [draft, setDraft] = useState<ObjectiveDraft>(() => emptyDraft('principal'))
  // La décision de reprise ne se prend qu'une fois, au premier rendu où les
  // objectifs sont connus : sans ce verrou, créer un objectif renverrait
  // aussitôt aux places l'utilisateur en train d'en saisir un second.
  const [resumed, setResumed] = useState(false)

  const principals = useMemo(
    () => selectPrincipals(objectivesQuery.data),
    [objectivesQuery.data],
  )

  // L'emplacement que le prochain objectif recevra. Le serveur attribue le plus
  // petit libre sous verrou (AGENTS.md) : reprendre la même règle ici donne à
  // l'aperçu de l'étape 3 la couleur que la carte aura vraiment.
  const nextSlot = useMemo(
    () => PRINCIPAL_SLOTS.find((slot) => !principals.some((o) => o.slot === slot)) ?? 1,
    [principals],
  )

  const pendingOnboarding = profile.isSuccess && profile.data.onboarded_at === null
  // On sort dès que la mutation part, sans attendre l'aller-retour : le parcours
  // est fini du point de vue de l'utilisateur. `visible` — et non
  // `pendingOnboarding` — pilote AUSSI le verrou de défilement, sinon le
  // composant rend `null` sans se démonter et le `body` resterait bloqué.
  const visible = pendingOnboarding && !complete.isPending && !complete.isSuccess

  /**
   * Reprise. `onboarded_at` s'écrit sur le dernier écran, mais l'objectif est
   * créé dès la fin des questions : fermer l'onglet entre les deux relancerait
   * le parcours et ferait créer un doublon. Un profil non onboardé qui porte
   * déjà un principal a donc forcément passé les questions — il repart des
   * places.
   */
  useEffect(() => {
    if (!pendingOnboarding || resumed || !objectivesQuery.isSuccess) return
    setResumed(true)
    if (principals.length > 0) setStep('slots')
  }, [pendingOnboarding, resumed, objectivesQuery.isSuccess, principals.length])

  // Le parcours couvre l'écran : laisser la page défiler derrière lui donnerait
  // une seconde barre de défilement et un fond qui bouge. `Modal` fait pareil.
  useEffect(() => {
    if (!visible) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [visible])

  if (!visible) return null

  function patch(next: Partial<ObjectiveDraft>) {
    setDraft((current) => ({ ...current, ...next }))
  }

  function startAnother() {
    setDraft(emptyDraft('principal'))
    setStep('goal')
  }

  function submitDraft() {
    if (!userId || !year || !today || !isDraftReady(draft)) return
    createObjective.mutate(
      { draft, userId, year, today },
      { onSuccess: () => setStep('slots') },
    )
  }

  function finish() {
    complete.mutate()
  }

  const questionIndex = QUESTIONS.indexOf(step)
  function back() {
    if (questionIndex > 0) setStep(QUESTIONS[questionIndex - 1]!)
  }

  const pending = createObjective.isPending || complete.isPending
  const error = createObjective.error ?? complete.error ?? objectivesQuery.error ?? null
  const submitLabel = createObjective.isPending ? 'Création…' : 'Créer cet objectif'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Premiers pas sur Clarity"
      className={`fixed inset-0 z-70 overflow-y-auto bg-auth-canvas px-5.5 py-9.5 lg:px-8 lg:py-15 ${
        reducedMotion ? '' : 'animate-fade-in'
      }`}
    >
      <div className="mx-auto flex w-full max-w-120 flex-col">
        {error && (
          <Alert variant="danger" className="mb-4">
            {dataErrorMessage(error)}
          </Alert>
        )}

        {!today || !userId || !objectivesQuery.isSuccess ? (
          <div className="flex min-h-60 items-center justify-center">
            <Spinner className="text-ink-muted" />
          </div>
        ) : step === 'goal' ? (
          <StepGoal
            draft={draft}
            onChange={patch}
            onNext={() => setStep('horizon')}
            first={principals.length === 0}
            // Ajouter un deuxième objectif se quitte : on revient aux places.
            onBack={principals.length > 0 ? () => setStep('slots') : undefined}
          />
        ) : step === 'horizon' ? (
          <StepHorizon
            draft={draft}
            onChange={patch}
            today={today}
            year={year!}
            onNext={() => setStep('measure')}
            onBack={back}
          />
        ) : step === 'measure' ? (
          <StepMeasure
            draft={draft}
            onChange={patch}
            slot={nextSlot}
            today={today}
            onNext={() => setStep('setup')}
            onBack={back}
          />
        ) : step === 'setup' ? (
          draft.measure === 'habitude' ? (
            <StepHabit
              draft={draft}
              onChange={patch}
              slot={nextSlot}
              today={today}
              year={year!}
              actionLabel={submitLabel}
              pending={pending}
              onSubmit={submitDraft}
              onBack={back}
            />
          ) : draft.measure === 'quantite' ? (
            <StepQuantity
              draft={draft}
              onChange={patch}
              slot={nextSlot}
              today={today}
              year={year!}
              actionLabel={submitLabel}
              pending={pending}
              onSubmit={submitDraft}
              onBack={back}
            />
          ) : (
            <StepMilestones
              draft={draft}
              onChange={patch}
              slot={nextSlot}
              today={today}
              actionLabel={submitLabel}
              pending={pending}
              onSubmit={submitDraft}
              onBack={back}
            />
          )
        ) : step === 'slots' ? (
          <StepSlots
            principals={principals}
            onAdd={startAnother}
            onNext={() => setStep('ready')}
          />
        ) : (
          <StepReady pending={pending} onFinish={finish} />
        )}
      </div>
    </div>
  )
}
