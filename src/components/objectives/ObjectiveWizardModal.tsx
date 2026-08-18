import { useEffect, useId, useRef, useState } from 'react'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { WizardProgress } from './draft/WizardProgress'
import { NatureQuestion } from './draft/NatureQuestion'
import { GoalQuestion } from './draft/GoalQuestion'
import { HorizonQuestion } from './draft/HorizonQuestion'
import { MeasureQuestion } from './draft/MeasureQuestion'
import { HabitQuestion } from './draft/HabitQuestion'
import { QuantityQuestion } from './draft/QuantityQuestion'
import { MilestonesQuestion } from './draft/MilestonesQuestion'
import { DRAFT_COPY, type QuestionCopy } from './draft/copy'
import { useAppToday } from '../../hooks/useAppToday'
import { useCreateObjectiveFully } from '../../hooks/useCreateObjectiveFully'
import { MAX_PRINCIPALS } from '../../hooks/useObjectives'
import { dataErrorMessage } from '../../lib/errorMessage'
import {
  emptyDraft,
  isDraftReady,
  isScopeReady,
  withKind,
  type DraftScope,
  type ObjectiveDraft,
} from '../../lib/objectiveDraft'

/**
 * Les cinq questions, dans l'ordre. La nature vient **en premier** : c'est elle
 * qui décide des mesures offertes à la quatrième, et l'apprendre après avoir
 * tout saisi ferait revenir en arrière.
 */
type Step = 'nature' | 'goal' | 'horizon' | 'measure' | 'setup'
const STEPS: Step[] = ['nature', 'goal', 'horizon', 'measure', 'setup']

type ObjectiveWizardModalProps = {
  open: boolean
  onClose: () => void
  userId: string
  year: number
  /** Places occupées aujourd'hui, arrêtés compris — les mêmes que le rail. */
  principalSlotsUsed: number
  secondarySlotsUsed: number
  /**
   * Réponses déjà connues à l'ouverture. Le bilan de trimestre (§8) s'en sert
   * deux fois : pour poser d'emblée le trimestre qui vient, et pour reprendre un
   * objectif arrêté — **reprendre, c'est créer la suite**, jamais rouvrir, d'où
   * une simple draft préremplie et non une résurrection.
   *
   * Les questions restent toutes posées : on préremplit, on ne saute rien.
   */
  initialDraft?: ObjectiveDraft
  /** Au-dessus d'une cérémonie plutôt qu'au-dessus de l'application. */
  elevation?: 'app' | 'ceremony'
  /** Le nouvel objectif devient celui qu'on regarde. */
  onCreated?: (id: string) => void
}

/**
 * Créer un objectif — **cinq questions, une minute**.
 *
 * Même parcours que l'onboarding, mêmes corps de question, même copie : ce sont
 * littéralement les mêmes composants (`src/components/objectives/draft/`). Seule
 * la coquille diffère — l'onboarding est un plein écran, ici c'est une modale.
 *
 * La version précédente empilait les neuf champs sur un seul écran et
 * **déduisait** la nature du nombre de places libres. Une question par écran, et
 * la nature enfin posée : c'est la même matière, servie autrement.
 */
