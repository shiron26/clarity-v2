// La copie du choix « seulement cette fois / toute la série ».
//
// Dans un module à part parce que deux surfaces la portent : la boîte de dialogue
// des lignes (`TaskDeleteDialog`) et le pied de la feuille d'édition, qui ne peut
// pas ouvrir une modale par-dessus la sienne. Recopiée, elle divergerait — et
// c'est exactement le texte qui décide de ce que l'utilisateur perd.
import { parseRecurrence, recurrenceSentence } from '../../lib/recurrence'

export const TASK_DELETE_TITLE = 'Supprimer cette tâche ?'

/** Le cas simple : rien ne se répète, il n'y a rien à choisir. */
export const TASK_DELETE_PERMANENT = 'Définitif, sans corbeille.'

export const TASK_SKIP_LABEL = 'Seulement cette fois'
export const TASK_SKIP_HELP = 'Elle disparaît maintenant et revient à la prochaine échéance.'

export const TASK_SERIES_LABEL = 'Toute la série'
export const TASK_SERIES_HELP = 'Elle disparaît et ne revient plus.'

/**
 * « Cette tâche revient toutes les semaines. » Le rythme est rappelé avant le
 * choix : sans lui, « seulement cette fois » ne dit pas quand est la fois
 * suivante.
 */
export function taskRepeatIntro(recurrence: unknown): string {
  const sentence = recurrenceSentence(parseRecurrence(recurrence))
  return sentence ? `Cette tâche revient ${sentence}.` : ''
}
