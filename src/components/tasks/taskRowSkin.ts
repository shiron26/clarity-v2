// L'habillage commun aux trois variantes de ligne de tâche (dashboard, liste
// desktop, liste mobile) : la couleur d'objectif portée par la ligne, et la
// séquence d'animation du cochage.
//
// Les trois le recopiaient à l'identique — dont le dégradé, écrit trois fois avec
// son alpha en hexadécimal. Le **padding** reste chez l'appelant : c'est la seule
// chose qui diffère réellement entre les trois, et le rentrer ici obligerait à
// paramétrer deux valeurs par variante pour n'en factoriser aucune.
import type { CSSProperties } from 'react'
import { objectiveSkin } from '../../lib/objectivePalette'
import type { DonePhase } from './taskDone'

type TaskRowSkinInput = {
  /** Slot de l'objectif lié, s'il y en a un. */
  objectiveSlot: number | null | undefined
  /** `completed_at` non nul. */
  done: boolean
  donePhase: DonePhase | undefined
  reducedMotion: boolean
}

export type TaskRowSkin = {
  /** Couleur de l'objectif, ou `null` — la case à cocher la reprend. */
  accent: string | null
  /** La ligne porte-t-elle sa couleur ? Une tâche cochée ne la porte plus. */
  linked: boolean
  /** La case doit-elle jouer son éclat ? */
  bursting: boolean
  /** Les classes d'animation du cochage, à composer avec `cn()`. */
  doneClasses: string | false
  /** Bordure gauche teintée + dégradé, ou rien. */
  style: CSSProperties | undefined
}

export function taskRowSkin({
  objectiveSlot,
  done,
  donePhase,
  reducedMotion,
}: TaskRowSkinInput): TaskRowSkin {
  // Une tâche liée à un objectif porte sa couleur : chaque coche fait avancer
  // quelque chose de visible.
  const accent = objectiveSlot != null ? objectiveSkin(objectiveSlot).core : null
  const linked = accent !== null && !done

  return {
    accent,
    linked,
    bursting: donePhase !== undefined && !reducedMotion,
    doneClasses:
      !reducedMotion &&
      (donePhase === 1
        ? 'animate-row-flash'
        : donePhase === 2 && 'animate-row-collapse overflow-hidden'),
    style:
      linked && accent
        ? {
            borderLeftColor: accent,
            backgroundImage: `linear-gradient(90deg,${accent}0d,transparent 60%)`,
          }
        : undefined,
  }
}
