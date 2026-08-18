import { ObjectiveCard } from '../ObjectiveCard'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'
import { daysOfWeek as weekOf, type IsoDate } from '../../../lib/appDate'
import { draftMilestones, parseAmount, type ObjectiveDraft } from '../../../lib/objectiveDraft'
import type { Milestone } from '../../../hooks/useMilestones'
import type { Objective } from '../../../hooks/useObjectives'

/**
 * L'aperçu de la carte pendant qu'on règle la mesure : à côté de la colonne en
 * grand écran, au-dessus du formulaire sinon (prop `aside` d'`OnboardingShell`).
 *
 * Les trois dernières questions du parcours règlent ce que la carte affichera,
 * et rien à l'écran ne le montrait : « 5 fois par semaine », « 6 000 » ou quatre
 * lignes d'étapes ne disent pas ce que ça donne. Le rythme change le nombre de
 * segments de l'anneau, et à sept fois par semaine la carte troque l'anneau
 * pour les sept pastilles de jours : le montrer coûte un aperçu, l'expliquer
 * coûterait un paragraphe que personne ne lit.
 *
 * **C'est la VRAIE carte** (`ObjectiveCard`) et le VRAI brouillon : titre saisi,
 * couleur de la place à venir, réglages en cours. Contrairement à
 * `MeasurePreview`, qui compare trois façons de suivre le même objectif et a
 * donc besoin d'un exemple, il n'y a ici qu'une réponse à donner, et elle ne se
 * lit que sur son propre objectif.
 *
 * Un seul chiffre est inventé, celui des séances faites : un anneau vide ne
 * montrerait pas la différence entre trois et cinq segments, qui est tout le
 * sujet de la question. La légende le dit (« en cours de semaine »). Le reste
 * est littéral — la quantité part du point de départ saisi, les étapes sont
 * celles qu'on est en train d'écrire, aucune n'est cochée.
 */
type DraftPreviewProps = {
  draft: ObjectiveDraft
  /** L'emplacement que l'objectif recevra, donc sa couleur. */
  slot: number
  today: IsoDate
}

export function DraftPreview({ draft, slot, today }: DraftPreviewProps) {
  const reducedMotion = usePrefersReducedMotion()

  const habit = draft.measure === 'habitude'
  const cadence = Math.max(1, draft.cadence)
  // Toujours strictement en dessous de la cadence : une période déjà bouclée
  // (« 1/1 ») se lirait comme un objectif atteint, pas comme un rythme.
  const done = habit ? Math.floor(cadence / 2) : 0

  const objective = previewObjective(draft, slot, cadence)

  // La carte ne rend les sept pastilles qu'en cadence quotidienne ; elle a alors
  // besoin d'une vraie semaine et des jours crédités. Le « aujourd'hui » de
  // l'aperçu est le lendemain des jours faits, pour que la semaine se lise
  // « trois faits, celui-ci en cours, le reste à venir » plutôt qu'en jours
  // manqués.
  const week = weekOf(today)
  const activeDays = new Set(
    habit ? week.slice(0, done).map((day) => `${objective.id}|${day}`) : [],
  )

  // En mode relevé, la valeur d'aujourd'hui devient le premier relevé de
  // l'objectif : la carte affichera vraiment ce chiffre. En cumul on part de
  // zéro, par définition.
  const value = (draft.entryMode === 'releve' ? parseAmount(draft.startValue) : null) ?? 0

  return (
    // Aucune marge : la coquille qui la pose décide de l'espacement, il n'est
    // pas le même au-dessus du formulaire et à côté de lui.
    <div>
      <p className="mb-2 text-caption text-ink-muted">{caption(draft)}</p>
      <ObjectiveCard
        // Rejouer l'apparition quand la forme de la carte change, pas à chaque
        // frappe : c'est le changement d'anneau qui porte l'explication.
        key={`${draft.measure}-${draft.periodUnit}-${cadence}`}
        className={reducedMotion ? undefined : 'animate-fade-in'}
        objective={objective}
        week={{
          objective_id: objective.id,
          period_unit: draft.periodUnit,
          period_year: 0,
          period_index: 0,
          target: cadence,
          done,
        }}
        progress={{
          objective_id: objective.id,
          value,
          entries: value > 0 ? 1 : 0,
          last_entry_date: value > 0 ? today : null,
        }}
        milestones={previewMilestones(objective.id, draft)}
        activeDays={activeDays}
        daysOfWeek={week}
        today={habit ? (week[done] ?? week[6]!) : today}
      />
    </div>
  )
}

/**
 * Ce que l'aperçu montre, dit en une ligne. Seule l'habitude annonce un moment
 * (« en cours de semaine ») : c'est la seule des trois dont le remplissage est
 * inventé, et le taire ferait passer un exemple pour un état.
 */
function caption(draft: ObjectiveDraft): string {
  if (draft.measure === 'habitude') {
    return draft.periodUnit === 'week'
      ? 'Votre carte, en cours de semaine.'
      : 'Votre carte, en cours de mois.'
  }
  return 'Votre carte, telle qu’elle démarrera.'
}

/**
 * L'objectif que la carte rendra. Les champs dépendants de la mesure suivent la
 * discipline de `toNewObjective` (`src/lib/objectiveDraft.ts`) : un objectif par
 * étapes n'a ni période ni cadence, une habitude n'a ni unité ni mode de saisie.
 * En laisser traîner un ferait rendre la carte d'une autre mesure.
 */
function previewObjective(draft: ObjectiveDraft, slot: number, cadence: number): Objective {
  const habit = draft.measure === 'habitude'
  const quantity = draft.measure === 'quantite'

  return {
    // Ces sept champs existent dans le type mais ne sont jamais lus par la
    // carte. Aucune valeur plausible à inventer : ils restent neutres.
    id: 'preview',
    user_id: null,
    space_id: null,
    parent_objective_id: null,
    created_at: null,
    year: 0,
    window_range: '',

    quarter: draft.quarter,
    slot,

    // La carte est celle d'un principal : elle prend sa couleur dans
    // `objectiveSkin(slot)`. L'aperçu n'est donc pas proposé aux secondaires.
    kind: 'principal',
    label: draft.label.trim(),
    title: draft.title.trim() === '' ? 'Votre objectif' : draft.title.trim(),
    why: null,
    description: null,
    measure: draft.measure,
    period_unit: draft.measure === 'jalons' ? null : draft.periodUnit,
    cadence: habit ? cadence : null,
    // Sur une habitude, la cible totale ne s'affiche pas : le rythme est le seul
    // indicateur de la carte.
    target_value: quantity ? parseAmount(draft.targetValue) : null,
    unit: quantity && draft.unit !== '' ? draft.unit : null,
    entry_mode: quantity ? draft.entryMode : null,
    direction: quantity ? 'atteindre' : null,
    closed_at: null,
  }
}

/**
 * Les étapes déjà écrites, aucune cochée : elles n'existent pas encore, et en
 * cocher une pour « montrer quelque chose » afficherait un travail que personne
 * n'a fait. Tant qu'aucune ligne n'est remplie, la carte rend son propre état
 * vide.
 */
function previewMilestones(objectiveId: string, draft: ObjectiveDraft): Milestone[] {
  if (draft.measure !== 'jalons') return []

  return draftMilestones(draft).map((title, i) => ({
    id: `preview-${i}`,
    objective_id: objectiveId,
    year: 0,
    // La carte ne lit ni l'année ni le trimestre d'une étape : elle coche et
    // affiche le titre. Neutres, comme les autres champs non lus.
    quarter: 1,
    position: i,
    title,
    completed_at: null,
  }))
}
