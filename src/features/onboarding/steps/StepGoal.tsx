import { OnboardingShell } from '../components/OnboardingShell'
import { GoalQuestion } from '../../../components/objectives/draft/GoalQuestion'
import { DRAFT_COPY, ONBOARDING_GOAL_SUBTITLE } from '../../../components/objectives/draft/copy'
import { isScopeReady, type ObjectiveDraft } from '../../../lib/objectiveDraft'

/**
 * s1 — le corps vit dans `GoalQuestion`, partagé avec l'assistant de l'écran
 * Objectifs : deux écrans posent la même question, elle ne s'écrit qu'une fois.
 */
type StepGoalProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  onNext: () => void
  onBack?: () => void
  /** Premier objectif du parcours : c'est le seul qui présente l'application. */
  first: boolean
}

export function StepGoal({ draft, onChange, onNext, onBack, first }: StepGoalProps) {
  return (
    <OnboardingShell
      step={1}
      title={DRAFT_COPY.goal.title}
      subtitle={first ? ONBOARDING_GOAL_SUBTITLE : DRAFT_COPY.goal.subtitle}
      actionLabel="Continuer"
      onAction={onNext}
      actionDisabled={!isScopeReady(draft, 'goal')}
      onBack={onBack}
    >
      <GoalQuestion draft={draft} onChange={onChange} autoFocus />
    </OnboardingShell>
  )
}
