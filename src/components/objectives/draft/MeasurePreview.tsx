import { ObjectiveCard } from '../ObjectiveCard'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'
import { addDays, type IsoDate } from '../../../lib/appDate'
import type { Milestone } from '../../../hooks/useMilestones'
import type { Objective, ObjectiveMeasure } from '../../../hooks/useObjectives'
import type { ObjectiveDraft } from '../../../lib/objectiveDraft'

/**
 * L'aperçu de la carte de « Comment comptez-vous avancer dessus ? » : à côté de
 * la colonne en grand écran, au-dessus des trois réponses sinon. C'est
 * `OnboardingShell` qui le place — voir sa prop `aside`.
 *
 * C'est la question la plus difficile du parcours : elle décide de tout ce que
 * l'application demandera ensuite, et jusqu'ici rien ne montrait ce que chaque
 * réponse produit. La carte est l'objet signature du produit — la voir prendre
 * trois formes règle en une seconde ce que trois paragraphes expliquent mal.
 *
 * **C'est la VRAIE carte** (`ObjectiveCard`), pas une imitation : le composant
 * est pur, tout lui arrive en props, il suffit de lui fabriquer un objectif et
 * un jeu de données. L'aperçu ne peut donc pas diverger de ce que l'utilisateur
 * verra, et il suivra les évolutions de la carte sans qu'on y pense.
 * (`features/auth/components/ObjectivePreviewCard.tsx` est l'inverse : une carte
 * redessinée à la main pour le panneau de connexion. Une deuxième copie suffit,
 * il n'en faut pas une troisième.)
 *
 * **C'est un EXEMPLE, pas le brouillon en cours.** Reprendre le titre saisi
 * donnait « Test · 40 sur 100 » : un objectif qu'on vient d'écrire, avec des
 * chiffres qui ne veulent rien dire, et sur quoi personne ne se projette. Les
 * trois aperçus montrent donc **le même objectif** suivi des trois façons : la
 * démonstration de ce que dit la note sous les réponses, rejouée à chaque clic.
 *
 * **Un objectif d'exemple par place**, parce qu'on passe ici trois fois de
 * suite : le permis, mettre de l'argent de côté, reprendre le sport. Revoir la
 * même carte à chaque objectif la ferait prendre pour un décor ; trois domaines
 * différents disent au passage que la question ne range pas les objectifs par
 * sujet. La place vient du brouillon (c'est une réponse déjà donnée) et donne
 * aussi sa couleur à la carte.
 *
 * La carte ne porte que son titre et son indicateur : la fenêtre choisie ne s'y
 * lit pas.
 */
type MeasurePreviewProps = {
  draft: ObjectiveDraft
  /** L'emplacement que l'objectif recevra — donc sa couleur. */
  slot: number
  today: IsoDate
}

type Example = {
  /** Cadence d'une habitude, nulle ailleurs — c'est elle qui dessine l'anneau. */
  cadence: number | null
  targetValue: number | null
  unit: string | null
  /** Séances faites cette semaine (habitude) ou valeur relevée (quantité). */
  done: number
  milestones: string[]
}

type SlotExample = {
  title: string
  label: string
  measures: Record<ObjectiveMeasure, Example>
}

/**
 * Un objectif par place, chacun pris dans les trois sens. Les cadences restent
 * sous sept : à sept fois par semaine la carte troque l'anneau pour les sept
 * pastilles de jours, qui demandent une vraie semaine de dates.
 */
const EXAMPLES: ReadonlyArray<SlotExample> = [
  {
    title: 'Passer le permis',
    label: 'PERMIS',
    measures: {
      habitude: { cadence: 3, targetValue: null, unit: null, done: 2, milestones: [] },
      quantite: { cadence: null, targetValue: 20, unit: 'h', done: 8, milestones: [] },
      jalons: {
        cadence: null,
        targetValue: null,
        unit: null,
        done: 0,
        milestones: ['Code', '20 h de conduite', 'Examen'],
      },
    },
  },
  {
    title: 'Mettre de l’argent de côté',
    label: 'ÉPARGNE',
    measures: {
      habitude: { cadence: 2, targetValue: null, unit: null, done: 1, milestones: [] },
      quantite: { cadence: null, targetValue: 3000, unit: '€', done: 1200, milestones: [] },
      jalons: {
        cadence: null,
        targetValue: null,
        unit: null,
        done: 0,
        milestones: ['Faire le point', 'Virement automatique', '1 000 € de côté'],
      },
    },
  },
  {
    title: 'Reprendre le sport',
    label: 'SPORT',
    measures: {
      habitude: { cadence: 4, targetValue: null, unit: null, done: 3, milestones: [] },
      quantite: { cadence: null, targetValue: 100, unit: 'km', done: 42, milestones: [] },
      jalons: {
        cadence: null,
        targetValue: null,
        unit: null,
        done: 0,
        milestones: ['Une séance par semaine', '5 km d’affilée', 'Course de 10 km'],
      },
    },
  },
]