export function ObjectiveWizardModal({
  open,
  onClose,
  userId,
  year,
  principalSlotsUsed,
  secondarySlotsUsed,
  initialDraft,
  elevation = 'app',
  onCreated,
}: ObjectiveWizardModalProps) {
  const formId = useId()
  const topRef = useRef<HTMLDivElement>(null)

  const todayQuery = useAppToday()
  const today = todayQuery.data

  const defaultKind = principalSlotsUsed < MAX_PRINCIPALS ? 'principal' : 'secondaire'
  const [step, setStep] = useState<Step>('nature')
  const [draft, setDraft] = useState<ObjectiveDraft>(
    () => initialDraft ?? emptyDraft(defaultKind),
  )

  const createObjective = useCreateObjectiveFully()

  // Chaque ouverture repart de la draft d'entrée : la modale sert plusieurs
  // créations de suite, et un brouillon qui survivrait ferait réapparaître les
  // réponses précédentes sur un objectif qui n'a rien à voir.
  useEffect(() => {
    if (!open) return
    setStep('nature')
    setDraft(initialDraft ?? emptyDraft(defaultKind))
    createObjective.reset()
    // Les mutations sont stables ; ne réagir qu'à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultKind, initialDraft])

  // On quitte un écran défilé (la quantité est longue) vers un écran court : sans
  // ce retour en haut, on tombe sur du vide. `scrollIntoView` remonte n'importe
  // quel ancêtre défilant, y compris le panneau de `Modal`.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'nearest' })
  }, [step])

  function patch(next: Partial<ObjectiveDraft>) {
    setDraft((current) => ({ ...current, ...next }))
  }

  const index = STEPS.indexOf(step)
  const last = step === 'setup'
  const scope: DraftScope = step
  const copy = questionCopy(step, draft)

  function advance() {
    if (last) {
      if (!today || !isDraftReady(draft)) return
      createObjective.mutate(
        { draft, userId, year, today },
        {
          onSuccess: (id) => {
            onCreated?.(id)
            onClose()
          },
        },
      )
      return
    }
    setStep(STEPS[index + 1]!)
  }

  const ready = isScopeReady(draft, scope) && (!last || (!!today && !createObjective.isPending))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={copy.title}
      variant="sheet"
      elevation={elevation}
      footer={
        <div className="flex items-center justify-between gap-3">
          {index > 0 ? (
            <Button variant="ghost" onClick={() => setStep(STEPS[index - 1]!)}>
              ← Retour
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="submit"
            form={formId}
            disabled={!ready}
            loading={last && createObjective.isPending}
          >
            {last ? 'Créer l’objectif' : 'Continuer'}
          </Button>
        </div>
      }
    >
      <div ref={topRef} />
      <WizardProgress total={STEPS.length} current={index + 1} className="mt-1 mb-4" />
      <p className="mb-5 text-body leading-relaxed text-ink-3">{copy.subtitle}</p>

      {/* Hauteur minimale en desktop : cinq écrans de tailles différentes dans
          un panneau ancré en haut feraient sauter le cadre à chaque étape. En
          mobile la feuille est déjà pleine hauteur, il n'y a rien à caler. */}
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) advance()
        }}
        className="sm:min-h-84"
      >
        {step === 'nature' && (
          <NatureQuestion
            draft={draft}
            onSelectKind={(kind) => setDraft((current) => withKind(current, kind))}
            principalSlotsUsed={principalSlotsUsed}
            secondarySlotsUsed={secondarySlotsUsed}
          />
        )}

        {step === 'goal' && (
          <GoalQuestion draft={draft} onChange={patch} autoFocus />
        )}

        {step === 'horizon' && today && (
          <HorizonQuestion draft={draft} onChange={patch} today={today} year={year} />
        )}

        {step === 'measure' && <MeasureQuestion draft={draft} onChange={patch} />}

        {step === 'setup' && today && draft.measure === 'habitude' && (
          <HabitQuestion draft={draft} onChange={patch} today={today} year={year} />
        )}
        {step === 'setup' && today && draft.measure === 'quantite' && (
          <QuantityQuestion draft={draft} onChange={patch} today={today} year={year} />
        )}
        {step === 'setup' && draft.measure === 'jalons' && (
          <MilestonesQuestion draft={draft} onChange={patch} />
        )}

        {createObjective.error && (
          <Alert className="mt-4">{dataErrorMessage(createObjective.error)}</Alert>
        )}
      </form>
    </Modal>
  )
}

/** Le titre et le sous-titre de l'écran courant — la dernière question en a trois. */
function questionCopy(step: Step, draft: ObjectiveDraft): QuestionCopy {
  if (step !== 'setup') return DRAFT_COPY[step]
  if (draft.measure === 'habitude') return DRAFT_COPY.habit
  if (draft.measure === 'quantite') return DRAFT_COPY.quantity
  return DRAFT_COPY.milestones
}
