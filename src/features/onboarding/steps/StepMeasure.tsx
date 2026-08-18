import { OnboardingShell } from '../components/OnboardingShell'
import { MeasureQuestion } from '../../../components/objectives/draft/MeasureQuestion'
import { MeasurePreview } from '../../../components/objectives/draft/MeasurePreview'
import { DRAFT_COPY } from '../../../components/objectives/draft/copy'
import type { IsoDate } from '../../../lib/appDate'
import type { ObjectiveDraft } from '../../../lib/objectiveDraft'

/**
 * s3 — le corps vit dans `MeasureQuestion`, partagé avec l'écran Objectifs.
 *
 * Seul l'onboarding demande l'aperçu de la carte : c'est ici qu'on découvre le
 * produit, et la question est celle qui décide de tout le reste.
 */
type StepMeasureProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  /** L'emplacement que l'objectif recevra, pour que l'aperçu ait sa couleur. */
  slot: number
  today: IsoDate
  onNext: () => void
  onBack: () => void
}

export function StepMeasure({ draft, onChange, slot, today, onNext, onBack }: StepMeasureProps) {
  return (
    <OnboardingShell
      step={3}
      title={DRAFT_COPY.measure.title}
      subtitle={DRAFT_COPY.measure.subtitle}
      actionLabel="Continuer"
      onAction={onNext}
      onBack={onBack}
      aside={<MeasurePreview draft={draft} slot={slot} today={today} />}
    >
      <MeasureQuestion draft={draft} onChange={onChange} />
    </OnboardingShell>
  )
}