export function MeasurePreview({ draft, slot, today }: MeasurePreviewProps) {
  const reducedMotion = usePrefersReducedMotion()

  // Les places vont de 1 à 3 (`PRINCIPAL_SLOTS`) ; la première sert de filet si
  // ce contrat bouge un jour.
  const slotExample = EXAMPLES[slot - 1] ?? EXAMPLES[0]!
  const example = slotExample.measures[draft.measure]
  const objective = previewObjective(draft, slot, slotExample, example)

  return (
    // Aucune marge : la coquille qui la pose décide de l'espacement, il n'est
    // pas le même au-dessus du formulaire et à côté de lui.
    <div>
      <p className="mb-2 text-caption text-ink-muted">
        Un exemple, quelques semaines après le départ.
      </p>
      <ObjectiveCard
        // Rejouer l'apparition à chaque réponse : c'est le changement de forme
        // qui porte l'explication, il doit se voir.
        key={`${slot}-${draft.measure}`}
        className={reducedMotion ? undefined : 'animate-fade-in'}
        objective={objective}
        week={{
          objective_id: objective.id,
          period_unit: 'week',
          period_year: 0,
          period_index: 0,
          target: example.cadence ?? 1,
          done: example.done,
        }}
        progress={{
          objective_id: objective.id,
          value: example.done,
          entries: 3,
          last_entry_date: addDays(today, -3),
        }}
        milestones={sampleMilestones(objective.id, example.milestones, today)}
        // La cadence de l'exemple n'est jamais quotidienne : la carte rend
        // l'anneau, jamais les sept pastilles, et ces deux props restent vides.
        activeDays={new Set()}
        daysOfWeek={[]}
        today={today}
      />
    </div>
  )
}

/**
 * L'objectif que la carte rendra. Les champs dépendants de la mesure suivent la
 * discipline de `toNewObjective` (`src/lib/objectiveDraft.ts`) : un objectif par
 * étapes n'a ni période ni cadence, et en laisser traîner une ferait afficher
 * « Étapes · 3×/semaine » sous le titre.
 */
function previewObjective(
  draft: ObjectiveDraft,
  slot: number,
  slotExample: SlotExample,
  example: Example,
): Objective {
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

    // Les deux seules réponses déjà données que la carte affiche.
    quarter: draft.quarter,
    slot,

    // La carte est celle d'un principal : elle prend sa couleur dans
    // `objectiveSkin(slot)`. L'aperçu n'est donc pas proposé aux secondaires.
    kind: 'principal',
    label: slotExample.label,
    title: slotExample.title,
    why: null,
    description: null,
    measure: draft.measure,
    period_unit: draft.measure === 'jalons' ? null : 'week',
    cadence: example.cadence,
    target_value: example.targetValue,
    unit: example.unit,
    entry_mode: quantity ? 'releve' : null,
    direction: quantity ? 'atteindre' : null,
    closed_at: null,
  }
}

/** La première étape est franchie : une liste toute vide ne montrerait rien. */
function sampleMilestones(objectiveId: string, titles: string[], today: IsoDate): Milestone[] {
  return titles.map((title, i) => ({
    id: `preview-${i}`,
    objective_id: objectiveId,
    year: 0,
    quarter: 1,
    position: i,
    title,
    // Seule la nullité est lue (la carte coche, elle n'affiche pas la date).
    completed_at: i === 0 ? `${addDays(today, -7)}T12:00:00Z` : null,
  }))
}
