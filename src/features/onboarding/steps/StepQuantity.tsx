import { OnboardingShell } from '../components/OnboardingShell'
import { QuantityQuestion } from '../../../components/objectives/draft/QuantityQuestion'
import { DraftPreview } from '../../../components/objectives/draft/DraftPreview'
import { DRAFT_COPY } from '../../../components/objectives/draft/copy'
import { isScopeReady, type ObjectiveDraft } from '../../../lib/objectiveDraft'
import type { IsoDate } from '../../../lib/appDate'

/** s4b — le corps vit dans `QuantityQuestion`, partagé avec l'écran Objectifs. */
type StepQuantityProps = {
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

export function StepQuantity({
  draft,
  onChange,
  slot,
  today,
  year,
  actionLabel,
  pending,
  onSubmit,
  onBack,
}: StepQuantityProps) {
  return (
    <OnboardingShell
      step={4}
      title={DRAFT_COPY.quantity.title}
      subtitle={DRAFT_COPY.quantity.subtitle}
      actionLabel={actionLabel}
      onAction={onSubmit}
      actionDisabled={pending || !isScopeReady(draft, 'setup')}
      onBack={onBack}
      aside={<DraftPreview draft={draft} slot={slot} today={today} />}
    >
      <QuantityQuestion draft={draft} onChange={onChange} today={today} year={year} />
    </OnboardingShell>
  )
}
