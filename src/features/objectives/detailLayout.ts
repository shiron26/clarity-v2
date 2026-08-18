// Quelles bandes l'écran d'un objectif porte-t-il ? Module pur, sans JSX.
//
// Trois axes **orthogonaux**, lus chacun une seule fois :
//
//   `measure`    décide quelles bandes existent ;
//   `kind`       décide si la régularité a un sens, et si l'objectif porte des tâches ;
//   `closed_at`  n'ajoute aucune bande — il en désarme.
//
// Les croiser en descripteur plutôt qu'en cascade de `if` a un effet mesurable :
// le cas « secondaire à jalons » tombe juste sans être écrit nulle part, parce
// qu'il est l'intersection de deux règles indépendantes. C'est le test que la
// décomposition est bonne.
import type { Objective } from '../../hooks/useObjectives'

export type DetailLayout = {
  /** En-tête éteint : pastille et titre en gris. */
  dim: boolean
  /** `progress` = barre + % + projection. `bare` = la valeur seule. */
  hero: 'progress' | 'bare'
  /** `null` = **aucun bloc sombre** : des étapes n'ont pas de rythme. */
  rhythm: 'heatmap' | 'curve' | null
  /** Le chiffre de régularité a-t-il un sens ici ? */
  regularity: boolean
  milestones: boolean
  relatedTasks: boolean
  /** Bouton « Saisir mon relevé » dans le héros. */
  entryAction: boolean
}

export function detailLayout(objective: Objective): DetailLayout {
  const stopped = objective.closed_at !== null
  const secondary = objective.kind === 'secondaire'
  const { measure } = objective

  const rhythm = measure === 'jalons' ? null : measure === 'habitude' ? 'heatmap' : 'curve'

  return {
    dim: stopped,
    hero: stopped ? 'bare' : 'progress',
    rhythm,

    // « Pas de régularité » n'est pas une exception qu'on s'autorise : elle
    // mesure « tenu sur attendu », et rien n'est attendu d'un secondaire (il n'a
    // pas de cadence) ni d'un objectif arrêté.
    regularity: rhythm !== null && !stopped && !secondary,

    // Une quantité n'a pas d'étapes ; l'habitude et les jalons en ont.
    milestones: measure !== 'quantite',

    // Le serveur refuse de rattacher une tâche à autre chose qu'un principal
    // perso (`task_objective_invalid_target`, migration 0006). Et la maquette ne
    // montre la bande que sur un objectif jalonné : ailleurs, le rythme occupe
    // déjà la place et les tâches se lisent sur leur propre écran.
    relatedTasks: measure === 'jalons' && !secondary,

    entryAction: measure === 'quantite' && !stopped,
  }
}
