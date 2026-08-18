import { Input } from '../../ui/Input'
import { FieldHint } from '../../ui/FieldLabel'
import { QuietNote } from './FeasibilityNote'
import { MAX_MILESTONES, type ObjectiveDraft } from '../../../lib/objectiveDraft'

type MilestonesQuestionProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  autoFocus?: boolean
}

/**
 * « Quelles sont les étapes ? »
 *
 * **Aucune cadence n'est demandée**, parce qu'un objectif par étapes n'en a pas.
 * L'écran le dit au lieu de poser une question sans objet.
 *
 * Quatre lignes fixes, pas de bouton « ajouter » : c'est le cap serveur
 * `milestone_cap`, énoncé ici plutôt que découvert au moment de l'erreur. Les
 * lignes laissées vides ne partent pas.
 */
export function MilestonesQuestion({
  draft,
  onChange,
  autoFocus = false,
}: MilestonesQuestionProps) {
  function setMilestone(index: number, value: string) {
    const milestones = [...draft.milestones]
    milestones[index] = value
    onChange({ milestones })
  }

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: MAX_MILESTONES }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {/* Décorative : rien ne se coche à la création, la case est là pour
                annoncer ce que deviendra la ligne. */}
            <span
              aria-hidden="true"
              className="size-4.5 shrink-0 rounded-xs border-2 border-border-idle"
            />
            <Input
              value={draft.milestones[i] ?? ''}
              onChange={(e) => setMilestone(i, e.target.value)}
              placeholder={i === 0 ? 'Première étape' : 'Étape suivante'}
              aria-label={`Étape ${i + 1}`}
              autoFocus={autoFocus && i === 0}
              className="min-w-0 flex-1 px-3.5 py-[11px] text-body"
            />
          </div>
        ))}
      </div>
      <FieldHint>
        Quatre maximum par trimestre. Vous en poserez de nouvelles au bilan du trimestre
        suivant.
      </FieldHint>

      <QuietNote>
        <b>Pas de cadence pour cet objectif.</b> Il n’apparaîtra pas dans votre rythme
        hebdomadaire et ne vous demandera rien chaque semaine.
      </QuietNote>
    </>
  )
}
