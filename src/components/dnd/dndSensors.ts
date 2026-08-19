// Les capteurs, identiques pour les trois surfaces.
//
// Un seul capteur pointeur : il couvre la souris, le doigt et le stylet. Pas de
// `TouchSensor` avec délai d'appui long, parce que le geste part TOUJOURS d'une
// poignée qui porte `touch-none` : le navigateur ne peut pas défiler depuis ce
// point, il n'y a donc aucun geste à lui disputer, et un délai n'ajouterait que
// de la latence. Le jour où l'on voudra saisir une ligne entière au doigt, il
// faudra au contraire `TouchSensor` + `{ delay, tolerance }`.
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

export function useDndSensors(): SensorDescriptor<SensorOptions>[] {
  return useSensors(
    // Six pixels de course avant activation. Sans contrainte, le geste
    // démarrerait dès `pointerdown` : poser le doigt sur la poignée suffirait à
    // déplacer, et le bouton ne recevrait jamais le focus, ce qui condamnerait
    // le chemin clavier. Au-delà d'une dizaine de pixels, la prise semble molle.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Espace ou Entrée pour saisir, flèches pour déplacer, Espace ou Entrée pour
    // déposer, Échap pour annuler. Rien à écrire de notre côté.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}
