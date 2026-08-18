import { OnboardingShell } from '../components/OnboardingShell'
import { HabitQuestion } from '../../../components/objectives/draft/HabitQuestion'
import { DraftPreview } from '../../../components/objectives/draft/DraftPreview'
import { DRAFT_COPY } from '../../../components/objectives/draft/copy'
import type { ObjectiveDraft } from '../../../lib/objectiveDraft'
import type { IsoDate } from '../../../lib/appDate'

/**
 * s4a — le corps vit dans `HabitQuestion`, partagé avec l'écran Objectifs.
 *
 * L'aperçu de la carte reste ici, comme celui de la question des mesures : c'est
 * l'onboarding qui fait découvrir le produit, la modale de l'écran Objectifs
 * s'adresse à quelqu'un qui a déjà ses cartes sous les yeux.
 */
type StepHabitProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  /** L'emplacement que l'objectif recevra, pour que l'aperçu ait sa couleur. */
  slot: number
  today: IsoDate
  year: number
  actionLabel: string
  pending: boolean
  onSubmit: () => void
  onBack: () => void
}

export function StepHabit({
  draft,
  onChange,
  slot,
  today,
  year,
  actionLabel,
  pending,
  onSubmit,
  onBack,
}: StepHabitProps) {
  return (
    <OnboardingShell
      step={4}
      title={DRAFT_COPY.habit.title}
      subtitle={DRAFT_COPY.habit.subtitle}
      actionLabel={actionLabel}
      onAction={onSubmit}
      actionDisabled={pending}
      onBack={onBack}
      aside={<DraftPreview draft={draft} slot={slot} today={today} />}
    >
      <HabitQuestion draft={draft} onChange={onChange} today={today} year={year} />
    </OnboardingShell>
  )
}
