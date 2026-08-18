import { OnboardingShell } from '../components/OnboardingShell'
import { HorizonQuestion } from '../../../components/objectives/draft/HorizonQuestion'
import { DRAFT_COPY } from '../../../components/objectives/draft/copy'
import type { ObjectiveDraft } from '../../../lib/objectiveDraft'
import type { IsoDate } from '../../../lib/appDate'

/** s2 — le corps vit dans `HorizonQuestion`, partagé avec l'écran Objectifs. */
type StepHorizonProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  today: IsoDate
  year: number
  onNext: () => void
  onBack: () => void
}

export function StepHorizon({ draft, onChange, today, year, onNext, onBack }: StepHorizonProps) {
  return (
    <OnboardingShell
      step={2}
      title={DRAFT_COPY.horizon.title}
      subtitle={DRAFT_COPY.horizon.subtitle}
      actionLabel="Continuer"
      onAction={onNext}
      onBack={onBack}
    >
      {/* Deux options seulement ici : l'année, ou le trimestre en cours. Un
          premier objectif calé sur le trimestre prochain finirait le parcours
          sur un dashboard vide jusqu'à son premier jour. */}
      <HorizonQuestion
        draft={draft}
        onChange={onChange}
        today={today}
        year={year}
        allowNextQuarter={false}
      />
    </OnboardingShell>
  )
}
