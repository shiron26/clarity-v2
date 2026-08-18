import { OnboardingShell } from '../components/OnboardingShell'
import { MilestonesQuestion } from '../../../components/objectives/draft/MilestonesQuestion'
import { DraftPreview } from '../../../components/objectives/draft/DraftPreview'
import { DRAFT_COPY } from '../../../components/objectives/draft/copy'
import { isScopeReady, type ObjectiveDraft } from '../../../lib/objectiveDraft'
import type { IsoDate } from '../../../lib/appDate'

/** s4c — le corps vit dans `MilestonesQuestion`, partagé avec l'écran Objectifs. */
type StepMilestonesProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  /** L'emplacement que l'objectif recevra, pour que l'aperçu ait sa couleur. */
  slot: number
  today: IsoDate
  actionLabel: string
  pending: boolean
  onSubmit: () => void
  onBack: () => void
}

export function StepMilestones({
  draft,
  onChange,
  slot,
  today,
  actionLabel,
  pending,
  onSubmit,
  onBack,
}: StepMilestonesProps) {
  return (
    <OnboardingShell
      step={4}
      title={DRAFT_COPY.milestones.title}
      subtitle={DRAFT_COPY.milestones.subtitle}
      actionLabel={actionLabel}
      onAction={onSubmit}
      actionDisabled={pending || !isScopeReady(draft, 'setup')}
      onBack={onBack}
      aside={<DraftPreview draft={draft} slot={slot} today={today} />}
    >
      <MilestonesQuestion draft={draft} onChange={onChange} autoFocus />
    </OnboardingShell>
  )
}
