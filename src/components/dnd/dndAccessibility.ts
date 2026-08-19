// Les textes que dnd-kit lit à voix haute. Ses valeurs par défaut sont en
// anglais : sans ce fichier, un déplacement s'annonce « Draggable item was
// moved over droppable area ».
import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core'

export const dndInstructions: ScreenReaderInstructions = {
  draggable:
    'Pour déplacer cet élément, appuyez sur la barre d’espace ou sur Entrée. ' +
    'Utilisez ensuite les flèches pour choisir sa nouvelle position, ' +
    'la barre d’espace ou Entrée pour le déposer, Échap pour annuler.',
}

type AnnouncementContext = {
  labelOf: (id: string) => string
  /**
   * Rang à partir de 1 où l'élément déplacé se poserait maintenant.
   *
   * Le conteneur le calcule dans ses propres gestionnaires et le tient à jour :
   * ni l'ordre affiché ni la cible ne suffisent à le déduire ici, puisque la
   * grille se réagence pendant le geste et pas la liste. Et c'est fiable, car
   * dnd-kit appelle toujours le gestionnaire de props avant les annonces.
   */
  rankOf: () => number
  countOf: () => number
}

export function createAnnouncements({
  labelOf,
  rankOf,
  countOf,
}: AnnouncementContext): Announcements {
  const at = () => `position ${rankOf()} sur ${countOf()}`

  return {
    onDragStart: ({ active }) => `« ${labelOf(String(active.id))} » saisi, ${at()}.`,
    onDragOver: ({ active, over }) => {
      // Hors de toute cible, il n'y a rien de neuf à dire : répéter la dernière
      // position à chaque pixel rendrait l'annonce illisible.
      if (!over || over.id === active.id) return undefined
      return `« ${labelOf(String(active.id))} » déplacé en ${at()}.`
    },
    onDragEnd: ({ active, over }) => {
      const label = labelOf(String(active.id))
      if (!over) return `« ${label} » reposé à sa place.`
      return `« ${label} » déposé en ${at()}.`
    },
    onDragCancel: ({ active }) =>
      `Déplacement annulé, « ${labelOf(String(active.id))} » revient à sa place.`,
  }
}
